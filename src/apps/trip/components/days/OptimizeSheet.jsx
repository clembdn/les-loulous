import { useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, MapPinOff } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { useOnline } from '@/shared/lib/useOnline.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { getCategory } from '../../config/categories.js'
import { saveDay } from '../../services/daysService.js'
import { fetchMatrix } from '../../services/routesService.js'
import { formatDuration } from '../../utils/format.js'
import { formatDistance, hasCoords } from '../../utils/geo.js'
import { MAX_RUN_POINTS } from '../../utils/legs.js'
import { tonightStay } from '../../utils/nights.js'
import { dayModel, optimizeDay, travelCost } from '../../utils/optimize.js'
import { buildDayTimeline } from '../../utils/timeline.js'
import TripMap from '../map/TripMap.jsx'

const MAP_PADDING = { top: 28, bottom: 28, left: 28, right: 28 }
// Une liste vide STABLE : un `[]` neuf à chaque rendu relancerait le calcul.
const NO_STOPS = []

const placesKey = (places) => places.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')

/**
 * « Optimiser l'ordre » d'une journée : le trajet le plus court entre ses
 * étapes, de l'hébergement du matin à celui du soir (cf. utils/optimize.js).
 *
 * L'ordre se calcule tout de suite à vol d'oiseau, puis par la route dès que
 * les temps d'OpenRouteService arrivent (en ligne). On voit le nouvel ordre
 * et ce qu'il fait gagner avant de l'appliquer ; « Annuler » dans le message
 * remet l'ancien.
 */
export default function OptimizeSheet({ open, date, onClose }) {
  const { currentUid } = useAuth()
  const online = useOnline()
  const { tripId, days, dayKeys, stays, transports, stopsByDate, colorIndexByStay } = useTripData()
  const stops = stopsByDate[date] || NO_STOPS

  const model = useMemo(() => {
    if (!date) return null
    const i = dayKeys.indexOf(date)
    return dayModel({
      date,
      stops,
      stays,
      transports,
      morning: i > 0 ? tonightStay(dayKeys[i - 1], stays) : null,
      tonight: tonightStay(date, stays),
    })
  }, [date, stops, stays, transports, dayKeys])

  // Les temps par la route, pour CES lieux : si la journée change pendant
  // qu'on regarde (l'autre ajoute une étape), l'ancienne matrice ne vaut plus.
  const key = model ? placesKey(model.places) : ''
  const [matrix, setMatrix] = useState({ key: null, data: null, failed: false })
  const tooMany = (model?.places.length || 0) > MAX_RUN_POINTS
  useEffect(() => {
    if (!open || !model || !online || tooMany || model.places.length < 2 || matrix.key === key) return undefined
    let alive = true
    fetchMatrix(model.places)
      .then((data) => { if (alive) setMatrix({ key, data, failed: false }) })
      .catch(() => { if (alive) setMatrix({ key, data: null, failed: true }) })
    return () => { alive = false }
  }, [open, key, online, tooMany]) // eslint-disable-line react-hooks/exhaustive-deps

  const byRoad = matrix.key === key && !!matrix.data
  const loading = open && online && !tooMany && matrix.key !== key
  const result = useMemo(
    () => (model ? optimizeDay(model, stops, travelCost(byRoad ? matrix.data : null)) : null),
    [model, stops, byRoad, matrix.data],
  )

  const items = useMemo(
    () => (result && date ? buildDayTimeline(date, result.stops, stays, transports) : []),
    [result, date, stays, transports],
  )

  function apply() {
    const before = stops
    saveDay(tripId, date, { stops: result.stops }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))
    toast.success(`Ordre optimisé · ${formatDistance(result.before.distanceM - result.after.distanceM)} de moins`, {
      action: {
        label: 'Annuler',
        onClick: () => saveDay(tripId, date, { stops: before }, days[date], currentUid).catch(() => toast.error('Impossible d’annuler')),
      },
    })
    onClose()
  }

  if (!result) return null
  const minutes = (s) => formatDuration(s / 60) || '0 min'
  const source = loading
    ? <span className="inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Calcul par la route…</span>
    : byRoad ? 'Par la route' : `À vol d’oiseau (${online ? 'route indisponible' : 'hors-ligne'})`

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Optimiser l’ordre"
      description={date ? formatDayFr(date) : null}
      size="lg"
      footer={(
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            {result.changed ? 'Annuler' : 'Fermer'}
          </Button>
          {result.changed && (
            <Button type="button" className="flex-1" onClick={apply}>Appliquer</Button>
          )}
        </div>
      )}
    >
      <section className="rounded-2xl bg-surface-2 px-4 py-3">
        {result.changed ? (
          <>
            <p className="text-[24px] font-semibold tracking-[-0.01em] text-accent tabular">
              −{formatDistance(result.before.distanceM - result.after.distanceM)}
            </p>
            <p className="mt-0.5 text-[14px] text-muted tabular">
              {formatDistance(result.before.distanceM)} · {minutes(result.before.durationS)}
              {' → '}
              <span className="font-semibold text-fg">{formatDistance(result.after.distanceM)} · {minutes(result.after.durationS)}</span>
            </p>
          </>
        ) : (
          <>
            <p className="text-[17px] font-semibold text-fg">L’ordre actuel est déjà le plus court</p>
            <p className="mt-0.5 text-[14px] text-muted tabular">
              {formatDistance(result.before.distanceM)} · {minutes(result.before.durationS)}
            </p>
          </>
        )}
        <p className="mt-1.5 text-[12px] text-muted">{source} · hébergements compris</p>
      </section>

      {result.changed && (
        <div className="mt-4 h-44 rounded-2xl overflow-hidden">
          <TripMap
            items={items}
            home={tonightStay(date, stays)}
            colorIndexByStay={colorIndexByStay}
            padding={MAP_PADDING}
            className="h-full"
          />
        </div>
      )}

      <ol className="mt-4 space-y-1">
        {result.stops.map((stop, i) => {
          const category = getCategory(stop.category)
          const fixed = !!stop.time || !hasCoords(stop)
          return (
            <li key={stop.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <span
                className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-mono text-[13px] font-semibold text-white"
                style={{ backgroundColor: category.color }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[15px] text-fg truncate">{stop.name}</span>
              {stop.time && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[13px] text-muted font-mono">
                  <Lock size={12} aria-hidden="true" /> {stop.time}
                </span>
              )}
              {!stop.time && fixed && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[12px] text-muted">
                  <MapPinOff size={12} aria-hidden="true" /> pas localisée
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-[13px] text-muted">
        Les étapes à heure fixe, celles qui ne sont pas localisées et les réservations restent à leur place,
        avec autant d’étapes avant chacune qu’aujourd’hui : seul le choix et l’ordre des lieux changent.
      </p>
    </ThemedSheet>
  )
}
