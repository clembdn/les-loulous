import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginView() {
  const { loginWithEmail, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      await loginWithEmail(email.trim(), password)
    } catch (err) {
      setError(err.message || 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    if (!email.trim()) {
      setError('Renseigne ton email d\'abord')
      return
    }
    setError(null)
    try {
      await resetPassword(email.trim())
      setInfo('Email de réinitialisation envoyé.')
    } catch (err) {
      setError(err.message || 'Envoi impossible')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white">FinAuzi</h1>
          <p className="text-sm text-white/40 mt-1">Notre trésorerie pour l'Australie</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-white text-black font-medium text-sm disabled:opacity-50 transition hover:bg-white/90"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          {info && <p className="text-xs text-emerald-400 text-center">{info}</p>}
          <button
            type="button"
            onClick={onReset}
            className="w-full text-xs text-white/40 hover:text-white/70 mt-2 transition"
          >
            Mot de passe oublié ?
          </button>
        </form>
      </div>
    </div>
  )
}
