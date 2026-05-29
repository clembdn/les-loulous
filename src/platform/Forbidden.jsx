import { useAuth } from '@/shared/context/AuthContext.jsx'

export default function Forbidden() {
  const { logout } = useAuth()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 fade-in">
      <h1 className="text-xl font-semibold text-white">Accès refusé</h1>
      <p className="text-sm text-white/40 max-w-xs">
        Cet espace est privé — seuls Clément et Lise y ont accès.
      </p>
      <button
        onClick={logout}
        className="text-xs text-white/60 hover:text-white underline-offset-4 hover:underline transition"
      >
        Se déconnecter
      </button>
    </div>
  )
}
