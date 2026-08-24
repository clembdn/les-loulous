// FinAuzi — deviner la catégorie d'une ligne de relevé.
//
// Un libellé bancaire est du bruit avec un nom de commerçant dedans :
//   « CB CARREFOUR MARKET 14/08 CARTE 4979 »  →  carrefour market
//   « EFTPOS WOOLWORTHS 2043 SYDNEY AUS »     →  woolworths
//
// On nettoie, on cherche le commerçant, et on retient. Les règles apprises
// sont stockées dans les réglages (`importRules`), donc partagées entre les
// deux téléphones et gratuites : corriger une catégorie une fois suffit à ce
// que les imports suivants tombent juste.

const ACCENTS = /[̀-ͯ]/g

// Le bruit standard des deux pays : type d'opération, numéro de carte,
// date répétée dans le libellé, ville, code pays. L'ordre compte — les
// expressions de deux mots passent avant les mots isolés, sinon « direct
// debit » perd son second mot et « direct » survit tout seul.
const NOISE_PHRASES = /\b(direct debit|paiement par carte|achat carte|point of sale)\b/g

const NOISE_WORDS = new Set([
  'achat', 'paiement', 'payment', 'purchase', 'retrait', 'withdrawal',
  'cb', 'carte', 'card', 'eftpos', 'visa', 'mastercard', 'debit', 'credit', 'direct',
  'prlv', 'prelevement', 'facture', 'dd',
  'vir', 'virement', 'transfer', 'tfr', 'osko', 'payid', 'bpay', 'sepa',
  'recu', 'emis', 'inst', 'ref', 'reference',
  'aus', 'au', 'fra', 'nsw', 'vic', 'qld', 'sa', 'wa',
  'to', 'from', 'the', 'de', 'du', 'des', 'la', 'le', 'les', 'pour', 'par', 'chez', 'and', 'et',
  'pty', 'ltd', 'sarl', 'sas', 'sa.', 'inc', 'llc', 'gmbh',
])

export function normalizeLabel(raw) {
  let s = String(raw || '')
    .toLowerCase()
    .normalize('NFD').replace(ACCENTS, '')

  // Les dates se retirent AVANT que la ponctuation ne disparaisse, sinon
  // « 14/08 » devient « 14 08 » et pollue le nom du commerçant.
  s = s.replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, ' ')
  s = s.replace(/[^a-z0-9\s'&]/g, ' ')
  s = s.replace(NOISE_PHRASES, ' ')

  const words = s.split(/\s+/).filter((word) => (
    word
    && !NOISE_WORDS.has(word)
    && !/^\d+$/.test(word)      // références et numéros de magasin
    && !/^x+\d*$/.test(word)    // cartes masquées « xxxx1234 »
  ))

  return words.join(' ').trim()
}

// Le titre affiché dans l'app : le libellé nettoyé, en capitales initiales.
// Le libellé brut n'est pas perdu pour autant — il part dans les notes.
export function prettifyLabel(raw) {
  const normalized = normalizeLabel(raw)
  const source = normalized || String(raw || '').trim()
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
    .slice(0, 60) || 'Opération'
}

// Commerçants connus des deux côtés — France et Australie dans la même
// table, puisque le foyer dépense dans les deux pays.
const SEEDS = {
  groceries: ['carrefour', 'leclerc', 'intermarche', 'auchan', 'lidl', 'aldi', 'monoprix', 'franprix', 'casino', 'super u', 'picard', 'biocoop', 'woolworths', 'woolies', 'coles', 'iga', 'harris farm', 'costco'],
  restaurants: ['mcdonald', 'burger', 'kfc', 'subway', 'uber eats', 'ubereats', 'deliveroo', 'doordash', 'menulog', 'restaurant', 'cafe', 'coffee', 'boulangerie', 'pizza', 'sushi', 'thai', 'bakery'],
  transport: ['sncf', 'ratp', 'uber', 'didi', 'ola', 'total', 'totalenergies acces', 'esso', 'shell', 'ampol', 'caltex', 'bp ', 'opal', 'translink', 'myki', 'parking', 'linkt', 'toll', 'peage', 'vinci autoroute', 'blablacar', 'lime', 'garage'],
  utilities: ['edf', 'engie', 'totalenergies', 'agl', 'origin energy', 'energy australia', 'alinta', 'sydney water', 'veolia', 'suez', 'eau'],
  internet: ['orange', 'sfr', 'bouygues', 'free mobile', 'free ', 'sosh', 'red by', 'telstra', 'optus', 'vodafone', 'belong', 'tpg', 'aussie broadband', 'more telecom'],
  subscriptions: ['netflix', 'spotify', 'disney', 'prime video', 'amazon prime', 'apple.com', 'itunes', 'icloud', 'google', 'youtube', 'canal', 'deezer', 'adobe', 'microsoft', 'openai', 'anthropic', 'claude', 'dropbox', 'audible', 'stan', 'binge', 'kayo'],
  health: ['pharmacie', 'pharmacy', 'chemist', 'medicare', 'docteur', 'doctor', 'dentist', 'dentiste', 'mutuelle', 'bupa', 'medibank', 'hcf', 'nib', 'opticien', 'laboratoire', 'clinic'],
  shopping: ['amazon', 'zara', 'h&m', 'uniqlo', 'decathlon', 'ikea', 'kmart', 'big w', 'target', 'jb hi-fi', 'bunnings', 'officeworks', 'fnac', 'darty', 'boulanger', 'sephora', 'asos', 'zalando', 'temu', 'shein'],
  housing: ['loyer', 'rent', 'real estate', 'realty', 'agence immo', 'syndic', 'foncia', 'ray white', 'lj hooker'],
  travel: ['airbnb', 'booking', 'expedia', 'qantas', 'jetstar', 'virgin australia', 'air france', 'transavia', 'ryanair', 'easyjet', 'flixbus', 'hotel', 'hostel', 'trainline'],
  leisure: ['cinema', 'hoyts', 'event cinemas', 'ugc', 'pathe', 'gym', 'fitness', 'anytime', 'goodlife', 'bar ', 'pub ', 'brewery', 'bottleshop', 'dan murphy', 'liquorland', 'nicolas', 'theatre', 'musee', 'museum'],
  salary: ['salaire', 'salary', 'payroll', 'paie', 'wages', 'remuneration'],
  bonus: ['caf ', 'allocation', 'centrelink', 'remboursement', 'refund', 'ato ', 'impots'],
}

const SEED_ENTRIES = Object.entries(SEEDS).flatMap(([category, needles]) =>
  needles.map((needle) => [needle, category]),
)

// Les règles de l'utilisateur passent avant les nôtres : c'est lui qui a
// raison sur son propre relevé.
export function guessCategory(rawLabel, kind, userRules = {}) {
  const label = normalizeLabel(rawLabel)
  if (!label) return null

  for (const [needle, category] of Object.entries(userRules)) {
    if (needle && label.includes(needle)) return category
  }

  for (const [needle, category] of SEED_ENTRIES) {
    if (label.includes(needle)) {
      // Un « remboursement Carrefour » reste une entrée d'argent : une
      // catégorie de dépense sur un crédit n'aurait aucun sens.
      if (kind === 'income' && !['salary', 'bonus', 'other-income'].includes(category)) continue
      if (kind === 'expense' && ['salary', 'bonus'].includes(category)) continue
      return category
    }
  }

  return null
}

// Ce qu'on retient d'une correction : les deux ou trois premiers mots du
// libellé nettoyé. Assez précis pour viser le bon commerçant, assez large
// pour rattraper « carrefour market » puis « carrefour city ».
export function ruleKeyFor(rawLabel) {
  const words = normalizeLabel(rawLabel).split(' ').filter(Boolean)
  if (words.length === 0) return null
  return words.slice(0, words[0].length <= 4 ? 2 : 1).join(' ')
}

export function learnRule(rules, rawLabel, categoryId) {
  const key = ruleKeyFor(rawLabel)
  if (!key || !categoryId) return rules
  if (rules[key] === categoryId) return rules
  return { ...rules, [key]: categoryId }
}
