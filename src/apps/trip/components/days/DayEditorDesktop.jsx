import { useEffect, useRef, useState } from 'react'
import { MapPin, Play, Plus, X } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useToday } from '@/shared/lib/useToday.js'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { Button } from '@/shared/ui/Button.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { useAddStop } from '../../hooks/useAddStop.js'
import { useLegMode } from '../../hooks/useLegMode.js'
import { getCategory } from '../../config/categories.js'
import { MAX_STOPS_PER_DAY, saveDay, saveDays } from '../../services/daysService.js'
import { insertionPointByTime, moveStop } from '../../utils/timeline.js'
import { plural } from '../../utils/format.js'
import TripHeader from '../trips/TripHeader.jsx'
import TripMap from '../map/TripMap.jsx'
import TonightCard from '../resas/TonightCard.jsx'
import { DayWeather } from '../weather/WeatherBadge.jsx'
import DayList from './DayList.jsx'
import DayTimeline from './DayTimeline.jsx'
import QuickAdd from './QuickAdd.jsx'
import { DayDate, RouteLink } from './DayParts.jsx'

const sameOrder = (a = [], b = []) => a.length === b.length && a.every((s, i) => s.id === b[i]?.id)

/**
 * Ordinateur : l'éditeur. Les jours à gauche (avec la bande des nuits), la
 * journée choisie au centre, et la vraie carte qui prend toute la place
 * restante à droite (dès `xl`) : survoler une étape allume son repère, et
 * inversement. Entre `lg` et `xl`, la carte passe au-dessus de la frise.
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
  const { readOnly } = ui
  const {
    trip, tripId, days, dayKeys, nights, timelines, stopsByDate, colorIndexByStay, attachmentsByParent,
  } = useTripData()
  const view = useDayView(date)
  const setLegMode = useLegMode(date)

  const [drag, setDrag] = useState(null) // { stopId, fromDate }
  const [drop, setDrop] = useState(null) // { date, beforeId } — position dans la journée affichée
  const [dropDay, setDropDay] = useState(null) // jour survolé dans la colonne de gauche
  const [hoverKey, setHoverKey] = useState(null) // élément allumé dans la frise et sur la carte
  // Une seule carte montée (un contexte WebGL) : à droite dès `xl`, au-dessus de la frise avant.
  const wide = useMediaQuery('(min-width: 1280px)')
  const timelineRef = useRef(null)

  // Un lieu touché sur la carte, en attente d'être ajouté.
  const [picked, setPicked] = useState(null)
  const addStop = useAddStop()
  const quickAddRef = useRef(null)
  useEffect(() => setPicked(null), [date])

  // Raccourcis : N pour une nouvelle étape, ← → pour le jour d'avant ou
  // d'après. Pas pendant qu'on tape, ni quand une feuille est ouverte.
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (el?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"]')) return
      const i = dayKeys.indexOf(date)
      if ((e.key === 'n' || e.key === 'N') && !readOnly) {
        e.preventDefault()
        quickAddRef.current?.focus()
      } else if (e.key === 'ArrowLeft' && i > 0) {
        ui.openDay(dayKeys[i - 1], { replace: true })
      } else if (e.key === 'ArrowRight' && i < dayKeys.length - 1) {
        ui.openDay(dayKeys[i + 1], { replace: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [date, dayKeys, ui, readOnly])

  // Un repère cliqué sur la carte : son élément de frise s'allume et vient sous les yeux.
  function selectOnMap(key) {
    setHoverKey(key)
    timelineRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

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

  const dnd = readOnly ? null : {
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
      onAdd={ui.editStay && (() => ui.editStay(null, { date }))}
      onViewAttachment={ui.viewAttachments}
    />
  )

  const map = (className) => (
    <TripMap
      items={view.items}
      legs={view.legs}
      home={view.tonight}
      colorIndexByStay={colorIndexByStay}
      activeKey={hoverKey}
      onHover={setHoverKey}
      onSelect={selectOnMap}
      fallbackCenter={ui.near}
      interactive
      controls
      attribution="bottom-left"
      padding={{ top: 60, bottom: 60, left: 60, right: 60 }}
      onPlaceClick={readOnly ? undefined : setPicked}
      preview={picked}
      fitKey={date}
      className={className}
    />
  )

  // La fiche du lieu touché, posée sur la carte : on l'ajoute en un clic.
  const pickedCard = picked && (
    <div className="absolute left-3 right-3 top-3 z-10 mx-auto max-w-sm rounded-2xl bg-surface p-3.5 shadow-[0_10px_32px_rgb(17_20_27/0.22)]">
      <div className="flex items-start gap-3">
        <span
          className="h-9 w-9 shrink-0 rounded-full text-white flex items-center justify-center"
          style={{ backgroundColor: getCategory(picked.category).color }}
        >
          <MapPin size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg truncate">{picked.name}</p>
          <p className="text-[13px] text-muted">{picked.category ? getCategory(picked.category).label : 'Lieu de la carte'}</p>
        </div>
        <button type="button" onClick={() => setPicked(null)} aria-label="Fermer" className="h-8 w-8 -mr-1 -mt-1 rounded-full flex items-center justify-center text-muted hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>
      <Button
        className="mt-3 w-full"
        disabled={view.stopCount >= MAX_STOPS_PER_DAY}
        onClick={() => { if (addStop(date, picked)) setPicked(null) }}
      >
        <Plus size={15} /> Ajouter au {formatDayFr(date)}
      </Button>
    </div>
  )

  return (
    <div className="max-w-[1800px] mx-auto px-6 xl:px-8 pt-7 pb-12 grid gap-6 items-start lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,27rem)_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(0,30rem)_minmax(0,1fr)]">
      <TripHeader
        trip={trip}
        onEdit={ui.editTrip}
        onShare={ui.shareTrip}
        className="lg:col-span-2"
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => ui.openRunner(date)} disabled={!view.items.length}>
              <Play size={14} /> Déroulé
            </Button>
            {ui.newItem && (
              <Button size="sm" onClick={() => ui.newItem(date)}>
                <Plus size={15} /> Ajouter
              </Button>
            )}
          </>
        )}
      />

      {/* La carte occupe toute la hauteur de l'écran, en-tête compris, et
          reste en place quand la journée défile. */}
      {wide && (
        <aside className="col-start-3 row-start-1 row-span-2 sticky top-6 h-[calc(100vh-3rem)] min-h-[480px] rounded-2xl overflow-hidden shadow-sm">
          {map('h-full')}
          {pickedCard}
        </aside>
      )}

      <aside className="row-start-2 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto no-scrollbar -ml-2 pr-1">
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

      <div className="row-start-2 space-y-4 min-w-0">
        <section className="rounded-2xl bg-surface shadow-sm overflow-hidden">
          <header className="px-5 pt-4 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <DayDate date={date} today={today} />
              <span className="flex items-center gap-3">
                <DayWeather date={date} className="text-sm" />
                <span className="text-[13px] text-muted tabular">
                  Jour {view.dayNumber}/{dayKeys.length} · {plural(view.stopCount, 'étape')}
                </span>
              </span>
            </div>
            {readOnly ? (
              <>
                {view.day?.title && <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-fg">{view.day.title}</h2>}
                {view.day?.notes && <p className="mt-1 text-[15px] text-muted whitespace-pre-line">{view.day.notes}</p>}
              </>
            ) : (
              <>
                <InlineText
                  key={`title-${date}`}
                  value={view.day?.title || ''}
                  placeholder="Titre de la journée"
                  maxLength={120}
                  className="mt-1 w-full text-[22px] font-semibold tracking-[-0.01em] text-fg placeholder:text-muted"
                  onSave={(title) => saveDay(tripId, date, { title }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))}
                />
                <InlineText
                  key={`notes-${date}`}
                  multiline
                  value={view.day?.notes || ''}
                  placeholder="Notes de la journée…"
                  maxLength={2000}
                  className="mt-1 w-full text-[15px] text-muted placeholder:text-muted/70 resize-none"
                  onSave={(notes) => saveDay(tripId, date, { notes }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))}
                />
              </>
            )}
          </header>

          {!wide && map('h-72')}

          <div ref={timelineRef} className="p-3">
            <DayTimeline
              items={view.items}
              legs={view.legs}
              attachmentsByParent={attachmentsByParent}
              colorIndexByStay={colorIndexByStay}
              onStop={(stop) => ui.openStop(date, stop)}
              onResa={ui.openResa}
              onLegMode={setLegMode}
              dnd={dnd}
              activeKey={hoverKey}
              onHover={setHoverKey}
            />
            {view.items.length === 0 && (
              <p className="px-2 py-3 text-[15px] text-muted">
                {readOnly ? 'Rien de prévu ce jour-là.' : 'Rien de prévu. Tapez un lieu, collez un lien Google Maps, ou cliquez un lieu de la carte.'}
              </p>
            )}
            {dnd && (
              <div
                className="pt-2"
                onDragOver={(e) => dnd.onDragOver(e, null)}
                onDrop={dnd.onDrop}
              >
                <QuickAdd
                  ref={quickAddRef}
                  date={date}
                  near={view.near || ui.near}
                  disabled={view.stopCount >= MAX_STOPS_PER_DAY}
                />
                <p className="mt-2 px-1 text-[12px] text-muted">
                  <kbd className="font-mono">N</kbd> nouvelle étape · <kbd className="font-mono">←</kbd> <kbd className="font-mono">→</kbd> autre jour · cliquez un lieu de la carte pour l’ajouter
                </p>
              </div>
            )}
            {view.routeUrl && (
              <div className="px-2 pt-3 text-right">
                <RouteLink url={view.routeUrl} />
              </div>
            )}
          </div>
        </section>
        {tonight}
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
