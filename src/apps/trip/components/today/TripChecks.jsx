import { useMemo } from 'react'
import { BedDouble, ChevronRight, CircleCheck, MapPinOff, Plus, TriangleAlert } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { tripChecks } from '../../utils/today.js'
import { plural } from '../../utils/format.js'

const ROW = 'w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2'

/**
 * « Avant de partir » : ce qui coûte cher à découvrir sur place — une nuit
 * sans toit, une nuit payée deux fois, une étape qu'on ne pourra plus
 * localiser sans réseau. Chaque ligne mène à la correction.
 */
export default function TripChecks({ className }) {
  const ui = useTripUI()
  const { nights, stopsByDate, dayKeys, isLoading } = useTripData()
  const checks = useMemo(() => tripChecks(nights, stopsByDate, dayKeys), [nights, stopsByDate, dayKeys])
  const empty = !checks.gaps.length && !checks.overlaps.length && !checks.unlocated.length

  return (
    <section className={cn('rounded-2xl border border-border bg-surface', className)}>
      <p className="px-4 pt-3.5 text-[11px] uppercase tracking-[0.16em] text-faint">Avant de partir</p>
      {isLoading ? null : empty ? (
        <p className="px-4 pt-2 pb-4 flex items-start gap-2 text-sm text-muted">
          <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          Chaque nuit a son hébergement, chaque étape sa position.
        </p>
      ) : (
        <ul className="p-1.5 pt-1">
          {checks.gaps.map((date) => (
            <li key={`gap-${date}`}>
              <button type="button" onClick={() => ui.editStay(null, { date })} className={ROW}>
                <BedDouble size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg first-letter:uppercase">Nuit du {formatDayFr(date)}</span>
                  <span className="block text-xs text-amber-800">Sans hébergement</span>
                </span>
                <Plus size={16} className="mt-0.5 shrink-0 text-faint" />
              </button>
            </li>
          ))}
          {checks.overlaps.map(({ date, stays }) => (
            <li key={`overlap-${date}`}>
              <button type="button" onClick={() => ui.openDay(date)} className={ROW}>
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg first-letter:uppercase">Nuit du {formatDayFr(date)}</span>
                  <span className="block text-xs text-amber-800 truncate">
                    Réservée deux fois : {stays.map((s) => s.name).join(', ')}
                  </span>
                </span>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-faint" />
              </button>
            </li>
          ))}
          {checks.unlocated.length > 0 && (
            <li>
              <button type="button" onClick={() => ui.openDay(checks.unlocated[0].date)} className={ROW}>
                <MapPinOff size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg">{plural(checks.unlocated.length, 'étape')} sans position</span>
                  <span className="block text-xs text-muted">
                    Absentes des cartes et de la météo — à localiser tant qu’il y a du réseau.
                  </span>
                </span>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-faint" />
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
