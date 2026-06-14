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
// Écritures fire-and-forget : le cache local met l'UI à jour immédiatement, et hors-ligne
// les promesses Firestore ne se résolvent qu'au retour du réseau — il ne faut pas les attendre.
export function addNamedItem({ name, quantity = null, unit = null, quantityLabel = null }, { catalog, currentUid, items, listId = null }) {
  const incoming = readQuantity({ quantity, unit, quantityLabel })
  const key = normalizeName(name)
  const existing = (items || []).find((i) => !i.checked && normalizeName(i.name) === key)

  if (existing) {
    const merged = mergeQuantity(readQuantity(existing), incoming)
    if (merged.quantity != null) {
      updateItem(existing.id, { quantity: merged.quantity, unit: merged.unit }, currentUid)
        .catch((err) => console.error('[Courses] addNamedItem merge error:', err))
    }
    return
  }

  const aisle = resolveAisleForName(name, catalog)
  addItem(
    { name, aisle, listId, quantity: incoming.quantity, unit: incoming.unit, quantityLabel: incoming.quantity == null ? quantityLabel : null },
    currentUid,
  ).catch((err) => console.error('[Courses] addNamedItem error:', err))
  recordUsage(name, aisle, currentUid)
    .catch((err) => console.error('[Courses] recordUsage error:', err))
}
