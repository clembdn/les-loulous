// FinAuzi — taux EUR→AUD du jour, récupéré automatiquement.
//
// Source : Frankfurter (https://frankfurter.dev), qui republie les taux de
// référence de la BCE. Gratuit, open source, sans clé d'API — donc aucun
// secret à stocker et rien à facturer. Les taux BCE ne sont publiés qu'un
// jour ouvré sur deux vers 16 h CET : inutile de rafraîchir plus souvent
// qu'une fois par jour.
//
// Contraintes propres à cette app :
//   • offline-first — au supermarché sans réseau, le fetch doit échouer
//     silencieusement et rendre la dernière valeur connue, jamais bloquer.
//   • le taux n'est qu'une SUGGESTION : celui qui saisit peut toujours le
//     remplacer par le taux réellement obtenu à la banque, frais inclus.

import { DEFAULT_EUR_TO_AUD, normalizeRate } from '../utils/money.js'

const PRIMARY = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=AUD'
// Repli si Frankfurter est injoignable — même principe : ouvert, sans clé.
const FALLBACK = 'https://open.er-api.com/v6/latest/EUR'

const CACHE_KEY = 'finauzi:eurToAud'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const TIMEOUT_MS = 4000

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const rate = Number(parsed?.rate)
    if (!isFinite(rate) || rate <= 0) return null
    return { rate, fetchedAt: Number(parsed.fetchedAt) || 0, date: parsed.date || null }
  } catch {
    return null
  }
}

function writeCache(entry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Navigation privée, quota plein — le taux se re-fetchera, sans plus.
  }
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFromNetwork() {
  try {
    const data = await fetchJson(PRIMARY)
    const rate = Number(data?.rates?.AUD)
    if (isFinite(rate) && rate > 0) {
      return { rate, date: data.date || null, source: 'frankfurter' }
    }
  } catch {
    // On tombe sur le repli.
  }

  const data = await fetchJson(FALLBACK)
  const rate = Number(data?.rates?.AUD)
  if (!isFinite(rate) || rate <= 0) throw new Error('Taux introuvable')
  return { rate, date: data.time_last_update_utc || null, source: 'er-api' }
}

// Rend toujours quelque chose d'utilisable :
//   { rate, date, source, isStale, isFallback }
//
// `isStale` = la valeur vient du cache local et n'a pas pu être rafraîchie
// (hors ligne). `isFallback` = on n'a jamais réussi à récupérer un taux et
// on rend la constante de l'app, à ne surtout pas présenter comme le taux
// du jour.
export async function fetchEurToAud({ force = false } = {}) {
  const cached = readCache()
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS

  if (cached && isFresh && !force) {
    return { rate: cached.rate, date: cached.date, source: 'cache', isStale: false, isFallback: false }
  }

  try {
    const fetched = await fetchFromNetwork()
    const entry = { rate: fetched.rate, date: fetched.date, fetchedAt: Date.now() }
    writeCache(entry)
    return { ...fetched, isStale: false, isFallback: false }
  } catch {
    if (cached) {
      return { rate: cached.rate, date: cached.date, source: 'cache', isStale: true, isFallback: false }
    }
    return {
      rate: DEFAULT_EUR_TO_AUD,
      date: null,
      source: 'default',
      isStale: true,
      isFallback: true,
    }
  }
}

// Version synchrone — le dernier taux connu, sans toucher au réseau.
// Sert à pré-remplir un champ dès l'ouverture d'un formulaire, avant que le
// fetch n'ait répondu.
export function getCachedEurToAud(fallback = DEFAULT_EUR_TO_AUD) {
  const cached = readCache()
  return cached ? cached.rate : normalizeRate(fallback)
}
