"""
Manages MCP client sessions per conversation.
Each conversation gets its own MCP subprocess connection.
"""
import asyncio
import os
from typing import Any, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from dotenv import load_dotenv

load_dotenv()

MCP_SERVER_PATH = os.getenv("MCP_SERVER_PATH", "D:/mcp/devtoolkit-mcp/dist/index.js")

TOOL_DESCRIPTIONS = {
    "read_file":        lambda a: f"Read file: {a.get('file_path', '')}",
    "write_file":       lambda a: f"Write to: {a.get('file_path', '')}",
    "list_directory":   lambda a: f"List directory: {a.get('dir_path', '')}",
    "search_in_files":  lambda a: f"Search '{a.get('pattern', '')}' in files",
    "get_file_info":    lambda a: f"Get info for: {a.get('file_path', '')}",
    "delete_file":      lambda a: f"DELETE file: {a.get('file_path', '')}",
    "git_status":       lambda a: f"Git status in: {a.get('repo_path', '.')}",
    "git_log":          lambda a: f"Git log ({a.get('max_commits', 20)} commits)",
    "git_diff":         lambda a: "Git diff",
    "git_blame":        lambda a: f"Git blame: {a.get('file_path', '')}",
    "git_branches":     lambda a: "List git branches",
    "git_show_commit":  lambda a: f"Show commit: {a.get('commit_hash', '')}",
    "analyze_complexity": lambda a: f"Analyze complexity: {a.get('file_path', '')}",
    "find_todos":       lambda a: f"Find TODOs in: {a.get('dir_path', '.')}",
    "count_lines":      lambda a: f"Count lines in: {a.get('target', '')}",
    "detect_language":  lambda a: f"Detect language: {a.get('file_path', '')}",
    "find_duplicates":  lambda a: f"Find duplicate code",
    "get_imports":      lambda a: f"Get imports from: {a.get('file_path', '')}",
    "http_request":     lambda a: f"HTTP {a.get('method','GET')}: {a.get('url', '')}",
    "fetch_json":       lambda a: f"Fetch JSON from: {a.get('url', '')}",
    "check_url_status": lambda a: f"Check URLs: {', '.join(a.get('urls', [])[:2])}",
    "download_file":    lambda a: f"Download: {a.get('url', '')}",
    "get_system_info":  lambda a: "Get system information",
    "get_env":          lambda a: f"Read env vars",
    "run_command":      lambda a: f"Run: {a.get('command', '')}",
    "list_processes":   lambda a: "List running processes",
    "get_disk_usage":   lambda a: f"Disk usage: {a.get('path', '.')}",
    "get_network_info": lambda a: "Get network info",
}

def get_tool_description(tool_name: str, args: dict) -> str:
    fn = TOOL_DESCRIPTIONS.get(tool_name)
    if fn:
        try:
            return fn(args)
        except Exception:
            pass
    return f"Call: {tool_name}"


class MCPSession:
    """Wraps an MCP client session for a single conversation."""

    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self._session: Optional[ClientSession] = None
        self._stdio_cm = None   # single context manager from stdio_client()
        self._tools: list = []

    async def start(self):
        params = StdioServerParameters(
            command="node",
            args=[MCP_SERVER_PATH],
        )
        # stdio_client() returns ONE async context manager that yields (read, write)
        self._stdio_cm = stdio_client(params)
        read, write = await self._stdio_cm.__aenter__()

        self._session = ClientSession(read, write)
        await self._session.__aenter__()
        await self._session.initialize()

        tools_result = await self._session.list_tools()
        self._tools = tools_result.tools
        print(f"[MCP] Session started — {len(self._tools)} tools loaded")
        return self

    async def stop(self):
        if self._session:
            try:
                await self._session.__aexit__(None, None, None)
            except Exception:
                pass
            self._session = None

        if self._stdio_cm:
            try:
                await self._stdio_cm.__aexit__(None, None, None)
            except Exception:
                pass
            self._stdio_cm = None

        print("[MCP] Session stopped")

    async def call_tool(self, name: str, arguments: dict) -> str:
        if not self._session:
            return "Error: MCP session not active"
        try:
            # Strip None/null values — MCP Zod schemas reject null, only accept undefined
            clean_args = {k: v for k, v in arguments.items() if v is not None}
            result = await self._session.call_tool(name, clean_args)
            if result.content:
                first = result.content[0]
                return first.text if hasattr(first, "text") else str(first)
            return "Tool executed (no output)"
        except Exception as e:
            return f"Tool error: {e}"

    @property
    def tools(self):
        return self._tools


# ── Global session registry ───────────────────────────────────────────────────

_sessions: dict[str, MCPSession] = {}
_locks: dict[str, asyncio.Lock] = {}


async def get_session(conv_id: str, workspace_path: str) -> MCPSession:
    if conv_id not in _locks:
        _locks[conv_id] = asyncio.Lock()
    async with _locks[conv_id]:
        if conv_id not in _sessions:
            session = MCPSession(workspace_path)
            await session.start()
            _sessions[conv_id] = session
        return _sessions[conv_id]


async def close_session(conv_id: str):
    if conv_id in _sessions:
        await _sessions[conv_id].stop()
        del _sessions[conv_id]
    _locks.pop(conv_id, None)
