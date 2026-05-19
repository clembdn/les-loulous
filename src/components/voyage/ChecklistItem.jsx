import { Check } from 'lucide-react'
import { STATUS_META, getNextStatus } from '../../config/checklistSuggestions.js'
import { getPerson } from '../../config/people.js'
import { cn } from '../../lib/utils.js'

export default function ChecklistItem({ item, onCycleStatus, onEdit }) {
  const meta = STATUS_META[item.status] || STATUS_META.todo
  const completedBy = item.completedBy ? getPerson(item.completedBy) : null
  const isDone = item.status === 'done'

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition border border-transparent',
        'hover:bg-white/[0.03] hover:border-white/5',
      )}
    >
      <button
        type="button"
        onClick={() => onCycleStatus(item, getNextStatus(item.status))}
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition ring-1',
          meta.ringClass,
          meta.fillClass,
          'hover:scale-110 active:scale-95',
        )}
        title={`Statut : ${meta.label} (cliquer pour changer)`}
        aria-label={`Statut : ${meta.label}`}
      >
        {isDone && <Check size={14} className="text-white" strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={() => onEdit(item)}
        className="flex-1 min-w-0 text-left"
      >
        <p
          className={cn(
            'text-sm font-medium transition truncate',
            isDone ? 'text-white/40 line-through' : 'text-white/90',
          )}
        >
          {item.label}
        </p>
        {completedBy && isDone && (
          <p className="text-[10px] text-white/30 mt-0.5">
            Fait par {completedBy.label}
          </p>
        )}
      </button>

      {!isDone && (
        <span className={cn('text-[10px] uppercase tracking-wider font-medium flex-shrink-0', meta.textClass)}>
          {meta.label}
        </span>
      )}
    </div>
  )
}
