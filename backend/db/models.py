from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete")
    permissions = relationship("ToolPermission", back_populates="user", cascade="all, delete")

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="New Chat")
    workspace_path = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text)
    tool_calls = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    conversation = relationship("Conversation", back_populates="messages")

class ToolPermission(Base):
    __tablename__ = "tool_permissions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tool_name = Column(String(100), nullable=False)
    permission = Column(String(20), default="ask")  # ask | always | deny
    user = relationship("User", back_populates="permissions")
