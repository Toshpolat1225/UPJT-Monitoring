import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { uz } from '../lib/i18n'
import { IconFuel } from '../components/Icons'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(uz.auth.signInError)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-primary-50 to-accent-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mb-4 shadow-lg shadow-primary-600/30">
            <IconFuel size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{uz.appName}</h1>
          <p className="text-sm text-slate-500 mt-1">{uz.auth.welcome}</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">{uz.auth.signIn}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{uz.form.email}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={uz.auth.emailPlaceholder}
                className="input"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">{uz.form.password}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={uz.auth.passwordPlaceholder}
                className="input"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-error-50 border border-error-200 text-sm text-error-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                uz.auth.signInButton
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
