import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react'

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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[360px] relative">

        {/* Logo mark */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center mb-4 shadow-glow">
            <Sparkles size={22} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-semibold tracking-tight">CoderSathi</h1>
          <p className="text-muted text-sm mt-1.5">Build apps with AI, in real time</p>
        </div>

        {/* Card */}
        <div className="bg-sidebar border border-border rounded-2xl p-6 shadow-sm-dark">

          {/* Tab switcher */}
          <div className="flex bg-surface rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  mode === m ? 'bg-surface-2 text-white shadow-sm-dark' : 'text-muted hover:text-zinc-300'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-muted-2"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-muted-2"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-danger text-xs bg-danger/8 border border-danger/20 px-3 py-2.5 rounded-xl">
                <span className="mt-px">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-all mt-2"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          {mode === 'login' ? "No account?" : 'Already registered?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="text-accent hover:text-accent-hover transition-colors font-medium"
          >
            {mode === 'login' ? 'Sign up free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
