import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPerson, getEmailForUid } from '@/shared/config/people.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return 'Mot de passe incorrect.'
    case 'auth/user-not-found': return 'Compte introuvable.'
    case 'auth/too-many-requests': return 'Trop de tentatives, réessaie plus tard.'
    case 'auth/network-request-failed': return 'Problème de connexion réseau.'
    default: return 'Connexion impossible, réessaie.'
  }
}

export default function LoginView() {
  useAppTheme('dark', 'indigo')
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

  function selectProfile(uid) { setError(null); setInfo(null); setPassword(''); setSelectedUid(uid) }
  function back() { setSelectedUid(null); setError(null); setInfo(null); setPassword('') }

  async function onSubmit(e) {
    e.preventDefault()
    if (!email) { setError('Email non configuré pour ce profil.'); return }
    setError(null); setInfo(null); setBusy(true)
    try { await loginWithEmail(email, password) }
    catch (err) { setError(mapAuthError(err.code)) }
    finally { setBusy(false) }
  }
  async function onReset() {
    if (!email) { setError('Email non configuré pour ce profil.'); return }
    setError(null)
    try { await resetPassword(email); setInfo('Email de réinitialisation envoyé.') }
    catch (err) { setError(mapAuthError(err.code)) }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[460px] w-[680px] rounded-full bg-accent/10 blur-[130px]" />
      </div>
      <div className="relative w-full max-w-sm fade-in">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-fg">Clément &amp; Lise</h1>
          <p className="text-sm text-muted mt-1.5">Notre espace à deux</p>
        </div>

        {!person ? (
          <div className="slide-up">
            <p className="text-center text-sm text-muted mb-5">Qui es-tu ?</p>
            <div className="grid grid-cols-2 gap-3">
              {AUTHORIZED_UIDS.map((uid) => {
                const p = getPerson(uid)
                return (
                  <button
                    key={uid}
                    onClick={() => selectProfile(uid)}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface border border-border hover:border-border-strong hover:-translate-y-0.5 transition"
                  >
                    <span className={cn('h-16 w-16 rounded-full flex items-center justify-center text-2xl font-semibold border-2', p.bgClass, p.textClass, p.borderClass)}>
                      {p.initial}
                    </span>
                    <span className="text-sm font-medium text-fg">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3 slide-up">
            <button type="button" onClick={back} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition mb-2">
              <ArrowLeft size={14} /> Changer d'utilisateur
            </button>

            <div className="flex items-center gap-3 mb-5">
              <span className={cn('h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold border-2', person.bgClass, person.textClass, person.borderClass)}>
                {person.initial}
              </span>
              <span className="text-sm text-muted">
                Connexion en tant que <span className="text-fg font-medium">{person.label}</span>
              </span>
            </div>

            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                autoComplete="current-password"
                autoFocus
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Connexion…' : 'Se connecter'}</Button>

            {error && <p className="text-xs text-danger text-center">{error}</p>}
            {info && <p className="text-xs text-success text-center">{info}</p>}

            <button type="button" onClick={onReset} className="w-full text-xs text-muted hover:text-fg mt-2 transition">
              Mot de passe oublié ?
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
