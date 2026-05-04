import { useState } from 'react'
import { Wallet, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginView({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.')
      return
    }

    setLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      onLogin({ name: email.split('@')[0], email })
    } catch {
      setError('Identifiants incorrects.')
    } finally {
      setLoading(false)
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
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 border border-brand/30">
            <Wallet className="h-6 w-6 text-brand-glow" />
          </div>
          <div>
            <span className="text-xl font-semibold tracking-tight">Atlas</span>
            <span className="text-text-muted text-sm ml-1">Finance</span>
          </div>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="card space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
            <p className="text-sm text-text-secondary mt-1">
              Accédez à votre tableau de bord
            </p>
          </div>

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-10 pl-10 pr-12 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
            className="w-full h-10 rounded-lg bg-brand text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-brand-glow disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-6">
          Atlas Finance — Tableau de bord personnel
        </p>
      </div>
    </div>
  )
}
