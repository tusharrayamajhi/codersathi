# CoderSathi — Frontend

React + Vite frontend for the CoderSathi AI coding assistant. Features a split-panel UI with chat, a Monaco code editor, file explorer with folder tree, and real-time terminal output.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Routing | React Router v6 |
| State | Zustand |
| Realtime | WebSockets (native) |
| Markdown | react-markdown + remark-gfm |

---

## Prerequisites

- Node.js 18+
- Backend running at `http://localhost:8000`

---

## Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at **http://localhost:5173**

---

## Build for Production

```bash
npm run build
# Output in dist/
```

---

## Project Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main.tsx              # App entry
│   ├── App.tsx               # Router setup
│   ├── lib/
│   │   ├── api.ts            # API client (REST)
│   │   ├── store.ts          # Zustand auth store
│   │   └── types.ts          # TypeScript interfaces
│   ├── pages/
│   │   ├── Dashboard.tsx     # Main workspace (chat + editor + files)
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   └── components/
│       ├── ChatPanel.tsx     # Chat messages + model selector
│       ├── CodePanel.tsx     # File tree + Monaco editor + terminal
│       ├── MessageBubble.tsx # User / AI / tool-call / terminal messages
│       ├── Sidebar.tsx       # Conversation list
│       └── PermissionModal.tsx
```

---

## Features

- **Split panel** — chat on left, code editor + file tree on right
- **File explorer** — proper folder tree with collapse/expand, color-coded icons per file type
- **Monaco editor** — syntax highlighting for 15+ languages, read-only view of agent-created files
- **Tool call cards** — shows which tool the AI called, arguments, result (collapsible)
- **Terminal cards** — inline terminal output in the chat, expandable
- **Real-time streaming** — token-by-token streaming of AI responses via WebSocket
- **Model selector** — switch between Gemini and Groq models per message
- **Permission system** — approve/deny/always-allow tool calls before execution

---

## Backend Connection

The frontend connects to the backend at `http://localhost:8000` (hardcoded in `src/lib/api.ts`).  
To change the backend URL, update the base URL in `api.ts`.
