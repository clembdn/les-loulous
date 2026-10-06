import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { stayColor } from '../../config/palette.js'
import { dayChip } from '../../utils/format.js'

const DAY_WIDTH = 52

/**
 * Téléphone : la bande des nuits au-dessus des pastilles de jours, alignées
 * colonne par colonne et défilant ensemble.
 *
 * Chaque jour fait deux demi-colonnes. Une nuit va du MILIEU d'un jour au
 * milieu du suivant : une barre d'hébergement commence l'après-midi de
 * l'arrivée et finit le matin du départ — ce qu'on vit, plutôt qu'une case
 * par jour. Une nuit sans hébergement est un pointillé, à voir avant de partir.
 */
export default function DayStrip({ dayKeys, nights, segments, colorIndexByStay, selected, today, onSelect, onStayClick }) {
  const scroller = useRef(null)
  const lanes = Math.max(1, ...segments.map((s) => s.lane + 1))
  const halfCols = dayKeys.length * 2

  // Garder le jour choisi visible, sans faire défiler la page en hauteur
  // (ce que ferait `scrollIntoView`).
  useEffect(() => {
    const el = scroller.current
    const i = dayKeys.indexOf(selected)
    if (!el || i === -1) return
    const target = i * DAY_WIDTH - (el.clientWidth - DAY_WIDTH) / 2
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [selected, dayKeys])

  return (
    <div ref={scroller} className="overflow-x-auto no-scrollbar px-4">
      <div
        className="grid gap-y-1.5 w-max"
        style={{ gridTemplateColumns: `repeat(${halfCols}, ${DAY_WIDTH / 2}px)` }}
      >
        {segments.map(({ stay, start, span, lane, colorIndex }) => {
          const startedBefore = stay.checkIn.date < dayKeys[0]
          const colStart = startedBefore ? 1 : start * 2 + 2
          const colEnd = Math.min((start + span) * 2 + 2, halfCols + 1)
          return (
            <button
              key={stay.id}
              type="button"
              onClick={() => onStayClick(stay)}
              style={{ gridColumn: `${colStart} / ${colEnd}`, gridRow: lane + 1 }}
              className={cn(
                'h-6 mx-px px-1.5 rounded-md border text-left text-[11px] font-semibold leading-[22px] truncate',
                stayColor(colorIndex ?? colorIndexByStay[stay.id]).bar,
              )}
              title={stay.name}
            >
              {stay.name}
            </button>
          )
        })}
        {nights.map((n, i) => n.gap && (
          <div
            key={`gap-${n.date}`}
            style={{ gridColumn: `${i * 2 + 2} / ${i * 2 + 4}`, gridRow: 1 }}
            className="h-6 mx-px rounded-md border border-dashed border-amber-500 bg-amber-50 text-[11px] font-semibold text-amber-800 flex items-center justify-center"
            title="Nuit sans hébergement"
          >
            ?
          </div>
        ))}

        {dayKeys.map((date, i) => {
          const chip = dayChip(date)
          const active = date === selected
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={active}
              style={{ gridColumn: `${i * 2 + 1} / span 2`, gridRow: lanes + 1 }}
              className={cn(
                'relative mx-0.5 mt-1 py-1.5 rounded-xl border flex flex-col items-center transition',
                active ? 'bg-fg border-fg text-bg' : 'bg-surface border-border text-fg hover:border-border-strong',
              )}
            >
              <span className={cn('text-[11px]', active ? 'text-bg/75' : 'text-muted')}>{chip.dow}</span>
              <span className="text-base font-semibold leading-tight tabular">{chip.day}</span>
              {date === today && (
                <span aria-label="Aujourd’hui" className={cn('absolute bottom-1 h-1 w-1 rounded-full', active ? 'bg-bg' : 'bg-accent')} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
