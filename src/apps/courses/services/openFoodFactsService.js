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
const HEADERS = { 'X-User-Agent': 'FinAuzi-Courses/1.0 (application familiale privée)' }
const TIMEOUT_MS = 6000

const FIELDS = [
  'code', 'product_name', 'product_name_fr', 'brands', 'quantity', 'serving_quantity',
  'nutriments', 'nutriscore_grade', 'nova_group', 'image_front_small_url',
].join(',')

const memo = new Map()

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
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
export function toFood(product) {
  if (!product?.code) return null
  const n = product.nutriments || {}
  const kcal = kcalOf(n)
  if (kcal == null) return null
  const name = String(product.product_name_fr || product.product_name || '').trim()
  if (!name) return null
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
    imageUrl: product.image_front_small_url || null,
    nutriscore: product.nutriscore_grade || null,
    novaGroup: Number.isFinite(Number(product.nova_group)) ? Number(product.nova_group) : null,
  }
}

// Code-barres → aliment, ou null (produit inconnu, hors ligne, valeurs manquantes).
// Ne lève jamais : l'appelant enchaîne sur la saisie manuelle.
export async function fetchByBarcode(barcode) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (!code) return null
  if (memo.has(code)) return memo.get(code)
  try {
    const data = await fetchJson(`${PRODUCT_URL}/${code}.json?fields=${FIELDS}`)
    const food = data?.status === 1 || data?.product ? toFood(data.product) : null
    memo.set(code, food)
    return food
  } catch {
    return null
  }
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
