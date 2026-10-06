import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { stayColor } from '../../config/palette.js'
import { plural } from '../../utils/format.js'
import { itemText } from '../days/itemText.js'
import { itemColor } from '../ItemBadge.jsx'
import { DayWeather } from '../weather/WeatherBadge.jsx'

const MAX_ROWS = 4

/**
 * Une journée en aperçu — « Demain » pendant le voyage, « Jour 1 » avant le
 * départ (le titre est posé au-dessus) : la météo, les premiers horaires, où
 * l'on dort. Toute la carte ouvre la journée complète.
 */
export default function DayPreviewCard({ date, className }) {
  const ui = useTripUI()
  const { colorIndexByStay } = useTripData()
  const view = useDayView(date)
  const shown = view.items.slice(0, MAX_ROWS)
  const rest = view.items.length - shown.length
  const title = view.day?.title

  return (
    <section className={cn('rounded-2xl bg-surface shadow-sm', className)}>
      <button
        type="button"
        onClick={() => ui.openDay(date)}
        className="group w-full rounded-2xl p-4 text-left transition hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-fg truncate first-letter:uppercase">{title || formatDayFr(date)}</p>
            {title && <p className="text-[13px] text-muted first-letter:uppercase">{formatDayFr(date)}</p>}
          </div>
          <DayWeather date={date} className="shrink-0 mt-0.5 text-sm" />
        </div>

        {shown.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {shown.map((item) => {
              const { title: text, icon: Icon } = itemText(item)
              return (
                <li key={item.key} className="grid grid-cols-[2.9rem_1.25rem_minmax(0,1fr)] items-center gap-2 text-[15px]">
                  <span className="font-mono text-[13px] text-muted tabular">{item.time || '—'}</span>
                  <Icon size={16} style={{ color: itemColor(item, colorIndexByStay) }} aria-hidden="true" />
                  <span className="truncate text-fg">{text}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted">Rien de prévu pour l’instant.</p>
        )}
        {rest > 0 && <p className="mt-1.5 pl-[4.9rem] text-[13px] text-muted">+ {plural(rest, 'autre')}</p>}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3 text-[13px]">
          <NightLine view={view} colorIndexByStay={colorIndexByStay} />
          <span className="shrink-0 inline-flex items-center gap-0.5 font-medium text-accent">
            La journée <ChevronRight size={14} />
          </span>
        </div>
      </button>
    </section>
  )
}

function NightLine({ view, colorIndexByStay }) {
  if (view.tonight) {
    return (
      <span className="min-w-0 inline-flex items-center gap-1.5 text-muted">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', stayColor(colorIndexByStay[view.tonight.id]).dot)} />
        <span className="truncate">Nuit : {view.tonight.name}</span>
      </span>
    )
  }
  if (view.isLastDay) return <span className="text-muted">Dernier jour du voyage</span>
  return <span className="text-amber-800">Pas d’hébergement cette nuit</span>
}
