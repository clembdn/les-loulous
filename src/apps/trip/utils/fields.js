// Nettoyage des champs, à la lecture comme à l'écriture.
//
// Firestore refuse `undefined`, et les règles bornent chaque chaîne : tout ce
// qui part en base passe par ici. Tout ce qui en revient aussi — un document
// écrit par une version plus ancienne de l'app se relit sans trou, et
// l'affichage n'a jamais à se demander si un champ existe.
//
// Imports RELATIFS (pas d'alias `@/`) : ce module est testé sous `node --test`.

import { isDateKey } from '../../../shared/lib/dates.js'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const CURRENCY_RE = /^[A-Z]{3}$/

/** Chaîne obligatoire : rognée, bornée, jamais nulle. */
export function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Chaîne facultative : `null` plutôt qu'une chaîne vide. */
export function optText(value, max) {
  return text(value, max) || null
}

/** Nombre facultatif, accepte la virgule décimale d'un champ saisi en français. */
export function optNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

/** Prix au centime, jamais négatif. */
export function money(value) {
  const n = optNumber(value, { min: 0 })
  return n === null ? null : Math.round(n * 100) / 100
}

export function currencyCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return CURRENCY_RE.test(code) ? code : null
}

/**
 * Heure murale « HH:MM ».
 *
 * Jamais convertie d'un fuseau à l'autre : c'est l'heure imprimée sur le
 * billet, dans le fuseau du lieu. « 08:12 » reste 08:12, que le téléphone
 * soit à Lisbonne ou encore à Sydney.
 */
export function timeOfDay(value) {
  return typeof value === 'string' && TIME_RE.test(value) ? value : null
}

export function dateKey(value) {
  return isDateKey(value) ? value : ''
}

/** Un instant de réservation : `{ date, time }`, l'heure est facultative. */
export function timePoint(raw) {
  return { date: dateKey(raw?.date), time: timeOfDay(raw?.time) }
}

/**
 * Un lieu : nom, adresse, coordonnées, lien d'origine.
 *
 * Les deux coordonnées, ou aucune — une latitude seule ne place rien sur une
 * carte, et un 0 tombé d'un champ vide enverrait l'étape au large du Gabon.
 */
export function place(raw, { nameMax = 160 } = {}) {
  const lat = optNumber(raw?.lat, { min: -90, max: 90 })
  const lng = optNumber(raw?.lng, { min: -180, max: 180 })
  const located = lat !== null && lng !== null
  return {
    name: text(raw?.name, nameMax),
    address: optText(raw?.address, 300),
    lat: located ? lat : null,
    lng: located ? lng : null,
    mapsUrl: optText(raw?.mapsUrl, 2000),
  }
}

export function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

/**
 * Métadonnées d'écriture. `existing` reporte le créateur d'origine : une
 * journée s'écrit en fusion sans être relue, et c'est l'état en mémoire qui
 * sait qui l'a créée.
 */
export function stamp(existing, currentUid, now = new Date().toISOString()) {
  return {
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
}

export function readMeta(raw) {
  return {
    createdAt: raw?.createdAt || null,
    createdBy: raw?.createdBy || null,
    updatedAt: raw?.updatedAt || null,
    updatedBy: raw?.updatedBy || null,
  }
}

export function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
