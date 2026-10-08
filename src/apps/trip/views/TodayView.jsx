import { useMemo } from 'react'
import { CalendarPlus, ChevronRight, Flag, Share2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr, shiftDateKey } from '@/shared/lib/dates.js'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { useTripUI } from '../context/TripUIContext.jsx'
import { useDayView } from '../hooks/useDayView.js'
import { useLegMode } from '../hooks/useLegMode.js'
import { useNow } from '../hooks/useNow.js'
import { tripProgress } from '../utils/tripDates.js'
import { focusOf } from '../utils/today.js'
import { pastKeys } from '../utils/timeline.js'
import { formatProgress, formatTripRange } from '../utils/format.js'
import TripHeader from '../components/trips/TripHeader.jsx'
import TripMap from '../components/map/TripMap.jsx'
import OfflineBadge from '../components/OfflineBadge.jsx'
import TonightCard from '../components/resas/TonightCard.jsx'
import DayTimeline from '../components/days/DayTimeline.jsx'
import { RouteLink } from '../components/days/DayParts.jsx'
import { DayWeather } from '../components/weather/WeatherBadge.jsx'
import NextUpCard from '../components/today/NextUpCard.jsx'
import DayPreviewCard from '../components/today/DayPreviewCard.jsx'
import TripChecks from '../components/today/TripChecks.jsx'
import { RecapCountries, RecapDays, RecapDistances, RecapMap } from '../components/today/TripRecap.jsx'
import { useTripRecap } from '../hooks/useTripRecap.js'
import { formatKm } from '../utils/recap.js'
import { CARD, Eyebrow, HERO_CARD, SectionTitle, Stat } from '../components/today/parts.jsx'

/**
 * Le premier écran d'un voyage — « Aperçu » avant, « Aujourd'hui » pendant,
 * « Bilan » après (cf. config/navigation.js), souvent ouvert sans réseau.
 *
 *  · pendant : ce qui vient (en grand, avec « Y aller » et le déroulé), la
 *    journée avec le passé grisé, où l'on dort ce soir, et demain ;
 *  · avant : le compte à rebours, le premier jour, ce qu'il reste à régler ;
 *  · après : le voyage terminé.
 *
 * Il vit à l'horloge (`useNow`, à la minute) : « dans 1 h 20 » devient
 * « dans 1 h 19 », l'étape finie se grise, minuit fait passer à demain.
 * Ordinateur : deux colonnes, la journée à gauche, la carte, le soir et demain à droite.
 */
export default function TodayView() {
  const { today, time } = useNow()
  const { trip } = useTripData()
  const progress = tripProgress(trip, today)

  if (progress.status === 'upcoming') return <BeforeTrip progress={progress} />
  if (progress.status === 'past') return <TripDone />
  return <DuringTrip today={today} now={time} progress={progress} />
}

function Page({ children }) {
  return <div className="max-w-xl lg:max-w-6xl mx-auto px-3 lg:px-8 pt-4 lg:pt-7 pb-28 lg:pb-12">{children}</div>
}

/**
 * L'en-tête : un grand titre sur téléphone (le voyage est déjà nommé dans la
 * barre du haut), l'en-tête du voyage sur ordinateur.
 */
function Heading({ title, subtitle }) {
  const ui = useTripUI()
  const { trip } = useTripData()
  return (
    <>
      <div className="lg:hidden px-1 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg">{title}</h1>
          <p className="mt-0.5 text-[15px] text-muted first-letter:uppercase">{subtitle}</p>
          <OfflineBadge tripId={trip.id} className="mt-1.5" />
        </div>
        <button
          type="button"
          onClick={ui.exportCalendar}
          aria-label="Ajouter à l’agenda"
          className="mt-1 h-10 w-10 shrink-0 rounded-full bg-surface text-accent inline-flex items-center justify-center shadow-sm"
        >
          <CalendarPlus size={17} />
        </button>
        {ui.shareTrip && (
          <button
            type="button"
            onClick={ui.shareTrip}
            className="mt-1 h-10 px-3.5 shrink-0 rounded-full bg-surface text-accent text-[14px] font-semibold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Share2 size={15} /> Partager
          </button>
        )}
      </div>
      <TripHeader trip={trip} onEdit={ui.editTrip} onShare={ui.shareTrip} onExport={ui.exportCalendar} className="hidden lg:flex" />
    </>
  )
}

const COLUMNS = 'mt-5 grid gap-5 items-start lg:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]'
const STACK = 'min-w-0 space-y-5 lg:space-y-6'

function DuringTrip({ today, now, progress }) {
  const ui = useTripUI()
  const wide = useMediaQuery('(min-width: 1024px)')
  const { trip, dayKeys, attachmentsByParent, colorIndexByStay, isLoading } = useTripData()
  const view = useDayView(today)
  const setLegMode = useLegMode(today)
  const focus = useMemo(() => focusOf(view.items, now), [view.items, now])
  const past = useMemo(() => pastKeys(view.items, now), [view.items, now])
  const tomorrow = shiftDateKey(today, 1)
  const hasTomorrow = dayKeys.includes(tomorrow)
  const tomorrowIsLast = tomorrow === dayKeys[dayKeys.length - 1]

  return (
    <Page>
      <Heading title="Aujourd’hui" subtitle={`${formatDayFr(today)} · ${formatProgress(progress, trip.endDate).toLowerCase()}`} />
      <div className={COLUMNS}>
        <div className={STACK}>
          {isLoading
            ? <Skeleton className="h-72 rounded-3xl" />
            : <NextUpCard date={today} focus={focus} items={view.items} legs={view.legs} past={past} tonight={view.tonight} isLastDay={view.isLastDay} />}

          <section>
            <SectionTitle className="flex items-center justify-between">
              <span>{view.day?.title || 'La journée'}</span>
              <DayWeather date={today} className="text-sm font-normal" />
            </SectionTitle>
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-2 pt-2 pb-1">
                {isLoading ? (
                  <div className="px-2 py-2 space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : (
                  <DayTimeline
                    items={view.items}
                    legs={view.legs}
                    attachmentsByParent={attachmentsByParent}
                    colorIndexByStay={colorIndexByStay}
                    onStop={(stop) => ui.openStop(today, stop)}
                    onResa={ui.openResa}
                    onLegMode={setLegMode}
                    now={now}
                  />
                )}
                {!isLoading && view.items.length === 0 && (
                  <p className="px-2 py-3 text-[15px] text-muted">Rien de prévu aujourd’hui.</p>
                )}
              </div>
              <footer className="border-t border-border px-4 h-12 flex items-center justify-between gap-3">
                <RouteLink url={view.routeUrl} />
                <button
                  type="button"
                  onClick={() => ui.openDay(today)}
                  className="ml-auto h-11 inline-flex items-center gap-0.5 text-[14px] font-medium text-accent"
                >
                  La journée et sa carte <ChevronRight size={15} />
                </button>
              </footer>
            </div>
          </section>
        </div>

        <aside className={cn(STACK, 'lg:sticky lg:top-6')}>
          {/* Sur ordinateur, la place ne manque pas : toute la journée sur la carte. */}
          {wide && view.items.length > 0 && (
            <div className={cn(CARD, 'overflow-hidden')}>
              <TripMap
                items={view.items}
                legs={view.legs}
                home={view.tonight}
                colorIndexByStay={colorIndexByStay}
                pastKeys={past}
                activeKey={focus.item?.key}
                onPress={() => ui.openRunner(today, focus.item?.key)}
                pressLabel="Dérouler la journée sur la carte"
                className="h-72"
              />
            </div>
          )}
          <section>
            <SectionTitle>Ce soir</SectionTitle>
            <TonightCard
              date={today}
              stay={view.tonight}
              colorIndex={view.tonightColor}
              attachments={view.tonightAttachments}
              isLastDay={view.isLastDay}
              onOpen={() => view.tonight && ui.openResa('stay', view.tonight.id)}
              onAdd={ui.editStay && (() => ui.editStay(null, { date: today }))}
              onViewAttachment={ui.viewAttachments}
              hideLabel
            />
          </section>
          {hasTomorrow && (
            <section>
              <SectionTitle>{tomorrowIsLast ? 'Demain · dernier jour' : 'Demain'}</SectionTitle>
              <DayPreviewCard date={tomorrow} />
            </section>
          )}
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
      <Heading title="Aperçu" subtitle={formatTripRange(trip.startDate, trip.endDate)} />
      <div className={COLUMNS}>
        <div className={STACK}>
          <section className={HERO_CARD}>
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
              <p className="mt-1 text-[15px] text-muted">Départ le {formatDayFr(trip.startDate)}</p>
            </div>
            <dl className="relative grid grid-cols-3 gap-3 border-t border-border px-5 py-4 lg:px-6">
              <Stat value={isLoading ? null : stays.length} singular="hébergement" />
              <Stat value={isLoading ? null : transports.length} singular="trajet" />
              <Stat value={isLoading ? null : stops} singular="étape" />
            </dl>
          </section>
          <section>
            <SectionTitle>{tomorrow ? 'Demain · jour 1' : 'Jour 1'}</SectionTitle>
            <DayPreviewCard date={trip.startDate} />
          </section>
        </div>
        {/* Ce qu'il reste à régler regarde ceux qui préparent, pas leurs invités. */}
        {!ui.readOnly && (
          <aside className={cn(STACK, 'lg:sticky lg:top-6')}>
            <TripChecks />
          </aside>
        )}
      </div>
    </Page>
  )
}

/**
 * Après le voyage, le bilan : ce qu'on a parcouru (par la route, en train, en
 * avion), où l'on est passé (pays, villes, jour par jour), et tout le trajet
 * sur une carte (cf. utils/recap.js).
 */
function TripDone() {
  const ui = useTripUI()
  const { trip, dayKeys, isLoading } = useTripData()
  const { recap, route, countries } = useTripRecap()

  return (
    <Page>
      <Heading title="Bilan" subtitle={formatTripRange(trip.startDate, trip.endDate)} />
      <section className={cn(HERO_CARD, 'mt-5')}>
        <div className="relative p-6 lg:p-8 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center">
          <div>
            <span className="h-12 w-12 rounded-2xl bg-accent text-accent-fg flex items-center justify-center">
              <Flag size={22} />
            </span>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-fg">Voyage terminé</p>
            <p className="mt-1 text-[15px] text-muted">
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
              { value: formatKm(recap.distance.totalM), singular: 'parcourus', pluralForm: 'parcourus' },
              { value: recap.stops, singular: 'étape' },
              { value: countries?.length, singular: 'pays', pluralForm: 'pays' },
            ].map((s) => (
              <Stat
                key={s.singular}
                value={isLoading ? null : s.value}
                singular={s.singular}
                pluralForm={s.pluralForm}
                className="rounded-2xl bg-surface-2 px-4 py-3"
              />
            ))}
          </dl>
        </div>
      </section>
      <div className={COLUMNS}>
        <div className={STACK}>
          <RecapMap route={route} />
          <RecapDays perDay={recap.perDay} />
        </div>
        <aside className={cn(STACK, 'lg:sticky lg:top-6')}>
          <RecapDistances distance={recap.distance} />
          <RecapCountries countries={countries} />
        </aside>
      </div>
    </Page>
  )
}
