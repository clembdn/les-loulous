// Quantités structurées : nombre + unité, avec conversion/agrégation quand c'est possible.
// On garde un `quantityLabel` (texte) synchronisé pour l'affichage et la rétro-compat.

// family: 'mass' | 'volume' | 'count' | 'pack' | 'spoon'
// factor: vers l'unité de base de la famille (g pour mass, mL pour volume).
export const UNITS = [
  { id: 'g',       label: 'g',       family: 'mass',   factor: 1 },
  { id: 'kg',      label: 'kg',      family: 'mass',   factor: 1000 },
  { id: 'ml',      label: 'mL',      family: 'volume', factor: 1 },
  { id: 'cl',      label: 'cL',      family: 'volume', factor: 10 },
  { id: 'l',       label: 'L',       family: 'volume', factor: 1000 },
  { id: 'piece',   label: 'pièce',   plural: 'pièces',   family: 'count', factor: 1 },
  { id: 'boite',   label: 'boîte',   plural: 'boîtes',   family: 'pack',  factor: 1 },
  { id: 'paquet',  label: 'paquet',  plural: 'paquets',  family: 'pack',  factor: 1 },
  { id: 'sachet',  label: 'sachet',  plural: 'sachets',  family: 'pack',  factor: 1 },
  { id: 'pot',     label: 'pot',     plural: 'pots',     family: 'pack',  factor: 1 },
  { id: 'tranche', label: 'tranche', plural: 'tranches', family: 'pack',  factor: 1 },
  { id: 'gousse',  label: 'gousse',  plural: 'gousses',  family: 'pack',  factor: 1 },
  { id: 'cas',     label: 'c. à s.', family: 'spoon',  factor: 1 },
  { id: 'cac',     label: 'c. à c.', family: 'spoon',  factor: 1 },
]

const BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]))
export function getUnit(id) { return id ? BY_ID[id] || null : null }

function round2(n) { return Math.round(n * 100) / 100 }

// Convertit une saisie en nombre (gère la virgule FR et le vide).
export function toNumber(v) {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

// "1,5" / "500" sans zéros inutiles.
export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return ''
  return String(round2(n)).replace('.', ',')
}

export function unitLabel(id, quantity = 1) {
  const u = getUnit(id)
  if (!u) return ''
  return u.plural && Math.abs(quantity) > 1 ? u.plural : u.label
}

// "500 g", "2 pièces", "3" (sans unité), "" si rien.
export function formatQuantity(quantity, unit) {
  const hasQ = quantity != null && !Number.isNaN(quantity)
  if (hasQ && unit) return `${formatNumber(quantity)} ${unitLabel(unit, quantity)}`
  if (hasQ) return formatNumber(quantity)
  return ''
}

const UNIT_ALIASES = {
  g: 'g', gr: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', cl: 'cl',
  l: 'l', litre: 'l', litres: 'l',
  piece: 'piece', pieces: 'piece', pcs: 'piece', pc: 'piece', u: 'piece', unite: 'piece', unites: 'piece',
  boite: 'boite', boites: 'boite',
  paquet: 'paquet', paquets: 'paquet', pack: 'paquet',
  sachet: 'sachet', sachets: 'sachet',
  pot: 'pot', pots: 'pot',
  tranche: 'tranche', tranches: 'tranche',
  gousse: 'gousse', gousses: 'gousse',
}

// Devine {quantity, unit} depuis un texte libre ("500 g", "2 boîtes", "3").
export function parseQuantity(text) {
  const s = String(text || '').trim().toLowerCase()
  if (!s) return { quantity: null, unit: null }
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!m) return { quantity: null, unit: null }
  const quantity = Number(m[1].replace(',', '.'))
  const rest = m[2].normalize('NFD').replace(/\p{M}/gu, '').replace(/[.\s]+$/, '').trim()
  const unit = rest ? (UNIT_ALIASES[rest] || null) : null
  return { quantity: Number.isNaN(quantity) ? null : quantity, unit }
}

// Lit la quantité structurée d'un item (champs structurés, sinon parse du label libre).
export function readQuantity(item) {
  if (item && typeof item.quantity === 'number') return { quantity: item.quantity, unit: item.unit || null }
  return parseQuantity(item?.quantityLabel)
}

function familyOf(id) { return getUnit(id)?.family || null }
function factorOf(id) { return getUnit(id)?.factor || 1 }

function bestInFamily(base, fam) {
  if (fam === 'mass') return base >= 1000 ? { quantity: round2(base / 1000), unit: 'kg' } : { quantity: round2(base), unit: 'g' }
  if (fam === 'volume') return base >= 1000 ? { quantity: round2(base / 1000), unit: 'l' } : { quantity: round2(base), unit: 'ml' }
  return { quantity: round2(base), unit: null }
}

// Somme deux quantités si compatibles (même unité, ou même famille masse/volume).
// Renvoie { quantity, unit } ou null si non combinable.
export function addQuantities(a, b) {
  const qa = a?.quantity, qb = b?.quantity
  if (qa == null || qb == null) return null
  const ua = a.unit || null, ub = b.unit || null
  if (ua === ub) return { quantity: round2(qa + qb), unit: ua }
  const fa = familyOf(ua), fb = familyOf(ub)
  if (fa && fa === fb && (fa === 'mass' || fa === 'volume')) {
    return bestInFamily(qa * factorOf(ua) + qb * factorOf(ub), fa)
  }
  return null
}

// Fusion « tolérante » : addition si possible, sinon on garde la quantité définie.
export function mergeQuantity(existing, incoming) {
  const combined = addQuantities(existing, incoming)
  if (combined) return combined
  if (incoming?.quantity != null) return { quantity: incoming.quantity, unit: incoming.unit || null }
  if (existing?.quantity != null) return { quantity: existing.quantity, unit: existing.unit || null }
  return { quantity: null, unit: null }
}
