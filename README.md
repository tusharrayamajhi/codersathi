# CoderSathi 🤖

An AI-powered coding assistant that builds complete applications inside isolated workspaces. Chat with an AI agent that can read/write files, run commands, install packages, and scaffold full projects — all visible in real time.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CoderSathi                        │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │   Frontend   │    │        Backend           │  │
│  │  React/Vite  │◄──►│  FastAPI + LangGraph     │  │
│  │  Port 5173   │ WS │  Port 8000               │  │
│  └──────────────┘    └──────────┬───────────────┘  │
│                                 │ stdio MCP         │
│                      ┌──────────▼───────────────┐  │
│                      │   devtoolkit-mcp         │  │
│                      │   Node.js subprocess     │  │
│                      │   20+ developer tools    │  │
│                      └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

| Component | Tech | Port |
|-----------|------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind | 5173 |
| Backend | FastAPI + LangGraph + SQLAlchemy | 8000 |
| Database | PostgreSQL 15 + pgvector | 5432 |
| MCP Server | Node.js (devtoolkit-mcp) | stdio |

---

## Quick Start (Windows — Recommended)

> **Prerequisites:** Python 3.11+, Node.js 18+, PostgreSQL 15 with pgvector

**1. Clone the repo**
```bash
git clone https://github.com/tusharrayamajhi/codersathi
cd codersathi
```

**2. Set up each component** (see detailed guides below)

**3. Double-click `start.bat`** — starts MCP server, backend, and frontend in one click.

```
start.bat opens:
  ├── Terminal 1: MCP Server   (devtoolkit-mcp)
  ├── Terminal 2: Backend      → http://localhost:8000
  └── Terminal 3: Frontend     → http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Detailed Setup Guide

### Step 1 — PostgreSQL + pgvector

CoderSathi uses PostgreSQL for storing users, conversations, messages, and tool history. The **pgvector** extension is required (used for future semantic search features).

#### Install PostgreSQL 15+
Download from https://www.postgresql.org/download/

#### Install pgvector

**Windows:**
1. Download the release matching your PostgreSQL version from https://github.com/pgvector/pgvector/releases
2. Copy `vector.dll` → `C:\Program Files\PostgreSQL\15\lib\`
3. Copy `vector.control` and `vector--*.sql` → `C:\Program Files\PostgreSQL\15\share\extension\`

**macOS:**
```bash
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-15-pgvector
```

#### Create the database
```sql
-- Connect as postgres user
psql -U postgres

-- Run these commands:
CREATE DATABASE codersathi;
\c codersathi
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

---

### Step 2 — MCP Server (devtoolkit-mcp)

The MCP server provides the AI agent with 20+ developer tools: file read/write, shell commands, git, HTTP requests, and code analysis.

**GitHub:** https://github.com/tusharrayamajhi/devtoolkit-mcp

```bash
git clone https://github.com/tusharrayamajhi/devtoolkit-mcp
cd devtoolkit-mcp
npm install
npm run build
```

> The `dist/` folder is pre-built and committed — you can skip `npm run build` and use it directly with `node dist/index.js`.

Note the **absolute path** to `devtoolkit-mcp/dist/index.js` — you need it in the backend `.env`.

---

### Step 3 — Backend

```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install Python dependencies
pip install -r requirements.txt

# Copy environment file and fill in values
cp .env.example .env
```

Edit `.env` — minimum required values:

```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/codersathi
SYNC_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/codersathi
SECRET_KEY=any_long_random_string
GEMINI_API_KEY=your_key_here        # https://aistudio.google.com/app/apikey
GROQ_API_KEY=your_key_here          # https://console.groq.com/keys
MCP_SERVER_PATH=C:/absolute/path/to/devtoolkit-mcp/dist/index.js
DEFAULT_MODEL=gemini-2.5-flash-lite
```

```bash
# Create database tables
python setup_db.py

# Start backend
uvicorn main:app --reload --port 8000
```

Verify at http://localhost:8000/health → `{"status":"ok"}`

---

### Step 4 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

### Step 5 — Update start.bat

Open `start.bat` and update the paths to match your machine:

```bat
:: Set these to your actual paths
start "DevToolkit MCP Server" cmd /k "cd /d C:\path\to\devtoolkit-mcp && node dist/index.js"
start "CoderSathi Backend"    cmd /k "cd /d C:\path\to\codersathi\backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000"
start "CoderSathi Frontend"   cmd /k "cd /d C:\path\to\codersathi\frontend && npm run dev"
```

---

## Get API Keys (Free)

| Provider | Models | Free Tier | Link |
|----------|--------|-----------|------|
| Google Gemini | gemini-2.5-flash-lite, gemini-2.5-flash | 10–15 RPM, 20–500 RPD | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Groq | Llama 3.3 70B, Llama 3.1 8B, Qwen3 32B | 30–60 RPM, 250–14400 RPD | [console.groq.com](https://console.groq.com/keys) |

---

## Manual Start (Without start.bat)

Open 3 separate terminals:

**Terminal 1 — MCP Server**
```bash
cd devtoolkit-mcp
node dist/index.js
```

**Terminal 2 — Backend**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 3 — Frontend**
```bash
cd frontend
npm run dev
```

---

## Database Schema

```
users               — accounts (email + hashed password)
conversations       — chat sessions with isolated workspaces
messages            — user/assistant/tool_call/terminal messages
tool_permissions    — per-user always-allow / always-deny tool rules
```

pgvector (`CREATE EXTENSION vector`) is installed for semantic search on messages (roadmap feature).

---

## Features

- Chat with AI that can write code, run commands, install packages
- Multiple AI models switchable per message (Gemini + Groq)
- File explorer with folder tree — see every file the agent creates
- Monaco code editor — syntax highlighted, real-time file view
- Tool call history — see exactly which tools the AI called and what they returned
- Terminal output inline in chat
- Permission system — approve/deny/always-allow tool calls
- Isolated workspaces per conversation
- JWT authentication

---

## Troubleshooting

**`npm install` hangs forever**
→ This was a known issue (Node exec buffer). Fixed in devtoolkit-mcp v1.0+.

**`parallel_tool_calls` Pydantic error**
→ Fixed — Gemini doesn't support this parameter, it's removed from bind_tools.

**`Cancelled: file not overwritten`**
→ Fixed — elicitation check removed from devtoolkit-mcp dist/index.js.

**PostgreSQL connection refused**
→ Make sure PostgreSQL service is running. Windows: `Services` → `postgresql-x64-15` → Start.

**MCP session failed**
→ Check `MCP_SERVER_PATH` in `.env` points to the compiled `dist/index.js`, not `src/`.
