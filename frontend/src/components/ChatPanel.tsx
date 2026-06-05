import { useEffect, useRef, useState } from 'react'
import { Send, Square, AlertTriangle, Clock, ChevronDown, Zap } from 'lucide-react'
import { Message } from '../lib/types'
import MessageBubble from './MessageBubble'
import clsx from 'clsx'

interface Model { id: string; label: string; provider: string; rpm: number; rpd: number; stable: boolean; note?: string }

interface Props {
  messages: Message[]
  onSend: (content: string) => void
  isStreaming: boolean
  rateLimitInfo?: { message: string; hint: string } | null
  rateLimitCountdown?: number
  models?: Model[]
  selectedModel?: string
  onModelChange?: (id: string) => void
}

export default function ChatPanel({
  messages, onSend, isStreaming,
  rateLimitInfo, rateLimitCountdown,
  models = [], selectedModel = '', onModelChange,
}: Props) {
  const [input, setInput] = useState('')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isBlocked = isStreaming || (!!rateLimitInfo && (rateLimitCountdown ?? 0) > 0)
  const activeModel = models.find(m => m.id === selectedModel)

  function handleSend() {
    const text = input.trim()
    if (!text || isBlocked) return
    setInput('')
    onSend(text)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }

  return (
    <div className="flex flex-col h-full bg-bg">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center select-none">
            <p className="text-muted-2 text-sm">Ask anything to get started</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Rate limit */}
      {rateLimitInfo && (
        <div className="mx-4 mb-3 bg-warning/8 border border-warning/25 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-warning text-xs font-medium">{rateLimitInfo.message}</p>
            <p className="text-warning/60 text-xs mt-0.5">{rateLimitInfo.hint}</p>
          </div>
          {rateLimitCountdown != null && rateLimitCountdown > 0 && (
            <div className="flex items-center gap-1 shrink-0 text-warning/60 text-xs font-mono">
              <Clock size={11} />
              <span>{rateLimitCountdown}s</span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="bg-surface border border-border rounded-2xl transition-all focus-within:border-border-2 focus-within:shadow-glow/50">

          {/* Model selector */}
          {models.length > 0 && (
            <div className="flex items-center px-4 pt-3 pb-2" ref={menuRef}>
              <button
                onClick={() => setShowModelMenu(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-zinc-300 transition-colors relative"
              >
                {activeModel?.provider === 'groq'
                  ? <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                  : <Zap size={10} className="text-accent" />
                }
                <span className="font-medium">{activeModel?.label ?? selectedModel}</span>
                <span className="text-muted-2">·</span>
                <span className="text-muted-2">{activeModel?.rpm}rpm</span>
                <ChevronDown size={10} className={clsx('text-muted-2 transition-transform', showModelMenu && 'rotate-180')} />
              </button>

              {showModelMenu && (
                <div className="absolute bottom-[calc(100%+8px)] left-4 w-72 bg-sidebar border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                  {(['gemini', 'groq'] as const).map(provider => {
                    const group = models.filter(m => m.provider === provider)
                    if (!group.length) return null
                    return (
                      <div key={provider}>
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-[10px] text-muted-2 uppercase tracking-widest font-semibold">
                            {provider === 'gemini' ? 'Google Gemini' : 'Groq'}
                          </p>
                        </div>
                        {group.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { onModelChange?.(m.id); setShowModelMenu(false) }}
                            className={clsx(
                              'w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface/80 transition-colors',
                              m.id === selectedModel && 'bg-surface'
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={clsx('text-sm font-medium truncate', m.id === selectedModel ? 'text-accent' : !m.stable ? 'text-white/50' : 'text-white/90')}>
                                  {m.label}
                                </p>
                                {!m.stable && <span className="text-[9px] text-warning/80 bg-warning/10 px-1.5 py-0.5 rounded-md shrink-0">exp</span>}
                              </div>
                              {m.note && <p className="text-[10px] text-muted-2 mt-0.5 truncate">{m.note}</p>}
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-[10px] text-muted-2">{m.rpm} rpm</p>
                              <p className={clsx('text-[10px] font-medium', m.rpd >= 1000 ? 'text-accent/80' : 'text-muted-2')}>
                                {m.rpd >= 1000 ? `${(m.rpd / 1000).toFixed(1)}k` : m.rpd} rpd
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Textarea + send */}
          <div className="flex items-end gap-3 px-4 pb-3 pt-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask CoderSathi to build something..."
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-white outline-none resize-none placeholder:text-muted-2/70 leading-relaxed"
              style={{ maxHeight: 180 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isBlocked}
              className={clsx(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all',
                input.trim() && !isBlocked
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-glow'
                  : 'bg-surface-2 text-muted-2 cursor-not-allowed'
              )}
            >
              {isStreaming ? <Square size={13} /> : <Send size={13} />}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-2/50 mt-2">
          Review tool calls before approving. CoderSathi can make mistakes.
        </p>
      </div>
    </div>
  )
}
