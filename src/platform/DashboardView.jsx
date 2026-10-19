import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { Badge } from '@/shared/ui/Badge.jsx'
import { cn } from '@/shared/lib/utils.js'
import { APPS } from './apps.config.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

// Bento asymétrique mais équitable : chaque app occupe la même surface
// (2 cases), en large ou en haut. Pensé pour 4 apps, par position dans APPS.
// Mobile (2 col × 4 rangées) : [ 0 0 ] [ 1 2 ] [ 1 2 ] [ 3 3 ]
// lg (4 col × 2 rangées)      : [ 0 0 1 2 ] [ 3 3 1 2 ]
const CELLS = ['col-span-2', 'row-span-2 lg:col-span-1', 'row-span-2 lg:col-span-1', 'col-span-2']

// Halos de fond qui dérivent lentement, un par app (couleur via data-accent).
const BLOBS = [
  'top-[-20%] left-[-25%]',
  'top-[10%] right-[-30%]',
  'bottom-[-25%] left-[-10%]',
  'bottom-[-15%] right-[-20%]',
]

export default function DashboardView() {
  useAppTheme('dark', 'indigo')
  const { currentUid, logout } = useAuth()
  const me = getPerson(currentUid)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    // Hauteur figée sur l'écran (dvh) : toutes les apps visibles sans scroller.
    <div className="relative h-dvh min-h-[540px] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        {APPS.slice(0, BLOBS.length).map((app, i) => (
          <div
            key={app.id}
            data-accent={app.accent}
            className={cn('dash-blob absolute h-[80vmax] w-[80vmax] rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.22),transparent_62%)]', BLOBS[i])}
            style={{ animationDelay: `${i * -4.5}s` }}
          />
        ))}
      </div>

      <div className="relative max-w-6xl mx-auto w-full h-full px-4 sm:px-6 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1rem)] sm:py-8 lg:py-10 flex flex-col">
        <header className="dash-rise flex items-start justify-between mb-5 lg:mb-8 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted">{today}</p>
            <h1 className="text-2xl min-[390px]:text-[1.7rem] sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] text-fg mt-1.5 leading-tight">
              {greeting()}
              {me && <>, <span className="dash-name">{me.label}</span></>}
            </h1>
          </div>
          <button
            onClick={logout}
            className="shrink-0 h-10 w-10 sm:w-auto sm:px-4 inline-flex items-center justify-center gap-2 rounded-full text-sm text-muted border border-border bg-surface/60 backdrop-blur hover:text-fg hover:bg-surface-2 transition"
            title="Se déconnecter"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-4 lg:grid-cols-4 lg:grid-rows-2 gap-3 lg:gap-4">
          {APPS.map((app, i) => <AppTile key={app.id} app={app} index={i} />)}
        </div>
      </div>
    </div>
  )
}

// Projecteur qui suit la souris (desktop) : on pose --mx / --my sans re-rendu.
function trackPointer(e) {
  if (e.pointerType !== 'mouse') return
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function AppTile({ app, index }) {
  const Icon = app.icon
  const isSoon = app.status === 'soon'
  return (
    // L'animation d'entrée est sur l'enveloppe : posée sur le lien, son
    // `transform` final écraserait celui du survol.
    <div className={cn('dash-rise min-h-0', CELLS[index] ?? 'col-span-1')} style={{ animationDelay: `${120 + index * 80}ms` }}>
      <Link
        to={app.path}
        data-accent={app.accent}
        onPointerMove={trackPointer}
        className="group relative flex h-full flex-col justify-end overflow-hidden rounded-[28px] bg-accent text-accent-fg p-4 sm:p-5 lg:p-7 shadow-[0_24px_48px_-24px_rgb(var(--accent)/0.75)] ring-1 ring-inset ring-white/15 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_32px_64px_-24px_rgb(var(--accent)/0.9)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {/* Relief : lumière en haut à gauche, ombre en bas à droite */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255/0.22),transparent_45%,rgb(0_0_0/0.22))]" />
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),rgb(255_255_255/0.28),transparent_70%)]" />

        {/* Icône géante en filigrane, qui flotte */}
        <span className="pointer-events-none absolute -right-8 -top-4 h-40 w-40 sm:h-56 sm:w-56 lg:-right-10 lg:-top-8 lg:h-72 lg:w-72 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-rotate-6">
          <Icon className="dash-float h-full w-full opacity-[0.18]" strokeWidth={1.5} style={{ animationDelay: `${index * -1.7}s` }} />
        </span>

        {isSoon && <Badge className="absolute top-4 right-4 bg-black/20 text-current border-white/20">Bientôt</Badge>}
        <h2 className="relative text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.03em] leading-none">{app.name}</h2>
      </Link>
    </div>
  )
}
