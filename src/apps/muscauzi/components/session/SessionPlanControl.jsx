import { useState } from 'react'
import { CalendarClock, Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { DAY_SHORT, DAY_LABELS } from '@/shared/lib/dates.js'

const PARITY_LABEL = { even: 'Semaine paire', odd: 'Semaine impaire' }
const DOWS = [1, 2, 3, 4, 5, 6, 7]

// Contrôle discret : forcer la parité de semaine ET le jour de séance affiché.
// Un seul contrôle pour les deux cas (semaine de vacances qui décale le cycle,
// séance du mardi faite le mercredi).
export default function SessionPlanControl({ parity, dayOfWeek, isForced, onChange, onReset }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition',
          isForced
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border bg-surface text-muted hover:text-fg hover:border-border-strong',
        )}
      >
        <CalendarClock size={14} />
        {PARITY_LABEL[parity]} · {DAY_LABELS[dayOfWeek % 7]}
        {isForced && <span className="text-[10px] uppercase tracking-wider opacity-80">forcé</span>}
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-2xl border border-border bg-surface slide-up">
          <p className="text-[11px] uppercase tracking-wider text-faint mb-2">Semaine</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {['odd', 'even'].map((p) => (
              <button
                key={p}
                onClick={() => onChange({ parity: p, dayOfWeek })}
                className={cn(
                  'h-11 rounded-xl text-sm font-medium border transition',
                  p === parity
                    ? 'bg-accent text-accent-fg border-accent'
                    : 'bg-surface-2 text-muted border-border hover:text-fg',
                )}
              >
                {PARITY_LABEL[p]}
              </button>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-wider text-faint mb-2">Jour de séance</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DOWS.map((d) => (
              <button
                key={d}
                onClick={() => onChange({ parity, dayOfWeek: d })}
                className={cn(
                  'h-11 rounded-xl text-xs font-semibold border transition',
                  d === dayOfWeek
                    ? 'bg-accent text-accent-fg border-accent'
                    : 'bg-surface-2 text-muted border-border hover:text-fg',
                )}
              >
                {DAY_SHORT[d % 7]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3">
            {isForced ? (
              <button onClick={onReset} className="text-xs text-muted hover:text-fg transition">
                Revenir au jour réel
              </button>
            ) : <span />}
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition"
            >
              <Check size={14} /> Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
