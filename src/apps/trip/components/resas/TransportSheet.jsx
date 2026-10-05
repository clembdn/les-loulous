import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { ThemedConfirm, ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import Field from '../Field.jsx'
import PlaceInput from '../places/PlaceInput.jsx'
import AttachmentField from '../attachments/AttachmentField.jsx'
import { ChoiceChips, DateTimeField, FormSection, lastCurrency, PriceField, rememberCurrency } from './formParts.jsx'
import { getTransportMode, TRANSPORT_MODES } from '../../config/reservations.js'
import { deleteReservation, saveReservation } from '../../services/reservationsService.js'
import { resaTitle } from './resaDisplay.jsx'
import { plural } from '../../utils/format.js'

const NO_CHANGES = { add: [], remove: [] }
const NO_PLACE = { name: '', address: null, lat: null, lng: null, mapsUrl: null }

function placeOf(endpoint) {
  if (!endpoint) return NO_PLACE
  const { name, address, lat, lng, mapsUrl } = endpoint
  return { name, address, lat, lng, mapsUrl }
}

function initialForm(transport, defaults) {
  const date = transport?.from.date || defaults?.date || ''
  return {
    mode: transport?.mode || 'train',
    ref: transport?.ref || '',
    fromPlace: placeOf(transport?.from),
    from: { date, time: transport?.from.time || '' },
    toPlace: placeOf(transport?.to),
    to: { date: transport?.to.date || date, time: transport?.to.time || '' },
    seat: transport?.seat || '',
    confirmation: transport?.confirmation || '',
    price: transport?.price != null ? String(transport.price).replace('.', ',') : '',
    currency: transport?.currency || lastCurrency(),
    mailUrl: transport?.mailUrl || '',
    notes: transport?.notes || '',
  }
}

/**
 * Un trajet RÉSERVÉ : le billet existe, on le recopie (numéro, horaires,
 * place) et on joint sa capture. Rien n'est calculé — il n'y a pas d'itinéraire
 * à chercher pour un train qu'on a déjà payé.
 */
export default function TransportSheet({ open, transport, defaults, tripId, attachments = [], near, onClose, onDeleted }) {
  const { currentUid } = useAuth()
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec l'élément.
  const [form, setForm] = useState(() => initialForm(transport, defaults))
  const [files, setFiles] = useState(NO_CHANGES)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isEdit = !!transport
  const mode = getTransportMode(form.mode)

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }

  function changeFrom(next) {
    // L'arrivée suit le départ tant qu'elle n'est pas fixée après lui.
    const to = !form.to.date || form.to.date < next.date ? { ...form.to, date: next.date } : form.to
    set({ from: next, to })
  }

  function submit(e) {
    e.preventDefault()
    if (!form.from.date) return setError('Choisissez la date de départ.')
    if (form.to.date && form.to.date < form.from.date) return setError('L’arrivée précède le départ.')
    if (form.to.date === form.from.date && form.from.time && form.to.time && form.to.time < form.from.time) {
      return setError('Arrivée avant le départ le même jour : s’il arrive le lendemain, changez la date d’arrivée.')
    }

    const values = {
      mode: form.mode,
      ref: form.ref,
      from: { ...form.fromPlace, date: form.from.date, time: form.from.time || null },
      to: { ...form.toPlace, date: form.to.date || form.from.date, time: form.to.time || null },
      seat: form.seat,
      confirmation: form.confirmation,
      price: form.price,
      currency: form.currency,
      mailUrl: form.mailUrl,
      notes: form.notes,
    }
    const { done } = saveReservation('transport', tripId, transport, values, files, currentUid)
    done.catch(() => toast.error('Enregistrement impossible'))
    if (form.price) rememberCurrency(form.currency)
    toast.success(isEdit ? 'Trajet enregistré' : 'Trajet ajouté')
    onClose()
  }

  function remove() {
    deleteReservation('transport', tripId, transport.id, attachments.map((a) => a.id))
      .catch(() => toast.error('Suppression impossible'))
    toast.success('Trajet supprimé')
    onClose()
    onDeleted?.()
  }

  return (
    <>
      <ThemedSheet
        open={open}
        onOpenChange={(o) => { if (!o) onClose() }}
        title={isEdit ? 'Modifier le trajet' : 'Nouveau trajet réservé'}
        size="lg"
        footer={(
          <div className="flex gap-2">
            {isEdit && (
              <Button type="button" variant="danger" size="icon" className="h-11 w-11" onClick={() => setConfirmDelete(true)} aria-label="Supprimer le trajet">
                <Trash2 size={17} />
              </Button>
            )}
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" form="transport-form" className="flex-1">Enregistrer</Button>
          </div>
        )}
      >
        <form id="transport-form" onSubmit={submit} className="space-y-6" noValidate>
          <FormSection>
            <ChoiceChips options={TRANSPORT_MODES} value={form.mode} onChange={(m) => set({ mode: m })} />
            <Field label={form.mode === 'car' ? 'Loueur et véhicule' : 'Numéro'} optional>
              <Input value={form.ref} onChange={(e) => set({ ref: e.target.value })} placeholder={mode.refPlaceholder} autoFocus={!isEdit} />
            </Field>
          </FormSection>

          <FormSection title={mode.fromLabel}>
            <PlaceInput
              key={`from-${transport?.id || 'new'}`}
              value={form.fromPlace}
              onChange={(fromPlace) => set({ fromPlace })}
              placeholder={form.mode === 'flight' ? 'Aéroport de Lisbonne, ou lien Google Maps' : 'Gare, agence… ou lien Google Maps'}
              near={near}
            />
            <DateTimeField label="Le" date={form.from.date} time={form.from.time} onChange={changeFrom} />
          </FormSection>

          <FormSection title={mode.toLabel}>
            <PlaceInput
              key={`to-${transport?.id || 'new'}`}
              value={form.toPlace}
              onChange={(toPlace) => set({ toPlace })}
              placeholder="Lieu d’arrivée, ou lien Google Maps"
              near={near}
            />
            <DateTimeField label="Le" date={form.to.date} time={form.to.time} min={form.from.date} onChange={(to) => set({ to })} />
          </FormSection>

          <FormSection title="Réservation">
            <div className="grid sm:grid-cols-2 gap-3">
              {form.mode !== 'car' && (
                <Field label="Place" optional>
                  <Input value={form.seat} onChange={(e) => set({ seat: e.target.value })} placeholder="Voiture 12, place 64" />
                </Field>
              )}
              <Field label="Référence" optional>
                <Input value={form.confirmation} onChange={(e) => set({ confirmation: e.target.value })} placeholder="K7PQ2L" className="font-mono" />
              </Field>
              <PriceField price={form.price} currency={form.currency} onChange={(p) => set(p)} />
            </div>
            <Field label="Lien vers le mail" optional>
              <Input type="url" value={form.mailUrl} onChange={(e) => set({ mailUrl: e.target.value })} placeholder="https://mail.google.com/…" />
            </Field>
          </FormSection>

          <FormSection title="Billet et justificatifs">
            <AttachmentField existing={attachments} value={files} onChange={setFiles} />
          </FormSection>

          <Field label="Notes" optional>
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Terminal, bagages, franchise…" maxLength={2000} />
          </Field>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      </ThemedSheet>

      <ThemedConfirm
        open={confirmDelete}
        title={`Supprimer « ${transport ? resaTitle('transport', transport) : ''} » ?`}
        message="Le trajet disparaît pour tous les deux."
        details={attachments.length ? [plural(attachments.length, 'capture')] : []}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
