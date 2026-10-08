import { useMemo } from 'react'
import { Backpack, BedDouble, ChevronRight, CircleCheck, MapPinOff, Plus, TriangleAlert } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { tripChecks } from '../../utils/today.js'
import { plural } from '../../utils/format.js'
import { packingProgress } from '../../utils/packing.js'
import { PACKING_ID } from '../../config/navigation.js'

const ROW = 'w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2'

/**
 * « Avant de partir » : ce qui coûte cher à découvrir sur place — une nuit
 * sans toit, une nuit payée deux fois, une étape qu'on ne pourra plus
 * localiser sans réseau. Chaque ligne mène à la correction. Et la valise,
 * pour le couple (pas pour un invité).
 */
export default function TripChecks({ className }) {
  const ui = useTripUI()
  const { nights, stopsByDate, dayKeys, packing, isLoading } = useTripData()
  const checks = useMemo(() => tripChecks(nights, stopsByDate, dayKeys), [nights, stopsByDate, dayKeys])
  const empty = !checks.gaps.length && !checks.overlaps.length && !checks.unlocated.length

  return (
    <section className={cn('rounded-2xl bg-surface shadow-sm', className)}>
      <p className="px-4 pt-4 text-[15px] font-semibold text-fg">Avant de partir</p>
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
                <Plus size={16} className="mt-0.5 shrink-0 text-muted" />
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
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />
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
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />
              </button>
            </li>
          )}
        </ul>
      )}
      {!isLoading && !ui.readOnly && <PackingCheck packing={packing} onOpen={() => ui.openTab(PACKING_ID)} />}
    </section>
  )
}

function PackingCheck({ packing, onOpen }) {
  const { done, total } = packingProgress(packing)
  const ready = total > 0 && done === total
  return (
    <div className="px-1.5 pb-1.5 -mt-1">
      <button type="button" onClick={onOpen} className={ROW}>
        <Backpack size={16} className={cn('mt-0.5 shrink-0', ready ? 'text-emerald-600' : 'text-accent')} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-fg">Valise</span>
          <span className="block text-xs text-muted tabular">
            {!total ? 'Pas encore de liste : partir de la liste type' : ready ? 'Tout est dedans' : `${done} sur ${plural(total, 'affaire')} dedans`}
          </span>
        </span>
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />
      </button>
    </div>
  )
}
