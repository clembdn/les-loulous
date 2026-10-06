// Météo d'Open-Meteo, gardée sur l'appareil.
//
// Une donnée DÉRIVÉE, pas un état partagé : chaque téléphone a son cache
// localStorage (sur le modèle d'exchangeRateService de FinAuzi), rien ne part
// dans Firestore.
//
//  · prévisions : rafraîchies au-delà de 3 h, mais affichées même périmées —
//    hors-ligne, la prévision d'hier soir vaut mieux qu'un trou ;
//  · normales de saison : calculées une fois, gardées pour toujours (la
//    normale du 14 mai à Lisbonne ne bouge pas d'un voyage à l'autre).
//
// Les composants lisent le cache de façon SYNCHRONE (`readWeather`) et
// s'abonnent à ses changements (`subscribeWeather`) : l'écran s'affiche
// instantanément avec ce qu'on a, et se complète quand le réseau répond.

import {
  archiveRanges, archiveUrl, forecastDays, forecastUrl, groupKey, parseDaily, planWeather, seasonalNormals,
} from '../utils/weather.js'

const STORAGE_KEY = 'trip:weather:v1'
const FORECAST_TTL_MS = 3 * 60 * 60 * 1000
const TIMEOUT_MS = 12000
// Une requête multi-lieux reste raisonnable (URL, poids de la réponse).
const GROUPS_PER_REQUEST = 40
// Les normales s'accumulent de voyage en voyage : on garde les plus récentes.
const MAX_NORMAL_GROUPS = 200

let store = null
let version = 0
const listeners = new Set()
const inflight = new Set()

function load() {
  if (store) return store
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    store = { f: parsed?.f || {}, n: parsed?.n || {} }
  } catch {
    store = { f: {}, n: {} }
  }
  return store
}

function save(today) {
  const s = load()
  // Une prévision dont tous les jours sont passés ne sert plus à rien.
  for (const [key, entry] of Object.entries(s.f)) {
    if (!Object.keys(entry.days).some((date) => date >= today)) delete s.f[key]
  }
  const normals = Object.entries(s.n)
  if (normals.length > MAX_NORMAL_GROUPS) {
    normals.sort((a, b) => b[1].at - a[1].at)
    s.n = Object.fromEntries(normals.slice(0, MAX_NORMAL_GROUPS))
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Navigation privée, quota plein : la météo reste en mémoire pour la session.
  }
}

function changed(today) {
  save(today)
  version += 1
  listeners.forEach((fn) => fn())
}

export function subscribeWeather(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Change à chaque mise à jour du cache (pour `useSyncExternalStore`). */
export function weatherVersion() {
  return version
}

/**
 * La météo d'un lieu `{ lat, lng }` un jour donné, depuis le cache :
 * la prévision si on l'a (même périmée, `stale`), sinon la normale de saison,
 * sinon `null`. `{ kind, tmax, tmin, rain, source: 'forecast' | 'normal', stale }`.
 */
export function readWeather(date, place) {
  const s = load()
  const key = groupKey(place.lat, place.lng)
  const forecast = s.f[key]
  const day = forecast?.days[date]
  if (day) return { ...day, source: 'forecast', stale: Date.now() - forecast.at > FORECAST_TTL_MS }
  const normal = s.n[key]?.days[date.slice(5)]
  return normal ? { ...normal, source: 'normal', stale: false } : null
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function chunks(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function refreshForecasts(groups) {
  for (const batch of chunks(groups, GROUPS_PER_REQUEST)) {
    const parsed = parseDaily(await fetchJson(forecastUrl(batch)))
    const s = load()
    const at = Date.now()
    batch.forEach((key, i) => {
      if (parsed[i]) s.f[key] = { at, days: forecastDays(parsed[i]) }
    })
  }
}

/**
 * Les normales de `needs` (`{ [groupe]: [date] }`). Une requête d'archive par
 * année (5 en tout) pour tous les lieux ; une année qui échoue n'empêche pas
 * de moyenner les autres.
 */
async function refreshNormals(needs) {
  const groups = Object.keys(needs)
  const dates = [...new Set(Object.values(needs).flat())].sort()
  for (const batch of chunks(groups, GROUPS_PER_REQUEST)) {
    const years = await Promise.allSettled(
      archiveRanges(dates).map(({ start, end }) => fetchJson(archiveUrl(batch, start, end)).then(parseDaily)),
    )
    const answered = years.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    if (!answered.length) throw years[0]?.reason || new Error('Archive indisponible')
    const s = load()
    const at = Date.now()
    batch.forEach((key, i) => {
      const samples = Object.assign({}, ...answered.map((year) => year[i] || {}))
      // Toutes les dates de la fenêtre, pas seulement celles du lieu : une
      // étape déplacée d'un jour à l'autre n'oblige pas à tout redemander.
      const days = seasonalNormals(dates, samples, years.length)
      s.n[key] = { at, days: { ...s.n[key]?.days, ...days } }
    })
  }
}

/**
 * Va chercher ce qui manque ou a vieilli pour `requests` (`[{ date, lat, lng }]`).
 * Ne lève jamais : hors-ligne ou en cas d'échec, on garde ce qu'on a.
 */
export async function refreshWeather(requests, today) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const plan = planWeather(requests, today)
  const s = load()
  const now = Date.now()

  const forecasts = plan.forecast.filter((key) => {
    const entry = s.f[key]
    return !inflight.has(`f:${key}`) && (!entry || now - entry.at > FORECAST_TTL_MS)
  })
  const normals = {}
  for (const [key, dates] of Object.entries(plan.normals)) {
    const missing = dates.filter((date) => !s.n[key]?.days[date.slice(5)])
    if (missing.length && !inflight.has(`n:${key}`)) normals[key] = missing
  }

  const jobs = []
  if (forecasts.length) jobs.push(track(forecasts.map((k) => `f:${k}`), () => refreshForecasts(forecasts)))
  if (Object.keys(normals).length) jobs.push(track(Object.keys(normals).map((k) => `n:${k}`), () => refreshNormals(normals)))
  if (!jobs.length) return

  const results = await Promise.allSettled(jobs)
  results.filter((r) => r.status === 'rejected').forEach((r) => console.warn('[Trip] météo indisponible :', r.reason))
  if (results.some((r) => r.status === 'fulfilled')) changed(today)
}

// Une même case n'est jamais demandée deux fois en même temps (deux écrans
// qui s'ouvrent ensemble, une étape modifiée pendant la requête).
async function track(keys, job) {
  keys.forEach((k) => inflight.add(k))
  try {
    await job()
  } finally {
    keys.forEach((k) => inflight.delete(k))
  }
}
