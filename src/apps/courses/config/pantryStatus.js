import { normalizeName } from '../utils/aisleGuess.js'

// Méta d'affichage des statuts de stock. Classes Tailwind pré-bakées (scannées par le bundler).
export const STATUS_META = {
  ok:  { label: 'En stock',     short: 'OK',      pillClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dotClass: 'bg-emerald-500' },
  low: { label: 'Bientôt fini', short: 'Bientôt', pillClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',       dotClass: 'bg-amber-500' },
  out: { label: 'Épuisé',       short: 'Épuisé',  pillClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20',          dotClass: 'bg-rose-500' },
}

// Cycle de statut au tap : OK → Bientôt fini → Épuisé → OK.
export const STATUS_CYCLE = { ok: 'low', low: 'out', out: 'ok' }

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.ok
}

// Les statuts considérés « à racheter » (alimentent l'ajout à la liste de courses).
export const NEEDED_STATUSES = ['low', 'out']
export function isNeeded(status) {
  return NEEDED_STATUSES.includes(status)
}

// Index nom normalisé → statut de stock, pour répondre à « est-ce qu'on l'a déjà ? ».
export function buildStockIndex(pantry) {
  const index = new Map()
  for (const p of pantry || []) index.set(normalizeName(p.name), p.status)
  return index
}

// Statut de stock d'un ingrédient ('ok' | 'low' | 'out'), ou null s'il n'est pas dans le frigo.
export function getStockStatus(name, index) {
  return (index && index.get(normalizeName(name))) || null
}
