import { useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import Field from '../Field.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { saveDay } from '../../services/daysService.js'

// Le titre et les notes d'une journée, sur téléphone. Sur desktop ils
// s'éditent en place, dans l'en-tête du jour.
export default function DaySheet({ open, date, onClose }) {
  const { currentUid } = useAuth()
  const { tripId, days } = useTripData()
  const day = days[date]
  // Monté à chaque ouverture (cf. TripUIContext) : les champs naissent avec la journée.
  const [title, setTitle] = useState(day?.title || '')
  const [notes, setNotes] = useState(day?.notes || '')

  function submit(e) {
    e.preventDefault()
    saveDay(tripId, date, { title, notes }, day, currentUid).catch(() => toast.error('Enregistrement impossible'))
    onClose()
  }

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="La journée"
      description={date ? formatDayFr(date) : null}
      footer={(
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="day-form" className="flex-1">Enregistrer</Button>
        </div>
      )}
    >
      <form id="day-form" onSubmit={submit} className="space-y-4">
        <Field label="Titre" optional>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sintra, puis cap au sud" maxLength={120} autoFocus />
        </Field>
        <Field label="Notes" optional>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce qu’il ne faut pas oublier ce jour-là" maxLength={2000} />
        </Field>
      </form>
    </ThemedSheet>
  )
}
