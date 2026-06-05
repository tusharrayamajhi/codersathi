import { useState, useEffect, useRef } from 'react'
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
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { tool_name, tool_description, tool_args, tool_result, tool_status } = message

  useEffect(() => {
    if (tool_status === 'running') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [tool_status])

  const fmtTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const hasArgs = tool_args && Object.keys(tool_args).length > 0

  return (
    <div className="my-1.5 w-full max-w-[92%]">
      <div className="rounded-xl border border-border bg-surface/40 overflow-hidden text-xs">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-2/60 transition-colors text-left"
        >
          {tool_status === 'running'
            ? <Loader size={11} className="text-warning animate-spin shrink-0" />
            : tool_status === 'done'
            ? <CheckCircle size={11} className="text-success shrink-0" />
            : <XCircle size={11} className="text-danger shrink-0" />
          }
          <Wrench size={10} className="text-muted-2 shrink-0" />
          <span className="font-mono font-medium text-zinc-300">{tool_name}</span>
          {tool_description && (
            <span className="text-muted-2 truncate flex-1 ml-1">{tool_description}</span>
          )}
          <span className="shrink-0 ml-auto flex items-center gap-1.5">
            {tool_status === 'running' && (
              <span className="text-warning/70 font-mono tabular-nums">{fmtTime(elapsed)}</span>
            )}
            {tool_status === 'done' && <span className="text-success/60">done</span>}
            {open
              ? <ChevronDown size={10} className="text-muted-2" />
              : <ChevronRight size={10} className="text-muted-2" />
            }
          </span>
        </button>

        {open && (
          <div className="border-t border-border/60">
            {hasArgs && (
              <div className="px-3 py-2.5 border-b border-border/40">
                <p className="text-[9px] text-muted-2 uppercase tracking-widest mb-1.5 font-semibold">Input</p>
                <pre className="text-zinc-400 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(tool_args, null, 2)}
                </pre>
              </div>
            )}
            {tool_result && (
              <div className="px-3 py-2.5">
                <p className="text-[9px] text-muted-2 uppercase tracking-widest mb-1.5 font-semibold">Output</p>
                <pre className="text-zinc-300 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed max-h-52 overflow-y-auto">
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
    <div className="my-1.5 w-full max-w-[92%]">
      <div className="rounded-xl border border-border bg-[#0a0a0c] overflow-hidden text-xs">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left"
        >
          {isWait
            ? <Clock size={11} className="text-warning shrink-0" />
            : <Terminal size={11} className="text-success shrink-0" />
          }
          <span className="font-mono text-zinc-400 truncate flex-1">
            <span className="text-success/60 mr-1">$</span>
            {terminal_command}
          </span>
          {open
            ? <ChevronDown size={10} className="text-muted-2 shrink-0" />
            : <ChevronRight size={10} className="text-muted-2 shrink-0" />
          }
        </button>

        {open && terminal_output && (
          <div className="border-t border-border/40 px-3 py-2.5">
            <pre className="text-zinc-400 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed max-h-56 overflow-y-auto">
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
    <div className={clsx('flex gap-3 py-1', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-6 h-6 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-[10px] text-accent font-bold shrink-0 mt-1">
          CS
        </div>
      )}

      <div className={clsx(
        'max-w-[82%] text-sm leading-relaxed',
        isUser
          ? 'bg-surface-2 text-zinc-100 rounded-2xl rounded-br-sm px-4 py-2.5'
          : 'text-zinc-300 rounded-2xl rounded-bl-sm'
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
                    className="rounded-lg text-xs my-2 border border-border"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-surface px-1.5 py-0.5 rounded text-accent/90 text-xs font-mono" {...props}>
                    {children}
                  </code>
                )
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0">{children}</p>
              },
              ul({ children }) {
                return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
              },
              ol({ children }) {
                return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
              },
              li({ children }) {
                return <li className="text-zinc-300">{children}</li>
              },
              strong({ children }) {
                return <strong className="text-white font-semibold">{children}</strong>
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.streaming && message.content && <span className="streaming-cursor" />}
      </div>
    </div>
  )
}
