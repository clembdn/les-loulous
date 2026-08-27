import { Plus, Settings2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

// Bloc « Mes listes » injecté dans la sidebar partagée : propre à l'app Cook’It,
// c'est le seul morceau de navigation que les autres apps n'ont pas.
export default function ListsNavSection({ lists, counts, onManageLists, onChange }) {
  if (!lists) return null

  return (
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
  )
}
