import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { api } from '../lib/api'
import { Conversation, Message, PermissionRequest, WSMessage } from '../lib/types'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import CodePanel from '../components/CodePanel'
import PermissionModal from '../components/PermissionModal'

export default function Dashboard() {
  const { convId } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuthStore()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(convId || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [fileList, setFileList] = useState<string[]>([])
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'code' | 'terminal'>('code')
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [rateLimitInfo, setRateLimitInfo] = useState<{ message: string; hint: string } | null>(null)
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0)
  const [models, setModels] = useState<Array<{ id: string; label: string; provider: string; rpm: number; rpd: number; stable: boolean; note?: string }>>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const wsRef = useRef<WebSocket | null>(null)
  const streamingMsgRef = useRef('')

  // Load conversations list + available models
  useEffect(() => {
    if (token) api.listConversations(token).then(setConversations).catch(console.error)
    api.getModels().then(r => {
      setModels(r.models)
      setSelectedModel(r.default)
    }).catch(console.error)
  }, [token])

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConv && token) {
      api.getMessages(token, activeConv).then(msgs => {
        setMessages(msgs.map(m => {
          const base = { ...m, id: String(m.id) }
          if (m.role === 'tool_call') {
            try {
              const d = JSON.parse(m.content || '{}')
              return { ...base, tool_name: d.tool, tool_description: d.description, tool_args: d.args, tool_result: d.result, tool_status: 'done' as const }
            } catch { return base }
          }
          if (m.role === 'terminal') {
            try {
              const d = JSON.parse(m.content || '{}')
              return { ...base, terminal_command: d.command, terminal_output: d.output }
            } catch { return base }
          }
          return base
        }) as Message[])
      }).catch(console.error)
      api.listFiles(token, activeConv).then(r => setFileList(r.files)).catch(() => {})
    }
  }, [activeConv, token])

  // Navigate URL when conversation changes
  useEffect(() => {
    if (activeConv) navigate(`/c/${activeConv}`, { replace: true })
  }, [activeConv])

  // WebSocket connection
  useEffect(() => {
    if (!activeConv || !token) return
    wsRef.current?.close()

    const ws = new WebSocket(`ws://localhost:8000/ws/${activeConv}`)
    wsRef.current = ws
    streamingMsgRef.current = ''

    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }))

    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data)
      handleWSMessage(msg)
    }

    ws.onerror = () => console.error('WS error')
    ws.onclose = () => console.log('WS closed')

    return () => ws.close()
  }, [activeConv, token])

  function handleWSMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'connected':
        break

      case 'workspace_refresh':
        if (activeConv && token) {
          api.listFiles(token, activeConv).then(r => setFileList(r.files)).catch(() => {})
        }
        break

      case 'agent_start':
        streamingMsgRef.current = ''
        setIsStreaming(true)
        setMessages(prev => [...prev, { id: 'streaming', role: 'assistant', content: '', streaming: true }])
        break

      case 'token':
        streamingMsgRef.current += msg.content
        setMessages(prev => prev.map(m =>
          m.id === 'streaming' ? { ...m, content: streamingMsgRef.current } : m
        ))
        break

      case 'agent_done':
        setIsStreaming(false)
        const finalContent = streamingMsgRef.current
        setMessages(prev => prev.map(m =>
          m.id === 'streaming' ? { ...m, id: Date.now().toString(), streaming: false, content: finalContent } : m
        ))
        streamingMsgRef.current = ''
        // Refresh file list
        if (activeConv && token) {
          api.listFiles(token, activeConv).then(r => setFileList(r.files)).catch(() => {})
        }
        break

      case 'tool_start':
        setMessages(prev => [...prev, {
          id: `tool-${Date.now()}`,
          role: 'tool_call',
          content: '',
          tool_name: msg.tool,
          tool_description: msg.description,
          tool_args: msg.args,
          tool_status: 'running',
        }])
        break

      case 'tool_end':
        // Update the last running tool_call message with result
        setMessages(prev => {
          const idx = [...prev].reverse().findIndex(m => m.role === 'tool_call' && m.tool_status === 'running')
          if (idx === -1) return prev
          const realIdx = prev.length - 1 - idx
          return prev.map((m, i) => i === realIdx
            ? { ...m, tool_result: msg.output, tool_status: 'done' as const }
            : m
          )
        })
        break

      case 'terminal_output':
        setActiveTab('terminal')
        setTerminalLines(prev => [
          ...prev,
          `$ ${msg.command}`,
          ...msg.output.split('\n').filter(Boolean)
        ])
        // Also add as a terminal message in chat
        setMessages(prev => [...prev, {
          id: `term-${Date.now()}`,
          role: 'terminal',
          content: '',
          terminal_command: msg.command,
          terminal_output: msg.output,
        }])
        break

      case 'permission_request':
        setPermissionRequest({ request_id: msg.request_id, tool: msg.tool, description: msg.description, args: msg.args })
        break

      case 'file_changed':
        if (activeConv && token) {
          api.listFiles(token, activeConv).then(r => {
            setFileList(r.files)
            // Auto-open changed file
            const rel = msg.path.replace(msg.workspace, '').replace(/^[\\/]/, '')
            if (rel) loadFile(rel)
          }).catch(() => {})
        }
        break

      case 'rate_limit':
        setIsStreaming(false)
        // Extract countdown seconds from hint if possible
        const secsMatch = msg.hint.match(/(\d+)\s*second/)
        const secs = secsMatch ? parseInt(secsMatch[1]) : 60
        setRateLimitInfo({ message: msg.message, hint: msg.hint })
        setRateLimitCountdown(secs)
        // Auto-countdown
        let remaining = secs
        const timer = setInterval(() => {
          remaining--
          setRateLimitCountdown(remaining)
          if (remaining <= 0) {
            clearInterval(timer)
            setRateLimitInfo(null)
          }
        }, 1000)
        break

      case 'error':
        setIsStreaming(false)
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `❌ ${msg.message}` }])
        break
    }
  }

  async function loadFile(path: string) {
    if (!activeConv || !token) return
    try {
      const r = await api.getFileContent(token, activeConv, path)
      setCurrentFile(path)
      setFileContent(r.content)
      setActiveTab('code')
    } catch (e) { console.error(e) }
  }

  function sendMessage(content: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content }])
    wsRef.current.send(JSON.stringify({ type: 'message', content, model: selectedModel }))
  }

  function handlePermissionResponse(granted: boolean, choice: 'once' | 'always' | 'deny_always') {
    if (!permissionRequest || !wsRef.current) return
    wsRef.current.send(JSON.stringify({
      type: 'permission_response',
      request_id: permissionRequest.request_id,
      tool_name: permissionRequest.tool,
      granted,
      choice
    }))
    setPermissionRequest(null)
  }

  async function createNewChat() {
    if (!token) return
    const conv = await api.createConversation(token)
    setConversations(prev => [{ id: conv.id, title: conv.title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev])
    setActiveConv(conv.id)
    setMessages([])
    setFileList([])
    setCurrentFile(null)
    setFileContent('')
    setTerminalLines([])
  }

  async function deleteConv(id: string) {
    if (!token) return
    await api.deleteConversation(token, id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConv === id) {
      setActiveConv(null)
      setMessages([])
      navigate('/')
    }
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeConv={activeConv}
        onSelect={id => { setActiveConv(id); setMessages([]); setFileList([]); setCurrentFile(null); setTerminalLines([]) }}
        onNew={createNewChat}
        onDelete={deleteConv}
        user={user}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex flex-col w-1/2 border-r border-border">
          {activeConv
            ? <ChatPanel
                messages={messages}
                onSend={sendMessage}
                isStreaming={isStreaming}
                rateLimitInfo={rateLimitInfo}
                rateLimitCountdown={rateLimitCountdown}
                models={models}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            : <EmptyState onCreate={createNewChat} />
          }
        </div>

        {/* Right: Code + Terminal */}
        <div className="flex flex-col w-1/2">
          <CodePanel
            fileList={fileList}
            currentFile={currentFile}
            content={fileContent}
            terminalLines={terminalLines}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onFileSelect={loadFile}
          />
        </div>
      </div>

      {/* Permission Modal */}
      {permissionRequest && (
        <PermissionModal
          request={permissionRequest}
          onAllow={() => handlePermissionResponse(true, 'once')}
          onAllowAlways={() => handlePermissionResponse(true, 'always')}
          onDeny={() => handlePermissionResponse(false, 'once')}
          onDenyAlways={() => handlePermissionResponse(false, 'deny_always')}
        />
      )}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const examples = [
    'Build a React todo app with Tailwind',
    'Create a FastAPI REST API with auth',
    'Make a Next.js landing page',
    'Write a Python web scraper',
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 select-none">
      <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mb-5">
        <span className="text-accent text-sm font-bold">CS</span>
      </div>
      <h2 className="text-white text-lg font-semibold mb-1.5 tracking-tight">What are we building?</h2>
      <p className="text-muted text-sm mb-8 max-w-xs leading-relaxed">
        Describe an app and the AI will write the code, run the commands, and set it up — start to finish.
      </p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-xs mb-8">
        {examples.map(ex => (
          <button
            key={ex}
            onClick={onCreate}
            className="text-left text-xs text-muted-2 bg-surface/40 hover:bg-surface border border-border hover:border-border-2 rounded-xl px-3.5 py-2.5 transition-all hover:text-zinc-300"
          >
            {ex}
          </button>
        ))}
      </div>
      <button
        onClick={onCreate}
        className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-glow"
      >
        New conversation
      </button>
    </div>
  )
}
