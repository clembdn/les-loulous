import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BedDouble, ChevronRight, Footprints, Maximize2, Navigation, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr, shiftDateKey } from '@/shared/lib/dates.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useTripWeather } from '../../context/TripWeatherContext.jsx'
import { useDayView } from '../../hooks/useDayView.js'
import { useNow } from '../../hooks/useNow.js'
import { stayColor } from '../../config/palette.js'
import { goUrl } from '../../utils/mapsUrl.js'
import { destinationOf, focusOf } from '../../utils/today.js'
import { pastKeys } from '../../utils/timeline.js'
import { formatDistance } from '../../utils/geo.js'
import { formatUntil, plural } from '../../utils/format.js'
import TripMap from '../map/TripMap.jsx'
import ItemBadge from '../ItemBadge.jsx'
import WeatherBadge from '../weather/WeatherBadge.jsx'
import { itemText } from './itemText.js'

const GAP = 12
const MAP_PADDING = { top: 96, bottom: 270, left: 48, right: 48 }

/**
 * Le déroulé : la journée en plein écran sur la carte, étape par étape.
 *
 * En bas, une carte par élément de la frise, qu'on fait défiler du pouce ;
 * la carte vole jusqu'à celui qu'on regarde et allume le tronçon qui y mène.
 * Toucher un repère amène sa carte. Ouvert depuis l'écran Aujourd'hui, il
 * commence à la prochaine étape (`?depart=<clé>`).
 */
export default function DayRunner({ date }) {
  const ui = useTripUI()
  const [params] = useSearchParams()
  const { dayKeys, colorIndexByStay } = useTripData()
  const { weatherOf } = useTripWeather()
  const { today, time } = useNow()
  const day = dayKeys.includes(date) ? date : dayKeys[0]
  const view = useDayView(day)
  const isToday = day === today
  const tomorrow = shiftDateKey(day, 1)
  const hasTomorrow = dayKeys.includes(tomorrow)

  const past = useMemo(() => (isToday ? pastKeys(view.items, time) : null), [isToday, view.items, time])
  const focus = useMemo(() => (isToday ? focusOf(view.items, time) : null), [isToday, view.items, time])

  // Une carte par élément de la frise, plus l'hébergement du soir s'il
  // n'apparaît pas déjà dans la journée (deuxième nuit au même endroit).
  const cards = useMemo(() => {
    const list = view.items.map((item, i) => ({
      key: item.key,
      mapKey: item.key,
      item,
      prev: i > 0 ? view.items[i - 1] : null,
      leg: i > 0 ? view.legs[view.items[i - 1].key] : null,
    }))
    const tonightInDay = view.tonight && view.items.some((it) => it.stay?.id === view.tonight.id && it.type === 'checkin')
    if (view.tonight && !tonightInDay) {
      list.push({ key: 'tonight', mapKey: `home-${view.tonight.id}`, tonight: view.tonight })
    }
    return list
  }, [view.items, view.legs, view.tonight])

  const startKey = params.get('depart') || (focus?.item ? focus.item.key : null)
  const [active, setActive] = useState(() => Math.max(0, cards.findIndex((c) => c.key === startKey)))
  const [overview, setOverview] = useState(false)
  const scroller = useRef(null)
  const settle = useRef(null)
  const count = cards.length + (hasTomorrow ? 1 : 0)
  const index = Math.min(active, Math.max(0, count - 1))
  const current = cards[index] || null

  // La carte de départ, au centre sans animation — dès que la journée est
  // là : ouvert depuis un lien, le voyage peut encore être en chargement.
  const started = useRef(false)
  useEffect(() => {
    const el = scroller.current
    if (started.current || !el || !cards.length) return
    started.current = true
    const i = Math.max(0, cards.findIndex((c) => c.key === startKey))
    setActive(i)
    el.scrollLeft = i * step(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length])

  function step(el) {
    const first = el.querySelector('[data-card]')
    return (first?.offsetWidth || 300) + GAP
  }

  function goTo(i, smooth = true) {
    const el = scroller.current
    if (!el) return
    setOverview(false)
    setActive(i)
    el.scrollTo({ left: i * step(el), behavior: smooth ? 'smooth' : 'auto' })
  }

  function onScroll() {
    const el = scroller.current
    if (!el) return
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const i = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step(el))))
      setActive(i)
      setOverview(false)
    }, 90)
  }
  useEffect(() => () => clearTimeout(settle.current), [])

  function onKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.min(count - 1, index + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.max(0, index - 1)) }
  }

  const selectFromMap = (itemKey) => {
    const i = cards.findIndex((c) => c.mapKey === itemKey)
    if (i !== -1) goTo(i)
  }

  const focusKey = overview || !current ? null : current.mapKey
  const sidePad = 'max(28px, calc(50% - 160px))'

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F2EE] text-fg">
      <TripMap
        items={view.items}
        home={view.tonight}
        colorIndexByStay={colorIndexByStay}
        pastKeys={past}
        activeKey={focusKey}
        focusKey={focusKey}
        dimOthers
        interactive
        onSelect={selectFromMap}
        padding={MAP_PADDING}
        fallbackCenter={ui.near}
        attribution="top-right"
        className="absolute inset-0"
      />

      <header className="absolute left-2.5 right-2.5 top-[max(env(safe-area-inset-top),10px)] z-10 mx-auto max-w-xl h-[60px] rounded-[18px] bg-surface/95 backdrop-blur shadow-[0_4px_18px_rgb(17_20_27/0.14)] grid grid-cols-[52px_minmax(0,1fr)_52px] items-center">
        <button
          type="button"
          onClick={() => ui.closeRunner(day)}
          aria-label="Fermer le déroulé"
          className="ml-1.5 h-11 w-11 rounded-full flex items-center justify-center text-fg hover:bg-surface-2 transition"
        >
          <X size={22} />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs text-muted first-letter:uppercase">{formatDayFr(day)}{isToday ? ' · aujourd’hui' : ''}</p>
          <p className="text-[16px] font-semibold truncate">{view.day?.title || plural(view.stopCount, 'étape')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOverview((o) => !o)}
          aria-pressed={overview}
          aria-label="Toute la journée"
          title="Toute la journée"
          className={cn('h-11 w-11 rounded-full flex items-center justify-center text-accent transition', overview ? 'bg-accent/10' : 'hover:bg-surface-2')}
        >
          <Maximize2 size={19} />
        </button>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 pb-[max(env(safe-area-inset-bottom),8px)]">
        {count === 0 ? (
          <div className="mx-auto mb-6 max-w-xs rounded-2xl bg-surface px-5 py-4 text-center shadow-lg">
            <p className="text-[15px] font-medium">Rien de prévu ce jour-là.</p>
            {!ui.readOnly && (
              <button type="button" onClick={() => ui.closeRunner(day)} className="mt-2 text-[15px] font-semibold text-accent">Ajouter une étape</button>
            )}
          </div>
        ) : (
          <>
            <div
              ref={scroller}
              onScroll={onScroll}
              onKeyDown={onKeyDown}
              tabIndex={0}
              aria-label="Étapes de la journée — flèches gauche et droite pour passer de l’une à l’autre"
              className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto pb-2 pt-1 focus-visible:outline-none"
              style={{ gap: GAP, paddingInline: sidePad, scrollPaddingInline: sidePad }}
            >
              {cards.map((card, i) => (
                <StepCard
                  key={card.key}
                  card={card}
                  active={i === index}
                  past={!!past?.has(card.key)}
                  focus={focus}
                  day={day}
                  colorIndexByStay={colorIndexByStay}
                  weatherOf={weatherOf}
                  onPick={() => goTo(i)}
                />
              ))}
              {hasTomorrow && (
                <button
                  type="button"
                  data-card
                  onClick={() => ui.openRunner(tomorrow)}
                  className="snap-center shrink-0 w-[min(320px,calc(100vw-56px))] h-[232px] rounded-[20px] bg-surface/90 shadow-[0_8px_28px_rgb(17_20_27/0.16)] p-4 text-left flex flex-col justify-center gap-1"
                >
                  <span className="text-[13px] font-semibold text-muted first-letter:uppercase">Demain · {formatDayFr(tomorrow)}</span>
                  <span className="text-[19px] font-semibold">La journée suivante</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[15px] font-semibold text-accent">Continuer <ChevronRight size={16} /></span>
                </button>
              )}
            </div>
            <div className="flex justify-center">
              {Array.from({ length: count }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Carte ${i + 1} sur ${count}`}
                  aria-current={i === index ? 'step' : undefined}
                  className="h-6 px-[3px] flex items-center"
                >
                  <span className={cn('block h-1.5 rounded-full transition-all', i === index ? 'w-[18px] bg-accent' : 'w-1.5 bg-fg/25')} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StepCard({ card, active, past, focus, day, colorIndexByStay, weatherOf, onPick }) {
  const ui = useTripUI()
  const base = 'snap-center shrink-0 w-[min(320px,calc(100vw-56px))] h-[232px] rounded-[20px] bg-surface p-4 flex flex-col text-left shadow-[0_8px_28px_rgb(17_20_27/0.18)] transition-transform duration-300'

  if (card.tonight) {
    const stay = card.tonight
    const color = stayColor(colorIndexByStay[stay.id])
    const go = goUrl(stay)
    return (
      <article data-card onClick={active ? undefined : onPick} className={cn(base, !active && 'scale-[0.96]')}>
        <div className="flex items-center gap-2">
          <span className="h-[26px] w-[26px] rounded-[8px] flex items-center justify-center text-white" style={{ backgroundColor: color.hex }}>
            <BedDouble size={14} strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold">Ce soir</span>
        </div>
        <h2 className="mt-2.5 text-[19px] leading-6 font-semibold line-clamp-2">{stay.name}</h2>
        <p className="mt-1 text-[13px] text-muted line-clamp-2">
          {[stay.address, stay.accessCode && `code ${stay.accessCode}`].filter(Boolean).join(' · ')}
        </p>
        <Actions go={go} detailsLabel="Réservation" onDetails={() => ui.openResa('stay', stay.id)} />
      </article>
    )
  }

  const { item, prev, leg } = card
  const { title, sub } = itemText(item)
  const place = destinationOf(item)
  const go = place ? goUrl(place) : null
  const weatherPlace = item.type === 'stop' ? item.stop : item.type === 'transport' ? item.transport.to : item.stay
  const weather = weatherOf(day, weatherPlace)
  const isFocus = focus?.item?.key === item.key
  const status = past
    ? { text: 'Terminé', tone: 'bg-surface-2 text-muted' }
    : isFocus && focus.kind === 'current'
      ? { text: `En cours · jusqu’à ${focus.until}`, tone: 'bg-accent/10 text-accent' }
      : isFocus && focus.kind === 'next'
        ? { text: formatUntil(focus.minutes).replace(/^d/, 'D'), tone: 'bg-accent/10 text-accent' }
        : null
  const onDetails = item.type === 'stop'
    ? () => ui.openStop(day, item.stop)
    : () => ui.openResa(item.type === 'transport' ? 'transport' : 'stay', item.type === 'transport' ? item.transport.id : item.stay.id)
  const walking = leg && leg.distanceM <= 1500

  return (
    <article data-card onClick={active ? undefined : onPick} className={cn(base, !active && 'scale-[0.96]')}>
      <div className="flex items-center gap-2">
        <ItemBadge item={item} past={past} colorIndexByStay={colorIndexByStay} />
        <span className="font-mono text-[15px] font-semibold tabular">{item.time || '—'}</span>
        {status && <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold', status.tone)}>{status.text}</span>}
        {!status && weather && <WeatherBadge weather={weather} className="ml-auto text-sm" />}
      </div>
      <h2 className="mt-2.5 text-[19px] leading-6 font-semibold line-clamp-2">{title}</h2>
      {sub && <p className="mt-1 text-[13px] text-muted line-clamp-1">{sub}</p>}
      {leg && prev && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted min-w-0">
          {walking && <Footprints size={14} className="shrink-0" aria-hidden="true" />}
          <span className="truncate">≈ {formatDistance(leg.distanceM)} depuis {itemText(prev).title}</span>
        </p>
      )}
      <Actions go={go} detailsLabel={item.type === 'stop' ? 'Détails' : 'Réservation'} onDetails={onDetails} />
    </article>
  )
}

function Actions({ go, detailsLabel, onDetails }) {
  return (
    <div className="mt-auto flex gap-2 pt-3">
      {go && (
        <a
          href={go}
          target="_blank"
          rel="noreferrer"
          className="flex-1 h-12 rounded-[13px] bg-accent text-accent-fg inline-flex items-center justify-center gap-2 text-[15px] font-semibold active:scale-[0.98] transition"
        >
          <Navigation size={16} /> Y aller
        </a>
      )}
      <button
        type="button"
        onClick={onDetails}
        className={cn('h-12 px-4 rounded-[13px] bg-surface-2 text-[15px] font-medium text-fg hover:bg-border transition', !go && 'flex-1')}
      >
        {detailsLabel}
      </button>
    </div>
  )
}
