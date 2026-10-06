import { BedDouble } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { stayColor } from '../../config/palette.js'
import { getTransportMode } from '../../config/reservations.js'
import { dayChip, plural } from '../../utils/format.js'

/**
 * Éditeur desktop, colonne de gauche : les jours, et le long de chacun la
 * bande verticale des nuits.
 *
 * Chaque ligne a deux demi-bandes : le haut est la nuit d'AVANT (on se
 * réveille là), le bas la nuit qui vient (on y dort). Une barre d'hébergement
 * va donc du soir de l'arrivée au matin du départ, sans rien calculer de plus
 * que les nuits.
 *
 * Chaque jour est aussi une cible : on y lâche une étape traînée depuis le
 * détail d'un autre jour.
 */
export default function DayList({ dayKeys, nights, timelines, colorIndexByStay, days, selected, today, dropDate, onSelect, onDragOverDay, onDropOnDay }) {
  return (
    <ol className="space-y-1">
      {dayKeys.map((date, i) => {
        const chip = dayChip(date)
        const night = nights[i]
        const before = i > 0 ? nights[i - 1].stays[0] : null
        const tonight = night.stays[0] || null
        const arriving = tonight && tonight.id !== before?.id ? tonight : null
        const items = timelines[date] || []
        const stops = items.filter((it) => it.type === 'stop').length
        const transports = items.filter((it) => it.type === 'transport')
        const active = date === selected
        const title = days[date]?.title
        return (
          <li key={date}>
            <button
              type="button"
              onClick={() => onSelect(date)}
              onDragOver={(e) => onDragOverDay(e, date)}
              onDrop={(e) => onDropOnDay(e, date)}
              className={cn(
                'relative w-full flex items-stretch gap-3 rounded-xl pl-2 pr-3 py-2.5 text-left transition',
                active ? 'bg-surface shadow-sm' : 'hover:bg-surface/60',
                dropDate === date && 'ring-2 ring-accent bg-accent/5',
              )}
            >
              <span aria-hidden="true" className="w-1.5 shrink-0 flex flex-col -my-2">
                <span className={cn('flex-1', before ? stayColor(colorIndexByStay[before.id]).strip : 'bg-transparent')} />
                <span
                  className={cn(
                    'flex-1',
                    tonight ? stayColor(colorIndexByStay[tonight.id]).strip : night.gap ? 'border-l-2 border-dashed border-amber-400' : 'bg-transparent',
                  )}
                />
              </span>
              <span className="w-9 shrink-0 text-center">
                <span className={cn('block text-[11px]', active ? 'text-accent' : 'text-muted')}>{chip.dow}</span>
                <span className={cn('block text-lg font-semibold leading-tight tabular', active ? 'text-accent' : 'text-fg')}>{chip.day}</span>
                {date === today && <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-accent" aria-label="Aujourd’hui" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm truncate', title ? 'font-medium text-fg' : 'text-muted')}>
                  {title || `${chip.day} ${chip.month}`}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted min-w-0">
                  <span className="shrink-0">{stops ? plural(stops, 'étape') : 'Rien de prévu'}</span>
                  {transports.slice(0, 2).map((it) => {
                    const Icon = getTransportMode(it.transport.mode).icon
                    return (
                      <span key={it.key} className="inline-flex items-center gap-0.5 shrink-0 text-[#1E3A5F] font-medium">
                        <Icon size={11} /> {it.time || ''}
                      </span>
                    )
                  })}
                </span>
                {arriving && (
                  <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted min-w-0">
                    <BedDouble size={11} className="shrink-0" />
                    <span className="truncate">{arriving.name}</span>
                  </span>
                )}
                {night.overlap && <span className="block text-[11px] text-danger">Deux hébergements cette nuit</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
