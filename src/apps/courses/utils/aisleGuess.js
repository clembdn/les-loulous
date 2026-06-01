import { AISLE_KEYWORDS, DEFAULT_AISLE } from '../config/aisles.js'

// Minuscules, accents retirés, espaces compactés.
export function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Identifiant déterministe pour le catalogue (dédoublonnage par nom).
export function slugify(name) {
  const base = normalizeName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'item'
}

// Devine le rayon depuis le nom via le dictionnaire de mots-clés (premier match).
export function guessAisle(name) {
  const n = normalizeName(name)
  if (!n) return DEFAULT_AISLE
  for (const entry of AISLE_KEYWORDS) {
    for (const w of entry.words) {
      if (n.includes(w)) return entry.aisle
    }
  }
  return DEFAULT_AISLE
}
