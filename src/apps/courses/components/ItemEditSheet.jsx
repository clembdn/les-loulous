import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AISLES } from '../config/aisles.js'
import QuantityField from './QuantityField.jsx'
import { readQuantity, toNumber } from '../utils/quantity.js'

export default function ItemEditSheet({ item, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [aisle, setAisle] = useState('autres')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (item) {
      setName(item.name)
      const q = readQuantity(item)
      setQty(q.quantity != null ? String(q.quantity) : '')
      setUnit(q.unit || '')
      setAisle(item.aisle)
      setNote(item.note || '')
    }
  }, [item])

  function save() {
    const v = name.trim()
    if (!v) return
    onSave(item.id, { name: v, quantity: toNumber(qty), unit: unit || null, aisle, note: note.trim() || null })
    onClose()
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title="Modifier l'article">
      {item && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Nom</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Quantité</label>
            <QuantityField
              quantity={qty}
              unit={unit}
              onChange={({ quantity, unit: u }) => { setQty(quantity); setUnit(u || '') }}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Rayon</label>
            <div className="flex flex-wrap gap-2">
              {AISLES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAisle(a.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs border transition',
                    aisle === a.id
                      ? 'bg-accent text-accent-fg border-accent'
                      : 'bg-surface-2 text-muted border-border hover:text-fg',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Note (optionnel)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="ex. marque précise, sans gluten…"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { onDelete(item.id); onClose() }}>
              <Trash2 size={16} /> Supprimer
            </Button>
            <Button className="flex-1" onClick={save}>Enregistrer</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
