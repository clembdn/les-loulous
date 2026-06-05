import { addItem, updateItem } from '../services/shoppingItemsService.js'
import { recordUsage } from '../services/catalogService.js'
import { slugify, guessAisle, normalizeName } from './aisleGuess.js'
import { readQuantity, mergeQuantity } from './quantity.js'

// Rayon d'un nom : rayon mémorisé du catalogue (par slug) sinon devinette par mots-clés.
export function resolveAisleForName(name, catalog) {
  const slug = slugify(name)
  const known = catalog.find((c) => c.id === slug)
  return known?.aisle || guessAisle(name)
}

// Ajoute un article à la liste (+ met à jour le catalogue). Si un article actif du même
// nom existe déjà (passer `items`), on cumule les quantités au lieu de créer un doublon.
export async function addNamedItem({ name, quantity = null, unit = null, quantityLabel = null }, { catalog, currentUid, items }) {
  const incoming = readQuantity({ quantity, unit, quantityLabel })
  const key = normalizeName(name)
  const existing = (items || []).find((i) => !i.checked && normalizeName(i.name) === key)

  if (existing) {
    const merged = mergeQuantity(readQuantity(existing), incoming)
    if (merged.quantity != null) {
      await updateItem(existing.id, { quantity: merged.quantity, unit: merged.unit }, currentUid)
    }
    return
  }

  const aisle = resolveAisleForName(name, catalog)
  await addItem(
    { name, aisle, quantity: incoming.quantity, unit: incoming.unit, quantityLabel: incoming.quantity == null ? quantityLabel : null },
    currentUid,
  )
  await recordUsage(name, aisle, currentUid)
}
