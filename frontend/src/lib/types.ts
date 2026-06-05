export interface User { id: number; email: string }
export interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export interface AIModel { id: string; label: string; provider: string; rpm: number; rpd: number; stable: boolean; note?: string }

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool_call' | 'terminal'
  content: string
  created_at?: string
  streaming?: boolean
  // tool_call extras (populated from WS events or parsed from DB content)
  tool_name?: string
  tool_description?: string
  tool_args?: Record<string, unknown>
  tool_result?: string
  tool_status?: 'running' | 'done' | 'error'
  // terminal extras
  terminal_command?: string
  terminal_output?: string
}

export interface PermissionRequest {
  request_id: string
  tool: string
  description: string
  args: Record<string, unknown>
}

export type WSMessage =
  | { type: 'connected'; conv_id: string; workspace: string }
  | { type: 'token'; content: string }
  | { type: 'agent_start' }
  | { type: 'agent_done' }
  | { type: 'tool_start'; tool: string; description: string; args: Record<string, unknown> }
  | { type: 'tool_end';   tool: string; output: string }
  | { type: 'terminal_output'; command: string; output: string }
  | { type: 'permission_request'; request_id: string; tool: string; description: string; args: Record<string, unknown> }
  | { type: 'permission_auto'; tool: string; description: string; args: Record<string, unknown> }
  | { type: 'file_changed'; path: string; workspace: string }
  | { type: 'workspace_refresh' }
  | { type: 'error'; message: string }
  | { type: 'rate_limit'; message: string; hint: string; raw?: string }
  | { type: 'pong' }
