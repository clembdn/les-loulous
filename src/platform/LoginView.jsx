import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPerson, getEmailForUid } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Mot de passe incorrect.'
    case 'auth/user-not-found':
      return 'Compte introuvable.'
    case 'auth/too-many-requests':
      return 'Trop de tentatives, réessaie plus tard.'
    case 'auth/network-request-failed':
      return 'Problème de connexion réseau.'
    default:
      return 'Connexion impossible, réessaie.'
  }
}

export default function LoginView() {
  const { loginWithEmail, resetPassword, isAuthenticated, isAuthorized } = useAuth()
  const [selectedUid, setSelectedUid] = useState(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated && isAuthorized) return <Navigate to="/" replace />

  const person = selectedUid ? getPerson(selectedUid) : null
  const email = selectedUid ? getEmailForUid(selectedUid) : null

  function selectProfile(uid) {
    setError(null); setInfo(null); setPassword('')
    setSelectedUid(uid)
  }
  function back() {
    setSelectedUid(null); setError(null); setInfo(null); setPassword('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!email) { setError('Email non configuré pour ce profil.'); return }
    setError(null); setInfo(null); setBusy(true)
    try {
      await loginWithEmail(email, password)
    } catch (err) {
      setError(mapAuthError(err.code))
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    if (!email) { setError('Email non configuré pour ce profil.'); return }
    setError(null)
    try {
      await resetPassword(email)
      setInfo('Email de réinitialisation envoyé.')
    } catch (err) {
      setError(mapAuthError(err.code))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Clément &amp; Lise</h1>
          <p className="text-sm text-white/40 mt-1">Notre espace à deux</p>
        </div>

        {!person ? (
          <div>
            <p className="text-center text-sm text-white/50 mb-4">Qui es-tu ?</p>
            <div className="grid grid-cols-2 gap-3">
              {AUTHORIZED_UIDS.map((uid) => {
                const p = getPerson(uid)
                return (
                  <button
                    key={uid}
                    onClick={() => selectProfile(uid)}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition"
                  >
                    <span className={cn(
                      'h-16 w-16 rounded-full flex items-center justify-center text-2xl font-semibold border',
                      p.bgClass, p.textClass, p.borderClass,
                    )}>
                      {p.initial}
                    </span>
                    <span className="text-sm font-medium text-white">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2"
            >
              <ArrowLeft size={14} /> Changer d'utilisateur
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold border',
                person.bgClass, person.textClass, person.borderClass,
              )}>
                {person.initial}
              </span>
              <span className="text-sm text-white/70">
                Connexion en tant que <span className="text-white font-medium">{person.label}</span>
              </span>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                autoComplete="current-password"
                autoFocus
                required
                className="w-full px-4 py-3 pr-11 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

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
        )}
      </div>
    </div>
  )
}
