// Lecture d'un tableau nutritionnel photographié (texte brut sorti de l'OCR).
//
// Le piège central est australien : un panneau « Nutrition Information » a DEUX
// colonnes, « per serving » et « per 100 g ». Prendre la mauvaise donne des
// valeurs plausibles mais fausses, que rien ne vient contredire ensuite. On
// prend donc systématiquement la DERNIÈRE valeur de la ligne, qui est la
// colonne 100 g, après avoir vérifié qu'on est bien face à un tableau à deux
// colonnes.
//
// L'OCR se trompe : rien de ce qui sort d'ici n'est enregistré sans relecture.

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

// Tous les nombres d'une ligne, avec l'unité qui les suit si elle est collée
// ou séparée par un espace. « 1450kJ », « 4.2 g », « 168mg », « 0,107 g ».
function readNumbers(line) {
  const out = []
  const re = /(?:<\s*)?(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g)?\b/gi
  let m
  while ((m = re.exec(line)) !== null) {
    const value = Number(m[1].replace(',', '.'))
    if (!Number.isFinite(value)) continue
    out.push({ value, unit: m[2] ? m[2].toLowerCase() : null })
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
    if (!fieldFor(f)) continue
    // La ligne d'énergie française porte « kJ » ET « kcal » : deux nombres sans
    // pour autant être un tableau à deux colonnes.
    if (/energ/.test(f) && /kcal/.test(f) && /kj/.test(f)) continue
    if (readNumbers(line).length >= 2) twos += 1
  }
  return twos >= 2
}

function servingGramsFrom(lines) {
  for (const line of lines) {
    const f = fold(line)
    if (!/serving size|serve size|portion/.test(f)) continue
    const n = readNumbers(line).find((x) => x.unit === 'g')
    if (n) return n.value
  }
  return null
}

/**
 * Texte OCR → valeurs pour 100 g.
 * Rend { per100, servingGrams, matchedLines, twoColumns, confidence }.
 * `confidence` = part des champs importants retrouvés ; sert à prévenir
 * l'utilisateur quand la photo était mauvaise, pas à bloquer.
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

    const nums = readNumbers(line)
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
    if (picked.unit === 'mg') value /= 1000
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

  return { per100, servingGrams: servingGramsFrom(lines), matchedLines, twoColumns, confidence }
}
