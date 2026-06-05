"""
LangGraph ReAct agent powered by Gemini.
Every tool call goes through the permission system before execution.
"""
import asyncio
import os
import re
from typing import Any, AsyncGenerator, Optional, Type
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
from langchain_core.callbacks import AsyncCallbackManagerForToolRun
from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel, Field, create_model
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
import operator
from dotenv import load_dotenv
from agent.prompts import SYSTEM_PROMPT
from agent.mcp_client import MCPSession, get_tool_description

load_dotenv()

# ── State ─────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    workspace_path: str
    conv_id: str


# ── Build per-tool Pydantic schema from MCP inputSchema ───────────────────────

def _mcp_schema_to_pydantic(tool_name: str, input_schema: dict) -> Type[BaseModel]:
    """
    Converts an MCP tool's JSON Schema inputSchema into a Pydantic model.
    This gives LangGraph the exact field types/names the LLM should use.
    """
    properties = {}
    if hasattr(input_schema, "model_dump"):
        raw = input_schema.model_dump()
    elif isinstance(input_schema, dict):
        raw = input_schema
    else:
        raw = {}

    props    = raw.get("properties", {})
    required = set(raw.get("required", []))

    TYPE_MAP = {
        "string":  str,
        "number":  float,
        "integer": int,
        "boolean": bool,
        "object":  dict,
    }

    fields: dict[str, Any] = {}
    for field_name, field_def in props.items():
        if isinstance(field_def, dict):
            raw_type   = field_def.get("type", "string")
            field_desc = field_def.get("description", "")
            default    = field_def.get("default", ...)

            if raw_type == "array":
                # Gemini requires items — derive item type from "items" sub-schema
                items_schema = field_def.get("items", {})
                if isinstance(items_schema, dict):
                    item_py = TYPE_MAP.get(items_schema.get("type", "string"), str)
                else:
                    item_py = str
                py_type = list[item_py]          # e.g. list[str], list[int]
            else:
                py_type = TYPE_MAP.get(raw_type, str)
        else:
            py_type    = str
            field_desc = ""
            default    = ...

        if field_name not in required:
            # Optional field
            fields[field_name] = (Optional[py_type], Field(default if default != ... else None, description=field_desc))
        else:
            fields[field_name] = (py_type, Field(..., description=field_desc))

    if not fields:
        # Tool takes no args — use empty model
        return create_model(f"{tool_name}Args")

    return create_model(f"{tool_name}Args", **fields)


# ── MCP Tool wrapper ───────────────────────────────────────────────────────────

class MCPToolWrapper(BaseTool):
    name: str
    description: str
    mcp_session: Any
    permission_callback: Any
    ws_send: Any
    args_schema: Type[BaseModel]    # set per-tool from MCP schema
    handle_tool_error: bool = True

    def _run(self, **kwargs: Any) -> str:
        raise NotImplementedError("Use async")

    async def _arun(
        self,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
        **kwargs: Any,
    ) -> str:
        # Strip LangChain internals AND None values (optional fields the LLM set to null)
        # MCP server Zod schemas reject null — omitting the key lets the default apply
        args = {
            k: v for k, v in kwargs.items()
            if k not in ("run_manager", "callbacks") and v is not None
        }

        # 1. Ask user permission
        granted = await self.permission_callback(self.name, args)
        if not granted:
            return f"User denied permission for '{self.name}'. Try a different approach."

        # 2. Execute via MCP
        result = await self.mcp_session.call_tool(self.name, args)

        # 3. Notify frontend (file panel / terminal)
        if self.name in ("write_file", "delete_file") and args.get("file_path"):
            await self.ws_send({
                "type": "file_changed",
                "path": args.get("file_path", ""),
                "workspace": self.mcp_session.workspace_path,
            })
        elif self.name == "run_command":
            await self.ws_send({
                "type": "terminal_output",
                "command": args.get("command", ""),
                "output": result,
            })

        return result


# ── Built-in: Wait tool ────────────────────────────────────────────────────────

class WaitArgs(BaseModel):
    seconds: int = Field(..., description="Seconds to wait (1–300)", ge=1, le=300)
    reason: str  = Field(..., description="Why we are waiting — shown to user")

class WaitTool(BaseTool):
    """Pause execution for N seconds. Use while waiting for slow commands (npm install, builds, etc.)."""
    name: str = "wait"
    description: str = (
        "Pause for a given number of seconds. Use this when a long-running command "
        "(npm install, build, server startup) needs time to finish. After waiting, "
        "use run_command to check the result."
    )
    args_schema: Type[BaseModel] = WaitArgs
    ws_send: Any

    def _run(self, **kwargs: Any) -> str:
        raise NotImplementedError("Use async")

    async def _arun(
        self,
        seconds: int,
        reason: str,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
        **kwargs: Any,
    ) -> str:
        await self.ws_send({
            "type": "terminal_output",
            "command": f"wait {seconds}s",
            "output": f"⏳ Waiting {seconds} seconds — {reason}",
        })
        await asyncio.sleep(seconds)
        return f"Waited {seconds} seconds. {reason} — now check if the process completed."


def build_tools(mcp_session: MCPSession, permission_callback, ws_send) -> list[BaseTool]:
    tools: list[BaseTool] = []
    for t in mcp_session.tools:
        desc   = (t.description or f"MCP tool: {t.name}")[:1000]
        schema = _mcp_schema_to_pydantic(t.name, t.inputSchema if hasattr(t, "inputSchema") else {})
        tools.append(MCPToolWrapper(
            name=t.name,
            description=desc,
            args_schema=schema,
            mcp_session=mcp_session,
            permission_callback=permission_callback,
            ws_send=ws_send,
        ))
    # Built-in tools (not MCP)
    tools.append(WaitTool(ws_send=ws_send))
    return tools


# ── Graph builder ─────────────────────────────────────────────────────────────

AVAILABLE_MODELS = {
    # ── Gemini (Google) ───────────────────────────────────────────────────────
    "gemini-2.5-flash-lite": {
        "label": "Gemini 2.5 Flash Lite", "provider": "gemini",
        "rpm": 10, "rpd": 20, "stable": True,
    },
    "gemini-2.5-flash": {
        "label": "Gemini 2.5 Flash", "provider": "gemini",
        "rpm": 5, "rpd": 20, "stable": True,
    },
    "gemini-3.1-flash-lite": {
        "label": "Gemini 3.1 Flash Lite", "provider": "gemini",
        "rpm": 15, "rpd": 500, "stable": False,
        "note": "Requires thought_signature — may error with tool use",
    },
    "gemini-3-flash": {
        "label": "Gemini 3 Flash", "provider": "gemini",
        "rpm": 5, "rpd": 20, "stable": False,
        "note": "Requires thought_signature — may error with tool use",
    },
    # ── Groq (fast inference — actual free tier limits per docs) ──────────────
    "groq/llama-3.1-8b-instant": {
        "label": "Llama 3.1 8B Instant", "provider": "groq",
        "rpm": 30, "rpd": 14400, "stable": True,
    },
    "groq/llama-3.3-70b-versatile": {
        "label": "Llama 3.3 70B", "provider": "groq",
        "rpm": 30, "rpd": 1000, "stable": True,
    },
    "groq/meta-llama/llama-4-scout-17b-16e-instruct": {
        "label": "Llama 4 Scout 17B", "provider": "groq",
        "rpm": 30, "rpd": 1000, "stable": True,
    },
    "groq/qwen/qwen3-32b": {
        "label": "Qwen3 32B", "provider": "groq",
        "rpm": 60, "rpd": 1000, "stable": True,
    },
    "groq/groq/compound": {
        "label": "Groq Compound", "provider": "groq",
        "rpm": 30, "rpd": 250, "stable": True,
    },
    "groq/groq/compound-mini": {
        "label": "Groq Compound Mini", "provider": "groq",
        "rpm": 30, "rpd": 250, "stable": True,
    },
}

DEFAULT_MODEL = "gemini-2.5-flash-lite"


def _build_llm(model_id: str) -> BaseChatModel:
    """Instantiate the correct LLM based on provider prefix."""
    info = AVAILABLE_MODELS.get(model_id, {})
    provider = info.get("provider", "gemini")

    if provider == "groq":
        # Strip leading "groq/" prefix only — keep rest of path intact
        groq_model = model_id[len("groq/"):]
        return ChatGroq(
            model=groq_model,
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.3,
        )
    else:
        return ChatGoogleGenerativeAI(
            model=model_id,
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.3,
        )


def build_agent_graph(tools: list[BaseTool], workspace_path: str, model: str | None = None):
    selected = model or os.getenv("DEFAULT_MODEL", DEFAULT_MODEL)
    if selected not in AVAILABLE_MODELS:
        print(f"[Agent] WARNING: model '{selected}' not in AVAILABLE_MODELS, falling back to default")
        selected = os.getenv("DEFAULT_MODEL", DEFAULT_MODEL)

    print(f"[Agent] Using model: {selected} (provider: {AVAILABLE_MODELS[selected]['provider']})")

    llm = _build_llm(selected)
    # Gemini does not support parallel_tool_calls param — sequential execution
    # is enforced by sequential_tool_node in the graph instead.
    llm_with_tools = llm.bind_tools(tools)

    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(workspace_path=workspace_path))

    async def agent_node(state: AgentState):
        messages = [system_msg] + list(state["messages"])
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    # Sequential tool execution — even if LLM sends multiple tool calls,
    # we execute them one by one so each completes before the next starts
    tools_by_name = {t.name: t for t in tools}

    async def sequential_tool_node(state: AgentState):
        last = state["messages"][-1]
        if not hasattr(last, "tool_calls") or not last.tool_calls:
            return {"messages": []}

        results = []
        ran_background = None

        for tc in last.tool_calls:
            tool = tools_by_name.get(tc["name"])
            if not tool:
                content = f"Tool '{tc['name']}' not found."
            else:
                try:
                    content = await tool.ainvoke(tc["args"])
                except Exception as e:
                    content = f"Tool error: {e}"

            results.append(
                ToolMessage(content=str(content), tool_call_id=tc["id"], name=tc["name"])
            )

            if tc["name"] == "run_background":
                ran_background = content  # capture result to extract PID

        # After run_background, inject a HumanMessage forcing the AI to poll
        if ran_background is not None:
            results.append(HumanMessage(
                content=(
                    f"The background command has started. "
                    f"You MUST now: 1) call wait(seconds=15), then 2) call check_command_status with the PID from the result above. "
                    f"Keep polling every 15 seconds until running=false. "
                    f"Do NOT write files or declare success until check_command_status confirms the command completed successfully."
                )
            ))

        return {"messages": results}

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", sequential_tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# ── Main streaming runner ─────────────────────────────────────────────────────

async def run_agent_stream(
    user_message: str,
    history: list[dict],
    mcp_session: MCPSession,
    permission_callback,
    ws_send,
    model: str | None = None,
) -> AsyncGenerator[dict, None]:
    """Stream agent responses as dicts suitable for WebSocket sending."""

    tools = build_tools(mcp_session, permission_callback, ws_send)
    graph = build_agent_graph(tools, mcp_session.workspace_path, model)

    # Build message history
    messages = []
    for m in history[-20:]:  # last 20 messages for context
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            messages.append(AIMessage(content=m["content"] or ""))

    messages.append(HumanMessage(content=user_message))

    state = {
        "messages": messages,
        "workspace_path": mcp_session.workspace_path,
        "conv_id": "",
    }

    full_response = ""

    MAX_RETRIES = 2
    for attempt in range(MAX_RETRIES + 1):
        full_response = ""
        failed_gen = False

        try:
            async for event in graph.astream_events(state, version="v2"):
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if chunk.content:
                        full_response += chunk.content
                        yield {"type": "token", "content": chunk.content}

                elif kind == "on_tool_start":
                    tool_name = event["name"]
                    tool_input = event["data"].get("input", {})
                    description = get_tool_description(tool_name, tool_input)
                    yield {"type": "tool_start", "tool": tool_name, "description": description, "args": tool_input}

                elif kind == "on_tool_end":
                    tool_name = event["name"]
                    output = event["data"].get("output", "")
                    yield {"type": "tool_end", "tool": tool_name, "output": str(output)[:500]}

        except Exception as e:
            err_str = str(e).lower()

            # Gemini rate limit
            if any(k in err_str for k in ["429", "resource_exhausted", "rate limit", "quota", "too many requests", "resourceexhausted"]):
                retry_hint = _parse_retry_delay(str(e))
                yield {
                    "type": "rate_limit",
                    "message": "Gemini API rate limit reached.",
                    "hint": retry_hint or "Please wait a moment and try again.",
                    "raw": str(e)[:300],
                }
                return

            # Gemini failed_generation — model couldn't form a valid tool call
            if "failed_generation" in err_str or "failed to call a function" in err_str:
                if attempt < MAX_RETRIES:
                    print(f"[Agent] failed_generation on attempt {attempt + 1}, retrying...")
                    # Inject a recovery hint so the model tries a simpler approach
                    state = {
                        **state,
                        "messages": list(state["messages"]) + [
                            HumanMessage(content=(
                                "Your previous tool call could not be parsed. "
                                "Please respond in plain text first describing what you will do, "
                                "then use ONE tool at a time with only the required arguments."
                            ))
                        ],
                    }
                    failed_gen = True
                    continue  # retry
                else:
                    yield {"type": "error", "message": "The model had trouble generating a tool call after multiple attempts. Please try rephrasing your request."}
                    return

            yield {"type": "error", "message": str(e)}
            return

        if not failed_gen:
            break  # success — exit retry loop

    yield {"type": "done", "full_response": full_response}


def _parse_retry_delay(err: str) -> str:
    """Extract retry delay from Gemini or Groq error messages."""
    # Gemini: "retry_delay { seconds: 30 }"
    m = re.search(r"seconds:\s*(\d+)", err)
    if m:
        return f"Try again in {m.group(1)} seconds."
    # Groq / HTTP header: "retry-after: 2" or "retry_after=5"
    m2 = re.search(r"retry.after[:\s=]+(\d+)", err, re.IGNORECASE)
    if m2:
        return f"Try again in {m2.group(1)} seconds."
    # Groq sometimes says "Please try again in Xs"
    m3 = re.search(r"try again in (\d+\.?\d*)\s*s", err, re.IGNORECASE)
    if m3:
        secs = float(m3.group(1))
        return f"Try again in {int(secs) + 1} seconds."
    return "Please wait 30–60 seconds and try again."
