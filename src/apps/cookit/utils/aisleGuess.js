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

// Devine le rayon depuis le nom via le dictionnaire de mots-clés.
//
// Le rapprochement se fait sur des MOTS ENTIERS, jamais sur une sous-chaîne :
// un `includes` brut classait « Southern Fried Chicken » en épicerie sucrée
// (« sou-the-rn » contient « the »), « Daily Juice » en fruits & légumes
// (« d-ail-y »), « Mussels » en épicerie salée (« mus-sel-s ») et « Beautiful
// Water » en boissons (« b-eau-tiful »). Des réponses fausses et confiantes,
// pires que pas de réponse du tout.
//
// Un mot-clé peut contenir des espaces (« pomme de terre ») : on teste alors la
// séquence complète, toujours bornée par des frontières de mots.
const WORD_RE_CACHE = new Map()

function wordRegex(word) {
  let re = WORD_RE_CACHE.get(word)
  if (!re) {
    // Les DEUX côtés passent par normalizeName (dé-pluralisation prudente), sinon
    // « pommes de terre » ne trouverait pas le mot-clé « pomme de terre ». Le
    // `s?` final rattrape les pluriels courts que normalizeName laisse passer.
    const escaped = normalizeName(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`\\b${escaped}s?\\b`)
    WORD_RE_CACHE.set(word, re)
  }
  return re
}

function scan(n, multiWord) {
  for (const entry of AISLE_KEYWORDS) {
    for (const w of entry.words) {
      if (w.includes(' ') !== multiWord) continue
      if (wordRegex(w).test(n)) return entry.aisle
    }
  }
  return null
}

// Nom PRINCIPAL : ce qui précède le premier complément. « maquereaux à l'eau »
// a pour nom principal « maquereau ».
//
// Sans cette coupe, le mot-clé du complément l'emporte sur celui du produit :
// « eau » est un mot-clé « boissons », et le maquereau en boîte finissait donc
// au rayon Boissons. Même piège pour « thon à l'huile » (épicerie salée) ou
// « yaourt à la grecque ».
const CONNECTOR_RE = /\b(?:a|au|aux|de|du|des|en|avec|sauce|in|with)\b|\b[dl]'/

function headOf(n) {
  const m = CONNECTOR_RE.exec(n)
  if (!m || m.index <= 0) return null
  const head = n.slice(0, m.index).trim()
  return head && head !== n ? head : null
}

// Trois passes, de la plus spécifique à la plus large :
//   1. mots-clés COMPOSÉS sur le nom entier — « peanut butter » doit l'emporter
//      sur « butter », et « pomme de terre » enjambe le connecteur « de » ;
//   2. mots-clés simples sur le NOM PRINCIPAL — c'est le produit, pas sa sauce ;
//   3. mots-clés simples sur le nom entier — « filet de saumon » n'a pas de tête
//      reconnaissable, il faut bien aller chercher « saumon » dans la suite.
// À spécificité égale, l'ordre de déclaration tranche (cf. AISLE_KEYWORDS).
export function guessAisle(name) {
  const n = normalizeName(name)
  if (!n) return DEFAULT_AISLE
  const head = headOf(n)
  return scan(n, true)
    || (head ? scan(head, false) : null)
    || scan(n, false)
    || DEFAULT_AISLE
}
