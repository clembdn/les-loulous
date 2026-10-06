import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { stayColor } from '../../config/palette.js'
import { plural } from '../../utils/format.js'
import { itemText } from '../days/itemText.js'
import { DayWeather } from '../weather/WeatherBadge.jsx'

const MAX_ROWS = 4

/**
 * Une journée en aperçu — « Demain » pendant le voyage, « Jour 1 » avant le
 * départ : la météo, les premiers horaires, où l'on dort. Toute la carte
 * ouvre la journée complète.
 */
export default function DayPreviewCard({ date, label, className }) {
  const ui = useTripUI()
  const { colorIndexByStay } = useTripData()
  const view = useDayView(date)
  const shown = view.items.slice(0, MAX_ROWS)
  const rest = view.items.length - shown.length
  const title = view.day?.title

  return (
    <section className={cn('rounded-2xl border border-border bg-surface', className)}>
      <button
        type="button"
        onClick={() => ui.openDay(date)}
        className="group w-full rounded-2xl p-4 text-left transition hover:bg-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">{label}</p>
          <DayWeather date={date} />
        </div>
        <p className="mt-1 text-base font-semibold text-fg truncate first-letter:uppercase">{title || formatDayFr(date)}</p>
        {title && <p className="text-xs text-muted first-letter:uppercase">{formatDayFr(date)}</p>}

        {shown.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {shown.map((item) => {
              const { title: text, icon: Icon } = itemText(item)
              return (
                <li key={item.key} className="grid grid-cols-[2.75rem_1rem_minmax(0,1fr)] items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted tabular">{item.time || '—'}</span>
                  <Icon size={14} className="text-faint" aria-hidden="true" />
                  <span className="truncate text-fg">{text}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-faint">Rien de prévu pour l’instant.</p>
        )}
        {rest > 0 && <p className="mt-1.5 pl-[4.75rem] text-xs text-faint">+ {plural(rest, 'autre')}</p>}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3 text-xs">
          <NightLine view={view} colorIndexByStay={colorIndexByStay} />
          <span className="shrink-0 inline-flex items-center gap-0.5 text-muted group-hover:text-accent transition">
            La journée <ChevronRight size={13} />
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
        <span className={cn('h-2 w-2 shrink-0 rounded-full', stayColor(colorIndexByStay[view.tonight.id]).dot)} />
        <span className="truncate">Nuit : {view.tonight.name}</span>
      </span>
    )
  }
  if (view.isLastDay) return <span className="text-faint">Dernier jour du voyage</span>
  return <span className="text-amber-700">Pas d’hébergement cette nuit</span>
}
