import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBasket, Plus, Settings2 } from 'lucide-react'
import { COURSES_TABS } from '../../config/navigation.js'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

// Desktop-only vertical sidebar (lg+). Remplace le header en-page sur grand écran.
// `lists` (API des listes de courses) + `counts` alimentent la section « Mes listes ».
export default function Sidebar({ active, onChange, lists, counts, onManageLists }) {
  const { currentUid } = useAuth()
  const me = getPerson(currentUid)

  return (
    <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 flex-col border-r border-border bg-bg/80 backdrop-blur-xl z-30">
      <div className="px-3 pt-5 pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-surface-2 transition"
        >
          <ArrowLeft size={14} /> Nos apps
        </Link>
        <div className="flex items-center gap-2 px-2 mt-2">
          <ShoppingBasket size={18} className="text-accent" />
          <p className="text-sm font-semibold tracking-tight text-fg">Courses</p>
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto space-y-1">
        {COURSES_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-fg hover:bg-surface-2',
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.3 : 2} />
              {tab.label}
            </button>
          )
        })}

        {lists && (
          <div className="pt-5">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">Mes listes</span>
              <button
                onClick={onManageLists}
                aria-label="Gérer les listes"
                title="Gérer les listes"
                className="p-1 -mr-1 rounded-md text-faint hover:text-fg hover:bg-surface-2 transition"
              >
                <Settings2 size={14} />
              </button>
            </div>
            <div className="space-y-0.5">
              {lists.activeLists.map((l) => {
                const isActive = l.id === lists.activeListId
                const n = counts?.[l.id] || 0
                return (
                  <button
                    key={l.id}
                    onClick={() => { lists.selectList(l.id); onChange('liste') }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition',
                      isActive ? 'bg-surface-2 text-fg font-medium' : 'text-muted hover:text-fg hover:bg-surface-2',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', isActive ? 'bg-accent' : 'border border-border-strong')} />
                    <span className="flex-1 truncate text-left">{l.name}</span>
                    {n > 0 && <span className="shrink-0 text-xs text-faint tabular">{n}</span>}
                  </button>
                )
              })}
              <button
                onClick={() => { lists.createList(); onChange('liste') }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface-2 transition"
              >
                <Plus size={15} className="shrink-0 text-accent" />
                Nouvelle liste
              </button>
            </div>
          </div>
        )}
      </nav>

      {me && (
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <span
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                me.bgClass, me.textClass, me.borderClass,
              )}
            >
              {me.initial}
            </span>
            <span className="text-sm text-muted">{me.label}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
