import { useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { useDayView } from '../../hooks/useDayView.js'
import { DEFAULT_CATEGORY } from '../../config/categories.js'
import CategoryChips from '../CategoryChips.jsx'
import { Disclosure } from '../resas/formParts.jsx'
import { MAX_STOPS_PER_DAY, saveDay, saveDays } from '../../services/daysService.js'
import { guessCategory } from '../../utils/categoryGuess.js'
import { insertStopByTime, moveStop } from '../../utils/timeline.js'
import { newId } from '../../utils/fields.js'
import { formatDuration } from '../../utils/format.js'

const DURATIONS = [30, 60, 90, 120, 180, 240]

function initialForm(stop) {
  return {
    place: stop
      ? { name: stop.name, address: stop.address, lat: stop.lat, lng: stop.lng, mapsUrl: stop.mapsUrl }
      : { name: '', address: null, lat: null, lng: null, mapsUrl: null },
    time: stop?.time || '',
    durationMin: stop?.durationMin || null,
    category: stop?.category || DEFAULT_CATEGORY,
    notes: stop?.notes || '',
    date: null,
  }
}

/**
 * Une étape : un lieu et son heure d'abord ; sa catégorie (devinée, en
 * couleur) ; la durée et les notes pour qui en veut (« Plus d'options »).
 * La plupart des étapes s'ajoutent d'ailleurs sans cette fiche, par la
 * saisie rapide : ici, on complète.
 *
 * On peut aussi y changer l'étape de jour. L'ordre dans la journée se règle
 * en glissant (éditeur desktop, « Réorganiser » sur téléphone).
 */
export default function StopSheet({ open, date, stop, near, onClose }) {
  const { currentUid } = useAuth()
  const { tripId, days, dayKeys, stopsByDate } = useTripData()
  const view = useDayView(date)
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec l'élément.
  const [form, setForm] = useState(() => initialForm(stop))
  // La catégorie suit le lieu choisi tant qu'on ne l'a pas choisie soi-même.
  const [categoryTouched, setCategoryTouched] = useState(!!stop)
  const [error, setError] = useState(null)
  const isEdit = !!stop

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }
  const stops = stopsByDate[date] || []
  const targetDate = form.date || date

  function submit(e) {
    e.preventDefault()
    const name = form.place.name.trim()
    if (!name) {
      setError('Donnez un nom à l’étape, ou collez son lien Google Maps.')
      return
    }
    const category = categoryTouched || form.category !== DEFAULT_CATEGORY
      ? form.category
      : guessCategory({ name }) || DEFAULT_CATEGORY
    const next = {
      id: stop?.id || newId(),
      ...form.place,
      name,
      time: form.time || null,
      durationMin: form.durationMin || null,
      category,
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
    const list = isEdit ? stops.map((s) => (s.id === stop.id ? next : s)) : insertStopByTime(stops, next)
    if (list.length > MAX_STOPS_PER_DAY) {
      setError(`${MAX_STOPS_PER_DAY} étapes maximum par jour.`)
      return
    }
    saveDay(tripId, date, { stops: list }, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))
    if (!isEdit) toast.success('Étape ajoutée')
    onClose()
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

  const durations = form.durationMin && !DURATIONS.includes(form.durationMin)
    ? [...DURATIONS, form.durationMin].sort((a, b) => a - b)
    : DURATIONS
  const summary = [formatDuration(form.durationMin), form.notes && 'notes'].filter(Boolean).join(' · ')

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
            onPick={(found) => { if (!categoryTouched && found.category) set({ category: found.category }) }}
            placeholder="Tour de Belém, ou son lien Google Maps"
            near={near || view.near}
            autoFocus={!isEdit}
          />
        </Field>

        <div className={cn('grid gap-3', isEdit ? 'grid-cols-2' : 'grid-cols-1')}>
          <Field label="Heure" optional>
            <Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} className="text-[15px]" />
          </Field>
          {isEdit && (
            <Field label="Jour">
              <select
                value={targetDate}
                onChange={(e) => set({ date: e.target.value })}
                className="w-full h-11 px-3 rounded-xl bg-surface-2 border border-border text-[15px] text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {dayKeys.map((d) => <option key={d} value={d}>{formatDayFr(d)}</option>)}
              </select>
            </Field>
          )}
        </div>
        {isEdit && targetDate !== date && (
          <p className="-mt-3 text-[13px] text-muted">L’étape passera en fin de journée, le {formatDayFr(targetDate)}.</p>
        )}

        <div>
          <p className="text-[13px] font-medium text-muted mb-1.5">Catégorie</p>
          <CategoryChips value={form.category} onChange={(category) => { setCategoryTouched(true); set({ category }) }} />
        </div>

        <Disclosure summary={summary || 'durée, notes'} defaultOpen={!!(stop?.durationMin || stop?.notes)}>
          <div>
            <p className="text-[13px] font-medium text-muted mb-1.5">Durée</p>
            <div className="flex flex-wrap gap-1.5">
              {[null, ...durations].map((m) => {
                const active = (form.durationMin || null) === m
                return (
                  <button
                    key={m ?? 'none'}
                    type="button"
                    onClick={() => set({ durationMin: m })}
                    aria-pressed={active}
                    className={cn(
                      'h-10 px-3.5 rounded-full border text-[14px] transition',
                      active ? 'bg-fg border-fg text-bg font-medium' : 'border-border text-fg hover:border-border-strong',
                    )}
                  >
                    {m ? formatDuration(m) : 'Aucune'}
                  </button>
                )
              })}
            </div>
          </div>
          <Field label="Notes" optional>
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Billets réservés 9 h 30, prendre une veste…" maxLength={1000} />
          </Field>
        </Disclosure>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </ThemedSheet>
  )
}
