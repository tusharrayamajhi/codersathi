import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Message } from '../lib/types'
import clsx from 'clsx'
import { ChevronDown, ChevronRight, Terminal, Wrench, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'

// ── Tool-call card ────────────────────────────────────────────────────────────

function ToolCallCard({ message }: { message: Message }) {
  const [open, setOpen] = useState(false)
  const { tool_name, tool_description, tool_args, tool_result, tool_status } = message

  const statusIcon =
    tool_status === 'running' ? <Loader size={12} className="text-yellow-400 animate-spin" /> :
    tool_status === 'done'    ? <CheckCircle size={12} className="text-green-400" /> :
    <XCircle size={12} className="text-red-400" />

  const hasArgs = tool_args && Object.keys(tool_args).length > 0

  return (
    <div className="flex justify-start my-1 w-full">
      <div className="w-full max-w-[90%] rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden text-xs">
        {/* Header — always visible */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#222] transition-colors text-left"
        >
          <Wrench size={12} className="text-purple-400 shrink-0" />
          <span className="font-mono font-semibold text-purple-300">{tool_name}</span>
          {tool_description && (
            <span className="text-[#666] truncate flex-1">{tool_description}</span>
          )}
          <span className="flex items-center gap-1 shrink-0 ml-auto">
            {statusIcon}
            {tool_status === 'running' && <span className="text-yellow-400/70">running…</span>}
            {tool_status === 'done' && <span className="text-green-400/70">done</span>}
            {open ? <ChevronDown size={11} className="text-[#555]" /> : <ChevronRight size={11} className="text-[#555]" />}
          </span>
        </button>

        {/* Expanded detail */}
        {open && (
          <div className="border-t border-[#2a2a2a]">
            {hasArgs && (
              <div className="px-3 py-2 border-b border-[#2a2a2a]">
                <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Arguments</p>
                <pre className="text-[#aaa] whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(tool_args, null, 2)}
                </pre>
              </div>
            )}
            {tool_result && (
              <div className="px-3 py-2">
                <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Result</p>
                <pre className="text-[#ccc] whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto">
                  {tool_result}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Terminal card ─────────────────────────────────────────────────────────────

function TerminalCard({ message }: { message: Message }) {
  const [open, setOpen] = useState(false)
  const { terminal_command, terminal_output } = message

  const isWait = terminal_command?.startsWith('wait ')

  return (
    <div className="flex justify-start my-1 w-full">
      <div className="w-full max-w-[90%] rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] overflow-hidden text-xs">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#181818] transition-colors text-left"
        >
          {isWait
            ? <Clock size={12} className="text-yellow-400 shrink-0" />
            : <Terminal size={12} className="text-green-400 shrink-0" />
          }
          <span className="font-mono text-green-300 truncate flex-1">$ {terminal_command}</span>
          {open ? <ChevronDown size={11} className="text-[#555]" /> : <ChevronRight size={11} className="text-[#555]" />}
        </button>

        {open && terminal_output && (
          <div className="border-t border-[#2a2a2a] px-3 py-2">
            <pre className="text-[#aaa] whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
              {terminal_output}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main bubble ───────────────────────────────────────────────────────────────

export default function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'tool_call') return <ToolCallCard message={message} />
  if (message.role === 'terminal') return <TerminalCard message={message} />

  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex my-1', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs text-white font-bold shrink-0 mr-2 mt-0.5">
          CS
        </div>
      )}
      <div className={clsx(
        'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser ? 'bg-surface text-white rounded-br-sm' : 'text-[#ececec] rounded-bl-sm'
      )}>
        {message.streaming && !message.content ? (
          <span className="streaming-cursor" />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const isBlock = match || String(children).includes('\n')
                return isBlock ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match?.[1] || 'text'}
                    PreTag="div"
                    className="rounded-lg text-xs my-2"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-surface px-1.5 py-0.5 rounded text-accent text-xs" {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.streaming && message.content && (
          <span className="streaming-cursor" />
        )}
      </div>
    </div>
  )
}
