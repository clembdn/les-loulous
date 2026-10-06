import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Clock, Link2, Loader2, Plane } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useToday } from '@/shared/lib/useToday.js'
import { formatDayFr } from '@/shared/lib/dates.js'
import { Input } from '@/shared/ui/Input.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { TripDataProvider, useTripData } from '../context/TripDataContext.jsx'
import { useAddStop } from '../hooks/useAddStop.js'
import { resolveMapsLink } from '../services/placesService.js'
import { getLastDay } from '../services/lastDay.js'
import { getCategory } from '../config/categories.js'
import CategoryChips from '../components/CategoryChips.jsx'
import { LIST_PATH, tripPath } from '../config/navigation.js'
import { guessCategory } from '../utils/categoryGuess.js'
import { parseSharedPlace } from '../utils/sharedText.js'
import { groupTrips, tripDays, tripStatus } from '../utils/tripDates.js'
import { dayChip } from '../utils/format.js'
import { hasCoords } from '../utils/geo.js'
import TripMap, { placeItems } from '../components/map/TripMap.jsx'

const MAP_PADDING = { top: 30, bottom: 30, left: 30, right: 30 }

/**
 * /trip/partage — « Partager » un lieu depuis Google Maps (Android) arrive
 * ici (Web Share Target, cf. vite.config.js). Deux taps : le jour, puis
 * « Ajouter ». Le voyage est déjà choisi (en cours, sinon le prochain), le
 * jour aussi (aujourd'hui pendant le voyage, sinon le dernier consulté), la
 * catégorie devinée ; l'heure est facultative.
 *
 * Hors-ligne, le lien court ne peut pas être lu : on garde le nom et le
 * lien, l'étape se localisera plus tard (« Localiser » dans sa fiche).
 */
export default function ShareInView() {
  const [params] = useSearchParams()
  const today = useToday()
  const { trips, isLoading } = useTrips()
  const shared = useMemo(() => parseSharedPlace({
    title: params.get('title') || '',
    text: params.get('text') || '',
    url: params.get('url') || '',
  }), [params])

  // Les voyages où l'ajouter : en cours d'abord, puis à venir.
  const candidates = useMemo(() => {
    const groups = groupTrips(trips, today)
    return [...groups.ongoing, ...groups.upcoming]
  }, [trips, today])
  const [tripId, setTripId] = useState(null)
  const trip = candidates.find((t) => t.id === tripId) || candidates[0] || null

  const [place, setPlace] = useState(() => ({ name: shared.name, address: shared.address, lat: null, lng: null, mapsUrl: shared.mapsUrl }))
  const [reading, setReading] = useState(!!shared.mapsUrl)
  const [note, setNote] = useState(null)

  // Le lien court se lit (nom exact, coordonnées) : une fonction serveur, ou
  // directement s'il s'agit d'un lien long.
  useEffect(() => {
    if (!shared.mapsUrl) return undefined
    let alive = true
    resolveMapsLink(shared.mapsUrl).then((read) => {
      if (!alive) return
      setReading(false)
      if (!read) return
      setPlace((p) => ({ ...read.place, name: read.place.name || p.name, address: read.place.address || p.address }))
      if (read.message) setNote(read.message)
    }).catch(() => {
      if (alive) {
        setReading(false)
        setNote('Le lien n’a pas pu être lu : le lieu sera localisé plus tard.')
      }
    })
    return () => { alive = false }
  }, [shared.mapsUrl])

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto h-12 px-1 grid grid-cols-[96px_minmax(0,1fr)_96px] items-center">
          <Link to={LIST_PATH} replace className="h-11 px-3 inline-flex items-center text-[15px] text-accent">Annuler</Link>
          <p className="text-center text-[15px] font-semibold">Ajouter un lieu</p>
          <span />
        </div>
      </header>

      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-muted" /></div>
      ) : !trip ? (
        <NoTrip />
      ) : !shared.name && !shared.mapsUrl ? (
        <Empty url={shared.url} />
      ) : (
        <TripDataProvider key={trip.id} trip={trip}>
          <ShareForm
            trip={trip}
            candidates={candidates}
            onTrip={setTripId}
            today={today}
            place={place}
            onPlace={setPlace}
            reading={reading}
            note={note}
            sharedUrl={shared.mapsUrl}
          />
        </TripDataProvider>
      )}
    </div>
  )
}

function ShareForm({ trip, candidates, onTrip, today, place, onPlace, reading, note, sharedUrl }) {
  const navigate = useNavigate()
  const addStop = useAddStop()
  const { isLoading } = useTripData()
  const dayKeys = useMemo(() => tripDays(trip), [trip])
  const status = tripStatus(trip, today)
  const defaultDay = status === 'ongoing' && dayKeys.includes(today)
    ? today
    : dayKeys.includes(getLastDay(trip.id)) ? getLastDay(trip.id) : dayKeys[0]
  const [date, setDate] = useState(defaultDay)
  const [time, setTime] = useState('')
  const [category, setCategory] = useState(null)
  useEffect(() => setDate(defaultDay), [trip.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const guessed = guessCategory({ name: place.name }) || 'other'
  const chosen = category || guessed
  const located = hasCoords(place)
  const preview = useMemo(
    () => placeItems({ name: place.name, lat: place.lat, lng: place.lng }, chosen),
    [place.name, place.lat, place.lng, chosen],
  )

  function submit() {
    if (!place.name.trim()) return
    const stop = addStop(date, { ...place, category: chosen }, { time: time || null })
    if (stop) navigate(tripPath(trip.id, 'jours', date), { replace: true })
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-3 pb-32">
      {sharedUrl && (
        <p className="mb-2 flex items-center gap-1.5 text-[13px] text-muted min-w-0">
          <Link2 size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">Reçu de Google Maps · {sharedUrl.replace(/^https?:\/\//, '')}</span>
        </p>
      )}

      <div className="relative h-40 rounded-2xl overflow-hidden bg-surface-2">
        {located ? (
          <TripMap items={preview} padding={MAP_PADDING} className="h-full" />
        ) : (
          <div className="h-full flex items-center justify-center gap-2 text-[14px] text-muted">
            {reading ? <><Loader2 size={16} className="animate-spin" /> Lecture du lien…</> : 'Position à venir'}
          </div>
        )}
      </div>

      <label className="block mt-4">
        <span className="sr-only">Nom du lieu</span>
        <Input
          value={place.name}
          onChange={(e) => onPlace({ ...place, name: e.target.value })}
          className="h-12 text-[19px] font-semibold"
          placeholder="Nom du lieu"
        />
      </label>
      {place.address && <p className="mt-1.5 px-1 text-[14px] text-muted">{place.address}</p>}
      {note && <p className="mt-1 px-1 text-[13px] text-amber-800">{note}</p>}

      <div className="mt-3">
        <CategoryChips value={chosen} onChange={setCategory} layout="row" />
      </div>

      {candidates.length > 1 && (
        <section className="mt-6">
          <h2 className="px-1 mb-2 text-[13px] font-semibold text-muted">Voyage</h2>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {candidates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTrip(t.id)}
                aria-pressed={t.id === trip.id}
                className={cn(
                  'shrink-0 h-10 px-4 rounded-full border text-[14px] font-medium transition',
                  t.id === trip.id ? 'bg-fg border-fg text-bg' : 'bg-surface border-border text-fg',
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        </section>
      )}
      {candidates.length === 1 && (
        <p className="mt-6 px-1 flex items-center gap-2 text-[14px] text-muted">
          <Plane size={15} className="text-accent" aria-hidden="true" /> {trip.title}
        </p>
      )}

      <section className="mt-5">
        <h2 className="px-1 mb-2 text-[13px] font-semibold text-muted">Jour</h2>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {dayKeys.map((d) => {
            const chip = dayChip(d)
            const active = d === date
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                aria-pressed={active}
                aria-label={formatDayFr(d)}
                className={cn(
                  'relative shrink-0 w-[52px] h-[58px] rounded-xl border flex flex-col items-center justify-center transition',
                  active ? 'bg-fg border-fg text-bg' : 'bg-surface border-border text-fg',
                )}
              >
                <span className={cn('text-[11px]', active ? 'text-bg/75' : 'text-muted')}>{chip.dow}</span>
                <span className="text-[18px] font-semibold leading-tight tabular">{chip.day}</span>
                {d === today && <span className={cn('absolute bottom-1 h-1 w-1 rounded-full', active ? 'bg-bg' : 'bg-accent')} />}
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="px-1 mb-2 text-[13px] font-semibold text-muted">Heure <span className="font-normal">· facultative</span></h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTime('')}
            aria-pressed={!time}
            className={cn('h-11 px-4 rounded-xl border text-[14px] font-medium transition', !time ? 'bg-fg border-fg text-bg' : 'bg-surface border-border text-fg')}
          >
            Sans heure
          </button>
          <label className="flex-1 relative">
            <span className="sr-only">Heure</span>
            <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="pl-9 text-[15px]" />
          </label>
        </div>
        <p className="mt-2 px-1 text-[13px] text-muted">
          {time ? 'Rangée à son heure dans la journée.' : 'Sans heure, l’étape va en fin de journée ; on la glisse ensuite où l’on veut.'}
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-bg/95 backdrop-blur border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            onClick={submit}
            disabled={!place.name.trim() || isLoading}
            className="w-full h-[52px] rounded-2xl bg-accent text-accent-fg text-[16px] font-semibold disabled:opacity-50 active:scale-[0.99] transition"
          >
            Ajouter au {formatDayFr(date)}{time ? ` à ${time}` : ''}
          </button>
          <p className="mt-1.5 text-center text-[12px] text-muted">{getCategory(chosen).label} · {trip.title}</p>
        </div>
      </div>
    </div>
  )
}

function NoTrip() {
  return (
    <div className="max-w-sm mx-auto px-6 pt-16 text-center">
      <p className="text-[17px] font-semibold">Aucun voyage en cours ou à venir</p>
      <p className="mt-1 text-[15px] text-muted">Créez d’abord le voyage, puis partagez à nouveau ce lieu depuis Google Maps.</p>
      <Link to={LIST_PATH} replace className="mt-5 inline-flex h-11 px-5 items-center rounded-xl bg-accent text-accent-fg text-[15px] font-semibold">Mes voyages</Link>
    </div>
  )
}

function Empty({ url }) {
  return (
    <div className="max-w-sm mx-auto px-6 pt-16 text-center">
      <p className="text-[17px] font-semibold">Rien à ajouter</p>
      <p className="mt-1 text-[15px] text-muted">
        Partagez un lieu depuis Google Maps (bouton « Partager », puis Loulous).
        {url ? ` Lien reçu : ${url}` : ''}
      </p>
      <Link to={LIST_PATH} replace className="mt-5 inline-flex h-11 px-5 items-center rounded-xl bg-accent text-accent-fg text-[15px] font-semibold">Mes voyages</Link>
    </div>
  )
}
