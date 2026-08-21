import { cn } from '@/shared/lib/utils.js'
import { DAY_SHORT, DAY_LABELS, isoDayOfWeek } from '@/shared/lib/dates.js'

const DOWS = [1, 2, 3, 4, 5, 6, 7]

// Sélecteur de jour de la semaine.
//
// Sept cases identiques ne disent rien : on ne sait pas lesquelles portent une
// séance, ni où on est dans la semaine. Chaque case annonce donc sa charge
// (nombre d'exercices, ou « repos »), et aujourd'hui est repéré par un point.
export default function DayPicker({ value, onChange, counts = {}, today, className }) {
  // `today` : le jour réel de la date consultée, pas forcément celui du jour —
  // on peut rattraper la séance d'hier.
  const marked = today || isoDayOfWeek(new Date())

  return (
    <div className={cn('grid grid-cols-7 gap-1.5', className)}>
      {DOWS.map((dow) => {
        const count = counts[dow] || 0
        const isActive = dow === value
        const isToday = dow === marked
        return (
          <button
            key={dow}
            onClick={() => onChange(dow)}
            aria-label={`${DAY_LABELS[dow % 7]} — ${count > 0 ? `${count} exercices` : 'repos'}`}
            aria-pressed={isActive}
            className={cn(
              'relative h-[52px] rounded-xl border flex flex-col items-center justify-center gap-0.5',
              'transition-all duration-200 ease-ios active:scale-95',
              isActive
                ? 'bg-accent text-accent-fg border-accent'
                : count > 0
                  // Un jour programmé se distingue d'un jour de repos sans
                  // avoir besoin d'être sélectionné pour le voir.
                  ? 'bg-surface-2 text-fg border-border-strong hover:border-accent/50'
                  : 'bg-transparent text-faint border-border hover:text-muted',
            )}
          >
            <span className="text-[11px] font-semibold leading-none">{DAY_SHORT[dow % 7]}</span>
            <span className={cn(
              'text-[10px] leading-none tabular',
              isActive ? 'opacity-80' : count > 0 ? 'text-muted' : 'text-faint',
            )}>
              {count > 0 ? count : '—'}
            </span>
            {isToday && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-1 h-1 w-1 rounded-full',
                  isActive ? 'bg-accent-fg' : 'bg-accent',
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
