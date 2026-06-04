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

  // Close model menu on outside click
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
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted text-sm">Send a message to start coding</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Rate limit banner */}
      {rateLimitInfo && (
        <div className="mx-4 mb-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-warning text-sm font-medium">{rateLimitInfo.message}</p>
            <p className="text-warning/70 text-xs mt-0.5">{rateLimitInfo.hint}</p>
          </div>
          {rateLimitCountdown != null && rateLimitCountdown > 0 && (
            <div className="flex items-center gap-1 shrink-0 text-warning/70 text-xs font-mono">
              <Clock size={12} />
              <span>{rateLimitCountdown}s</span>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pb-4">
        <div className="bg-surface border border-border rounded-2xl focus-within:border-accent/50 transition-colors">
          {/* Model selector bar */}
          {models.length > 0 && (
            <div className="flex items-center px-4 pt-2.5 pb-1 border-b border-border/50 relative" ref={menuRef}>
              <button
                onClick={() => setShowModelMenu(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
              >
                {activeModel?.provider === 'groq'
                  ? <span className="text-orange-400 text-[10px]">🟠</span>
                  : <Zap size={11} className="text-accent" />
                }
                <span className="font-medium">{activeModel?.label || selectedModel || 'Select model'}</span>
                {activeModel && (
                  <span className="text-muted/60">
                    · {activeModel.rpm} RPM · {activeModel.rpd >= 1000 ? `${(activeModel.rpd/1000).toFixed(1)}k` : activeModel.rpd} RPD
                  </span>
                )}
                <ChevronDown size={11} className={clsx('transition-transform', showModelMenu && 'rotate-180')} />
              </button>

              {/* Dropdown */}
              {showModelMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-sidebar border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs text-muted font-medium">Select Gemini Model</p>
                  </div>
                  {/* Group by provider */}
                  {(['gemini', 'groq'] as const).map(provider => {
                    const group = models.filter(m => m.provider === provider)
                    if (!group.length) return null
                    const providerLabel = provider === 'gemini' ? '🔵 Google Gemini' : '🟠 Groq'
                    return (
                      <div key={provider}>
                        <div className="px-3 py-1.5 border-t border-border first:border-t-0">
                          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">{providerLabel}</p>
                        </div>
                        {group.map(m => (
                          <button key={m.id} onClick={() => { onModelChange?.(m.id); setShowModelMenu(false) }}
                            className={clsx('w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface/80 transition-colors', m.id === selectedModel && 'bg-surface')}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={clsx('text-sm font-medium truncate', m.id === selectedModel ? 'text-accent' : !m.stable ? 'text-white/60' : 'text-white')}>
                                  {m.label}
                                </p>
                                {!m.stable && <span className="text-[9px] text-warning bg-warning/10 px-1 py-0.5 rounded shrink-0">⚠ exp</span>}
                              </div>
                              {m.note && <p className="text-[10px] text-muted/60 mt-0.5 truncate">{m.note}</p>}
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-[10px] text-muted">{m.rpm} RPM</p>
                              <p className={clsx('text-[10px] font-medium', m.rpd >= 1000 ? 'text-accent' : 'text-muted')}>{m.rpd >= 1000 ? `${(m.rpd/1000).toFixed(1)}k` : m.rpd} RPD</p>
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

          {/* Textarea + send button */}
          <div className="flex items-end gap-2 px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Message CoderSathi..."
              rows={1}
              className="flex-1 bg-transparent text-white text-sm outline-none resize-none placeholder:text-muted leading-relaxed"
              style={{ maxHeight: 200 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isBlocked}
              className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                input.trim() && !isBlocked
                  ? 'bg-accent hover:bg-accent-hover text-white'
                  : 'bg-border text-muted cursor-not-allowed'
              )}
            >
              {isStreaming ? <Square size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-2">
          CoderSathi can make mistakes. Review tool calls before approving.
        </p>
      </div>
    </div>
  )
}
