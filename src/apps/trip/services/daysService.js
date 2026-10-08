import { setDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { DEFAULT_CATEGORY, STOP_CATEGORY_IDS } from '../config/categories.js'
import {
  dateKey, enumValue, optNumber, optText, place, readMeta, stamp, text, timeOfDay,
} from '../utils/fields.js'
import { listen } from './listen.js'
import { partCol, partDoc } from './refs.js'

// Une page par jour, comme le planning de Cook'It :
//   days/{AAAA-MM-JJ} → { date, title, notes, stops: [étape] }
// Les étapes vivent DANS le document du jour : réordonner est une seule
// écriture, et ouvrir une journée une seule lecture.

// Plafond des règles Firestore (`stops.size() <= 40`).
export const MAX_STOPS_PER_DAY = 40

// `fallbackId` est DÉTERMINISTE : un identifiant tiré au hasard à chaque
// lecture changerait à chaque écho de Firestore, et l'étape ouverte dans un
// formulaire perdrait sa correspondance (cf. programService de MuscAuzi).
function normalizeStop(raw, fallbackId) {
  const duration = optNumber(raw?.durationMin, { min: 1, max: 24 * 60 })
  return {
    id: text(raw?.id, 64) || fallbackId,
    ...place(raw),
    time: timeOfDay(raw?.time),
    durationMin: duration === null ? null : Math.round(duration),
    category: enumValue(raw?.category, STOP_CATEGORY_IDS, DEFAULT_CATEGORY),
    notes: optText(raw?.notes, 1000),
  }
}

function normalizeStops(list, date) {
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_STOPS_PER_DAY)
    .map((stop, i) => normalizeStop(stop, `legacy-${date}-${i}`))
}

/** Une journée telle qu'on la lit — la vitrine invité la relit aussi. */
export function normalizeDay(raw) {
  const date = dateKey(raw.date) || raw.id
  return {
    id: raw.id,
    date,
    title: optText(raw.title, 120),
    notes: optText(raw.notes, 2000),
    stops: normalizeStops(raw.stops, date),
    ...readMeta(raw),
  }
}

/** Les jours enregistrés d'un voyage, en map `{ [date]: jour }`. `onSync` : cf. listen.js. */
export function subscribeToDays(tripId, callback, onError, onSync) {
  return listen(partCol(tripId, 'days'), {
    label: 'days',
    onData: (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = normalizeDay({ id: d.id, ...d.data() }) })
      callback(map)
    },
    onSync,
    onError,
  })
}

// Seuls les champs présents dans `patch` sont écrits : renommer un jour ne
// réécrit pas ses étapes, et inversement. `date` part à chaque fois — les
// règles le comparent à l'identifiant du document.
function dayPayload(date, patch, existing, currentUid) {
  const out = { date, ...stamp(existing, currentUid) }
  if ('stops' in patch) out.stops = normalizeStops(patch.stops, date)
  if ('title' in patch) out.title = optText(patch.title, 120)
  if ('notes' in patch) out.notes = optText(patch.notes, 2000)
  return out
}

/**
 * Écrit une journée par FUSION, sans la relire : son état est déjà en mémoire
 * (l'écoute du voyage), et hors-ligne une lecture attendue ne ferait que
 * retarder l'écriture. `existing` reporte le créateur d'origine.
 *
 * Le tableau `stops` est remplacé en bloc : si les deux comptes modifient la
 * même journée au même instant, le dernier enregistré gagne (comme le
 * planning de Cook'It).
 */
export function saveDay(tripId, date, patch, existing, currentUid) {
  return setDoc(partDoc(tripId, 'days', date), dayPayload(date, patch, existing, currentUid), { merge: true })
}

/**
 * Plusieurs journées d'un coup — déplacer une étape d'un jour à l'autre
 * touche deux documents, qui doivent changer ENSEMBLE : sinon une coupure
 * réseau entre les deux écritures ferait disparaître l'étape, ou la doublerait.
 * `changes` : `{ [date]: patch }`.
 */
export function saveDays(tripId, changes, existingByDate, currentUid) {
  const batch = writeBatch(db)
  for (const [date, patch] of Object.entries(changes)) {
    batch.set(
      partDoc(tripId, 'days', date),
      dayPayload(date, patch, existingByDate?.[date], currentUid),
      { merge: true },
    )
  }
  return batch.commit()
}
