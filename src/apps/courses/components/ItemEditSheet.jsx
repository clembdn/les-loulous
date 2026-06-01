import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AISLES } from '../config/aisles.js'

export default function ItemEditSheet({ item, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [quantityLabel, setQuantityLabel] = useState('')
  const [aisle, setAisle] = useState('autres')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setQuantityLabel(item.quantityLabel || '')
      setAisle(item.aisle)
    }
  }, [item])

  function save() {
    const v = name.trim()
    if (!v) return
    onSave(item.id, { name: v, quantityLabel: quantityLabel.trim() || null, aisle })
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
            <label className="block text-xs text-muted mb-1.5">Quantité (libre)</label>
            <Input
              value={quantityLabel}
              onChange={(e) => setQuantityLabel(e.target.value)}
              placeholder="ex. 500 g, 2, 1 paquet"
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
