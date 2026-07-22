import { Plus, Settings2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

// Sélecteur de liste (mobile/tablette) : pastilles horizontales défilables.
// Sur desktop (lg+), la sidebar prend le relais → ce composant est masqué.
export default function ListChips({ className, activeLists, activeListId, counts, onSelect, onCreate, onManage }) {
  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5', className)}>
      {activeLists.map((l) => {
        const isActive = l.id === activeListId
        const n = counts?.[l.id] || 0
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            aria-pressed={isActive}
            className={cn(
              'shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition',
              isActive
                ? 'bg-accent text-accent-fg border-accent'
                : 'bg-surface text-muted border-border hover:text-fg',
            )}
          >
            <span className="truncate max-w-[9rem]">{l.name}</span>
            {n > 0 && (
              <span className={cn('text-xs tabular', isActive ? 'text-accent-fg/80' : 'text-faint')}>{n}</span>
            )}
          </button>
        )
      })}
      <button
        onClick={onCreate}
        aria-label="Nouvelle liste"
        title="Nouvelle liste"
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full border border-border text-muted hover:text-fg hover:bg-surface-2 transition"
      >
        <Plus size={16} />
      </button>
      <button
        onClick={onManage}
        aria-label="Gérer les listes"
        title="Gérer les listes"
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full border border-border text-muted hover:text-fg hover:bg-surface-2 transition"
      >
        <Settings2 size={16} />
      </button>
    </div>
  )
}
