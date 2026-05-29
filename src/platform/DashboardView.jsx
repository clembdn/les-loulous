import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson, COLOR_BY_ID } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'
import { APPS } from './apps.config.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function DashboardView() {
  const { currentUid, logout } = useAuth()
  const me = getPerson(currentUid)

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 max-w-5xl mx-auto w-full fade-in">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Clément &amp; Lise</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {greeting()}{me ? ` ${me.label}` : ''} — Notre espace à deux
          </p>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition"
          title="Se déconnecter"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 auto-rows-fr">
        {APPS.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  )
}

function AppCard({ app }) {
  const Icon = app.icon
  const color = COLOR_BY_ID[app.accent] || COLOR_BY_ID.amber
  const isSoon = app.status === 'soon'

  return (
    <Link
      to={app.path}
      className={cn(
        'group relative flex flex-col justify-between p-7 rounded-3xl border bg-white/[0.02] min-h-[200px] transition hover:-translate-y-0.5 hover:bg-white/[0.04]',
        color.borderClass,
      )}
    >
      {isSoon && (
        <span className="absolute top-5 right-5 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">
          Bientôt
        </span>
      )}
      <span className={cn(
        'h-14 w-14 rounded-2xl flex items-center justify-center border',
        color.bgClass, color.textClass, color.borderClass,
      )}>
        <Icon size={26} strokeWidth={2} />
      </span>
      <div className="mt-6">
        <h2 className={cn('text-xl font-semibold', isSoon ? 'text-white/60' : 'text-white')}>{app.name}</h2>
        <p className="text-sm text-white/40 mt-1">{app.description}</p>
      </div>
    </Link>
  )
}
