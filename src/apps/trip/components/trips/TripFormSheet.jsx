import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useOnline } from '@/shared/lib/useOnline.js'
import { ThemedConfirm, ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { formatDateFr } from '@/shared/lib/dates.js'
import Field from '../Field.jsx'
import {
  createTrip, deleteTripCascade, readDayStopCounts, readTripContents, updateTrip,
} from '../../services/tripsService.js'
import { daysBetween, validateTripDates } from '../../utils/tripDates.js'
import { plural } from '../../utils/format.js'
import { tripPath } from '../../config/navigation.js'

/**
 * Créer, modifier ou supprimer un voyage : un titre et deux dates.
 *
 * Les écritures partent sans être attendues (offline-first). Seules les
 * LECTURES le sont — compter ce qu'une suppression emporte, ou ce qu'un
 * raccourcissement masque — et elles retombent sur le cache hors-ligne.
 */
export default function TripFormSheet({ open, trip = null, onClose, onDeleted }) {
  const { currentUid } = useAuth()
  const online = useOnline()
  const navigate = useNavigate()
  const isEdit = !!trip

  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  // { kind: 'shrink', values, hidden } | { kind: 'delete', details }
  const [confirm, setConfirm] = useState(null)

  // Remis à zéro à l'ouverture seulement — et suivi par l'id, pas par l'objet :
  // le voyage est renormalisé à chaque écho de Firestore, et le formulaire
  // effacerait ce qu'on est en train de taper si l'autre modifiait le voyage.
  useEffect(() => {
    if (!open) return
    setTitle(trip?.title || '')
    setStartDate(trip?.startDate || '')
    setEndDate(trip?.endDate || '')
    setNotes(trip?.notes || '')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?.id])

  function changeStart(value) {
    setStartDate(value)
    // Le retour suit le départ : choisir le 12 mai quand la fin est au 3 ne
    // doit pas laisser un voyage à l'envers.
    if (value && (!endDate || endDate < value)) setEndDate(value)
  }

  function save(values) {
    if (isEdit) {
      updateTrip(trip, values, currentUid).catch(() => toast.error('Enregistrement impossible'))
      toast.success('Voyage enregistré')
      onClose()
      return
    }
    const { id, done } = createTrip(values, currentUid)
    done.catch(() => toast.error('Création impossible'))
    toast.success('Voyage créé')
    onClose()
    navigate(tripPath(id, 'jours'))
  }

  async function submit(e) {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Donnez un titre au voyage.')
      return
    }
    const dateError = validateTripDates(startDate, endDate)
    if (dateError) {
      setError(dateError)
      return
    }
    const values = { title: cleanTitle, startDate, endDate, notes }

    // Raccourcir le voyage masque les jours qui sortent de la plage. Leurs
    // étapes sont gardées (elles reviennent si on rallonge), mais personne
    // ne doit les voir disparaître sans l'avoir accepté.
    if (isEdit && (startDate > trip.startDate || endDate < trip.endDate)) {
      const counts = await readDayStopCounts(trip.id).catch(() => [])
      const hidden = counts
        .filter((d) => d.stops > 0 && (d.date < startDate || d.date > endDate))
        .sort((a, b) => a.date.localeCompare(b.date))
      if (hidden.length) {
        setConfirm({ kind: 'shrink', values, hidden })
        return
      }
    }
    save(values)
  }

  async function askDelete() {
    const contents = await readTripContents(trip.id).catch(() => null)
    const details = contents
      ? [
          contents.stops > 0 && plural(contents.stops, 'étape'),
          contents.stays > 0 && plural(contents.stays, 'hébergement'),
          contents.transports > 0 && plural(contents.transports, 'trajet réservé', 'trajets réservés'),
          contents.attachments > 0 && plural(contents.attachments, 'capture'),
        ].filter(Boolean)
      : []
    setConfirm({ kind: 'delete', details })
  }

  function confirmDelete() {
    deleteTripCascade(trip.id).catch(() => toast.error('Suppression impossible'))
    toast.success('Voyage supprimé')
    onClose()
    onDeleted?.()
  }

  const length = startDate && endDate && endDate >= startDate ? daysBetween(startDate, endDate) + 1 : 0

  return (
    <>
      <ThemedSheet
        open={open}
        onOpenChange={(o) => { if (!o) onClose() }}
        title={isEdit ? 'Modifier le voyage' : 'Nouveau voyage'}
        footer={(
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" form="trip-form" className="flex-1">{isEdit ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        )}
      >
        <form id="trip-form" onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Titre">
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null) }}
              placeholder="Portugal, côte ouest"
              maxLength={120}
              autoFocus={!isEdit}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Du">
              <Input type="date" value={startDate} onChange={(e) => { changeStart(e.target.value); setError(null) }} />
            </Field>
            <Field label="Au">
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => { setEndDate(e.target.value); setError(null) }}
              />
            </Field>
          </div>
          {length > 0 && (
            <p className="-mt-2 text-[13px] text-muted tabular">
              {plural(length, 'jour')}{length > 1 && ` · ${plural(length - 1, 'nuit')}`}
            </p>
          )}

          <Field label="Notes" optional>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Idées, rappels, ce qu'on ne veut pas oublier…"
              maxLength={2000}
            />
          </Field>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          {isEdit && (
            <div className="pt-3 border-t border-border">
              <Button type="button" variant="danger" size="sm" disabled={!online} onClick={askDelete}>
                <Trash2 size={15} /> Supprimer le voyage
              </Button>
              {!online && (
                <p className="text-[13px] text-muted mt-1">
                  Connexion requise : tout ce que contient le voyage doit être supprimé avec lui.
                </p>
              )}
            </div>
          )}
        </form>
      </ThemedSheet>

      <ThemedConfirm
        open={confirm?.kind === 'shrink'}
        title="Raccourcir le voyage ?"
        message="Ces jours sortent du voyage. Leurs étapes sont conservées et reviendront si vous rallongez les dates."
        details={confirm?.kind === 'shrink'
          ? confirm.hidden.map((d) => `${formatDateFr(d.date)} · ${plural(d.stops, 'étape')}`)
          : []}
        confirmLabel="Raccourcir"
        onConfirm={() => save(confirm.values)}
        onClose={() => setConfirm(null)}
      />

      <ThemedConfirm
        open={confirm?.kind === 'delete'}
        title={`Supprimer « ${trip?.title || ''} » ?`}
        message="Le voyage disparaît pour tous les deux, avec tout ce qu'il contient. C'est définitif."
        details={confirm?.kind === 'delete' ? confirm.details : []}
        onConfirm={confirmDelete}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}
