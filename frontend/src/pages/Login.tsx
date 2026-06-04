import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { Code2 } from 'lucide-react'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'login'
        ? await api.login(email, password)
        : await api.register(email, password)
      setAuth({ id: res.user_id, email: res.email }, res.access_token)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mb-4">
            <Code2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">CoderSathi</h1>
          <p className="text-muted text-sm mt-1">Your AI coding companion</p>
        </div>

        {/* Card */}
        <div className="bg-sidebar border border-border rounded-2xl p-6">
          <h2 className="text-white font-medium text-lg mb-6 text-center">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted mb-1.5 block">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-accent transition-colors placeholder:text-muted"
                placeholder="you@example.com" required
              />
            </div>
            <div>
              <label className="text-sm text-muted mb-1.5 block">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-accent transition-colors placeholder:text-muted"
                placeholder="••••••••" required minLength={6}
              />
            </div>

            {error && <p className="text-danger text-sm bg-danger/10 px-3 py-2 rounded-lg">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-4">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="text-accent hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
