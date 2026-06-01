import { cn } from '@/shared/lib/utils.js'

const TABS = [
  { id: 'liste', label: 'Liste' },
  { id: 'recettes', label: 'Recettes' },
  { id: 'planning', label: 'Planning' },
]

export default function TabBar({ tab, onTab }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-border">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition',
            tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
