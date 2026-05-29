import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { Badge } from '@/shared/ui/Badge.jsx'
import { APPS } from './apps.config.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function DashboardView() {
  useAppTheme('dark', 'indigo')
  const { currentUid, logout } = useAuth()
  const me = getPerson(currentUid)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[760px] rounded-full bg-accent/10 blur-[150px]" />
      </div>
      <div className="relative max-w-5xl mx-auto w-full px-6 py-10 flex flex-col min-h-screen fade-in">
        <header className="flex items-start justify-between mb-12">
          <div>
            <p className="text-sm text-muted capitalize">{today}</p>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-fg mt-1">
              {greeting()}{me ? `, ${me.label}` : ''}
            </h1>
            <p className="text-sm text-faint mt-1">Clément &amp; Lise — Notre espace à deux</p>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted hover:text-fg hover:bg-surface-2 transition"
            title="Se déconnecter"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </header>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 auto-rows-fr content-center">
          {APPS.map((app) => <AppCard key={app.id} app={app} />)}
        </div>
      </div>
    </div>
  )
}

function AppCard({ app }) {
  const Icon = app.icon
  const isSoon = app.status === 'soon'
  return (
    <Link
      to={app.path}
      data-theme={app.theme}
      data-accent={app.accent}
      className="group relative flex flex-col justify-between p-7 rounded-3xl border border-border bg-surface min-h-[220px] shadow-card transition hover:-translate-y-1 hover:shadow-lift"
    >
      {isSoon && <Badge className="absolute top-5 right-5">Bientôt</Badge>}
      <span className="h-14 w-14 rounded-2xl flex items-center justify-center bg-accent/10 text-accent border border-accent/20">
        <Icon size={26} strokeWidth={2} />
      </span>
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-fg tracking-[-0.01em]">{app.name}</h2>
        <p className="text-sm text-muted mt-1">{app.description}</p>
      </div>
    </Link>
  )
}
