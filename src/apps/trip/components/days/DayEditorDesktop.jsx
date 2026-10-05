import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useToday } from '@/shared/lib/useToday.js'
import { Button } from '@/shared/ui/Button.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { MAX_STOPS_PER_DAY, saveDay, saveDays } from '../../services/daysService.js'
import { insertionPointByTime, moveStop } from '../../utils/timeline.js'
import { plural } from '../../utils/format.js'
import TripHeader from '../trips/TripHeader.jsx'
import MiniMap from '../map/MiniMap.jsx'
import TonightCard from '../resas/TonightCard.jsx'
import DayList from './DayList.jsx'
import DayTimeline from './DayTimeline.jsx'
import { AddStopButton, DayDate, RouteLink } from './DayParts.jsx'

const sameOrder = (a = [], b = []) => a.length === b.length && a.every((s, i) => s.id === b[i]?.id)

/**
 * Ordinateur : l'éditeur. Les jours à gauche (avec la bande des nuits), la
 * journée choisie au centre, la carte et « ce soir » à droite (dès `xl`).
 *
 * Les étapes se glissent-déposent : dans leur journée pour les réordonner,
 * ou sur un jour de la colonne de gauche pour les y envoyer (rangées à leur
 * heure). Glisser-déposer HTML natif — pas de bibliothèque : la souris suffit,
 * le téléphone a ses boutons dans la fiche de l'étape.
 */
export default function DayEditorDesktop({ date }) {
  const { currentUid } = useAuth()
  const today = useToday()
  const ui = useTripUI()
  const {
    trip, tripId, days, dayKeys, nights, timelines, stopsByDate, colorIndexByStay, attachmentsByParent,
  } = useTripData()
  const view = useDayView(date)

  const [drag, setDrag] = useState(null) // { stopId, fromDate }
  const [drop, setDrop] = useState(null) // { date, beforeId } — position dans la journée affichée
  const [dropDay, setDropDay] = useState(null) // jour survolé dans la colonne de gauche

  function reset() {
    setDrag(null)
    setDrop(null)
    setDropDay(null)
  }

  function commit(toDate, beforeId) {
    if (!drag) return
    const changes = moveStop(stopsByDate, { fromDate: drag.fromDate, stopId: drag.stopId, toDate, beforeId })
    const unchanged = !changes || (toDate === drag.fromDate && sameOrder(changes[toDate], stopsByDate[toDate]))
    if (unchanged) return reset()
    if (changes[toDate].length > MAX_STOPS_PER_DAY) {
      toast.error(`${MAX_STOPS_PER_DAY} étapes maximum par jour`)
      return reset()
    }
    const patches = Object.fromEntries(Object.entries(changes).map(([d, stops]) => [d, { stops }]))
    saveDays(tripId, patches, days, currentUid).catch(() => toast.error('Déplacement impossible'))
    if (toDate !== drag.fromDate) toast.success(`Étape déplacée au ${formatDayFr(toDate)}`)
    reset()
  }

  const dnd = {
    draggingId: drag?.stopId ?? null,
    dropActive: !!drag && drop?.date === date,
    dropBeforeId: drop?.date === date ? drop.beforeId : undefined,
    onDragStart: (stopId) => setDrag({ stopId, fromDate: date }),
    onDragOver: (e, beforeId) => {
      if (!drag) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (drop?.date !== date || drop.beforeId !== beforeId) setDrop({ date, beforeId })
      if (dropDay) setDropDay(null)
    },
    onDrop: (e) => {
      e.preventDefault()
      commit(date, drop?.date === date ? drop.beforeId : null)
    },
    onDragEnd: reset,
  }

  function dragOverDay(e, day) {
    if (!drag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropDay !== day) setDropDay(day)
    if (drop) setDrop(null)
  }

  function dropOnDay(e, day) {
    e.preventDefault()
    if (!drag) return
    if (day === drag.fromDate) return reset()
    const moved = (stopsByDate[drag.fromDate] || []).find((s) => s.id === drag.stopId)
    commit(day, insertionPointByTime(stopsByDate[day] || [], moved?.time))
  }

  const tonight = (
    <TonightCard
      date={date}
      stay={view.tonight}
      colorIndex={view.tonightColor}
      attachments={view.tonightAttachments}
      isLastDay={view.isLastDay}
      onOpen={() => view.tonight && ui.openResa('stay', view.tonight.id)}
      onAdd={() => ui.editStay(null, { date })}
      onViewAttachment={ui.viewAttachments}
    />
  )

  return (
    <div className="max-w-[1600px] mx-auto px-6 xl:px-8 pt-7 pb-12">
      <TripHeader
        trip={trip}
        onEdit={ui.editTrip}
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => ui.editStay(null, { date })}>
              <Plus size={15} /> Hébergement
            </Button>
            <Button variant="secondary" size="sm" onClick={() => ui.editTransport(null, { date })}>
              <Plus size={15} /> Trajet
            </Button>
          </>
        )}
      />

      <div className="mt-6 grid gap-6 items-start lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_23rem]">
        <aside className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto -ml-2 pr-1">
          <DayList
            dayKeys={dayKeys}
            nights={nights}
            timelines={timelines}
            colorIndexByStay={colorIndexByStay}
            days={days}
            selected={date}
            today={today}
            dropDate={dropDay}
            onSelect={(d) => ui.openDay(d, { replace: true })}
            onDragOverDay={dragOverDay}
            onDropOnDay={dropOnDay}
          />
        </aside>

        <div className="space-y-4 min-w-0">
          <section className="rounded-2xl border border-border bg-surface overflow-hidden">
            <header className="px-5 pt-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <DayDate date={date} today={today} />
                <span className="text-xs text-muted tabular">
                  Jour {view.dayNumber}/{dayKeys.length} · {plural(view.stopCount, 'étape')}
                </span>
              </div>
              <InlineText
                key={`title-${date}`}
                value={view.day?.title || ''}
                placeholder="Titre de la journée"
                maxLength={120}
                className="mt-1 w-full text-xl font-semibold tracking-[-0.01em] text-fg placeholder:text-faint"
                onSave={(title) => saveDay(tripId, date, { title }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))}
              />
              <InlineText
                key={`notes-${date}`}
                multiline
                value={view.day?.notes || ''}
                placeholder="Notes de la journée…"
                maxLength={2000}
                className="mt-1 w-full text-sm text-muted placeholder:text-faint resize-none"
                onSave={(notes) => saveDay(tripId, date, { notes }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))}
              />
            </header>

            <div className="xl:hidden">
              <MiniMap items={view.items} home={view.tonight} width={640} height={240} />
            </div>

            <div className="p-3">
              <DayTimeline
                items={view.items}
                legs={view.legs}
                attachmentsByParent={attachmentsByParent}
                colorIndexByStay={colorIndexByStay}
                onStop={(stop) => ui.editStop(date, stop)}
                onResa={ui.openResa}
                dnd={dnd}
              />
              {view.items.length === 0 && (
                <p className="px-2 py-3 text-sm text-faint">Rien de prévu. Collez le lien Google Maps d’une étape pour commencer.</p>
              )}
              <div
                className="pt-2"
                onDragOver={(e) => dnd.onDragOver(e, null)}
                onDrop={dnd.onDrop}
              >
                <AddStopButton onClick={() => ui.editStop(date)} disabled={view.stopCount >= MAX_STOPS_PER_DAY} />
              </div>
            </div>
          </section>
          <div className="xl:hidden">{tonight}</div>
        </div>

        <aside className="hidden xl:block sticky top-6 space-y-4">
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <MiniMap items={view.items} home={view.tonight} width={400} height={320} />
            <div className="px-4 py-2.5 flex justify-end border-t border-border">
              {view.routeUrl ? <RouteLink url={view.routeUrl} /> : <span className="text-xs text-faint">Le parcours apparaît avec deux lieux localisés.</span>}
            </div>
          </div>
          {tonight}
        </aside>
      </div>
    </div>
  )
}

/**
 * Un texte modifiable en place, enregistré quand on quitte le champ (ou
 * Entrée pour le titre). La valeur distante ne remplace la saisie que si le
 * champ n'a pas le focus : l'autre peut modifier la journée sans effacer ce
 * qu'on est en train de taper.
 */
function InlineText({ value, onSave, multiline = false, className, ...rest }) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  // Échap abandonne la saisie : le `blur` qui suit ne doit pas l'enregistrer.
  const cancelled = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      value={draft}
      rows={multiline ? Math.min(6, Math.max(1, draft.split('\n').length)) : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { focused.current = true }}
      onBlur={() => {
        focused.current = false
        if (cancelled.current) {
          cancelled.current = false
          setDraft(value)
          return
        }
        if (draft.trim() !== value.trim()) onSave(draft)
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      className={`bg-transparent rounded-md -mx-1 px-1 focus:outline-none focus:bg-surface-2 transition ${className}`}
      {...rest}
    />
  )
}
