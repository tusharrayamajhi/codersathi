"""
WebSocket endpoint.
KEY FIX: A background receiver() task continuously reads incoming WS messages.
Permission responses are resolved immediately (no queue delay).
Other messages go into msg_queue for the main loop.
This lets the agent run AND receive permission responses at the same time.
"""
import asyncio
import json
import os
import traceback
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from jose import JWTError, jwt
from db.database import AsyncSessionLocal
from db.models import Conversation, Message, User, ToolPermission
from agent.mcp_client import get_session, close_session, get_tool_description
from agent.graph import run_agent_stream
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")


# ── Permission manager ────────────────────────────────────────────────────────

class PermissionManager:
    def __init__(self, ws: WebSocket, always_allow: set, always_deny: set):
        self.ws           = ws
        self.always_allow = always_allow
        self.always_deny  = always_deny
        self._pending: dict[str, asyncio.Event] = {}
        self._results: dict[str, bool]          = {}
        self._choices: dict[str, str]           = {}
        self._counter = 0

    async def ask(self, tool_name: str, args: dict) -> bool:
        if tool_name in self.always_deny:
            return False

        if tool_name in self.always_allow:
            try:
                await self.ws.send_json({
                    "type": "permission_auto",
                    "tool": tool_name,
                    "description": get_tool_description(tool_name, args),
                    "args": args,
                })
            except Exception:
                pass
            return True

        # Ask the user
        self._counter += 1
        request_id = f"perm_{self._counter}"
        event = asyncio.Event()
        self._pending[request_id] = event

        try:
            await self.ws.send_json({
                "type": "permission_request",
                "request_id": request_id,
                "tool": tool_name,
                "description": get_tool_description(tool_name, args),
                "args": args,
            })
        except Exception:
            self._pending.pop(request_id, None)
            return False

        try:
            await asyncio.wait_for(event.wait(), timeout=120.0)
            granted = self._results.get(request_id, False)
            choice  = self._choices.get(request_id, "once")
            if choice == "always":
                self.always_allow.add(tool_name)
            elif choice == "deny_always":
                self.always_deny.add(tool_name)
            return granted
        except asyncio.TimeoutError:
            print(f"[WS] Permission timeout for {tool_name}")
            return False
        finally:
            self._pending.pop(request_id, None)

    def resolve(self, request_id: str, granted: bool, choice: str = "once"):
        """Called by the receiver task immediately when a permission_response arrives."""
        self._results[request_id] = granted
        self._choices[request_id] = choice
        ev = self._pending.get(request_id)
        if ev:
            ev.set()


# ── WebSocket handler ─────────────────────────────────────────────────────────

@router.websocket("/ws/{conv_id}")
async def websocket_endpoint(websocket: WebSocket, conv_id: str):
    await websocket.accept()

    # ── Auth ──────────────────────────────────────────────────────────────────
    try:
        auth_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        token    = auth_msg.get("token", "")
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id  = int(payload.get("sub"))
    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"Auth failed: {e}"})
        await websocket.close(code=1008)
        return

    # ── Load conversation + saved permissions ─────────────────────────────────
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user_id)
            )
            conv = result.scalar_one_or_none()
            if not conv:
                await websocket.send_json({"type": "error", "message": "Conversation not found"})
                await websocket.close(code=1008)
                return
            perms = (await db.execute(select(ToolPermission).where(ToolPermission.user_id == user_id))).scalars().all()
            always_allow   = {p.tool_name for p in perms if p.permission == "always"}
            always_deny    = {p.tool_name for p in perms if p.permission == "deny"}
            workspace_path = conv.workspace_path
    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"DB error: {e}"})
        await websocket.close(code=1011)
        return

    # ── Start MCP session ─────────────────────────────────────────────────────
    try:
        mcp_session = await get_session(conv_id, workspace_path)
    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"MCP failed: {e}"})
        await websocket.close(code=1011)
        return

    perm_manager = PermissionManager(websocket, always_allow, always_deny)
    msg_queue: asyncio.Queue = asyncio.Queue()

    # ── Background DB helper ──────────────────────────────────────────────────
    async def save_tool_permission(tool_name: str, choice: str):
        perm_value = "always" if choice == "always" else "deny"
        try:
            async with AsyncSessionLocal() as db:
                existing = (await db.execute(
                    select(ToolPermission).where(
                        ToolPermission.user_id == user_id,
                        ToolPermission.tool_name == tool_name,
                    )
                )).scalar_one_or_none()
                if existing:
                    existing.permission = perm_value
                else:
                    db.add(ToolPermission(user_id=user_id, tool_name=tool_name, permission=perm_value))
                await db.commit()
        except Exception as ex:
            print(f"[WS] permission save error: {ex}")

    # ── Background receiver task ──────────────────────────────────────────────
    # This runs concurrently with the agent so permission responses are
    # processed immediately, not blocked waiting for the main loop.
    async def receiver():
        try:
            while True:
                data  = await websocket.receive_json()
                mtype = data.get("type", "")

                if mtype == "permission_response":
                    # Resolve immediately — unblocks the waiting tool
                    request_id = data.get("request_id", "")
                    granted    = data.get("granted", False)
                    choice     = data.get("choice", "once")
                    tool_name  = data.get("tool_name", "")
                    perm_manager.resolve(request_id, granted, choice)
                    if choice in ("always", "deny_always") and tool_name:
                        asyncio.create_task(save_tool_permission(tool_name, choice))

                elif mtype == "ping":
                    try:
                        await websocket.send_json({"type": "pong"})
                    except Exception:
                        pass

                else:
                    # User chat messages and other events go to main loop
                    await msg_queue.put(data)

        except WebSocketDisconnect:
            print(f"[WS] Client disconnected: {conv_id}")
        except Exception as e:
            print(f"[WS] Receiver error: {e}")
        finally:
            await msg_queue.put(None)   # sentinel → stop main loop

    recv_task = asyncio.create_task(receiver())

    # ── Helpers ───────────────────────────────────────────────────────────────
    async def ws_send(msg: dict):
        try:
            await websocket.send_json(msg)
        except Exception:
            pass

    async def permission_callback(tool_name: str, args: dict) -> bool:
        return await perm_manager.ask(tool_name, args)

    try:
        await websocket.send_json({"type": "connected", "conv_id": conv_id, "workspace": workspace_path})
    except Exception:
        recv_task.cancel()
        return

    # ── Main loop ─────────────────────────────────────────────────────────────
    try:
        while True:
            data = await msg_queue.get()
            if data is None:
                break                           # sentinel from receiver

            msg_type = data.get("type", "")

            # ── Chat message ──────────────────────────────────────────────────
            if msg_type == "message":
                user_text      = data.get("content", "").strip()
                selected_model = data.get("model", None)
                if not user_text:
                    continue

                # Save user message + auto-title
                try:
                    async with AsyncSessionLocal() as db:
                        db.add(Message(conversation_id=conv_id, role="user", content=user_text))
                        count = (await db.execute(
                            select(Message).where(Message.conversation_id == conv_id)
                        )).scalars().all()
                        if len(count) <= 1:
                            await db.execute(
                                Conversation.__table__.update()
                                .where(Conversation.id == conv_id)
                                .values(title=user_text[:60])
                            )
                        await db.commit()
                except Exception as e:
                    print(f"[WS] msg save error: {e}")

                # Load history
                history = []
                try:
                    async with AsyncSessionLocal() as db:
                        rows = (await db.execute(
                            select(Message)
                            .where(Message.conversation_id == conv_id)
                            .order_by(Message.created_at)
                        )).scalars().all()
                        history = [{"role": m.role, "content": m.content or ""} for m in rows]
                except Exception as e:
                    print(f"[WS] history error: {e}")

                await ws_send({"type": "agent_start"})
                full_response = ""
                # Track the in-flight tool call so we can pair start+end for DB save
                pending_tool: dict = {}

                try:
                    async for chunk in run_agent_stream(
                        user_text,
                        history[:-1],
                        mcp_session,
                        permission_callback,
                        ws_send,
                        model=selected_model,
                    ):
                        ctype = chunk.get("type")

                        if ctype == "done":
                            full_response = chunk.get("full_response", "")

                        elif ctype == "tool_start":
                            pending_tool = chunk          # save args/description
                            await ws_send(chunk)

                        elif ctype == "tool_end":
                            await ws_send(chunk)
                            # Persist tool event to DB
                            tool_record = {
                                "tool":        chunk.get("tool", pending_tool.get("tool", "")),
                                "description": pending_tool.get("description", ""),
                                "args":        pending_tool.get("args", {}),
                                "result":      chunk.get("output", ""),
                            }
                            try:
                                async with AsyncSessionLocal() as db:
                                    db.add(Message(
                                        conversation_id=conv_id,
                                        role="tool_call",
                                        content=json.dumps(tool_record),
                                    ))
                                    await db.commit()
                            except Exception as ex:
                                print(f"[WS] tool_call save error: {ex}")
                            pending_tool = {}

                        elif ctype == "terminal_output":
                            await ws_send(chunk)
                            # Persist terminal output too
                            try:
                                async with AsyncSessionLocal() as db:
                                    db.add(Message(
                                        conversation_id=conv_id,
                                        role="terminal",
                                        content=json.dumps({
                                            "command": chunk.get("command", ""),
                                            "output":  chunk.get("output", ""),
                                        }),
                                    ))
                                    await db.commit()
                            except Exception as ex:
                                print(f"[WS] terminal save error: {ex}")

                        elif ctype == "rate_limit":
                            await ws_send(chunk)
                            full_response = chunk.get("hint", "Rate limited.")

                        else:
                            await ws_send(chunk)

                except Exception as e:
                    print(f"[WS] agent error:\n{traceback.format_exc()}")
                    err_str = str(e).lower()
                    if any(k in err_str for k in ["429", "resource_exhausted", "quota", "rate"]):
                        await ws_send({
                            "type": "rate_limit",
                            "message": "Gemini API rate limit reached.",
                            "hint": "Please wait 30–60 seconds and try again.",
                        })
                        full_response = "Rate limited."
                    else:
                        await ws_send({"type": "error", "message": str(e)})
                        full_response = f"Error: {e}"

                # Save assistant response
                if full_response:
                    try:
                        async with AsyncSessionLocal() as db:
                            db.add(Message(conversation_id=conv_id, role="assistant", content=full_response))
                            await db.commit()
                    except Exception as e:
                        print(f"[WS] response save error: {e}")

                await ws_send({"type": "agent_done"})

    except Exception as e:
        print(f"[WS] Main loop error:\n{traceback.format_exc()}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        recv_task.cancel()
        try:
            await recv_task
        except asyncio.CancelledError:
            pass
        await close_session(conv_id)
        print(f"[WS] Session closed: {conv_id}")
