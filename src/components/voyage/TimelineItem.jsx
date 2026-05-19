import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../../lib/utils.js'

function formatMonthYear(iso) {
  if (!iso) return ''
  try {
    const s = format(parseISO(iso), 'MMMM yyyy', { locale: fr })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return iso
  }
}

function getTimePosition(iso) {
  if (!iso) return 'future'
  const now = new Date()
  const itemDate = parseISO(iso)
  const sameMonth = itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth()
  if (sameMonth) return 'current'
  if (itemDate < now) return 'past'
  return 'future'
}

const DOT_STYLES = {
  past:    'bg-white/10 ring-white/10',
  current: 'bg-emerald-400 ring-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.6)]',
  future:  'bg-white/40 ring-white/20',
}

const TEXT_STYLES = {
  past:    'text-white/40',
  current: 'text-white',
  future:  'text-white/90',
}

const LABEL_STYLES = {
  past:    'text-white/30',
  current: 'text-emerald-400',
  future:  'text-white/50',
}

export default function TimelineItem({ item, onEdit, isLast }) {
  const position = getTimePosition(item.date)
  const dateLabel = formatMonthYear(item.date)

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[7px] top-4 bottom-0 w-px bg-white/5" aria-hidden />
      )}

      {/* Dot */}
      <div className="flex-shrink-0 relative z-10 mt-1.5">
        <div className={cn('h-4 w-4 rounded-full ring-2 transition', DOT_STYLES[position])} />
      </div>

      {/* Content (clickable card) */}
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="flex-1 min-w-0 text-left group"
      >
        <p className={cn('text-[10px] uppercase tracking-[0.18em] font-medium mb-0.5 capitalize', LABEL_STYLES[position])}>
          {dateLabel}
        </p>
        <p className={cn(
          'text-sm font-medium transition group-hover:text-white truncate',
          TEXT_STYLES[position],
        )}>
          {item.label}
        </p>
        {item.description && (
          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{item.description}</p>
        )}
      </button>
    </div>
  )
}
