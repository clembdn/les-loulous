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
export function addNamedItem({ name, quantity = null, unit = null, quantityLabel = null, foodId = null }, { catalog, currentUid, items, listId = null, foods = null }) {
  const incoming = readQuantity({ quantity, unit, quantityLabel })
  const key = normalizeName(name)
  const existing = (items || []).find((i) => !i.checked && normalizeName(i.name) === key)

  if (existing) {
    const merged = mergeQuantity(readQuantity(existing), incoming)
    if (merged.quantity != null) {
      updateItem(existing.id, { quantity: merged.quantity, unit: merged.unit }, currentUid)
        .catch((err) => console.error('[Cook’It] addNamedItem merge error:', err))
    }
    return
  }

  const aisle = resolveAisleForName(name, catalog)
  // Rattachement automatique : si un aliment de la bibliotheque porte ce nom, on
  // le lie sans rien demander. C'est ce qui fait que retaper « yaourt » ramene
  // ses valeurs nutritionnelles tout seul.
  const linked = foodId || (foods || []).find((f) => f.nameLower === key)?.id || null
  addItem(
    { name, aisle, listId, foodId: linked, quantity: incoming.quantity, unit: incoming.unit, quantityLabel: incoming.quantity == null ? quantityLabel : null },
    currentUid,
  ).catch((err) => console.error('[Cook’It] addNamedItem error:', err))
  recordUsage(name, aisle, currentUid)
    .catch((err) => console.error('[Cook’It] recordUsage error:', err))
}

// Ajout en lot. `addNamedItem` lit `items` au moment de l'appel : dans une boucle
// synchrone, deux entrees de meme nom ne se voient pas et creent deux documents.
// Ici on tient une liste qui grossit au fur et a mesure, donc elles fusionnent.
export function addNamedItems(list, ctx) {
  const pending = []
  for (const entry of list) {
    addNamedItem(entry, { ...ctx, items: [...(ctx.items || []), ...pending] })
    // On n'a pas l'id du document cree (ecriture fire-and-forget), mais un
    // marqueur suffit : seuls le nom et la quantite servent au rapprochement.
    pending.push({
      id: `pending-${pending.length}`,
      name: entry.name,
      quantity: entry.quantity ?? null,
      unit: entry.unit ?? null,
      quantityLabel: entry.quantityLabel ?? null,
      checked: false,
    })
  }
}
