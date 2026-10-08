import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Globe2, Loader2, Share2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useOnline } from '@/shared/lib/useOnline.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { getCategory } from '../../config/categories.js'
import { getTransportMode } from '../../config/reservations.js'
import { cachedTimezone, resolveTimezones } from '../../services/timezones.js'
import { plural } from '../../utils/format.js'
import { buildIcs, icsFileName, tripEvents, tripPlaces } from '../../utils/ics.js'

const LABELS = {
  transportMode: (mode) => getTransportMode(mode).label,
  category: (id) => (id === 'other' ? '' : getCategory(id).label),
}

/**
 * « Ajouter à l'agenda » : le voyage en fichier .ics — les nuits de chaque
 * hébergement, les trajets, les étapes à heure fixe, le programme des
 * journées. Chaque heure est mise dans le fuseau de son lieu (cf. utils/ics.js) ;
 * les fuseaux sont demandés à l'ouverture, en ligne.
 *
 * Fichier téléchargé, ou partagé vers une app d'agenda sur téléphone.
 * Google Agenda sur Android n'ouvre pas les .ics : on l'importe depuis
 * calendar.google.com sur ordinateur, ce que la feuille explique.
 */
export default function CalendarSheet({ open, onClose }) {
  const online = useOnline()
  const { trip, dayKeys, days, stays, transports } = useTripData()
  const [options, setOptions] = useState({ stops: true, dayPlans: true })
  // Les fuseaux sont lus dans le cache ; `version` redessine quand il se complète.
  const [version, setVersion] = useState(0)
  const [resolving, setResolving] = useState(false)

  const places = useMemo(() => tripPlaces({ days, stays, transports }), [days, stays, transports])

  useEffect(() => {
    if (!open || !online || !places.length) return undefined
    let alive = true
    setResolving(true)
    resolveTimezones(places).finally(() => {
      if (!alive) return
      setResolving(false)
      setVersion((v) => v + 1)
    })
    return () => { alive = false }
  }, [open, online, places])

  const events = useMemo(
    () => tripEvents({ trip, dayKeys, days, stays, transports, tzOf: cachedTimezone, labels: LABELS, options }),
    [trip, dayKeys, days, stays, transports, options, version], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const zones = useMemo(() => {
    const set = new Set(places.map(cachedTimezone).filter(Boolean))
    return [...set]
  }, [places, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const unzoned = places.filter((p) => !cachedTimezone(p)).length

  const stopCount = Object.values(days).reduce((n, d) => n + d.stops.filter((s) => s.time).length, 0)
  const planCount = dayKeys.filter((d) => days[d]?.stops.length).length

  function file() {
    const text = buildIcs(trip, events)
    return new File([text], icsFileName(trip), { type: 'text/calendar' })
  }

  function download() {
    const f = file()
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`${f.name} téléchargé`)
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([''], 'a.ics', { type: 'text/calendar' })] })

  async function share() {
    try {
      await navigator.share({ files: [file()], title: trip.title })
    } catch (err) {
      if (err?.name !== 'AbortError') download()
    }
  }

  const toggle = (key) => setOptions((o) => ({ ...o, [key]: !o[key] }))

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Ajouter à l’agenda"
      description={`${trip.title} · ${plural(events.length, 'événement')}`}
      footer={(
        <div className="flex gap-2">
          {canShare && (
            <Button type="button" variant="secondary" className="flex-1" onClick={share} disabled={!events.length}>
              <Share2 size={16} /> Partager
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={download} disabled={!events.length}>
            <Download size={16} /> Télécharger .ics
          </Button>
        </div>
      )}
    >
      <ul className="space-y-1.5 text-[15px] text-fg">
        {stays.length > 0 && <Line>{plural(stays.length, 'hébergement')} : les nuits, l’arrivée et le départ</Line>}
        {transports.length > 0 && <Line>{plural(transports.length, 'trajet réservé', 'trajets réservés')}</Line>}
        <Toggle on={options.stops} onClick={() => toggle('stops')} disabled={!stopCount}>
          {plural(stopCount, 'étape à heure fixe', 'étapes à heure fixe')}
        </Toggle>
        <Toggle on={options.dayPlans} onClick={() => toggle('dayPlans')} disabled={!planCount}>
          Le programme de {plural(planCount, 'journée')} (toute la journée)
        </Toggle>
      </ul>

      <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
        {resolving
          ? <><Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" /> Recherche des fuseaux horaires…</>
          : (
            <>
              <Globe2 size={14} className="mt-0.5 shrink-0" />
              <span>
                {zones.length ? `Heures dans le fuseau de chaque lieu (${zones.join(', ')}) : justes où que soit le téléphone.` : ''}
                {unzoned > 0 && ` ${plural(unzoned, 'lieu')} sans fuseau${online ? '' : ' (hors-ligne)'} : heure affichée telle quelle.`}
                {!places.length && 'Aucun lieu localisé : heures affichées telles quelles.'}
              </span>
            </>
          )}
      </p>

      <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-muted space-y-1.5">
        <p>
          <span className="font-semibold text-fg">Google Agenda</span> : sur ordinateur, calendar.google.com ›
          Paramètres › Importer. Créez d’abord un agenda « {trip.title} » et importez-y le fichier : après des
          changements, on supprime cet agenda et on réimporte.
        </p>
        <p><span className="font-semibold text-fg">iPhone, Samsung, Outlook</span> : ouvrez le fichier.</p>
      </div>
    </ThemedSheet>
  )
}

function Line({ children }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-5 w-5 shrink-0 rounded-md bg-accent text-accent-fg flex items-center justify-center"><Check size={13} strokeWidth={3} /></span>
      {children}
    </li>
  )
}

function Toggle({ on, onClick, disabled, children }) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on && !disabled} className="w-full flex items-center gap-2.5 text-left disabled:opacity-50">
        <span className={cn('h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition', on && !disabled ? 'bg-accent border-accent text-accent-fg' : 'border-border-strong text-transparent')}>
          <Check size={13} strokeWidth={3} />
        </span>
        {children}
      </button>
    </li>
  )
}
