// Météo : Open-Meteo, gratuit et sans clé.
//
//  · jusqu'à 16 jours : les PRÉVISIONS (api.open-meteo.com/v1/forecast) ;
//  · au-delà : les NORMALES DE SAISON — la moyenne ERA5 des 5 dernières
//    années, sur ±3 jours autour de la date (archive-api.open-meteo.com). Elles
//    s'affichent en grisé, « ~24° » : ce qu'il fait d'habitude, pas une
//    prévision.
//
// Les lieux sont regroupés à 0,1° (≈ 11 km) : toutes les étapes d'une ville
// partagent une même météo, et une seule ligne de la requête.
//
// Module pur, testé sous `node --test` ; le réseau et le cache sont dans
// services/weatherService.js.

import { shiftDateKey } from '../../../shared/lib/dates.js'
import { hasCoords } from './geo.js'
import { dayRoute } from './route.js'

export const FORECAST_DAYS = 16
export const NORMAL_YEARS = 5
export const NORMAL_HALF_WINDOW = 3
// Seuil météorologique d'un « jour de pluie ».
const RAIN_DAY_MM = 1

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'

// Du plus clément au plus rude : l'ordre départage deux temps aussi
// fréquents l'un que l'autre dans une normale (on ne noircit pas le tableau).
export const WEATHER_KINDS = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm']

export const WEATHER_LABELS = {
  clear: 'Ensoleillé',
  partly: 'Éclaircies',
  cloudy: 'Couvert',
  fog: 'Brouillard',
  drizzle: 'Bruine',
  rain: 'Pluie',
  snow: 'Neige',
  storm: 'Orage',
}

/** Code météo WMO (celui d'Open-Meteo) → une des huit sortes ci-dessus, ou `null`. */
export function weatherKind(code) {
  if (!Number.isFinite(code)) return null
  if (code <= 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return null
}

// 0,1° près ; `+ 0` efface le « -0 » qu'un arrondi peut produire.
const round1 = (n) => Math.round(n * 10) / 10 + 0

/** La case de 0,1° d'un lieu : « 38.7,-9.1 ». C'est aussi la clé du cache. */
export function groupKey(lat, lng) {
  return `${round1(lat).toFixed(1)},${round1(lng).toFixed(1)}`
}

export function groupCoords(key) {
  const [lat, lng] = key.split(',').map(Number)
  return { lat, lng }
}

/** Dernier jour couvert par les prévisions demandées aujourd'hui. */
export function forecastEnd(today) {
  return shiftDateKey(today, FORECAST_DAYS - 1)
}

/**
 * Ce qu'il faut demander pour des `requests` `[{ date, lat, lng }]` :
 * `{ forecast: [groupe], normals: { [groupe]: [date] } }`. Les dates passées
 * ne demandent rien : la météo d'hier ne sert plus.
 */
export function planWeather(requests, today) {
  const end = forecastEnd(today)
  const forecast = new Set()
  const normals = {}
  for (const { date, lat, lng } of requests) {
    if (date < today || !hasCoords({ lat, lng })) continue
    const key = groupKey(lat, lng)
    if (date <= end) forecast.add(key)
    else (normals[key] ||= new Set()).add(date)
  }
  return {
    forecast: [...forecast].sort(),
    normals: Object.fromEntries(Object.entries(normals).map(([k, dates]) => [k, [...dates].sort()])),
  }
}

function coordsParams(groups) {
  const coords = groups.map(groupCoords)
  return {
    latitude: coords.map((c) => c.lat).join(','),
    longitude: coords.map((c) => c.lng).join(','),
  }
}

/** Une requête de prévisions pour tous les `groups` d'un coup. Dates rendues dans le fuseau de chaque lieu. */
export function forecastUrl(groups) {
  const params = new URLSearchParams({
    ...coordsParams(groups),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS),
  })
  return `${FORECAST_URL}?${params}`
}

/** Une requête d'archive ERA5 entre `start` et `end` pour tous les `groups`. */
export function archiveUrl(groups, start, end) {
  const params = new URLSearchParams({
    ...coordsParams(groups),
    start_date: start,
    end_date: end,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
    models: 'era5',
  })
  return `${ARCHIVE_URL}?${params}`
}

const num = (v) => (Number.isFinite(v) ? v : null)

/**
 * Une réponse Open-Meteo → un tableau, un élément par lieu demandé (même
 * ordre) : `{ [date]: { code, tmax, tmin, rainProb, rainMm } }`. Open-Meteo
 * rend un objet pour un lieu, un tableau pour plusieurs ; les derniers jours
 * d'une prévision arrivent parfois vides (`null`) : ils sont écartés.
 */
export function parseDaily(json) {
  const list = Array.isArray(json) ? json : [json]
  return list.map((loc) => {
    const d = loc?.daily || {}
    const days = {}
    ;(d.time || []).forEach((date, i) => {
      const day = {
        code: num(d.weather_code?.[i]),
        tmax: num(d.temperature_2m_max?.[i]),
        tmin: num(d.temperature_2m_min?.[i]),
        rainProb: num(d.precipitation_probability_max?.[i]),
        rainMm: num(d.precipitation_sum?.[i]),
      }
      if (day.tmax !== null || day.code !== null) days[date] = day
    })
    return days
  })
}

/** Les jours d'une prévision, tels qu'on les garde : `{ [date]: { kind, tmax, tmin, rain } }`, `rain` en %. */
export function forecastDays(parsed) {
  const out = {}
  for (const [date, d] of Object.entries(parsed)) {
    out[date] = { kind: weatherKind(d.code), tmax: d.tmax, tmin: d.tmin, rain: d.rainProb }
  }
  return out
}

/**
 * Décale une clé de `years` ans, en heure locale. Le 29 février d'une année
 * non bissextile devient le 1er mars : à ±3 jours près, sans importance.
 */
export function shiftYears(key, years) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y + years, m - 1, d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Les plages d'archive à demander pour des dates cibles : la même fenêtre
 * (±3 jours autour des dates) reculée de 1 à 5 ans. Une normale ne sert
 * qu'au-delà de 16 jours : un an plus tôt, c'est toujours du passé consolidé.
 */
export function archiveRanges(dates, years = NORMAL_YEARS) {
  if (!dates.length) return []
  const sorted = [...dates].sort()
  const start = shiftDateKey(sorted[0], -NORMAL_HALF_WINDOW)
  const end = shiftDateKey(sorted[sorted.length - 1], NORMAL_HALF_WINDOW)
  return Array.from({ length: years }, (_, i) => ({
    offset: i + 1,
    start: shiftYears(start, -(i + 1)),
    end: shiftYears(end, -(i + 1)),
  }))
}

function mean(values) {
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

function dominantKind(kinds) {
  const counts = new Map()
  for (const k of kinds) counts.set(k, (counts.get(k) || 0) + 1)
  let best = null
  for (const k of WEATHER_KINDS) {
    if ((counts.get(k) || 0) > (counts.get(best) || 0)) best = k
  }
  return best
}

/**
 * La normale de saison de chaque date cible, à partir de jours d'archive
 * `samples` (`{ [date]: { code, tmax, tmin, rainMm } }`, toutes années mêlées) :
 * pour chaque année, les ±3 jours autour de la même date.
 *
 * Rend `{ [MM-JJ]: { kind, tmax, tmin, rain, samples } }` — moyennes des
 * maximales et des minimales, `rain` = part des jours de pluie en %, `kind` =
 * le temps le plus fréquent. Indexé par MM-JJ : la normale du 14 mai ne
 * dépend pas de l'année du voyage.
 */
export function seasonalNormals(dates, samples, years = NORMAL_YEARS) {
  const out = {}
  for (const date of dates) {
    const picked = []
    for (let k = 1; k <= years; k++) {
      const center = shiftYears(date, -k)
      for (let d = -NORMAL_HALF_WINDOW; d <= NORMAL_HALF_WINDOW; d++) {
        const day = samples[shiftDateKey(center, d)]
        if (day && day.tmax !== null && day.tmin !== null) picked.push(day)
      }
    }
    if (!picked.length) continue
    const rainy = picked.filter((day) => day.rainMm !== null)
    out[date.slice(5)] = {
      kind: dominantKind(picked.map((day) => weatherKind(day.code)).filter(Boolean)),
      tmax: mean(picked.map((day) => day.tmax)),
      tmin: mean(picked.map((day) => day.tmin)),
      rain: rainy.length ? Math.round((rainy.filter((day) => day.rainMm >= RAIN_DAY_MM).length / rainy.length) * 100) : null,
      samples: picked.length,
    }
  }
  return out
}

/**
 * Les lieux dont on veut la météo pour une journée (sa frise, l'hébergement
 * du soir) :
 *  · `anchors` — un ou deux lieux qui la résument : le premier de la journée
 *    et celui du soir (l'hébergement, sinon le dernier lieu). Un jour de
 *    route Lisbonne → Porto affiche les deux ; un jour en ville, un seul ;
 *  · `all` — un lieu par case de 0,1°, pour la météo d'une étape précise.
 */
export function weatherPlaces(items, tonight = null) {
  const route = dayRoute(items)
  const points = route.points.map(({ lat, lng }) => ({ lat, lng }))
  const evening = tonight && hasCoords(tonight) ? { lat: tonight.lat, lng: tonight.lng } : points[points.length - 1]
  const all = []
  const seen = new Set()
  for (const p of evening ? [...points, evening] : points) {
    const key = groupKey(p.lat, p.lng)
    if (seen.has(key)) continue
    seen.add(key)
    all.push(p)
  }
  const first = points[0] || evening
  const anchors = []
  if (first) anchors.push(first)
  if (evening && first && groupKey(evening.lat, evening.lng) !== groupKey(first.lat, first.lng)) anchors.push(evening)
  return { anchors, all }
}

/** « 24° ». */
export function formatTemp(t) {
  return Number.isFinite(t) ? `${Math.round(t)}°` : '—'
}
