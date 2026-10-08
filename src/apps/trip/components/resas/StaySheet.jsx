import { useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils.js'
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
import { ChoiceChips, DateTimeField, Disclosure, FILLED, FormSection, lastCurrency, PriceField, rememberCurrency } from './formParts.jsx'
import OcrPrefill from './OcrPrefill.jsx'
import { stayFields } from '../../utils/resaParse.js'
import { STAY_KINDS } from '../../config/reservations.js'
import { deleteReservation, saveReservation } from '../../services/reservationsService.js'
import { deleteSentExpense } from '../../services/expenseService.js'
import { daysBetween } from '../../utils/tripDates.js'
import { formatPrice, plural } from '../../utils/format.js'

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
 * Un hébergement : la capture du mail d'abord (c'est elle qu'on montre à
 * l'accueil), puis où et quand, puis ce qu'il faut à la porte — le code et
 * la référence. Téléphone, prix, lien du mail et notes sont repliés.
 */
export default function StaySheet({ open, stay, defaults, tripId, tripStart = null, attachments = [], near, onClose, onDeleted }) {
  const { currentUid } = useAuth()
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec l'élément.
  const [form, setForm] = useState(() => initialForm(stay, defaults))
  const [files, setFiles] = useState(NO_CHANGES)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editAddress, setEditAddress] = useState(false)
  // Les champs remplis par la lecture de la capture, surlignés pour relecture.
  const [filled, setFilled] = useState(() => new Set())
  // Les dates pré-remplies (le jour affiché) ne sont qu'une supposition.
  const guessedDate = useRef(stay ? null : form.checkIn.date)
  const isEdit = !!stay

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }
  const hl = (key) => filled.has(key) && FILLED
  const capture = files.add[0] || attachments.find((a) => !files.remove.includes(a.id)) || null

  function applyCapture(parsed) {
    const f = stayFields(parsed)
    const patch = {}
    const keys = new Set()
    const datesFree = !form.checkIn.date || form.checkIn.date === guessedDate.current
    if (f.checkIn.date && datesFree) {
      patch.checkIn = { date: f.checkIn.date, time: f.checkIn.time || form.checkIn.time }
      keys.add('checkIn')
      if (f.checkOut.date && f.checkOut.date > f.checkIn.date) {
        patch.checkOut = { date: f.checkOut.date, time: f.checkOut.time || form.checkOut.time }
        keys.add('checkOut')
      }
    } else {
      if (f.checkIn.time && !form.checkIn.time) { patch.checkIn = { ...form.checkIn, time: f.checkIn.time }; keys.add('checkIn') }
      if (f.checkOut.time && !form.checkOut.time) { patch.checkOut = { ...form.checkOut, time: f.checkOut.time }; keys.add('checkOut') }
    }
    if (f.accessCode && !form.accessCode) { patch.accessCode = f.accessCode; keys.add('accessCode') }
    if (f.confirmation && !form.confirmation) { patch.confirmation = f.confirmation; keys.add('confirmation') }
    if (f.price && !form.price) {
      patch.price = String(f.price.amount).replace('.', ',')
      patch.currency = f.price.currency
      keys.add('price')
    }
    set(patch)
    setFilled(keys)
    if (keys.size) toast.success(`${plural(keys.size, 'champ rempli', 'champs remplis')} depuis la capture : vérifiez-les`)
    else toast('Rien de reconnaissable sur cette capture : complétez à la main.')
  }

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
    // Sa dépense FinAuzi reste (on a pu la payer quand même : annulation
    // payante) ; on propose de la supprimer, si c'est Trip qui l'avait créée.
    const expense = stay.expense
    toast.success('Hébergement supprimé', expense?.created ? {
      description: `Sa dépense (${formatPrice(expense.amount, expense.currency)}) reste dans FinAuzi.`,
      action: { label: 'La supprimer', onClick: () => deleteSentExpense(expense.txId).catch(() => toast.error('Suppression impossible')) },
    } : undefined)
    onClose()
    onDeleted?.()
  }

  const nights = form.checkIn.date && form.checkOut.date && form.checkOut.date > form.checkIn.date
    ? daysBetween(form.checkIn.date, form.checkOut.date)
    : 0
  const priceValue = Number(String(form.price).replace(',', '.'))
  const summary = [
    form.phone && 'téléphone',
    form.price && Number.isFinite(priceValue) && formatPrice(priceValue, form.currency),
    form.mailUrl && 'lien du mail',
    form.notes && 'notes',
  ].filter(Boolean).join(' · ') || 'téléphone, prix, lien du mail, notes'

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
          <FormSection title="Capture de la confirmation">
            <AttachmentField existing={attachments} value={files} onChange={setFiles} compact />
            {capture && <OcrPrefill capture={capture} near={form.checkIn.date || tripStart} onRead={applyCapture} />}
          </FormSection>

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
            {editAddress ? (
              <Field label="Adresse" optional>
                <Input
                  value={form.place.address || ''}
                  onChange={(e) => set({ place: { ...form.place, address: e.target.value } })}
                  placeholder="Rue, ville"
                  autoFocus
                />
              </Field>
            ) : (
              <button type="button" onClick={() => setEditAddress(true)} className="-mt-1 text-[13px] font-medium text-accent">
                {form.place.address ? 'Modifier l’adresse' : 'Saisir l’adresse à la main'}
              </button>
            )}
          </FormSection>

          <FormSection title="Dates">
            <div className="grid sm:grid-cols-2 gap-3">
              <DateTimeField label="Arrivée" date={form.checkIn.date} time={form.checkIn.time} onChange={changeCheckIn} highlight={filled.has('checkIn')} />
              <DateTimeField
                label="Départ"
                date={form.checkOut.date}
                time={form.checkOut.time}
                min={form.checkIn.date}
                onChange={(checkOut) => set({ checkOut })}
                highlight={filled.has('checkOut')}
              />
            </div>
            {nights > 0 && <p className="text-[13px] text-muted tabular">{plural(nights, 'nuit')}</p>}
          </FormSection>

          <FormSection title="À la porte">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code d’accès" optional>
                <Input value={form.accessCode} onChange={(e) => set({ accessCode: e.target.value })} placeholder="4417" className={cn('font-mono text-[15px]', hl('accessCode'))} />
              </Field>
              <Field label="Référence" optional>
                <Input value={form.confirmation} onChange={(e) => set({ confirmation: e.target.value })} placeholder="HMX2K9" className={cn('font-mono text-[15px]', hl('confirmation'))} />
              </Field>
            </div>
          </FormSection>

          <Disclosure key={filled.has('price') ? 'open' : 'closed'} summary={summary} defaultOpen={filled.has('price') || (isEdit && !!(stay.phone || stay.mailUrl || stay.notes))}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Téléphone" optional>
                <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+351 …" />
              </Field>
              <PriceField price={form.price} currency={form.currency} onChange={(p) => set(p)} highlight={filled.has('price')} />
            </div>
            <Field label="Lien vers le mail" optional hint="Sur téléphone, un lien Gmail ouvre parfois la boîte de réception : la capture, elle, s’affiche toujours.">
              <Input type="url" value={form.mailUrl} onChange={(e) => set({ mailUrl: e.target.value })} placeholder="https://mail.google.com/…" />
            </Field>
            <Field label="Notes" optional>
              <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Parking, étage, petit-déjeuner…" maxLength={2000} />
            </Field>
          </Disclosure>

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
