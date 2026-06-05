import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Sheet } from './Sheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { addNamedItem } from '../utils/addItems.js'
import { normalizeName } from '../utils/aisleGuess.js'
import { buildStockIndex, getStockStatus, getStatusMeta } from '../config/pantryStatus.js'
import { readQuantity } from '../utils/quantity.js'
import { cn } from '@/shared/lib/utils.js'

// Feuille de sélection pré-cochée : ajoute les ingrédients choisis à la liste.
// Générique : accepte une liste d'ingrédients (détail recette OU agrégat semaine).
export default function AddIngredientsSheet({
  open, onClose, ingredients, items, catalog, pantry = [], onAdded, title = 'Ajouter à la liste',
}) {
  const { currentUid } = useAuth()
  const list = Array.isArray(ingredients) ? ingredients : []

  // Noms déjà présents dans la liste active (non cochés) → pour le dédoublonnage.
  const activeNames = useMemo(
    () => new Set(items.filter((i) => !i.checked).map((i) => normalizeName(i.name))),
    [items],
  )
  // Index du frigo → savoir ce qu'on a déjà en stock.
  const stockIndex = useMemo(() => buildStockIndex(pantry), [pantry])

  const [checked, setChecked] = useState([])
  const [busy, setBusy] = useState(false)

  // À l'ouverture : pré-coché SAUF ce qui est déjà dans la liste OU déjà en stock (statut « ok »).
  useEffect(() => {
    if (open) {
      setChecked(list.map((ing) => {
        const inStock = getStockStatus(ing.name, stockIndex) === 'ok'
        const already = activeNames.has(normalizeName(ing.name))
        const hasQty = readQuantity(ing).quantity != null
        // décoché si déjà en stock, ou déjà listé sans quantité à cumuler
        return !inStock && !(already && !hasQty)
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const count = checked.filter(Boolean).length

  function toggle(i) {
    setChecked((c) => c.map((v, j) => (j === i ? !v : v)))
  }

  async function confirm() {
    setBusy(true)
    try {
      for (let i = 0; i < list.length; i++) {
        if (checked[i]) {
          await addNamedItem(
            { name: list[i].name, quantity: list[i].quantity, unit: list[i].unit, quantityLabel: list[i].quantityLabel },
            { catalog, currentUid, items },
          )
        }
      }
      onClose()
      onAdded?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title}>
      {list.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Aucun ingrédient à ajouter.</p>
      ) : (
        <>
          <div className="space-y-0.5">
            {list.map((ing, i) => {
              const already = activeNames.has(normalizeName(ing.name))
              const stock = getStockStatus(ing.name, stockIndex)
              const stockMeta = stock ? getStatusMeta(stock) : null
              return (
                <label key={i} className="flex items-center gap-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[i] || false}
                    onChange={() => toggle(i)}
                    className="h-4 w-4 shrink-0"
                    style={{ accentColor: 'rgb(var(--accent))' }}
                  />
                  <span className="flex-1 text-sm text-fg">
                    {ing.name}
                    {ing.quantityLabel && <span className="text-muted"> · {ing.quantityLabel}</span>}
                  </span>
                  {already ? (
                    <span className="text-xs text-faint shrink-0">déjà dans la liste</span>
                  ) : stockMeta ? (
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0', stockMeta.pillClass)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', stockMeta.dotClass)} />
                      {stockMeta.label}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button className="flex-1" onClick={confirm} disabled={count === 0 || busy}>
              Ajouter ({count})
            </Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
