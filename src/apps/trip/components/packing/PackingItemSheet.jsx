import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import Field from '../Field.jsx'
import { PACKING_CATEGORIES } from '../../config/packing.js'
import { usePackingActions } from '../../hooks/usePacking.js'

const chip = (active) => cn(
  'h-10 px-3.5 rounded-full border text-[14px] inline-flex items-center gap-1.5 transition',
  active ? 'bg-fg border-fg text-bg font-medium' : 'border-border text-fg hover:border-border-strong',
)

/** La fiche d'une affaire : son nom, sa catégorie, à qui elle est. */
export default function PackingItemSheet({ open, item, onClose }) {
  const actions = usePackingActions()
  // Monté à chaque ouverture : le formulaire naît avec l'affaire.
  const [form, setForm] = useState(() => ({ name: item?.name || '', category: item?.category, owner: item?.owner || null }))
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  function submit(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) return
    actions.update(item, { name, category: form.category, owner: form.owner })
    onClose()
  }

  if (!item) return null
  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Affaire"
      footer={(
        <div className="flex gap-2">
          <Button type="button" variant="danger" size="icon" className="h-11 w-11" aria-label="Retirer de la valise" onClick={() => { actions.remove(item); onClose() }}>
            <Trash2 size={17} />
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="packing-form" className="flex-1" disabled={!form.name.trim()}>Enregistrer</Button>
        </div>
      )}
    >
      <form id="packing-form" onSubmit={submit} className="space-y-5">
        <Field label="Nom">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className="text-[15px]" />
        </Field>

        <div>
          <p className="text-[13px] font-medium text-muted mb-1.5">À qui</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set({ owner: null })} aria-pressed={!form.owner} className={chip(!form.owner)}>
              Commune
            </button>
            {AUTHORIZED_UIDS.map((uid) => {
              const person = getPerson(uid)
              return (
                <button key={uid} type="button" onClick={() => set({ owner: uid })} aria-pressed={form.owner === uid} className={chip(form.owner === uid)}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: person.color }} /> {person.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[13px] font-medium text-muted mb-1.5">Catégorie</p>
          <div className="flex flex-wrap gap-1.5">
            {PACKING_CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => set({ category: c.id })} aria-pressed={form.category === c.id} className={chip(form.category === c.id)}>
                <c.icon size={15} style={form.category === c.id ? undefined : { color: c.color }} /> {c.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </ThemedSheet>
  )
}
