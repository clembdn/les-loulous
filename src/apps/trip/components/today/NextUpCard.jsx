import { ChevronRight, House, Navigation, Play, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useTripWeather } from '../../context/TripWeatherContext.jsx'
import { stayColor } from '../../config/palette.js'
import { goUrl } from '../../utils/mapsUrl.js'
import { destinationOf } from '../../utils/today.js'
import { formatUntil } from '../../utils/format.js'
import { itemText } from '../days/itemText.js'
import AttachmentThumb from '../attachments/AttachmentThumb.jsx'
import CopyValue from '../CopyValue.jsx'
import { itemColor } from '../ItemBadge.jsx'
import TripMap from '../map/TripMap.jsx'
import WeatherBadge from '../weather/WeatherBadge.jsx'
import { Eyebrow, HERO_CARD } from './parts.jsx'

const EYEBROW = { current: 'En cours', next: 'Prochaine étape', then: 'À suivre' }

const GO = 'flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg text-[15px] font-semibold transition hover:opacity-90 active:scale-[0.98]'
const SECONDARY = 'h-12 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-[15px] font-medium text-fg transition hover:bg-border'
const BAND_PADDING = { top: 28, bottom: 28, left: 48, right: 48 }

/**
 * L'écran Aujourd'hui commence ici : ce qui vient, en grand, et « Y aller ».
 *
 * Sur téléphone, un bandeau de carte montre où c'est, à partir de l'étape
 * d'avant ; un tap ouvre le déroulé à cette étape. Sans rien devant soi, la
 * carte ramène à l'hébergement du soir — c'est ce qu'on cherche en fin de
 * journée, dans une ville qu'on ne connaît pas.
 *
 * `focus` vient de `focusOf` (utils/today.js), `items` et `past` de la journée.
 */
export default function NextUpCard({ date, focus, items, past, tonight, isLastDay, className }) {
  if (focus.item) return <ItemFocus date={date} focus={focus} items={items} past={past} tonight={tonight} className={className} />
  return <RestFocus date={date} free={focus.kind === 'free'} tonight={tonight} isLastDay={isLastDay} className={className} />
}

function GoLink({ place }) {
  const url = goUrl(place)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className={GO}>
      <Navigation size={16} /> Y aller
    </a>
  )
}

function ItemFocus({ date, focus, items, past, tonight, className }) {
  const ui = useTripUI()
  const phone = !useMediaQuery('(min-width: 1024px)')
  const { attachmentsByParent, colorIndexByStay } = useTripData()
  const { weatherOf } = useTripWeather()
  const { item } = focus
  const { title, sub, icon: Icon } = itemText(item)
  const color = itemColor(item, colorIndexByStay)
  const place = destinationOf(item, { underway: focus.kind === 'current' })
  // La météo de là où l'on sera : dans le train, c'est la ville d'arrivée.
  const weatherPlace = place || (item.type === 'transport' ? item.transport.to : item.stay || null)
  const weather = weatherPlace ? weatherOf(date, weatherPlace) : null

  // La capture compte à l'embarquement et à l'accueil, pas en rendant la chambre.
  const shown = item.type === 'transport' ? item.transport : item.type === 'checkin' ? item.stay : null
  const files = shown ? attachmentsByParent[shown.id] || [] : []
  const open = () => {
    if (item.type === 'stop') ui.openStop(date, item.stop)
    else if (item.type === 'transport') ui.openResa('transport', item.transport.id)
    else ui.openResa('stay', item.stay.id)
  }
  const runner = () => ui.openRunner(date, item.key)

  return (
    <section className={cn(HERO_CARD, className)}>
      {phone && (
        <TripMap
          items={items}
          home={tonight}
          colorIndexByStay={colorIndexByStay}
          pastKeys={past}
          activeKey={item.key}
          focusKey={item.key}
          focusZoom={14.2}
          dimOthers
          onPress={runner}
          pressLabel="Voir l’étape sur la carte, en déroulé"
          padding={BAND_PADDING}
          className="h-40"
        />
      )}
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow live={focus.kind === 'current'}>{EYEBROW[focus.kind]}</Eyebrow>
          <WeatherBadge weather={weather} detailed className="text-sm" />
        </div>

        {focus.kind === 'next' && (
          <p className="mt-1.5 flex items-baseline gap-2 tabular">
            <span className="text-[34px] leading-10 font-bold tracking-[-0.02em] text-fg first-letter:uppercase">{formatUntil(focus.minutes)}</span>
            <span className="font-mono text-[17px] font-medium text-muted">{item.time}</span>
          </p>
        )}
        {focus.kind === 'current' && (
          <p className="mt-1.5 text-[34px] leading-10 font-bold tracking-[-0.02em] text-fg tabular">jusqu’à {focus.until}</p>
        )}

        <button type="button" onClick={open} className="group mt-4 w-full flex items-start gap-3 text-left">
          <span className="h-11 w-11 shrink-0 rounded-2xl text-white flex items-center justify-center" style={{ backgroundColor: color }}>
            <Icon size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[19px] font-semibold leading-snug text-fg">
              <span className="min-w-0">{title}</span>
              <ChevronRight size={18} className="shrink-0 text-muted group-hover:text-fg transition" />
            </span>
            {sub && <span className="mt-0.5 block text-[14px] text-muted">{sub}</span>}
            {item.type === 'stop' && item.stop.notes && (
              <span className="mt-1.5 block text-[14px] text-muted whitespace-pre-line line-clamp-3">{item.stop.notes}</span>
            )}
          </span>
        </button>

        <Essentials item={item} files={files} onViewAttachment={ui.viewAttachments} />
      </div>

      <div className="relative flex gap-2 px-5 pb-5">
        <GoLink place={place} />
        <button type="button" onClick={runner} className={cn(SECONDARY, !place && 'flex-1')}>
          <Play size={14} fill="currentColor" /> Déroulé
        </button>
      </div>
    </section>
  )
}

/**
 * Ce qu'on doit avoir sous les yeux au guichet ou à la porte : la place, la
 * référence, le code d'accès, et la capture (la carte d'embarquement, le mail
 * de l'hôtel) à montrer d'un tap.
 */
function Essentials({ item, files, onViewAttachment }) {
  let values = []
  if (item.type === 'transport') {
    const t = item.transport
    values = [
      t.seat && <CopyValue key="seat" label="Place" value={t.seat} mono={false} large />,
      t.confirmation && <CopyValue key="ref" label="Référence" value={t.confirmation} />,
    ]
  } else if (item.type === 'checkin') {
    values = [
      item.stay.accessCode && <CopyValue key="code" label="Code d’accès" value={item.stay.accessCode} mono={false} large />,
      item.stay.confirmation && <CopyValue key="ref" label="Référence" value={item.stay.confirmation} />,
    ]
  }
  values = values.filter(Boolean)
  const [first] = files
  if (!values.length && !first) return null
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
      <div className="min-w-0 flex-1 flex flex-wrap gap-x-6 gap-y-2">
        {values.length ? values : <p className="text-[13px] text-muted self-center">La réservation, à montrer sur place :</p>}
      </div>
      {first && (
        <AttachmentThumb
          attachment={first}
          onClick={() => onViewAttachment(files, 0)}
          className="h-20 w-16 shrink-0"
        />
      )}
    </div>
  )
}

function RestFocus({ date, free, tonight, isLastDay, className }) {
  const ui = useTripUI()
  const { colorIndexByStay } = useTripData()
  const { weatherOf } = useTripWeather()

  if (tonight) {
    return (
      <section className={cn(HERO_CARD, className)}>
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <Eyebrow>{free ? 'Journée libre' : 'Plus rien de prévu'}</Eyebrow>
            <WeatherBadge weather={weatherOf(date, tonight)} detailed className="text-sm" />
          </div>
          <div className="mt-3 flex items-start gap-3">
            <span
              className="h-11 w-11 shrink-0 rounded-2xl text-white flex items-center justify-center"
              style={{ backgroundColor: stayColor(colorIndexByStay[tonight.id]).hex }}
            >
              <House size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold tracking-[-0.02em] text-fg">Rentrer</p>
              <p className="mt-0.5 text-[14px] text-muted">{[tonight.name, tonight.address].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </div>
        <div className="relative flex gap-2 px-5 pb-5">
          <GoLink place={tonight} />
          <button type="button" onClick={() => ui.openResa('stay', tonight.id)} className={cn(SECONDARY, !goUrl(tonight) && 'flex-1')}>
            Réservation <ChevronRight size={15} />
          </button>
        </div>
      </section>
    )
  }

  const title = isLastDay ? 'Bon retour !' : free ? 'Rien de prévu aujourd’hui' : 'C’est tout pour aujourd’hui'
  return (
    <section className={cn(HERO_CARD, className)}>
      <div className="relative p-5">
        <Eyebrow>{isLastDay ? 'Dernier jour' : free ? 'Journée libre' : 'Plus rien de prévu'}</Eyebrow>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg">{title}</p>
        {!isLastDay && <p className="mt-1 text-[14px] text-amber-800">Pas d’hébergement ce soir : à prévoir.</p>}
      </div>
      {ui.editStop && (
        <div className="relative flex gap-2 px-5 pb-5">
          <button type="button" onClick={() => ui.editStop(date)} className={cn(SECONDARY, 'flex-1')}>
            <Plus size={15} /> Ajouter une étape
          </button>
        </div>
      )}
    </section>
  )
}
