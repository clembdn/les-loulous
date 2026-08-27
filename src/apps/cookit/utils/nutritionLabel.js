// Lecture d'un tableau nutritionnel photographié (texte brut sorti de l'OCR).
//
// Le piège central est australien : un panneau « Nutrition Information » a DEUX
// colonnes, « per serving » et « per 100 g ». Prendre la mauvaise donne des
// valeurs plausibles mais fausses, que rien ne vient contredire ensuite. On
// prend donc systématiquement la DERNIÈRE valeur de la ligne, qui est la
// colonne 100 g, après avoir vérifié qu'on est bien face à un tableau à deux
// colonnes.
//
// Le second piège, mesuré sur de vraies photos : Tesseract lit très bien les
// CHIFFRES et très mal les GLYPHES D'UNITÉ collés contre eux.
//
//     étiquette      OCR          conséquence de la première version
//     596kJ      →   596k)        unité inconnue → énergie perdue, toujours
//     6.9g       →   6.99         lu comme 6,99 → valeur fausse, sans alerte
//     17.1g      →   17.19        17,19
//
// D'où le principe de ce lecteur : l'unité d'une ligne est CONNUE D'AVANCE
// (protéines en g, sodium en mg, énergie en kJ). On ne la demande donc pas à
// l'OCR, on la déduit de la ligne — et on se sert du jeton lu seulement comme
// indice, avec ses confusions habituelles.
//
// L'OCR se trompe quand même : rien de ce qui sort d'ici n'est enregistré sans
// relecture, et `suspect` désigne les valeurs qui violent une borne physique.

const KJ_PER_KCAL = 4.184
// Le sel est du chlorure de sodium : 1 g de sodium ≈ 2,5 g de sel.
const SALT_PER_SODIUM = 2.5

// Retire les accents et uniformise, pour que « Protéines » et « Proteines »
// (fréquent en sortie d'OCR) se ressemblent.
function fold(s) {
  return String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// Confusions classiques de l'OCR sur des caractères entourés de chiffres.
// On ne corrige QUE dans un contexte numérique, pour ne pas abîmer les mots.
function repairDigits(text) {
  return text.replace(/[\dOoIlSB][\dOoIlSB.,]*[\dOoIlSB]|\d/g, (m) => (
    /\d/.test(m)
      ? m.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5').replace(/B/g, '8')
      : m
  ))
}

// Unité attendue de chaque ligne — la clé de tout ce fichier.
const ROW_UNIT = {
  kcal: 'kj',
  proteins: 'g',
  fat: 'g',
  satFat: 'g',
  carbs: 'g',
  sugars: 'g',
  fiber: 'g',
  salt: 'g',
  sodium: 'mg',
}

// Jeton d'unité lu par l'OCR → unité réelle, avec ses confusions habituelles :
// le J de kJ tombe en `)`, `]`, `|`, `l`, `d` ; le g en `q`.
function normUnit(token) {
  const t = String(token || '').toLowerCase().replace(/[^a-z0-9)\]}|]/g, '')
  if (!t) return null
  if (/^k?cal$/.test(t)) return 'kcal'
  if (/^k[j)\]}|il1d]?$/.test(t)) return 'kj'
  if (/^m[gq9]$/.test(t)) return 'mg'
  if (/^[gq]$/.test(t)) return 'g'
  return null
}

// « 6.9g » ressort en « 6.99 » : le g collé au chiffre est lu comme un 9.
// Sur une ligne dont on SAIT qu'elle est en grammes, un nombre à deux décimales
// terminé par 9 et sans unité reconnue est donc relu comme « valeur + g ».
//
// Garde-fou : on n'applique la règle que si le résultat reste ≥ 0,1, pour ne pas
// transformer un vrai « 0,09 g » en zéro. Les étiquettes n'impriment jamais deux
// décimales sur une macro, ce qui rend la règle sûre partout ailleurs.
function gramGluedTo9(literal, expected) {
  if (expected !== 'g') return null
  const m = /^(\d+)\.(\d)9$/.exec(literal)
  if (!m) return null
  const value = Number(`${m[1]}.${m[2]}`)
  return value >= 0.1 ? value : null
}

// Tous les nombres d'une ligne, avec leur unité. `expected` est l'unité attendue
// de la ligne, utilisée pour rattraper les g lus comme des 9.
function readNumbers(line, expected = null) {
  const out = []
  const re = /(?:<\s*)?(\d+(?:[.,]\d+)?)\s*([a-zA-Z)\]}|]{0,4})/g
  let m
  while ((m = re.exec(line)) !== null) {
    const literal = m[1].replace(',', '.')
    let value = Number(literal)
    if (!Number.isFinite(value)) continue
    let unit = normUnit(m[2])
    if (!unit) {
      const fixed = gramGluedTo9(literal, expected)
      if (fixed != null) { value = fixed; unit = 'g' }
    }
    out.push({ value, unit })
  }
  return out
}

// Ordre significatif : les lignes « dont … » doivent être reconnues AVANT leur
// parent, sinon « - Saturated Fat » serait lu comme la ligne « Fat ».
const FIELDS = [
  { key: 'satFat', match: /saturated|satures|satur\b/ },
  { key: 'sugars', match: /sugars?|sucres?/ },
  { key: 'fiber', match: /fibre|fiber|fibres/ },
  { key: 'sodium', match: /sodium/ },
  { key: 'salt', match: /\bsalt\b|\bsel\b/ },
  { key: 'kcal', match: /energy|energie|calories/ },
  { key: 'proteins', match: /protein|proteines?/ },
  { key: 'fat', match: /\bfat\b|matieres grasses|lipides|graisses/ },
  { key: 'carbs', match: /carbohydrate|glucides/ },
]

function fieldFor(folded) {
  return FIELDS.find((f) => f.match.test(folded))?.key || null
}

// Deux colonnes ? On se fie d'abord à l'en-tête, sinon au fait que plusieurs
// lignes de nutriments portent deux nombres.
function detectTwoColumns(lines) {
  const header = lines.some((l) => {
    const f = fold(l)
    return /100\s*g/.test(f) && /(per\s*serv|par\s*portion|serving)/.test(f)
  })
  if (header) return true

  let twos = 0
  for (const line of lines) {
    const f = fold(line)
    const key = fieldFor(f)
    if (!key) continue
    // La ligne d'énergie française porte « kJ » ET « kcal » : deux nombres sans
    // pour autant être un tableau à deux colonnes.
    if (/energ/.test(f) && /kcal/.test(f) && /kj/.test(f)) continue
    if (readNumbers(line, ROW_UNIT[key]).length >= 2) twos += 1
  }
  return twos >= 2
}

function servingGramsFrom(lines) {
  for (const line of lines) {
    const f = fold(line)
    if (!/serving size|serve size|portion/.test(f)) continue
    const n = readNumbers(line, 'g').find((x) => x.unit === 'g')
    if (n) return n.value
  }
  return null
}

// Bornes physiques. L'OCR ne se trompe pas au hasard : il perd un point décimal
// ou confond un glyphe, et le résultat viole alors une contrainte que la chimie,
// elle, respecte toujours. On DÉSIGNE le champ douteux plutôt que de tout jeter —
// une valeur signalée se corrige d'un geste, une lecture rejetée fait tout
// retaper.
function suspectFields(per100) {
  const bad = new Set()
  const num = (v) => (Number.isFinite(v) ? v : null)
  const { kcal, proteins, carbs, fat, sugars, satFat, salt } = per100

  // Rien ne pèse plus de 100 g dans 100 g de produit.
  for (const [key, v] of Object.entries(per100)) {
    if (key === 'kcal') continue
    if (num(v) != null && (v < 0 || v > 100)) bad.add(key)
  }
  const macros = [proteins, carbs, fat]
  const allMacros = macros.every((v) => num(v) != null)
  if (allMacros && proteins + carbs + fat > 100) {
    bad.add('proteins'); bad.add('carbs'); bad.add('fat')
  }

  // Un « dont … » ne dépasse pas son total. La tolérance absorbe les arrondis
  // de l'étiquette elle-même.
  if (num(sugars) != null && num(carbs) != null && sugars > carbs + 0.05) bad.add('sugars')
  if (num(satFat) != null && num(fat) != null && satFat > fat + 0.05) bad.add('satFat')

  // Atwater : 4 kcal/g de protéines et de glucides, 9 pour les lipides.
  // Tolérance large (±35 %) — fibres, polyols et alcool ne sont pas comptés —
  // mais un point décimal perdu fait bien plus que 35 %.
  if (num(kcal) != null && kcal > 0 && allMacros) {
    const computed = 4 * proteins + 4 * carbs + 9 * fat
    const ratio = computed / kcal
    if (ratio > 1.35 || ratio < 0.65) {
      bad.add('kcal'); bad.add('proteins'); bad.add('carbs'); bad.add('fat')
    }
  }

  // 30 g de sel pour 100 g, ce serait plus salé que du sel de table dilué.
  if (num(salt) != null && salt > 30) bad.add('salt')

  return [...bad]
}

/**
 * Texte OCR → valeurs pour 100 g.
 * Rend { per100, servingGrams, matchedLines, twoColumns, confidence, suspect }.
 * `confidence` = part des champs importants retrouvés ; `suspect` = liste des
 * champs qui violent une borne physique. Ni l'un ni l'autre ne bloque : ils
 * servent à dire à l'utilisateur où regarder.
 */
export function parseNutritionLabel(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const twoColumns = detectTwoColumns(lines)
  const found = {}
  const matchedLines = []

  for (const raw of lines) {
    const line = repairDigits(raw)
    const f = fold(line)
    const key = fieldFor(f)
    if (!key) continue

    const nums = readNumbers(line, ROW_UNIT[key])
    if (nums.length === 0) continue

    if (key === 'kcal') {
      // Une valeur explicitement en kcal prime toujours sur les kJ.
      const kcal = nums.filter((n) => n.unit === 'kcal')
      const kj = nums.filter((n) => n.unit === 'kj')
      let value = null
      if (kcal.length) value = (twoColumns ? kcal[kcal.length - 1] : kcal[0]).value
      else if (kj.length) value = (twoColumns ? kj[kj.length - 1] : kj[0]).value / KJ_PER_KCAL
      else value = (twoColumns ? nums[nums.length - 1] : nums[0]).value / KJ_PER_KCAL
      if (found.kcal == null) { found.kcal = Math.round(value); matchedLines.push(raw) }
      continue
    }

    const picked = twoColumns ? nums[nums.length - 1] : nums[0]
    let value = picked.value
    // Le sodium s'exprime en mg sur les étiquettes australiennes.
    if (picked.unit === 'mg' || (picked.unit == null && ROW_UNIT[key] === 'mg')) value /= 1000
    if (found[key] == null) { found[key] = value; matchedLines.push(raw) }
  }

  // Le sel n'est presque jamais imprimé en Australie : on le déduit du sodium.
  if (found.salt == null && found.sodium != null) {
    found.salt = Math.round(found.sodium * SALT_PER_SODIUM * 1000) / 1000
  }
  delete found.sodium

  const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)
  const per100 = {
    kcal: found.kcal ?? null,
    proteins: round(found.proteins),
    carbs: round(found.carbs),
    fat: round(found.fat),
    sugars: round(found.sugars),
    satFat: round(found.satFat),
    fiber: round(found.fiber),
    // Le sel est le seul nutriment couramment sous 1 g : deux décimales
    // suffisent partout ailleurs, mais elles le dégraderaient (0,107 → 0,11).
    salt: round(found.salt, 3),
  }

  const core = ['kcal', 'proteins', 'carbs', 'fat']
  const confidence = core.filter((k) => per100[k] != null).length / core.length

  return {
    per100,
    servingGrams: servingGramsFrom(lines),
    matchedLines,
    twoColumns,
    confidence,
    suspect: suspectFields(per100),
  }
}
