import { PermissionRequest } from '../lib/types'
import { Shield, Terminal, FileEdit, Trash2, Globe, Eye } from 'lucide-react'

interface Props {
  request: PermissionRequest
  onAllow: () => void
  onAllowAlways: () => void
  onDeny: () => void
  onDenyAlways: () => void
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  run_command: <Terminal size={18} className="text-warning" />,
  delete_file: <Trash2 size={18} className="text-danger" />,
  write_file: <FileEdit size={18} className="text-accent" />,
  http_request: <Globe size={18} className="text-blue-400" />,
  fetch_json: <Globe size={18} className="text-blue-400" />,
  download_file: <Globe size={18} className="text-blue-400" />,
}

const TOOL_DANGER: Record<string, 'low' | 'medium' | 'high'> = {
  read_file: 'low', list_directory: 'low', git_status: 'low', git_log: 'low',
  git_branches: 'low', detect_language: 'low', get_file_info: 'low',
  write_file: 'medium', git_diff: 'low', search_in_files: 'low',
  analyze_complexity: 'low', find_todos: 'low', count_lines: 'low',
  get_imports: 'low', find_duplicates: 'low',
  http_request: 'medium', fetch_json: 'medium', check_url_status: 'low',
  download_file: 'medium', get_env: 'medium',
  run_command: 'high', delete_file: 'high', get_system_info: 'low',
  list_processes: 'low', get_disk_usage: 'low', get_network_info: 'low',
}

const DANGER_COLORS = {
  low: 'border-border',
  medium: 'border-warning/40',
  high: 'border-danger/40',
}

const DANGER_BADGES = {
  low: <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">Safe</span>,
  medium: <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full">Moderate</span>,
  high: <span className="text-[10px] text-danger bg-danger/10 px-2 py-0.5 rounded-full">Sensitive</span>,
}

export default function PermissionModal({ request, onAllow, onAllowAlways, onDeny, onDenyAlways }: Props) {
  const danger = TOOL_DANGER[request.tool] || 'medium'
  const icon = TOOL_ICONS[request.tool] || <Shield size={18} className="text-muted" />

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-sidebar border ${DANGER_COLORS[danger]} rounded-2xl w-full max-w-md shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-semibold">{request.tool}</p>
              {DANGER_BADGES[danger]}
            </div>
            <p className="text-muted text-xs mt-0.5">CoderSathi wants to run this tool</p>
          </div>
        </div>

        {/* Description */}
        <div className="px-5 py-4">
          <p className="text-white text-sm mb-3">{request.description}</p>

          {/* Args preview */}
          {Object.keys(request.args).length > 0 && (
            <div className="bg-[#0d0d0d] rounded-xl p-3 font-mono text-xs space-y-1">
              {Object.entries(request.args).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted">{k}:</span>
                  <span className="text-accent truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onAllow}
              className="flex-1 bg-accent hover:bg-accent-hover text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Allow once
            </button>
            <button
              onClick={onDeny}
              className="flex-1 bg-surface hover:bg-border text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Deny
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAllowAlways}
              className="flex-1 bg-transparent border border-accent/30 hover:border-accent text-accent rounded-xl py-2 text-xs font-medium transition-colors"
            >
              Always allow
            </button>
            <button
              onClick={onDenyAlways}
              className="flex-1 bg-transparent border border-danger/30 hover:border-danger text-danger rounded-xl py-2 text-xs font-medium transition-colors"
            >
              Always deny
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
