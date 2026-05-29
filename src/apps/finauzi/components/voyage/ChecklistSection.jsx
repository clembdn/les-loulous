import { Plus } from 'lucide-react'
import ChecklistItem from './ChecklistItem.jsx'
import { cn } from '@/shared/lib/utils.js'

export default function ChecklistSection({
  section,
  items,
  onCycleStatus,
  onEdit,
  onAdd,
  compact = false,
}) {
  const Icon = section.icon
  const done = items.filter((i) => i.status === 'done').length
  const total = items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div
      className={cn(
        'bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', section.bgClass, section.accentClass)}>
          <Icon size={15} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{section.label}</p>
          <p className="text-[11px] text-white/40 truncate">{section.description}</p>
        </div>
        <span className="text-[11px] text-white/50 tabular flex-shrink-0">
          {done}/{total}
        </span>
      </div>

      {total > 0 && (
        <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full transition-all duration-500 ease-out', section.dotClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-0.5 flex-1">
        {items.length === 0 ? (
          <p className="text-xs text-white/30 px-3 py-4 text-center">
            Aucun élément
          </p>
        ) : (
          items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onCycleStatus={onCycleStatus}
              onEdit={onEdit}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => onAdd(section.id)}
        className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.04] transition border border-dashed border-white/10 hover:border-white/20"
      >
        <Plus size={12} strokeWidth={2.4} />
        Ajouter
      </button>
    </div>
  )
}
