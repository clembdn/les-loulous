import { useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { ThemedConfirm, ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import Field from '../Field.jsx'
import PlaceInput from '../places/PlaceInput.jsx'
import AttachmentField from '../attachments/AttachmentField.jsx'
import { ChoiceChips, DateTimeField, Disclosure, FILLED, FormSection, lastCurrency, PriceField, rememberCurrency } from './formParts.jsx'
import OcrPrefill from './OcrPrefill.jsx'
import { transportFields } from '../../utils/resaParse.js'
import { getTransportMode, TRANSPORT_MODES } from '../../config/reservations.js'
import { deleteReservation, saveReservation } from '../../services/reservationsService.js'
import { deleteSentExpense } from '../../services/expenseService.js'
import { resaTitle } from './resaDisplay.jsx'
import { formatPrice, plural } from '../../utils/format.js'

const NO_CHANGES = { add: [], remove: [] }
const NO_PLACE = { name: '', address: null, lat: null, lng: null, mapsUrl: null }

// « Nouveau vol », « Modifier le train »… : le formulaire dit ce qu'on saisit.
const NOUNS = {
  flight: ['Nouveau vol', 'Modifier le vol'],
  train: ['Nouveau train', 'Modifier le train'],
  bus: ['Nouveau bus', 'Modifier le bus'],
  ferry: ['Nouveau ferry', 'Modifier le ferry'],
  car: ['Nouvelle location', 'Modifier la location'],
  other: ['Nouveau trajet réservé', 'Modifier le trajet'],
}

function placeOf(endpoint) {
  if (!endpoint) return NO_PLACE
  const { name, address, lat, lng, mapsUrl } = endpoint
  return { name, address, lat, lng, mapsUrl }
}

function initialForm(transport, defaults) {
  // « Créer le retour » : l'aller à l'envers — on repart d'où l'on arrivait.
  const reverse = !transport && defaults?.reverseOf
  if (reverse) {
    return {
      mode: reverse.mode,
      ref: '',
      fromPlace: placeOf(reverse.to),
      from: { date: '', time: '' },
      toPlace: placeOf(reverse.from),
      to: { date: '', time: '' },
      seat: '',
      confirmation: '',
      price: '',
      currency: reverse.currency || lastCurrency(),
      mailUrl: '',
      notes: '',
    }
  }
  const date = transport?.from.date || defaults?.date || ''
  return {
    mode: transport?.mode || defaults?.mode || 'train',
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
 * place) et on joint sa capture — en tête, c'est elle qu'on montre au
 * contrôle. Rien n'est calculé : il n'y a pas d'itinéraire à chercher pour
 * un train qu'on a déjà payé.
 *
 * Le type vient de la tuile choisie (« Vol ») : on ne le redemande pas.
 * « Créer le retour » ouvre un nouveau trajet, départ et arrivée inversés.
 */
export default function TransportSheet({ open, transport, defaults, tripId, tripStart = null, attachments = [], near, onClose, onDeleted, onReverse }) {
  const { currentUid } = useAuth()
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec l'élément.
  const [form, setForm] = useState(() => initialForm(transport, defaults))
  const [files, setFiles] = useState(NO_CHANGES)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [changeMode, setChangeMode] = useState(false)
  // Les champs remplis par la lecture de la capture, surlignés pour relecture.
  const [filled, setFilled] = useState(() => new Set())
  // La date pré-remplie (le jour affiché) n'est qu'une supposition : celle
  // lue sur le billet la remplace.
  const guessedDate = useRef(transport ? null : form.from.date)
  const isEdit = !!transport
  const mode = getTransportMode(form.mode)
  const nouns = NOUNS[form.mode] || NOUNS.other

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }
  const hl = (key) => filled.has(key) && FILLED

  // Une capture jointe (déjà enregistrée, ou ajoutée à l'instant) à lire.
  const capture = files.add[0] || attachments.find((a) => !files.remove.includes(a.id)) || null

  function applyCapture(parsed) {
    const f = transportFields(parsed)
    const patch = {}
    const keys = new Set()
    const take = (key, value, empty) => { if (value && empty) { keys.add(key); return true } return false }
    if (take('ref', f.ref, !form.ref)) {
      patch.ref = f.ref
      if (f.mode && f.mode !== form.mode && !isEdit) patch.mode = f.mode
    }
    const dateFree = !form.from.date || form.from.date === guessedDate.current
    if (take('from', f.from.date, dateFree)) patch.from = { date: f.from.date, time: f.from.time || form.from.time }
    else if (take('from', f.from.time, !form.from.time)) patch.from = { ...form.from, time: f.from.time }
    if (take('to', f.to.date || f.to.time, dateFree || !form.to.time)) {
      patch.to = { date: f.to.date || patch.from?.date || form.to.date, time: f.to.time || form.to.time }
    }
    if (take('fromPlace', f.fromName, !form.fromPlace.name)) patch.fromPlace = { ...form.fromPlace, name: f.fromName }
    if (take('toPlace', f.toName, !form.toPlace.name)) patch.toPlace = { ...form.toPlace, name: f.toName }
    if (take('seat', f.seat, !form.seat && form.mode !== 'car')) patch.seat = f.seat
    if (take('confirmation', f.confirmation, !form.confirmation)) patch.confirmation = f.confirmation
    if (take('price', f.price, !form.price)) {
      patch.price = String(f.price.amount).replace('.', ',')
      patch.currency = f.price.currency
    }
    set(patch)
    setFilled(keys)
    if (keys.size) toast.success(`${plural(keys.size, 'champ rempli', 'champs remplis')} depuis la capture : vérifiez-les`)
    else toast('Rien de reconnaissable sur cette capture : complétez à la main.')
  }

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
    // Sa dépense FinAuzi reste (on a pu la payer quand même : annulation
    // payante) ; on propose de la supprimer, si c'est Trip qui l'avait créée.
    const expense = transport.expense
    toast.success('Trajet supprimé', expense?.created ? {
      description: `Sa dépense (${formatPrice(expense.amount, expense.currency)}) reste dans FinAuzi.`,
      action: { label: 'La supprimer', onClick: () => deleteSentExpense(expense.txId).catch(() => toast.error('Suppression impossible')) },
    } : undefined)
    onClose()
    onDeleted?.()
  }

  const priceValue = Number(String(form.price).replace(',', '.'))
  const summary = [
    form.price && Number.isFinite(priceValue) && formatPrice(priceValue, form.currency),
    form.mailUrl && 'lien du mail',
    form.notes && 'notes',
  ].filter(Boolean).join(' · ') || 'prix, lien du mail, notes'

  return (
    <>
      <ThemedSheet
        open={open}
        onOpenChange={(o) => { if (!o) onClose() }}
        title={isEdit ? nouns[1] : nouns[0]}
        description={defaults?.reverseOf ? 'Le retour : départ et arrivée inversés' : null}
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
          <FormSection title={form.mode === 'flight' ? 'Carte d’embarquement' : 'Billet ou confirmation'}>
            <AttachmentField existing={attachments} value={files} onChange={setFiles} compact />
            {capture && <OcrPrefill capture={capture} near={form.from.date || tripStart} onRead={applyCapture} />}
          </FormSection>

          <FormSection>
            {changeMode ? (
              <ChoiceChips options={TRANSPORT_MODES} value={form.mode} onChange={(m) => { set({ mode: m }); setChangeMode(false) }} />
            ) : null}
            <Field label={form.mode === 'car' ? 'Loueur et véhicule' : 'Numéro'} optional>
              <Input
                value={form.ref}
                onChange={(e) => set({ ref: e.target.value })}
                placeholder={mode.refPlaceholder}
                autoFocus={!isEdit}
                className={cn('font-mono text-[15px]', hl('ref'))}
              />
            </Field>
            {!changeMode && (
              <button type="button" onClick={() => setChangeMode(true)} className="-mt-1 text-[13px] font-medium text-accent">
                {mode.short || mode.label} · changer de type
              </button>
            )}
          </FormSection>

          <FormSection title={mode.fromLabel}>
            <PlaceInput
              key={`from-${transport?.id || 'new'}`}
              value={form.fromPlace}
              onChange={(fromPlace) => set({ fromPlace })}
              placeholder={form.mode === 'flight' ? 'Aéroport de Lisbonne, ou lien Google Maps' : 'Gare, agence… ou lien Google Maps'}
              near={near}
            />
            <DateTimeField label="Le" date={form.from.date} time={form.from.time} onChange={changeFrom} highlight={filled.has('from')} />
          </FormSection>

          <FormSection title={mode.toLabel}>
            <PlaceInput
              key={`to-${transport?.id || 'new'}`}
              value={form.toPlace}
              onChange={(toPlace) => set({ toPlace })}
              placeholder="Lieu d’arrivée, ou lien Google Maps"
              near={near}
            />
            <DateTimeField label="Le" date={form.to.date} time={form.to.time} min={form.from.date} onChange={(to) => set({ to })} highlight={filled.has('to')} />
          </FormSection>

          <FormSection title="Au contrôle">
            <div className={form.mode === 'car' ? 'grid gap-3' : 'grid grid-cols-2 gap-3'}>
              {form.mode !== 'car' && (
                <Field label="Place" optional>
                  <Input value={form.seat} onChange={(e) => set({ seat: e.target.value })} placeholder="Voiture 12, place 64" className={cn('text-[15px]', hl('seat'))} />
                </Field>
              )}
              <Field label="Référence" optional>
                <Input value={form.confirmation} onChange={(e) => set({ confirmation: e.target.value })} placeholder="K7PQ2L" className={cn('font-mono text-[15px]', hl('confirmation'))} />
              </Field>
            </div>
          </FormSection>

          <Disclosure key={filled.has('price') ? 'open' : 'closed'} summary={summary} defaultOpen={filled.has('price') || (isEdit && !!(transport.mailUrl || transport.notes))}>
            <PriceField price={form.price} currency={form.currency} onChange={(p) => set(p)} highlight={filled.has('price')} />
            <Field label="Lien vers le mail" optional>
              <Input type="url" value={form.mailUrl} onChange={(e) => set({ mailUrl: e.target.value })} placeholder="https://mail.google.com/…" />
            </Field>
            <Field label="Notes" optional>
              <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Terminal, bagages, franchise…" maxLength={2000} />
            </Field>
          </Disclosure>

          {isEdit && form.mode !== 'car' && onReverse && (
            <Button type="button" variant="secondary" className="w-full" onClick={() => { onClose(); onReverse(transport) }}>
              <ArrowLeftRight size={16} /> Créer le retour
            </Button>
          )}

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
