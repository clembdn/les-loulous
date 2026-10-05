import { useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import Field from '../Field.jsx'
import PlaceInput from '../places/PlaceInput.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { DEFAULT_CATEGORY, STOP_CATEGORIES } from '../../config/categories.js'
import { MAX_STOPS_PER_DAY, saveDay, saveDays } from '../../services/daysService.js'
import { insertionPointByTime, moveStop, shiftStop } from '../../utils/timeline.js'
import { newId } from '../../utils/fields.js'
import { formatDuration } from '../../utils/format.js'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360]

function insertAt(stops, stop) {
  const beforeId = insertionPointByTime(stops, stop.time)
  const at = beforeId ? stops.findIndex((s) => s.id === beforeId) : -1
  return at === -1 ? [...stops, stop] : [...stops.slice(0, at), stop, ...stops.slice(at)]
}

function initialForm(stop) {
  return {
    place: stop
      ? { name: stop.name, address: stop.address, lat: stop.lat, lng: stop.lng, mapsUrl: stop.mapsUrl }
      : { name: '', address: null, lat: null, lng: null, mapsUrl: null },
    time: stop?.time || '',
    durationMin: stop?.durationMin ? String(stop.durationMin) : '',
    category: stop?.category || DEFAULT_CATEGORY,
    notes: stop?.notes || '',
    date: null,
  }
}

/**
 * Une étape : un lieu, une heure, une durée, une catégorie, des notes.
 *
 * C'est aussi là qu'on la range sur téléphone (monter, descendre, changer de
 * jour) : le glisser-déposer est réservé à l'éditeur desktop, où la souris le
 * rend précis.
 */
export default function StopSheet({ open, date, stop, near, onClose }) {
  const { currentUid } = useAuth()
  const { tripId, days, dayKeys, stopsByDate } = useTripData()
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec l'élément.
  const [form, setForm] = useState(() => initialForm(stop))
  const [error, setError] = useState(null)
  const isEdit = !!stop

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }
  const stops = stopsByDate[date] || []
  const index = stop ? stops.findIndex((s) => s.id === stop.id) : -1
  const targetDate = form.date || date

  function submit(e) {
    e.preventDefault()
    const name = form.place.name.trim()
    if (!name) {
      setError('Donnez un nom à l’étape, ou collez son lien Google Maps.')
      return
    }
    const next = {
      id: stop?.id || newId(),
      ...form.place,
      name,
      time: form.time || null,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      category: form.category,
      notes: form.notes,
    }

    // Changement de jour : l'étape part en fin de journée d'arrivée, dans le
    // même lot que son retrait du jour de départ.
    if (isEdit && targetDate !== date) {
      const moved = moveStop(stopsByDate, { fromDate: date, stopId: stop.id, toDate: targetDate })
      moved[targetDate] = moved[targetDate].map((s) => (s.id === stop.id ? next : s))
      if (moved[targetDate].length > MAX_STOPS_PER_DAY) {
        setError(`${MAX_STOPS_PER_DAY} étapes maximum par jour.`)
        return
      }
      saveDays(tripId, { [date]: { stops: moved[date] }, [targetDate]: { stops: moved[targetDate] } }, days, currentUid)
        .catch(() => toast.error('Déplacement impossible'))
      toast.success(`Étape déplacée au ${formatDayFr(targetDate)}`)
      onClose()
      return
    }

    // Une nouvelle étape datée se range à son heure ; ensuite, l'ordre est
    // celui qu'on choisit (changer l'heure ne la déplace pas d'elle-même).
    const list = isEdit ? stops.map((s) => (s.id === stop.id ? next : s)) : insertAt(stops, next)
    if (list.length > MAX_STOPS_PER_DAY) {
      setError(`${MAX_STOPS_PER_DAY} étapes maximum par jour.`)
      return
    }
    saveDay(tripId, date, { stops: list }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))
    if (!isEdit) toast.success('Étape ajoutée')
    onClose()
  }

  // Monter / descendre s'écrit tout de suite : l'ordre change sous les yeux,
  // la fiche reste ouverte pour continuer à ranger.
  function shift(delta) {
    saveDay(tripId, date, { stops: shiftStop(stops, stop.id, delta) }, days[date], currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
  }

  // Pas de confirmation pour une étape : un « Annuler » dans le message
  // remet la journée telle qu'elle était.
  function remove() {
    const before = stops
    saveDay(tripId, date, { stops: stops.filter((s) => s.id !== stop.id) }, days[date], currentUid)
      .catch(() => toast.error('Suppression impossible'))
    toast('Étape supprimée', {
      action: {
        label: 'Annuler',
        onClick: () => saveDay(tripId, date, { stops: before }, days[date], currentUid)
          .catch(() => toast.error('Impossible de la remettre')),
      },
    })
    onClose()
  }

  const durations = form.durationMin && !DURATIONS.includes(Number(form.durationMin))
    ? [...DURATIONS, Number(form.durationMin)].sort((a, b) => a - b)
    : DURATIONS

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={isEdit ? 'Modifier l’étape' : 'Nouvelle étape'}
      description={date ? formatDayFr(date) : null}
      size="lg"
      footer={(
        <div className="flex gap-2">
          {isEdit && (
            <Button type="button" variant="danger" size="icon" className="h-11 w-11" onClick={remove} aria-label="Supprimer l’étape">
              <Trash2 size={17} />
            </Button>
          )}
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="stop-form" className="flex-1">{isEdit ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      )}
    >
      <form id="stop-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Lieu">
          <PlaceInput
            key={stop?.id || 'new'}
            value={form.place}
            onChange={(place) => set({ place })}
            placeholder="Tour de Belém, ou son lien Google Maps"
            near={near}
            autoFocus={!isEdit}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Heure" optional>
            <Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
          <Field label="Durée" optional>
            <select
              value={form.durationMin}
              onChange={(e) => set({ durationMin: e.target.value })}
              className="w-full h-11 px-3 rounded-xl bg-surface-2 border border-border text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">—</option>
              {durations.map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
            </select>
          </Field>
        </div>

        <div>
          <p className="text-xs font-medium text-muted mb-1.5">Catégorie</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {STOP_CATEGORIES.map((c) => {
              const Icon = c.icon
              const active = form.category === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set({ category: c.id })}
                  aria-pressed={active}
                  className={cn(
                    'h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border text-xs transition',
                    active ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-border text-muted hover:text-fg',
                  )}
                >
                  <Icon size={14} /> {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Notes" optional>
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Billets réservés 9 h 30, prendre une veste…" maxLength={1000} />
        </Field>

        {isEdit && (
          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-xs font-medium text-muted">Ranger</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={index <= 0 || targetDate !== date} onClick={() => shift(-1)}>
                <ArrowUp size={15} /> Monter
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={index === -1 || index >= stops.length - 1 || targetDate !== date} onClick={() => shift(1)}>
                <ArrowDown size={15} /> Descendre
              </Button>
              <select
                value={targetDate}
                onChange={(e) => set({ date: e.target.value })}
                className="h-9 px-3 rounded-xl bg-surface-2 border border-border text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Jour de l’étape"
              >
                {dayKeys.map((d) => <option key={d} value={d}>{formatDayFr(d)}</option>)}
              </select>
            </div>
            {targetDate !== date && (
              <p className="text-xs text-muted">L’étape passera en fin de journée, le {formatDayFr(targetDate)}.</p>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </ThemedSheet>
  )
}
