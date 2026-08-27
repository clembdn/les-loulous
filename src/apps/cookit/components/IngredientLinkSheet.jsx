import { useState, useEffect } from 'react'
import { Link2Off } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { formatQuantity } from '../utils/quantity.js'
import { toGrams, nutrientsForGrams, formatKcal, UNRESOLVED } from '../utils/nutrition.js'
import { toNumber } from '../utils/quantity.js'
import FoodPickerSheet from './FoodPickerSheet.jsx'

// Relie un ingrédient de recette à un aliment, et règle le seul cas que la
// conversion automatique ne peut pas trancher : « 2 tranches » ou « 1 pincée »,
// dont personne ne connaît le poids sans le dire.

export default function IngredientLinkSheet({ ingredient, foods, foodById, open, onClose, onSave }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [foodId, setFoodId] = useState(null)
  const [picked, setPicked] = useState(null)
  const [grams, setGrams] = useState('')

  useEffect(() => {
    if (!open) return
    setFoodId(ingredient?.foodId || null)
    setPicked(ingredient?.foodId ? foodById.get(ingredient.foodId) || null : null)
    setGrams(ingredient?.gramsOverride != null ? String(ingredient.gramsOverride) : '')
  }, [ingredient, open, foodById])

  const food = picked
  const conv = food ? toGrams(ingredient?.quantity, ingredient?.unit, food) : { grams: null, reason: null }
  const override = toNumber(grams)
  const effective = override > 0 ? override : conv.grams
  // On demande un poids dès que la conversion échoue, quelle qu'en soit la raison
  // (unité non convertible OU quantité absente).
  const needsGrams = !!food && conv.grams == null
  const preview = food && effective != null ? nutrientsForGrams(food, effective) : null

  function save() {
    const patch = { foodId: foodId || null, gramsOverride: override > 0 ? override : null }
    // Un ingrédient sans quantité ne pouvait être réparé qu'en rouvrant tout
    // l'éditeur : on pose ici la quantité manquante, en grammes.
    if (ingredient?.quantity == null && override > 0) {
      patch.quantity = override
      patch.unit = 'g'
      patch.gramsOverride = null
    }
    onSave(patch)
    onClose()
  }

  return (
    <>
      <Sheet open={open && !pickerOpen} onOpenChange={(o) => !o && onClose()} title={ingredient?.name || 'Ingrédient'}>
        <div className="space-y-4">
          <p className="text-xs text-muted">
            {formatQuantity(ingredient?.quantity, ingredient?.unit) || 'Quantité non précisée'}
          </p>

          <div>
            <label className="block text-xs text-muted mb-1.5">Aliment correspondant</label>
            {food ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg truncate">{food.name}</span>
                  <span className="block text-xs text-faint truncate">
                    {[food.brand, `${Math.round(food.per100.kcal)} kcal / 100 g`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>Changer</Button>
              </div>
            ) : (
              <Button variant="dashed" className="w-full" onClick={() => setPickerOpen(true)}>
                Choisir un aliment
              </Button>
            )}
          </div>

          {needsGrams && (
            <div>
              <label className="block text-xs text-muted mb-1.5">
                Poids correspondant
              </label>
              <div className="relative">
                <Input
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  inputMode="decimal"
                  placeholder="120"
                  className="pr-8 tabular"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">g</span>
              </div>
              <p className="text-[11px] text-faint mt-1.5">
                {conv.reason === UNRESOLVED.NEEDS_PIECE_WEIGHT
                  ? 'Cette unité ne se convertit pas toute seule : indique le poids total.'
                  : 'Indique le poids utilisé pour compter cet ingrédient.'}
              </p>
            </div>
          )}

          {preview && (
            <p className="text-sm text-fg tabular">
              ≈ {Math.round(effective)} g → <strong>{formatKcal(preview.kcal)}</strong>
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {foodId && (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => { setFoodId(null); setPicked(null); setGrams('') }}
                aria-label="Délier"
              >
                <Link2Off size={16} />
              </Button>
            )}
            <Button className="flex-1" onClick={save}>Enregistrer</Button>
          </div>
        </div>
      </Sheet>

      <FoodPickerSheet
        open={pickerOpen}
        foods={foods}
        title={`Aliment pour « ${ingredient?.name || ''} »`}
        onClose={() => setPickerOpen(false)}
        onPick={(f) => { setPicked(f); setFoodId(f.id || null); setPickerOpen(false) }}
      />
    </>
  )
}
