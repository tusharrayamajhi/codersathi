# CoderSathi — Backend

FastAPI backend powering the CoderSathi AI coding assistant. Handles auth, conversations, WebSocket streaming, and orchestrates the LangGraph AI agent with MCP tool execution.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn |
| Database | PostgreSQL 15+ with **pgvector** extension |
| ORM | SQLAlchemy (async) + asyncpg |
| AI Agent | LangGraph ReAct agent |
| LLM Providers | Google Gemini, Groq (Llama, Qwen) |
| Tools | MCP (Model Context Protocol) via devtoolkit-mcp |
| Auth | JWT (python-jose) + bcrypt |
| Realtime | WebSockets |

---

## Prerequisites

- Python 3.11+
- PostgreSQL 15+ with **pgvector** extension installed
- Node.js 18+ (for MCP server)
- Gemini API key (free) and/or Groq API key (free)

---

## 1. PostgreSQL + pgvector Setup

### Install PostgreSQL
Download from https://www.postgresql.org/download/

### Install pgvector extension

**Windows** — download the pre-built binary from https://github.com/pgvector/pgvector/releases  
Copy `vector.dll` → `C:\Program Files\PostgreSQL\15\lib\`  
Copy `vector.control` + `vector--*.sql` → `C:\Program Files\PostgreSQL\15\share\extension\`

**macOS:**
```bash
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-15-pgvector
```

### Create the database

```bash
# Connect to postgres
psql -U postgres

# In psql shell:
CREATE DATABASE codersathi;
\c codersathi
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

---

## 2. MCP Server Setup

The backend requires the **devtoolkit-mcp** server running as a subprocess.

```bash
# Clone and build the MCP server
git clone https://github.com/tusharrayamajhi/devtoolkit-mcp
cd devtoolkit-mcp
npm install
npm run build
```

Note the absolute path to `dist/index.js` — you will need it for `.env`.

---

## 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)

# Create database tables
python setup_db.py

# Start the server
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**  
Swagger docs at **http://localhost:8000/docs**

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `SYNC_DATABASE_URL` | ✅ | PostgreSQL sync URL for setup_db.py (`postgresql://...`) |
| `SECRET_KEY` | ✅ | Long random string for JWT signing |
| `GEMINI_API_KEY` | ⚠️ | Required if using Gemini models. Get free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GROQ_API_KEY` | ⚠️ | Required if using Groq models. Get free at [console.groq.com](https://console.groq.com/keys) |
| `DEFAULT_MODEL` | ✅ | Default AI model ID (see `agent/graph.py`) |
| `MCP_SERVER_PATH` | ✅ | Absolute path to `devtoolkit-mcp/dist/index.js` |
| `WORKSPACE_BASE` | ✅ | Directory where agent workspaces are stored |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS (`http://localhost:5173`) |

> At least one of `GEMINI_API_KEY` or `GROQ_API_KEY` must be set.

---

## Available AI Models

| Model ID | Provider | RPM | RPD | Notes |
|----------|----------|-----|-----|-------|
| `gemini-2.5-flash-lite` | Gemini | 10 | 20 | Default, stable |
| `gemini-2.5-flash` | Gemini | 5 | 20 | Stable |
| `groq/llama-3.3-70b-versatile` | Groq | 30 | 1000 | Best quality |
| `groq/llama-3.1-8b-instant` | Groq | 30 | 14400 | Most RPD, small context |
| `groq/qwen/qwen3-32b` | Groq | 60 | 1000 | Best RPM |

---

## Project Structure

```
backend/
├── main.py              # FastAPI app entry point
├── setup_db.py          # One-time DB + table creation
├── requirements.txt
├── .env.example
├── agent/
│   ├── graph.py         # LangGraph ReAct agent + model definitions
│   ├── mcp_client.py    # MCP session manager
│   └── prompts.py       # System prompt
├── api/
│   ├── auth.py          # Register/login endpoints
│   ├── conversations.py # Conversation + file endpoints
│   └── ws.py            # WebSocket handler (main agent loop)
└── db/
    ├── database.py      # SQLAlchemy async engine
    └── models.py        # ORM models
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| DELETE | `/api/conversations/{id}` | Delete conversation |
| GET | `/api/conversations/{id}/messages` | Get message history |
| GET | `/api/conversations/{id}/files` | List workspace files |
| GET | `/api/conversations/{id}/file-content` | Read a file |
| WS | `/ws/{conv_id}` | WebSocket — send messages, stream agent responses |
| GET | `/api/models` | List available AI models |
