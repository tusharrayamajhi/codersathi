const BASE = '/api'

function headers(token?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  register: (email: string, password: string) =>
    req<{ access_token: string; user_id: number; email: string }>('/auth/register', {
      method: 'POST', headers: headers(), body: JSON.stringify({ email, password })
    }),

  login: (email: string, password: string) =>
    req<{ access_token: string; user_id: number; email: string }>('/auth/login', {
      method: 'POST', headers: headers(), body: JSON.stringify({ email, password })
    }),

  listConversations: (token: string) =>
    req<Array<{ id: string; title: string; created_at: string; updated_at: string }>>('/conversations', {
      headers: headers(token)
    }),

  createConversation: (token: string, title = 'New Chat') =>
    req<{ id: string; title: string; workspace_path: string }>('/conversations', {
      method: 'POST', headers: headers(token), body: JSON.stringify({ title })
    }),

  deleteConversation: (token: string, id: string) =>
    req<{ deleted: boolean }>(`/conversations/${id}`, {
      method: 'DELETE', headers: headers(token)
    }),

  getMessages: (token: string, convId: string) =>
    req<Array<{ id: number; role: string; content: string }>>(`/conversations/${convId}/messages`, {
      headers: headers(token)
    }),

  listFiles: (token: string, convId: string) =>
    req<{ files: string[]; workspace: string }>(`/conversations/${convId}/files`, {
      headers: headers(token)
    }),

  getFileContent: (token: string, convId: string, path: string) =>
    req<{ path: string; content: string }>(`/conversations/${convId}/file-content?path=${encodeURIComponent(path)}`, {
      headers: headers(token)
    }),

  getModels: () =>
    req<{ models: Array<{ id: string; label: string; provider: string; rpm: number; rpd: number; stable: boolean; note?: string }>; default: string }>('/models'),
}
