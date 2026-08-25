import { useState, useEffect } from 'react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { toNumber } from '../utils/quantity.js'
import { nutrientsForGrams, formatKcal, formatGrams } from '../utils/nutrition.js'
import { SLOTS } from '../services/foodLogService.js'

// Quelle quantité, à quel repas — le dernier pas avant d'inscrire au journal.
// Les raccourcis de portion évitent de peser : c'est ce qui décide si le
// journal est tenu tous les jours ou abandonné au bout d'une semaine.

const QUICK = [30, 50, 100, 150, 200, 250]

export default function FoodLogEntrySheet({ food, slot, open, onClose, onAdd }) {
  const [grams, setGrams] = useState('100')
  const [chosenSlot, setChosenSlot] = useState(slot || 'midi')

  useEffect(() => {
    if (!open) return
    // Une portion indiquée sur l'emballage vaut mieux qu'un 100 g arbitraire.
    setGrams(String(food?.servingGrams || 100))
    setChosenSlot(slot || 'midi')
  }, [food, slot, open])

  const g = toNumber(grams)
  const n = food && g > 0 ? nutrientsForGrams(food, g) : null

  function add() {
    if (!food || !(g > 0)) return
    onAdd({
      kind: 'food',
      refId: food.id,
      label: food.name,
      slot: chosenSlot,
      amount: g,
      amountUnit: 'g',
      kcal: n.kcal, proteins: n.proteins, carbs: n.carbs, fat: n.fat,
    })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={food?.name || 'Ajouter'}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Repas</label>
          <div className="flex gap-2">
            {SLOTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setChosenSlot(s.id)}
                className={cn(
                  'flex-1 px-2 py-2 rounded-xl text-xs border transition',
                  chosenSlot === s.id
                    ? 'bg-accent text-accent-fg border-accent'
                    : 'bg-surface-2 text-muted border-border hover:text-fg',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Quantité</label>
          <div className="relative">
            <Input value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" className="pr-8 tabular" autoFocus />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">g</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {food?.servingGrams > 0 && (
              <button
                onClick={() => setGrams(String(food.servingGrams))}
                className="px-2.5 py-1 rounded-full text-[11px] border border-accent text-accent hover:bg-accent/10 transition"
              >
                1 portion ({food.servingGrams} g)
              </button>
            )}
            {food?.gramsPerPiece > 0 && (
              <button
                onClick={() => setGrams(String(food.gramsPerPiece))}
                className="px-2.5 py-1 rounded-full text-[11px] border border-accent text-accent hover:bg-accent/10 transition"
              >
                1 pièce ({food.gramsPerPiece} g)
              </button>
            )}
            {QUICK.map((v) => (
              <button
                key={v}
                onClick={() => setGrams(String(v))}
                className="px-2.5 py-1 rounded-full text-[11px] border border-border text-muted hover:text-fg transition tabular"
              >
                {v} g
              </button>
            ))}
          </div>
        </div>

        {n && (
          <div className="rounded-xl bg-surface-2 p-3 flex items-baseline justify-between">
            <span className="text-lg font-semibold text-fg tabular">{formatKcal(n.kcal)}</span>
            <span className="text-xs text-muted tabular">
              P {formatGrams(n.proteins)} · G {formatGrams(n.carbs)} · L {formatGrams(n.fat)}
            </span>
          </div>
        )}

        <Button className="w-full" onClick={add} disabled={!(g > 0)}>Ajouter au journal</Button>
      </div>
    </Sheet>
  )
}
