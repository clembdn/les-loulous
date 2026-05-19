import { AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AccessDeniedScreen() {
  const { currentUser, logout } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-danger/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="card text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto h-16 w-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-danger" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-xl font-bold text-danger">Accès refusé</h1>
            <p className="text-sm text-text-secondary mt-2">
              Ce compte n'est pas autorisé à accéder à FinAuzi.
            </p>
          </div>

          {/* Email */}
          {currentUser?.email && (
            <div className="px-4 py-3 rounded-xl bg-bg-elevated border border-border-subtle">
              <p className="text-xs text-text-muted mb-0.5">Connecté avec</p>
              <p className="text-sm font-medium truncate">{currentUser.email}</p>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full h-11 rounded-xl bg-bg-elevated border border-border-subtle text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>

        <p className="text-center text-[10px] text-text-muted mt-6">
          FinAuzi — Espace privé
        </p>
      </div>
    </div>
  )
}
