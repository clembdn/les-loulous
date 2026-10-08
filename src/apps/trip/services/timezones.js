// Le fuseau horaire (IANA) d'un lieu, pour l'export agenda : demandé à
// Open-Meteo (`timezone=auto`, sans clé — le même service que la météo),
// plusieurs lieux par requête, et gardé pour toujours sur l'appareil : le
// fuseau d'un lieu ne change pas.
//
// Case de 0,01° (≈ 1 km) : une case plus grande pourrait enjamber une
// frontière de fuseau.

const KEY = 'trip:timezones'
const URL_BASE = 'https://api.open-meteo.com/v1/forecast'
const PER_REQUEST = 50

// Un fuseau que le navigateur sait convertir (sinon, inutile de le garder).
function isZone(tz) {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const cellOf = (p) => `${Math.round(p.lat * 100)},${Math.round(p.lng * 100)}`

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function save(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // Stockage plein ou navigation privée : on redemandera.
  }
}

/** Le fuseau connu d'un lieu, ou `null` (lecture synchrone du cache). */
export function cachedTimezone(p) {
  return load()[cellOf(p)] || null
}

/**
 * Demande les fuseaux qui manquent pour ces lieux. Rend le nombre de lieux
 * restés sans fuseau (hors-ligne, service indisponible).
 */
export async function resolveTimezones(places) {
  const known = load()
  const missing = [...new Map(places.filter((p) => !known[cellOf(p)]).map((p) => [cellOf(p), p])).values()]
  for (let i = 0; i < missing.length; i += PER_REQUEST) {
    const batch = missing.slice(i, i + PER_REQUEST)
    const params = new URLSearchParams({
      latitude: batch.map((p) => p.lat.toFixed(4)).join(','),
      longitude: batch.map((p) => p.lng.toFixed(4)).join(','),
      timezone: 'auto',
      forecast_days: '1',
      daily: 'weather_code',
    })
    try {
      const res = await fetch(`${URL_BASE}?${params}`)
      if (!res.ok) continue
      const body = await res.json()
      // Un seul lieu : un objet ; plusieurs : une liste, dans l'ordre demandé.
      const answers = Array.isArray(body) ? body : [body]
      batch.forEach((p, k) => {
        const tz = answers[k]?.timezone
        if (isZone(tz)) known[cellOf(p)] = tz
      })
    } catch {
      // Hors-ligne : les heures resteront « flottantes ».
    }
  }
  save(known)
  return places.filter((p) => !known[cellOf(p)]).length
}
