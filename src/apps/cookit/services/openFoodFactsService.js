// Open Food Facts — base ouverte et collaborative de produits alimentaires.
//
// Gratuit, open data, AUCUNE clé d'API : rien à stocker, rien à facturer.
// L'API autorise le CORS depuis le navigateur (`access-control-allow-origin: *`),
// donc pas de backend ni de proxy à maintenir.
//
// Deux limites connues, dont l'UI doit tenir compte :
//   • la couverture australienne est PARTIELLE — beaucoup de produits Woolworths
//     et Coles sont absents. L'échec de recherche est un cas courant, pas une
//     exception : il doit mener directement à la saisie manuelle.
//   • les navigateurs interdisent de fixer `User-Agent` ; OFF accepte
//     `X-User-Agent` pour identifier l'app (leur politique d'usage le demande).
//
// Quotas OFF : 100 req/min sur les produits, 10 req/min sur la recherche.
// D'où le debounce côté UI et le cache mémoire ci-dessous.

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'
// L'ancien /cgi/search.pl est hors service : la recherche passe par search-a-licious.
const SEARCH_URL = 'https://search.openfoodfacts.org/search'
const HEADERS = { 'X-User-Agent': 'CookIt/1.0 (application familiale privée)' }
const TIMEOUT_MS = 6000

const FIELDS = [
  'code', 'product_name', 'product_name_fr', 'brands', 'quantity', 'serving_quantity',
  'nutriments', 'nutriscore_grade', 'nova_group', 'image_front_small_url',
  // Classification : `pnns_groups_1` est une taxonomie fermée et bien remplie
  // (« Milk and dairy products », « Beverages »…). C'est de loin le meilleur
  // signal pour ranger un produit dans un rayon — deviner depuis un nom anglais
  // comme « Vegemite » ou « Weet-Bix » ne mène nulle part.
  'pnns_groups_1', 'food_groups_tags',
].join(',')

const memo = new Map()

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: HEADERS })
    if (!res.ok) {
      // Le statut voyage avec l'erreur : OFF répond 404 pour un produit inconnu,
      // ce qui n'a rien d'une panne réseau et ne doit pas être annoncé comme telle.
      const err = new Error(`HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// « en:milk-and-dairy-products » et « unknown » ne nous apprennent rien : on ne
// garde que les libellés PNNS exploitables.
function normalizeGroup(v) {
  const raw = String(v || '').trim()
  if (!raw || /^unknown$/i.test(raw)) return null
  return raw.startsWith('en:') ? raw.slice(3).replace(/-/g, ' ') : raw
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// OFF ne garantit pas energy-kcal_100g : certains produits n'ont que les kJ.
function kcalOf(n) {
  const direct = num(n?.['energy-kcal_100g'])
  if (direct != null) return direct
  const kj = num(n?.energy_100g ?? n?.['energy-kj_100g'])
  return kj != null ? Math.round(kj / 4.184 * 100) / 100 : null
}

// Fiche OFF → aliment de l'app. `null` si le produit n'a aucune valeur exploitable.
// Conversion tolérante : rend toujours ce qu'on a pu lire, même incomplet.
// Sert à pré-remplir la fiche quand Open Food Facts connaît le produit mais pas
// ses valeurs nutritionnelles — récupérer le nom, la marque et la photo évite
// déjà la moitié de la saisie.
export function toPartialFood(product) {
  if (!product?.code) return null
  const n = product.nutriments || {}
  const kcal = kcalOf(n)
  const name = String(product.product_name_fr || product.product_name || '').trim()
  return {
    id: `off-${product.code}`,
    source: 'off',
    name,
    brand: String(product.brands || '').split(',')[0].trim() || null,
    barcode: String(product.code),
    per100: {
      kcal,
      proteins: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g),
      sugars: num(n.sugars_100g),
      satFat: num(n['saturated-fat_100g']),
      fiber: num(n.fiber_100g),
      salt: num(n.salt_100g),
    },
    servingGrams: num(product.serving_quantity),
    // Repris tel quel dans le champ `group` de l'aliment, à côté des groupes
    // CIQUAL — les deux alimentent la même table de correspondance des rayons.
    group: normalizeGroup(product.pnns_groups_1) || normalizeGroup(product.food_groups_tags?.[0]),
    imageUrl: product.image_front_small_url || null,
    nutriscore: product.nutriscore_grade || null,
    novaGroup: Number.isFinite(Number(product.nova_group)) ? Number(product.nova_group) : null,
  }
}

// Version stricte : une fiche sans nom ou sans calories n'est pas exploitable
// telle quelle dans une recherche.
export function toFood(product) {
  const food = toPartialFood(product)
  if (!food || !food.name || food.per100.kcal == null) return null
  return food
}

// Résultats possibles d'un scan. Les distinguer est indispensable : « inconnu »,
// « hors ligne » et « fiche incomplète » appellent trois réactions différentes,
// et les confondre dans un `null` laissait l'utilisateur sans savoir ce qui
// s'était passé.
export const SCAN = {
  FOUND: 'found',
  NOT_FOUND: 'not-found',
  NO_NUTRITION: 'no-nutrition',
  OFFLINE: 'offline',
}

// Code-barres → { status, food, barcode }. Ne lève jamais.
// `food` est renseigné pour FOUND et NO_NUTRITION (partiel dans ce dernier cas).
export async function fetchByBarcode(barcode) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (!code) return { status: SCAN.NOT_FOUND, food: null, barcode: code }
  if (memo.has(code)) return memo.get(code)

  let result
  try {
    const data = await fetchJson(`${PRODUCT_URL}/${code}.json?fields=${FIELDS}`)
    const known = data?.status === 1 || data?.product
    const food = known ? toPartialFood(data.product) : null
    if (!food) {
      result = { status: SCAN.NOT_FOUND, food: null, barcode: code }
    } else if (!food.name || food.per100.kcal == null) {
      result = { status: SCAN.NO_NUTRITION, food, barcode: code }
    } else {
      result = { status: SCAN.FOUND, food, barcode: code }
    }
  } catch (err) {
    if (err?.status === 404) {
      // Produit réellement absent de la base — cas courant en Australie.
      result = { status: SCAN.NOT_FOUND, food: null, barcode: code }
      memo.set(code, result)
      return result
    }
    // Réseau coupé ou délai dépassé : surtout ne pas mémoriser, le prochain
    // essai doit repartir sur le réseau.
    return { status: SCAN.OFFLINE, food: null, barcode: code }
  }
  memo.set(code, result)
  return result
}

// Recherche texte sur les produits emballés. Rend [] en cas d'échec.
export async function searchProducts(query, { limit = 20 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  const key = `q:${q}:${limit}`
  if (memo.has(key)) return memo.get(key)
  try {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=${limit}&fields=${FIELDS}`
    const data = await fetchJson(url)
    const foods = (data?.hits || []).map(toFood).filter(Boolean)
    memo.set(key, foods)
    return foods
  } catch {
    return []
  }
}
