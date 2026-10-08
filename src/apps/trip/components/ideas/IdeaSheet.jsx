import { useState } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import Field from '../Field.jsx'
import PlaceInput from '../places/PlaceInput.jsx'
import CategoryChips from '../CategoryChips.jsx'
import { useIdeaActions } from '../../hooks/useIdeas.js'

/**
 * La fiche d'un lieu à caser : le lieu (on peut le localiser, ou le
 * remplacer par son lien Google Maps), sa catégorie — un lieu « Autre » prend
 * celle du lieu trouvé —, des notes. « Placer » passe au choix du jour.
 */
export default function IdeaSheet({ open, idea, near, onClose, onPlace }) {
  const actions = useIdeaActions()
  // Monté à chaque ouverture (cf. TripUIContext) : le formulaire naît avec le lieu.
  const [form, setForm] = useState(() => ({
    place: idea
      ? { name: idea.name, address: idea.address, lat: idea.lat, lng: idea.lng, mapsUrl: idea.mapsUrl }
      : { name: '', address: null, lat: null, lng: null, mapsUrl: null },
    category: idea?.category,
    notes: idea?.notes || '',
  }))
  const [error, setError] = useState(null)
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }

  // Ce qui est saisi part avec le lieu, qu'on enregistre ou qu'on le place.
  function current() {
    const name = form.place.name.trim()
    if (!name) {
      setError('Donnez un nom au lieu.')
      return null
    }
    return { ...idea, ...form.place, name, category: form.category, notes: form.notes }
  }

  function submit(e) {
    e.preventDefault()
    const next = current()
    if (!next) return
    actions.update(idea, next)
    onClose()
  }

  function place() {
    const next = current()
    if (!next) return
    // Enregistré d'abord : le choix du jour place le lieu tel qu'on vient de le corriger.
    const changed = ['name', 'address', 'lat', 'lng', 'mapsUrl', 'category'].some((k) => next[k] !== idea[k])
      || (next.notes || '') !== (idea.notes || '')
    if (changed) actions.update(idea, next)
    onPlace(next)
  }

  function remove() {
    actions.remove(idea)
    onClose()
  }

  if (!idea) return null
  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Lieu à caser"
      description="Repéré, pas encore placé dans un jour"
      size="lg"
      footer={(
        <div className="flex gap-2">
          <Button type="button" variant="danger" size="icon" className="h-11 w-11" onClick={remove} aria-label="Retirer de la liste">
            <Trash2 size={17} />
          </Button>
          <Button type="submit" form="idea-form" variant="secondary" className="flex-1">Enregistrer</Button>
          <Button type="button" className="flex-1" onClick={place}>
            <CalendarPlus size={16} /> Placer
          </Button>
        </div>
      )}
    >
      <form id="idea-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Lieu">
          <PlaceInput
            value={form.place}
            onChange={(p) => set({ place: p })}
            onPick={(found) => { if (form.category === 'other' && found.category) set({ category: found.category }) }}
            placeholder="Nom du lieu, ou son lien Google Maps"
            near={near}
          />
        </Field>

        <div>
          <p className="text-[13px] font-medium text-muted mb-1.5">Catégorie</p>
          <CategoryChips value={form.category} onChange={(category) => set({ category })} />
        </div>

        <Field label="Notes" optional>
          <Textarea
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Conseillé par Marie, fermé le lundi…"
            maxLength={1000}
          />
        </Field>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </ThemedSheet>
  )
}
