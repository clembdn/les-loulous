// Recherche de photos via l'API Pexels (clé client — app privée à 2 utilisateurs).
// On ne stocke ensuite que l'URL choisie sur la recette : pas d'appels répétés, OK hors-ligne.
const ENDPOINT = 'https://api.pexels.com/v1/search'
const KEY = import.meta.env.VITE_PEXELS_API_KEY

export function hasPexelsKey() {
  return typeof KEY === 'string' && KEY.trim().length > 0
}

export async function searchFoodPhotos(query, { perPage = 9 } = {}) {
  const term = String(query || '').trim()
  if (!hasPexelsKey() || !term) return []
  const url = `${ENDPOINT}?query=${encodeURIComponent(term)}&per_page=${perPage}&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: KEY } })
  if (!res.ok) throw new Error(`Pexels ${res.status}`)
  const data = await res.json()
  return (data.photos || []).map((p) => ({
    id: p.id,
    thumb: p.src?.medium || p.src?.small || p.src?.tiny || p.src?.original,
    url: p.src?.large || p.src?.landscape || p.src?.medium || p.src?.original,
    alt: p.alt || term,
    photographer: p.photographer || '',
  }))
}
