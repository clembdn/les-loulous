// Chargement paresseux de la table CIQUAL (ANSES) — aliments bruts en français.
//
// Le JSON (~270 Ko, ~67 Ko gzippé) sort dans son propre chunk grâce à l'import()
// dynamique : il n'est téléchargé qu'à la première recherche d'aliment, jamais au
// démarrage de l'app. Une fois chargé il reste en mémoire pour la session, et le
// service worker le garde pour l'usage hors-ligne.
//
// Régénérer le fichier : node scripts/build-ciqual.mjs

import { normalizeName } from '../utils/aisleGuess.js'

let cache = null
let pending = null

function hydrate(raw) {
  // Format positionnel compact : [code, name, group, kcal, proteins, carbs, fat, sugars, fiber, satFat, salt]
  return raw.foods.map(([code, name, group, kcal, proteins, carbs, fat, sugars, fiber, satFat, salt]) => ({
    id: `ciqual-${code}`,
    source: 'ciqual',
    name,
    group,
    nameLower: normalizeName(name),
    brand: null,
    barcode: null,
    per100: { kcal, proteins, carbs, fat, sugars, satFat, fiber, salt },
    gramsPerPiece: null,
    densityGPerMl: null,
  }))
}

export async function loadCiqual() {
  if (cache) return cache
  if (!pending) {
    pending = import('./ciqual.json')
      .then((mod) => { cache = hydrate(mod.default); return cache })
      .catch((err) => {
        console.error('[Cook’It] CIQUAL indisponible:', err)
        pending = null
        return []
      })
  }
  return pending
}

// Recherche par sous-chaîne, insensible aux accents et au pluriel.
// Les noms CIQUAL sont de la forme « Poulet, blanc, cuit » : on privilégie les
// aliments dont le nom COMMENCE par la recherche, bien plus pertinents.
export async function searchCiqual(query, limit = 25) {
  const needle = normalizeName(query)
  if (needle.length < 2) return []
  const foods = await loadCiqual()
  const starts = []
  const contains = []
  for (const f of foods) {
    if (f.nameLower.startsWith(needle)) starts.push(f)
    else if (f.nameLower.includes(needle)) contains.push(f)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}
