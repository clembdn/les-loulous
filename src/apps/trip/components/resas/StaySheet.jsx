import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { shiftDateKey } from '@/shared/lib/dates.js'
import { ThemedConfirm, ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import Field from '../Field.jsx'
import PlaceInput from '../places/PlaceInput.jsx'
import AttachmentField from '../attachments/AttachmentField.jsx'
import { ChoiceChips, DateTimeField, FormSection, lastCurrency, PriceField, rememberCurrency } from './formParts.jsx'
import { STAY_KINDS } from '../../config/reservations.js'
import { deleteReservation, saveReservation } from '../../services/reservationsService.js'
import { daysBetween } from '../../utils/tripDates.js'
import { plural } from '../../utils/format.js'

const NO_CHANGES = { add: [], remove: [] }

function initialForm(stay, defaults) {
  const checkIn = stay?.checkIn.date || defaults?.date || ''
  return {
    kind: stay?.kind || 'hotel',
    place: stay
      ? { name: stay.name, address: stay.address, lat: stay.lat, lng: stay.lng, mapsUrl: stay.mapsUrl }
      : { name: '', address: null, lat: null, lng: null, mapsUrl: null },
    checkIn: { date: checkIn, time: stay?.checkIn.time || '' },
    checkOut: { date: stay?.checkOut.date || (checkIn ? shiftDateKey(checkIn, 1) : ''), time: stay?.checkOut.time || '' },
    confirmation: stay?.confirmation || '',
    accessCode: stay?.accessCode || '',
    phone: stay?.phone || '',
    price: stay?.price != null ? String(stay.price).replace('.', ',') : '',
    currency: stay?.currency || lastCurrency(),
    mailUrl: stay?.mailUrl || '',
    notes: stay?.notes || '',
  }
}

/**
 * Un hébergement : où, quand, et tout ce qu'on montre à l'accueil
 * (référence, code de la boîte à clés, capture du mail de réservation).
 */
export default function StaySheet({ open, stay, defaults, tripId, attachments = [], near, onClose, onDeleted }) {
  const { currentUid } = useAuth()
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec l'élément.
  const [form, setForm] = useState(() => initialForm(stay, defaults))
  const [files, setFiles] = useState(NO_CHANGES)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isEdit = !!stay

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }

  function changeCheckIn(next) {
    // Le départ suit l'arrivée : une nuit par défaut, jamais avant.
    const checkOut = !form.checkOut.date || form.checkOut.date <= next.date
      ? { ...form.checkOut, date: next.date ? shiftDateKey(next.date, 1) : '' }
      : form.checkOut
    set({ checkIn: next, checkOut })
  }

  function submit(e) {
    e.preventDefault()
    if (!form.place.name.trim()) return setError('Donnez un nom à l’hébergement, ou collez son lien Google Maps.')
    if (!form.checkIn.date || !form.checkOut.date) return setError('Choisissez les dates d’arrivée et de départ.')
    if (form.checkOut.date <= form.checkIn.date) return setError('Le départ doit être au moins le lendemain de l’arrivée.')

    const values = {
      kind: form.kind,
      ...form.place,
      checkIn: { date: form.checkIn.date, time: form.checkIn.time || null },
      checkOut: { date: form.checkOut.date, time: form.checkOut.time || null },
      confirmation: form.confirmation,
      accessCode: form.accessCode,
      phone: form.phone,
      price: form.price,
      currency: form.currency,
      mailUrl: form.mailUrl,
      notes: form.notes,
    }
    const { done } = saveReservation('stay', tripId, stay, values, files, currentUid)
    done.catch(() => toast.error('Enregistrement impossible'))
    if (form.price) rememberCurrency(form.currency)
    toast.success(isEdit ? 'Hébergement enregistré' : 'Hébergement ajouté')
    onClose()
  }

  function remove() {
    deleteReservation('stay', tripId, stay.id, attachments.map((a) => a.id))
      .catch(() => toast.error('Suppression impossible'))
    toast.success('Hébergement supprimé')
    onClose()
    onDeleted?.()
  }

  const nights = form.checkIn.date && form.checkOut.date && form.checkOut.date > form.checkIn.date
    ? daysBetween(form.checkIn.date, form.checkOut.date)
    : 0

  return (
    <>
      <ThemedSheet
        open={open}
        onOpenChange={(o) => { if (!o) onClose() }}
        title={isEdit ? 'Modifier l’hébergement' : 'Nouvel hébergement'}
        size="lg"
        footer={(
          <div className="flex gap-2">
            {isEdit && (
              <Button type="button" variant="danger" size="icon" className="h-11 w-11" onClick={() => setConfirmDelete(true)} aria-label="Supprimer l’hébergement">
                <Trash2 size={17} />
              </Button>
            )}
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" form="stay-form" className="flex-1">Enregistrer</Button>
          </div>
        )}
      >
        <form id="stay-form" onSubmit={submit} className="space-y-6" noValidate>
          <FormSection>
            <ChoiceChips options={STAY_KINDS} value={form.kind} onChange={(kind) => set({ kind })} />
            <Field label="Nom et lieu">
              <PlaceInput
                key={stay?.id || 'new'}
                value={form.place}
                onChange={(place) => set({ place })}
                placeholder="Casa na Alfama, ou son lien Google Maps"
                near={near}
                autoFocus={!isEdit}
              />
            </Field>
            <Field label="Adresse" optional>
              <Input
                value={form.place.address || ''}
                onChange={(e) => set({ place: { ...form.place, address: e.target.value } })}
                placeholder="Remplie par le lien Google Maps"
              />
            </Field>
          </FormSection>

          <FormSection title="Dates">
            <div className="grid sm:grid-cols-2 gap-3">
              <DateTimeField label="Arrivée" date={form.checkIn.date} time={form.checkIn.time} onChange={changeCheckIn} />
              <DateTimeField
                label="Départ"
                date={form.checkOut.date}
                time={form.checkOut.time}
                min={form.checkIn.date}
                onChange={(checkOut) => set({ checkOut })}
              />
            </div>
            {nights > 0 && <p className="text-xs text-faint tabular">{plural(nights, 'nuit')}</p>}
          </FormSection>

          <FormSection title="Réservation">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Référence" optional>
                <Input value={form.confirmation} onChange={(e) => set({ confirmation: e.target.value })} placeholder="HMX2K9" className="font-mono" />
              </Field>
              <Field label="Code d’accès" optional>
                <Input value={form.accessCode} onChange={(e) => set({ accessCode: e.target.value })} placeholder="Boîte à clés 4417" />
              </Field>
              <Field label="Téléphone" optional>
                <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+351 …" />
              </Field>
              <PriceField price={form.price} currency={form.currency} onChange={(p) => set(p)} />
            </div>
            <Field label="Lien vers le mail" optional hint="Sur téléphone, un lien Gmail ouvre parfois la boîte de réception : la capture, elle, s’affiche toujours.">
              <Input type="url" value={form.mailUrl} onChange={(e) => set({ mailUrl: e.target.value })} placeholder="https://mail.google.com/…" />
            </Field>
          </FormSection>

          <FormSection title="Captures">
            <AttachmentField existing={attachments} value={files} onChange={setFiles} />
          </FormSection>

          <Field label="Notes" optional>
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Parking, étage, petit-déjeuner…" maxLength={2000} />
          </Field>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      </ThemedSheet>

      <ThemedConfirm
        open={confirmDelete}
        title={`Supprimer « ${stay?.name || ''} » ?`}
        message="L’hébergement disparaît pour tous les deux."
        details={attachments.length ? [plural(attachments.length, 'capture')] : []}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
