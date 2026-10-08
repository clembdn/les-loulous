import { useState } from 'react'
import { Pencil, Play } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useToday } from '@/shared/lib/useToday.js'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { useLegMode } from '../../hooks/useLegMode.js'
import { MAX_STOPS_PER_DAY, saveDay } from '../../services/daysService.js'
import { plural } from '../../utils/format.js'
import TripMap from '../map/TripMap.jsx'
import TonightCard from '../resas/TonightCard.jsx'
import { DayWeather } from '../weather/WeatherBadge.jsx'
import DayStrip from './DayStrip.jsx'
import DayTimeline from './DayTimeline.jsx'
import QuickAdd from './QuickAdd.jsx'
import ReorderList from './ReorderList.jsx'
import { DayDate, RouteLink } from './DayParts.jsx'

// En bas : la feuille qui monte sur la carte, et le bouton « Déroulé ».
const MAP_PADDING = { top: 40, bottom: 96, left: 44, right: 44 }

/**
 * Téléphone : le carnet de bord. La bande des nuits et les jours en haut, la
 * carte de la journée, puis la journée elle-même dans une feuille qui monte
 * sur la carte, et où l'on dort ce soir.
 *
 * La carte est figée (le doigt fait défiler la page, pas la carte) : un tap
 * l'ouvre en grand, en « déroulé » étape par étape. En bas de la frise, la
 * saisie rapide ; « Réorganiser » passe les étapes en liste à poignées.
 */
export default function DayViewMobile({ date }) {
  const today = useToday()
  const ui = useTripUI()
  const { currentUid } = useAuth()
  const { tripId, days, stopsByDate, dayKeys, nights, segments, colorIndexByStay, attachmentsByParent, isLoading } = useTripData()
  const view = useDayView(date)
  const setLegMode = useLegMode(date)
  const openRunner = () => ui.openRunner(date)
  // Mode « Réorganiser » : l'ordre en cours (identifiants), enregistré en sortant.
  const [order, setOrder] = useState(null)
  const stops = stopsByDate[date] || []
  const reordering = order !== null

  function toggleReorder() {
    if (!reordering) {
      setOrder(stops.map((s) => s.id))
      return
    }
    const changed = order.some((id, i) => id !== stops[i]?.id)
    if (changed) {
      const before = stops
      const byId = Object.fromEntries(stops.map((s) => [s.id, s]))
      // Une étape ajoutée entre-temps (par l'autre, sur son téléphone) n'est
      // pas dans `order` : on la garde, en fin de journée, plutôt que de l'effacer.
      const next = [...order.map((id) => byId[id]).filter(Boolean), ...stops.filter((s) => !order.includes(s.id))]
      saveDay(tripId, date, { stops: next }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))
      toast.success('Nouvel ordre enregistré', {
        action: { label: 'Annuler', onClick: () => saveDay(tripId, date, { stops: before }, days[date], currentUid) },
      })
    }
    setOrder(null)
  }

  return (
    <div className="max-w-xl mx-auto pb-28">
      <div className="bg-surface pt-3 pb-3">
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

      <div className="relative">
        <TripMap
          items={view.items}
          legs={view.legs}
          home={view.tonight}
          colorIndexByStay={colorIndexByStay}
          fallbackCenter={ui.near}
          onPress={openRunner}
          pressLabel="Dérouler la journée sur la carte"
          padding={MAP_PADDING}
          className="h-[clamp(220px,38vh,320px)]"
        />
        {view.items.length > 0 && (
          <button
            type="button"
            onClick={openRunner}
            className="absolute right-3 bottom-7 z-[2] h-10 pl-3.5 pr-4 inline-flex items-center gap-2 rounded-full bg-surface text-sm font-semibold text-accent shadow-[0_2px_12px_rgb(17_20_27/0.18)] active:scale-[0.97] transition"
          >
            <Play size={14} fill="currentColor" /> Déroulé
          </button>
        )}
      </div>

      <article className="relative z-[2] -mt-4 rounded-t-[20px] bg-surface pt-4 pb-3">
        <header className="px-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <DayDate date={date} today={today} />
            {ui.editDay ? (
              <button type="button" onClick={() => ui.editDay(date)} className="group mt-1 flex items-center gap-1.5 max-w-full text-left">
                <span className={view.day?.title ? 'text-[22px] leading-7 font-semibold tracking-[-0.01em] text-fg truncate' : 'text-[22px] leading-7 text-muted'}>
                  {view.day?.title || 'Donner un titre'}
                </span>
                <Pencil size={14} className="shrink-0 text-muted group-hover:text-fg" />
              </button>
            ) : view.day?.title && (
              <h2 className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.01em] text-fg truncate">{view.day.title}</h2>
            )}
            <p className="mt-1 text-[13px] text-muted tabular">
              Jour {view.dayNumber}/{dayKeys.length}
              {view.stopCount > 0 && ` · ${plural(view.stopCount, 'étape')}`}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <DayWeather date={date} className="mt-1 text-sm" />
            {stops.length > 1 && !ui.readOnly && (
              <button
                type="button"
                onClick={toggleReorder}
                className={reordering
                  ? 'h-9 px-3.5 rounded-full bg-accent text-accent-fg text-[14px] font-semibold'
                  : 'h-9 px-1 text-[14px] font-medium text-accent'}
              >
                {reordering ? 'Terminé' : 'Réorganiser'}
              </button>
            )}
          </div>
        </header>

        <div className="px-2 pt-2">
          {reordering && (
            <ReorderList
              stops={order.map((id) => stops.find((s) => s.id === id)).filter(Boolean)}
              onChange={setOrder}
            />
          )}
          {!reordering && (isLoading ? (
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
              onStop={(stop) => ui.openStop(date, stop)}
              onResa={ui.openResa}
              onLegMode={setLegMode}
            />
          ))}
          {!isLoading && !reordering && view.items.length === 0 && (
            <p className="px-2 py-3 text-[15px] text-muted">Rien de prévu pour l’instant.</p>
          )}
          {!reordering && !ui.readOnly && (
            <QuickAdd
              date={date}
              near={view.near || ui.near}
              disabled={view.stopCount >= MAX_STOPS_PER_DAY}
              className="px-2 pt-2"
            />
          )}
          {!reordering && view.routeUrl && (
            <div className="px-2 pt-3 text-center">
              <RouteLink url={view.routeUrl} />
            </div>
          )}
        </div>
      </article>

      <TonightCard
        className="mx-3 mt-3"
        date={date}
        stay={view.tonight}
        colorIndex={view.tonightColor}
        attachments={view.tonightAttachments}
        isLastDay={view.isLastDay}
        onOpen={() => view.tonight && ui.openResa('stay', view.tonight.id)}
        onAdd={ui.editStay && (() => ui.editStay(null, { date }))}
        onViewAttachment={ui.viewAttachments}
      />

      {view.day?.notes && (
        <section className="mx-3 mt-3 rounded-2xl bg-surface px-4 py-3">
          <p className="text-[13px] font-semibold text-muted">Notes</p>
          <p className="mt-1 text-[15px] text-fg whitespace-pre-line">{view.day.notes}</p>
        </section>
      )}
    </div>
  )
}
