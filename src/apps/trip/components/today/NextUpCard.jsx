import { ChevronRight, House, Navigation, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useTripWeather } from '../../context/TripWeatherContext.jsx'
import { goUrl } from '../../utils/mapsUrl.js'
import { destinationOf } from '../../utils/today.js'
import { formatUntil } from '../../utils/format.js'
import { itemText } from '../days/itemText.js'
import AttachmentThumb from '../attachments/AttachmentThumb.jsx'
import CopyValue from '../CopyValue.jsx'
import WeatherBadge from '../weather/WeatherBadge.jsx'
import { Eyebrow, Glow, HERO_CARD } from './parts.jsx'

const EYEBROW = { current: 'En cours', next: 'Prochaine étape', then: 'À suivre' }

const GO = 'flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg text-sm font-semibold transition hover:opacity-90 active:scale-[0.98]'
const SECONDARY = 'h-12 px-4 inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-surface-2 text-sm text-fg transition hover:border-border-strong'

/**
 * L'écran Aujourd'hui commence ici : ce qui vient, en grand, et « Y aller ».
 *
 * `focus` vient de `focusOf` (utils/today.js). Sans rien devant soi, la carte
 * ramène à l'hébergement du soir — c'est ce qu'on cherche en fin de journée,
 * dans une ville qu'on ne connaît pas.
 */
export default function NextUpCard({ date, focus, tonight, isLastDay, className }) {
  if (focus.item) return <ItemFocus date={date} focus={focus} className={className} />
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

function ItemFocus({ date, focus, className }) {
  const ui = useTripUI()
  const { attachmentsByParent } = useTripData()
  const { weatherOf } = useTripWeather()
  const { item } = focus
  const { title, sub, icon: Icon } = itemText(item)
  const place = destinationOf(item, { underway: focus.kind === 'current' })
  // La météo de là où l'on sera : dans le train, c'est la ville d'arrivée.
  const weatherPlace = place || (item.type === 'transport' ? item.transport.to : item.stay || null)
  const weather = weatherPlace ? weatherOf(date, weatherPlace) : null

  // La capture compte à l'embarquement et à l'accueil, pas en rendant la chambre.
  const shown = item.type === 'transport' ? item.transport : item.type === 'checkin' ? item.stay : null
  const files = shown ? attachmentsByParent[shown.id] || [] : []
  const open = () => {
    if (item.type === 'stop') ui.editStop(date, item.stop)
    else if (item.type === 'transport') ui.openResa('transport', item.transport.id)
    else ui.openResa('stay', item.stay.id)
  }

  return (
    <section className={cn(HERO_CARD, className)}>
      <Glow />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow live={focus.kind === 'current'}>{EYEBROW[focus.kind]}</Eyebrow>
          <WeatherBadge weather={weather} detailed className="text-sm" />
        </div>

        {focus.kind === 'next' && (
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-fg tabular">
            {formatUntil(focus.minutes)}
            <span className="ml-2 text-base font-medium text-muted">à {item.time}</span>
          </p>
        )}
        {focus.kind === 'current' && (
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-fg tabular">jusqu’à {focus.until}</p>
        )}

        <div className="mt-4 flex items-start gap-3">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-snug text-fg">{title}</p>
            {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
            {item.type === 'stop' && item.stop.notes && (
              <p className="mt-1.5 text-sm text-faint whitespace-pre-line line-clamp-3">{item.stop.notes}</p>
            )}
          </div>
        </div>

        <Essentials item={item} files={files} onViewAttachment={ui.viewAttachments} />
      </div>

      <div className="relative flex gap-2 px-5 pb-5">
        <GoLink place={place} />
        <button type="button" onClick={open} className={cn(SECONDARY, !place && 'flex-1')}>
          {item.type === 'stop' ? 'Détails' : 'Réservation'} <ChevronRight size={15} />
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
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-surface-2/70 p-3">
      <div className="min-w-0 flex-1 flex flex-wrap gap-x-6 gap-y-2">
        {values.length ? values : <p className="text-xs text-muted self-center">La réservation, à montrer sur place :</p>}
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
  const { weatherOf } = useTripWeather()

  if (tonight) {
    return (
      <section className={cn(HERO_CARD, className)}>
        <Glow />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <Eyebrow>{free ? 'Journée libre' : 'Plus rien de prévu'}</Eyebrow>
            <WeatherBadge weather={weatherOf(date, tonight)} detailed className="text-sm" />
          </div>
          <div className="mt-3 flex items-start gap-3">
            <span className="h-11 w-11 shrink-0 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
              <House size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold tracking-[-0.02em] text-fg">Rentrer</p>
              <p className="mt-0.5 text-sm text-muted">{[tonight.name, tonight.address].filter(Boolean).join(' · ')}</p>
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
      <Glow />
      <div className="relative p-5">
        <Eyebrow>{isLastDay ? 'Dernier jour' : free ? 'Journée libre' : 'Plus rien de prévu'}</Eyebrow>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg">{title}</p>
        {!isLastDay && <p className="mt-1 text-sm text-amber-800">Pas d’hébergement ce soir : à prévoir.</p>}
      </div>
      <div className="relative flex gap-2 px-5 pb-5">
        <button type="button" onClick={() => ui.editStop(date)} className={cn(SECONDARY, 'flex-1')}>
          <Plus size={15} /> Ajouter une étape
        </button>
      </div>
    </section>
  )
}
