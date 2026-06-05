import { useState } from 'react'
import { Plus, Trash2, LogOut, MessageSquare, Sparkles } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { Conversation } from '../lib/types'
import clsx from 'clsx'

interface Props {
  conversations: Conversation[]
  activeConv: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  user: { email: string } | null
}

export default function Sidebar({ conversations, activeConv, onSelect, onNew, onDelete, user }: Props) {
  const { logout } = useAuthStore()
  const [hoverId, setHoverId] = useState<string | null>(null)

  const initials = user?.email[0].toUpperCase() ?? '?'

  return (
    <div className="flex flex-col w-60 bg-sidebar border-r border-border h-full shrink-0 sidebar-texture">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-glow shrink-0">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">CoderSathi</span>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 pb-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-2 hover:text-white hover:bg-surface-2 transition-all group"
        >
          <Plus size={15} className="group-hover:text-accent transition-colors" />
          New chat
        </button>
      </div>

      {/* Section label */}
      {conversations.length > 0 && (
        <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-2/60">
          Recent
        </p>
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 space-y-px">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare size={20} className="text-muted-2/40 mb-2" />
            <p className="text-muted text-xs leading-relaxed">No conversations yet.<br />Start one above.</p>
          </div>
        )}
        {conversations.map(c => (
          <div
            key={c.id}
            onMouseEnter={() => setHoverId(c.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onSelect(c.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-all',
              activeConv === c.id
                ? 'bg-surface-2 text-white'
                : 'text-muted hover:bg-surface/60 hover:text-zinc-300'
            )}
          >
            <MessageSquare size={13} className={clsx('shrink-0 transition-colors', activeConv === c.id ? 'text-accent' : 'opacity-40')} />
            <span className="flex-1 text-[13px] truncate leading-snug">{c.title}</span>
            {hoverId === c.id && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all p-0.5 rounded"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="border-t border-border mx-3 pt-3 pb-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[10px] text-accent font-semibold shrink-0">
            {initials}
          </div>
          <span className="flex-1 text-[12px] text-muted truncate">{user?.email}</span>
          <button
            onClick={logout}
            className="text-muted-2 hover:text-danger transition-colors p-1 rounded hover:bg-danger/10"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
