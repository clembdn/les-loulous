import { useState } from 'react'
import { Plane, Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginView() {
  const { loginWithEmail, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.')
      return
    }

    setLoading(true)
    try {
      await loginWithEmail(email, password)
    } catch (err) {
      const code = err.code || ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Email ou mot de passe incorrect.')
      } else if (code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Réessayez plus tard.')
      } else {
        setError('Une erreur est survenue. Réessayez.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Entrez votre email pour réinitialiser.')
      return
    }
    try {
      await resetPassword(email)
      setResetSent(true)
      setError('')
    } catch {
      setError('Impossible d\'envoyer le lien. Vérifiez l\'email.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[350px] bg-brand-dim/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 border border-brand/30">
            <Plane className="h-7 w-7 text-brand-glow" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">FinAuzi</h1>
            <p className="text-sm text-text-muted mt-1">Notre trésorerie pour l'Australie</p>
          </div>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="card space-y-6 rounded-3xl">
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight">Connexion</h2>
            <p className="text-sm text-text-secondary mt-1">
              Connectez-vous pour accéder à votre espace privé.
            </p>
          </div>

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="text-sm text-success bg-success/10 border border-success/30 rounded-xl px-4 py-3 text-center">
              Lien de réinitialisation envoyé à {email}
            </div>
          )}

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl bg-bg-base border border-border-subtle text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-12 pl-11 pr-12 rounded-2xl bg-bg-base border border-border-subtle text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-brand text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-glow disabled:opacity-60 disabled:cursor-not-allowed shadow-glow transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Se connecter
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Reset password */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-text-muted hover:text-brand-glow transition-colors inline-flex items-center gap-1"
            >
              <KeyRound className="h-3 w-3" />
              Mot de passe oublié ?
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-[10px] text-text-muted mt-6">
          FinAuzi — Espace privé
        </p>
      </div>
    </div>
  )
}
