import { AISLES } from '../config/aisles.js'

// Regroupe les items par rayon, dans l'ordre du preset, rayons vides exclus.
export function groupByAisle(items) {
  const buckets = new Map(AISLES.map((a) => [a.id, []]))
  for (const it of items) {
    if (!buckets.has(it.aisle)) buckets.set('autres', buckets.get('autres') || [])
    ;(buckets.get(it.aisle) || buckets.get('autres')).push(it)
  }
  return AISLES
    .filter((a) => (buckets.get(a.id) || []).length > 0)
    .map((a) => ({ aisle: a, items: buckets.get(a.id) }))
}
