import { useState } from 'react'
import { Plus, Trash2, Code2, LogOut, MessageSquare } from 'lucide-react'
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

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-border h-full shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <Code2 size={16} className="text-white" />
        </div>
        <span className="text-white font-semibold text-base">CoderSathi</span>
      </div>

      {/* New Chat */}
      <div className="px-3 py-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted hover:bg-surface hover:text-white transition-colors"
        >
          <Plus size={16} />
          New conversation
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-muted text-xs text-center py-8">No conversations yet</p>
        )}
        {conversations.map(c => (
          <div
            key={c.id}
            onMouseEnter={() => setHoverId(c.id)}
            onMouseLeave={() => setHoverId(null)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer group transition-colors',
              activeConv === c.id ? 'bg-surface text-white' : 'text-muted hover:bg-surface/50 hover:text-white'
            )}
            onClick={() => onSelect(c.id)}
          >
            <MessageSquare size={14} className="shrink-0 opacity-60" />
            <span className="flex-1 text-sm truncate">{c.title}</span>
            {hoverId === c.id && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(c.id) }}
                className="text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 px-2">
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-medium">
            {user?.email[0].toUpperCase()}
          </div>
          <span className="flex-1 text-xs text-muted truncate">{user?.email}</span>
          <button onClick={logout} className="text-muted hover:text-danger transition-colors" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
