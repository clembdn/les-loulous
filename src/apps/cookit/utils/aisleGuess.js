import { AISLE_KEYWORDS, DEFAULT_AISLE } from '../config/aisles.js'

// Minuscules, accents retirés, espaces compactés. Forme « brute » (sert aux slugs stables).
function rawNormalize(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Dé-pluralisation FR prudente : retire un s/x final pour les mots d'au moins 5 lettres.
function singularize(word) {
  return word.length >= 5 && /[sx]$/.test(word) ? word.slice(0, -1) : word
}

// Clé de rapprochement des noms (liste / frigo / recettes), insensible au pluriel : tomate ≈ tomates.
export function normalizeName(name) {
  return rawNormalize(name).split(' ').map(singularize).join(' ')
}

// Casse d'affichage d'un nom d'ingrédient (« linter » de saisie) : espaces superflus
// retirés, apostrophes recollées, première lettre en capitale. Les sigles saisis en
// capitales sont préservés (« Lait UHT »), sauf si TOUT est en capitales (« EMMENTAL »).
//   "  emmental " → "Emmental"   ·   "huile d' olive" → "Huile d'olive"
export function cleanName(name) {
  const raw = String(name ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([’'])\s*/g, '$1')
    .trim()
  if (!raw) return ''
  const hasLower = raw !== raw.toLocaleUpperCase('fr-FR')
  const base = hasLower ? raw : raw.toLocaleLowerCase('fr-FR')
  return base.replace(/^\p{L}/u, (c) => c.toLocaleUpperCase('fr-FR'))
}

// Identifiant déterministe pour le catalogue (slug stable, non dé-pluralisé).
export function slugify(name) {
  const base = rawNormalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'item'
}

// Devine le rayon depuis le nom via le dictionnaire de mots-clés (premier match).
export function guessAisle(name) {
  const n = rawNormalize(name)
  if (!n) return DEFAULT_AISLE
  for (const entry of AISLE_KEYWORDS) {
    for (const w of entry.words) {
      if (n.includes(w)) return entry.aisle
    }
  }
  return DEFAULT_AISLE
}
