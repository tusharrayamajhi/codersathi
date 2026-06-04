import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  user: { id: number; email: string } | null
  token: string | null
  setAuth: (user: { id: number; email: string }, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'codersathi-auth' }
  )
)
