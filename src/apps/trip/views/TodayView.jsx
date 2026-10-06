import { useMemo } from 'react'
import { ChevronRight, Flag } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr, shiftDateKey } from '@/shared/lib/dates.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { useTripUI } from '../context/TripUIContext.jsx'
import { useDayView } from '../hooks/useDayView.js'
import { useNow } from '../hooks/useNow.js'
import { tripProgress } from '../utils/tripDates.js'
import { focusOf } from '../utils/today.js'
import { formatTripRange } from '../utils/format.js'
import TripHeader from '../components/trips/TripHeader.jsx'
import MiniMap from '../components/map/MiniMap.jsx'
import TonightCard from '../components/resas/TonightCard.jsx'
import DayTimeline from '../components/days/DayTimeline.jsx'
import { DayDate, RouteLink } from '../components/days/DayParts.jsx'
import { DayWeather } from '../components/weather/WeatherBadge.jsx'
import NextUpCard from '../components/today/NextUpCard.jsx'
import DayPreviewCard from '../components/today/DayPreviewCard.jsx'
import TripChecks from '../components/today/TripChecks.jsx'
import { Eyebrow, Glow, HERO_CARD, Stat } from '../components/today/parts.jsx'

/**
 * Aujourd'hui — l'écran qu'on ouvre pendant le voyage, souvent sans réseau.
 *
 *  · pendant : ce qui vient (en grand, avec « Y aller »), la journée avec le
 *    passé grisé, où l'on dort ce soir, et demain ;
 *  · avant : le compte à rebours, le premier jour, ce qu'il reste à régler ;
 *  · après : le voyage terminé.
 *
 * Il vit à l'horloge (`useNow`, à la minute) : « dans 1 h 20 » devient
 * « dans 1 h 19 », l'étape finie se grise, minuit fait passer à demain.
 * Ordinateur : deux colonnes, la journée à gauche, le soir et demain à droite.
 */
export default function TodayView() {
  const { today, time } = useNow()
  const { trip } = useTripData()
  const progress = tripProgress(trip, today)

  if (progress.status === 'upcoming') return <BeforeTrip progress={progress} />
  if (progress.status === 'past') return <TripDone />
  return <DuringTrip today={today} now={time} />
}

function Page({ children }) {
  return <div className="max-w-xl lg:max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-7 pb-28 lg:pb-12">{children}</div>
}

const COLUMNS = 'mt-5 grid gap-3 items-start lg:gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_24rem]'
const STACK = 'min-w-0 space-y-3 lg:space-y-4'

function DuringTrip({ today, now }) {
  const ui = useTripUI()
  const { trip, dayKeys, attachmentsByParent, colorIndexByStay, isLoading } = useTripData()
  const view = useDayView(today)
  const focus = useMemo(() => focusOf(view.items, now), [view.items, now])
  const tomorrow = shiftDateKey(today, 1)
  const hasTomorrow = dayKeys.includes(tomorrow)
  const tomorrowIsLast = tomorrow === dayKeys[dayKeys.length - 1]

  return (
    <Page>
      <TripHeader trip={trip} onEdit={ui.editTrip} />
      <div className={COLUMNS}>
        <div className={STACK}>
          {isLoading
            ? <Skeleton className="h-60 rounded-3xl" />
            : <NextUpCard date={today} focus={focus} tonight={view.tonight} isLastDay={view.isLastDay} />}

          <section className="rounded-2xl border border-border bg-surface overflow-hidden">
            <header className="px-4 pt-3.5 pb-1 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <DayDate date={today} today={today} />
                {view.day?.title && <p className="mt-0.5 text-base font-semibold text-fg truncate">{view.day.title}</p>}
              </div>
              <DayWeather date={today} className="mt-0.5 shrink-0" />
            </header>
            <div className="px-2 pb-2">
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
                  onStop={(stop) => ui.editStop(today, stop)}
                  onResa={ui.openResa}
                  now={now}
                />
              )}
              {!isLoading && view.items.length === 0 && (
                <p className="px-2 py-2 text-sm text-faint">Rien de prévu aujourd’hui.</p>
              )}
            </div>
            <footer className="border-t border-border px-4 py-2.5 flex items-center justify-between gap-3">
              <RouteLink url={view.routeUrl} />
              <button
                type="button"
                onClick={() => ui.openDay(today)}
                className="ml-auto inline-flex items-center gap-0.5 text-xs text-muted hover:text-accent transition"
              >
                Modifier la journée <ChevronRight size={13} />
              </button>
            </footer>
          </section>
        </div>

        <aside className={cn(STACK, 'lg:sticky lg:top-6')}>
          {/* Sur ordinateur, la place ne manque pas : le parcours du jour d'un coup d'œil. */}
          <div className="hidden lg:block rounded-2xl border border-border bg-surface overflow-hidden">
            <MiniMap items={view.items} home={view.tonight} width={400} height={240} />
          </div>
          <TonightCard
            date={today}
            stay={view.tonight}
            colorIndex={view.tonightColor}
            attachments={view.tonightAttachments}
            isLastDay={view.isLastDay}
            onOpen={() => view.tonight && ui.openResa('stay', view.tonight.id)}
            onAdd={() => ui.editStay(null, { date: today })}
            onViewAttachment={ui.viewAttachments}
          />
          {hasTomorrow && <DayPreviewCard date={tomorrow} label={tomorrowIsLast ? 'Demain · dernier jour' : 'Demain'} />}
        </aside>
      </div>
    </Page>
  )
}

/** Les étapes des jours du voyage (un jour masqué par un raccourcissement ne compte pas). */
function useStopCount() {
  const { dayKeys, stopsByDate } = useTripData()
  return useMemo(() => dayKeys.reduce((n, date) => n + (stopsByDate[date]?.length || 0), 0), [dayKeys, stopsByDate])
}

function BeforeTrip({ progress }) {
  const ui = useTripUI()
  const { trip, stays, transports, isLoading } = useTripData()
  const stops = useStopCount()
  const tomorrow = progress.daysUntil === 1

  return (
    <Page>
      <TripHeader trip={trip} onEdit={ui.editTrip} />
      <div className={COLUMNS}>
        <div className={STACK}>
          <section className={HERO_CARD}>
            <Glow />
            <div className="relative p-5 lg:p-6">
              <Eyebrow>Compte à rebours</Eyebrow>
              {tomorrow ? (
                <p className="mt-2 text-5xl font-semibold tracking-[-0.03em] text-fg">Demain</p>
              ) : (
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-6xl font-semibold tracking-[-0.04em] text-fg tabular">{progress.daysUntil}</span>
                  <span className="text-lg text-muted">jours</span>
                </p>
              )}
              <p className="mt-1 text-sm text-muted">Départ le {formatDayFr(trip.startDate)}</p>
            </div>
            <dl className="relative grid grid-cols-3 gap-3 border-t border-border px-5 py-4 lg:px-6">
              <Stat value={isLoading ? null : stays.length} singular="hébergement" />
              <Stat value={isLoading ? null : transports.length} singular="trajet" />
              <Stat value={isLoading ? null : stops} singular="étape" />
            </dl>
          </section>
          <DayPreviewCard date={trip.startDate} label={tomorrow ? 'Demain · jour 1' : 'Jour 1'} />
        </div>
        <aside className={cn(STACK, 'lg:sticky lg:top-6')}>
          <TripChecks />
        </aside>
      </div>
    </Page>
  )
}

function TripDone() {
  const ui = useTripUI()
  const { trip, dayKeys, nights, transports, isLoading } = useTripData()
  const stops = useStopCount()
  const booked = nights.filter((n) => n.stays.length > 0).length

  return (
    <Page>
      <TripHeader trip={trip} onEdit={ui.editTrip} />
      <section className={cn(HERO_CARD, 'mt-5')}>
        <Glow />
        <div className="relative p-6 lg:p-8 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center">
          <div>
            <span className="h-12 w-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
              <Flag size={22} />
            </span>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-fg">Voyage terminé</p>
            <p className="mt-1 text-sm text-muted">
              {formatTripRange(trip.startDate, trip.endDate)}. Tout reste là : les jours, les réservations, les captures.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => ui.openDay(trip.startDate)}>Revoir les jours</Button>
              <Button variant="secondary" onClick={() => ui.openTab('resas')}>Réservations</Button>
            </div>
          </div>
          <dl className="mt-6 lg:mt-0 grid grid-cols-2 gap-3">
            {[
              { value: dayKeys.length, singular: 'jour' },
              { value: booked, singular: 'nuit réservée', pluralForm: 'nuits réservées' },
              { value: stops, singular: 'étape' },
              { value: transports.length, singular: 'trajet' },
            ].map((s) => (
              <Stat
                key={s.singular}
                value={isLoading ? null : s.value}
                singular={s.singular}
                pluralForm={s.pluralForm}
                className="rounded-2xl bg-surface-2/70 px-4 py-3"
              />
            ))}
          </dl>
        </div>
      </section>
    </Page>
  )
}
