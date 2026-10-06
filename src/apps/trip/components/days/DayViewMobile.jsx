import { Pencil } from 'lucide-react'
import { useToday } from '@/shared/lib/useToday.js'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { MAX_STOPS_PER_DAY } from '../../services/daysService.js'
import TripHeader from '../trips/TripHeader.jsx'
import MiniMap from '../map/MiniMap.jsx'
import TonightCard from '../resas/TonightCard.jsx'
import { DayWeather } from '../weather/WeatherBadge.jsx'
import DayStrip from './DayStrip.jsx'
import DayTimeline from './DayTimeline.jsx'
import { AddStopButton, DayDate, RouteLink } from './DayParts.jsx'

/**
 * Téléphone : le carnet de bord. La bande des nuits et les jours en haut, la
 * journée choisie en carte (mini-carte, frise), puis où l'on dort ce soir.
 * Fait pour être LU vite ; on y range aussi ses étapes, depuis leur fiche.
 */
export default function DayViewMobile({ date }) {
  const today = useToday()
  const ui = useTripUI()
  const { trip, dayKeys, nights, segments, colorIndexByStay, attachmentsByParent, isLoading } = useTripData()
  const view = useDayView(date)

  return (
    <div className="max-w-xl mx-auto pt-5 pb-28">
      <div className="px-4">
        <TripHeader trip={trip} onEdit={ui.editTrip} />
      </div>

      <div className="mt-4">
        <DayStrip
          dayKeys={dayKeys}
          nights={nights}
          segments={segments}
          colorIndexByStay={colorIndexByStay}
          selected={date}
          today={today}
          onSelect={(d) => ui.openDay(d, { replace: true })}
          onStayClick={(stay) => ui.openResa('stay', stay.id)}
        />
      </div>

      <article className="mx-4 mt-3 rounded-2xl border border-border bg-surface overflow-hidden">
        <header className="px-4 pt-3.5 pb-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <DayDate date={date} today={today} />
            <button type="button" onClick={() => ui.editDay(date)} className="group mt-0.5 flex items-center gap-1.5 max-w-full text-left">
              <span className={view.day?.title ? 'text-base font-semibold text-fg truncate' : 'text-base text-faint'}>
                {view.day?.title || 'Donner un titre'}
              </span>
              <Pencil size={13} className="shrink-0 text-faint group-hover:text-fg" />
            </button>
          </div>
          <div className="shrink-0 mt-0.5 flex flex-col items-end gap-1">
            <span className="font-mono text-xs text-muted tabular">J{view.dayNumber}/{dayKeys.length}</span>
            <DayWeather date={date} />
          </div>
        </header>

        <MiniMap items={view.items} home={view.tonight} />
        {view.routeUrl && (
          <div className="px-4 pt-2 text-right">
            <RouteLink url={view.routeUrl} />
          </div>
        )}

        <div className="px-2 pt-1 pb-3">
          {isLoading ? (
            <div className="px-2 py-2 space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <DayTimeline
              items={view.items}
              legs={view.legs}
              attachmentsByParent={attachmentsByParent}
              colorIndexByStay={colorIndexByStay}
              onStop={(stop) => ui.editStop(date, stop)}
              onResa={ui.openResa}
            />
          )}
          {!isLoading && view.items.length === 0 && (
            <p className="px-2 py-3 text-sm text-faint">Rien de prévu pour l’instant.</p>
          )}
          <div className="px-2 pt-2">
            <AddStopButton
              onClick={() => ui.editStop(date)}
              disabled={view.stopCount >= MAX_STOPS_PER_DAY}
            />
          </div>
        </div>
      </article>

      <TonightCard
        className="mx-4 mt-3"
        date={date}
        stay={view.tonight}
        colorIndex={view.tonightColor}
        attachments={view.tonightAttachments}
        isLastDay={view.isLastDay}
        onOpen={() => view.tonight && ui.openResa('stay', view.tonight.id)}
        onAdd={() => ui.editStay(null, { date })}
        onViewAttachment={ui.viewAttachments}
      />

      {view.day?.notes && (
        <section className="mx-4 mt-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">Notes</p>
          <p className="mt-1 text-sm text-fg whitespace-pre-line">{view.day.notes}</p>
        </section>
      )}
    </div>
  )
}
