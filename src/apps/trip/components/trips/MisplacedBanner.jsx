import { useMemo, useState } from 'react'
import { MapPinOff } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useOnline } from '@/shared/lib/useOnline.js'
import { Button } from '@/shared/ui/Button.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { resolveMapsLink } from '../../services/placesService.js'
import { saveDays } from '../../services/daysService.js'
import { saveReservation } from '../../services/reservationsService.js'
import { isMisplaced, misplacedIn } from '../../utils/misplaced.js'
import { plural } from '../../utils/format.js'

/**
 * « 3 lieux placés à Washington par erreur · Corriger » : les lieux collés
 * avant le correctif des liens Google Maps (cf. utils/misplaced.js). Corriger
 * relit leur lien avec le résolveur actuel et les remet à leur place.
 */
export default function MisplacedBanner() {
  const { currentUid } = useAuth()
  const online = useOnline()
  const { tripId, days, stays, transports, isLoading } = useTripData()
  const list = useMemo(() => misplacedIn({ days, stays, transports }), [days, stays, transports])
  const [busy, setBusy] = useState(false)

  if (isLoading || !list.length) return null

  async function repair() {
    setBusy(true)
    const found = []
    // Un lien après l'autre : Google n'aime pas les rafales.
    for (const item of list) {
      const res = await resolveMapsLink(item.place.mapsUrl).catch(() => null)
      const place = res?.located ? res.place : null
      if (place && !isMisplaced(place)) found.push({ item, place })
    }

    const dayPatches = {}
    for (const { item, place } of found.filter((f) => f.item.kind === 'stop')) {
      const stops = dayPatches[item.date]?.stops || days[item.date].stops
      dayPatches[item.date] = {
        stops: stops.map((s) => (s.id === item.id ? { ...s, lat: place.lat, lng: place.lng, address: s.address || place.address } : s)),
      }
    }
    if (Object.keys(dayPatches).length) {
      saveDays(tripId, dayPatches, days, currentUid).catch(() => toast.error('Enregistrement impossible'))
    }
    for (const { item, place } of found.filter((f) => f.item.kind === 'stay')) {
      const stay = stays.find((s) => s.id === item.id)
      saveReservation('stay', tripId, stay, { ...stay, lat: place.lat, lng: place.lng, address: stay.address || place.address }, {}, currentUid)
        .done.catch(() => toast.error('Enregistrement impossible'))
    }
    const byTransport = new Map()
    for (const { item, place } of found.filter((f) => f.item.kind === 'transport')) {
      const t = byTransport.get(item.id) || transports.find((x) => x.id === item.id)
      byTransport.set(item.id, { ...t, [item.end]: { ...t[item.end], lat: place.lat, lng: place.lng } })
    }
    for (const t of byTransport.values()) {
      saveReservation('transport', tripId, transports.find((x) => x.id === t.id), t, {}, currentUid)
        .done.catch(() => toast.error('Enregistrement impossible'))
    }

    const missed = list.length - found.length
    if (found.length) toast.success(`${plural(found.length, 'lieu relocalisé', 'lieux relocalisés')}`)
    if (missed) toast.error(`${plural(missed, 'lien n’a', 'liens n’ont')} pas pu être relu${missed > 1 ? 's' : ''} : ouvrez ${missed > 1 ? 'ces lieux' : 'ce lieu'} et cherchez-le par son nom`)
    setBusy(false)
  }

  return (
    <div className="max-w-xl lg:max-w-6xl mx-auto px-3 lg:px-8 pt-3 lg:pt-5">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
        <MapPinOff size={18} className="shrink-0 text-amber-700" />
        <p className="flex-1 min-w-0 text-[14px] text-amber-950">
          <span className="font-semibold">{plural(list.length, 'lieu placé', 'lieux placés')} à Washington par erreur.</span>{' '}
          <span className="text-amber-900">Un ancien bug des liens Google Maps, corrigé depuis.</span>
        </p>
        <Button size="sm" onClick={repair} disabled={busy || !online} className="shrink-0">
          {busy ? 'Correction…' : 'Corriger'}
        </Button>
      </div>
    </div>
  )
}
