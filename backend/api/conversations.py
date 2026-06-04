from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from db.database import get_db
from db.models import Conversation, Message, User
from api.auth import get_current_user
from pydantic import BaseModel
import uuid, os, shutil
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/conversations", tags=["conversations"])
WORKSPACE_BASE = os.getenv("WORKSPACE_BASE", "./workspaces")

async def auth_user(authorization: str = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    return await get_current_user(authorization.split(" ")[1], db)

class CreateConvRequest(BaseModel):
    title: str = "New Chat"

@router.get("")
async def list_conversations(user: User = Depends(auth_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()
    return [{"id": c.id, "title": c.title, "created_at": str(c.created_at), "updated_at": str(c.updated_at)} for c in convs]

@router.post("")
async def create_conversation(req: CreateConvRequest, user: User = Depends(auth_user), db: AsyncSession = Depends(get_db)):
    conv_id = str(uuid.uuid4())
    workspace = os.path.join(WORKSPACE_BASE, str(user.id), conv_id)
    os.makedirs(workspace, exist_ok=True)
    conv = Conversation(id=conv_id, user_id=user.id, title=req.title, workspace_path=os.path.abspath(workspace))
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"id": conv.id, "title": conv.title, "workspace_path": conv.workspace_path, "created_at": str(conv.created_at)}

@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str, user: User = Depends(auth_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await db.execute(select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at))
    return [{"id": m.id, "role": m.role, "content": m.content or "", "created_at": str(m.created_at)} for m in msgs.scalars().all()]

@router.delete("/{conv_id}")
async def delete_conversation(conv_id: str, user: User = Depends(auth_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    # Remove workspace folder
    if conv.workspace_path and os.path.exists(conv.workspace_path):
        shutil.rmtree(conv.workspace_path, ignore_errors=True)
    await db.execute(delete(Conversation).where(Conversation.id == conv_id))
    await db.commit()
    return {"deleted": True}

@router.get("/{conv_id}/files")
async def list_workspace_files(conv_id: str, user: User = Depends(auth_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id))
    conv = result.scalar_one_or_none()
    if not conv or not conv.workspace_path:
        raise HTTPException(status_code=404, detail="Not found")
    files = []
    for root, dirs, filenames in os.walk(conv.workspace_path):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in filenames:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, conv.workspace_path)
            files.append(rel.replace("\\", "/"))
    return {"files": files, "workspace": conv.workspace_path}

@router.get("/{conv_id}/file-content")
async def get_file_content(conv_id: str, path: str, user: User = Depends(auth_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    full_path = os.path.join(conv.workspace_path, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    return {"path": path, "content": content}
