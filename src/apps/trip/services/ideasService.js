import { deleteDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { DEFAULT_CATEGORY, STOP_CATEGORY_IDS } from '../config/categories.js'
import { enumValue, optText, place, readMeta, stamp, text } from '../utils/fields.js'
import { listen } from './listen.js'
import { partCol, partDoc } from './refs.js'
import { dayDocPayload } from './daysService.js'

// La liste « à caser » : des lieux repérés, pas encore placés dans un jour.
//   ideas/{id} → { name, address, lat, lng, mapsUrl, category, notes }
// UN DOCUMENT PAR LIEU, et non un tableau comme les étapes d'un jour : deux
// téléphones qui repèrent un lieu au même instant ne s'écrasent pas, et
// repérer un lieu n'a pas besoin du voyage chargé (partage Android, hors-ligne).
//
// Placer un lieu dans un jour, c'est le même identifiant qui passe d'un
// document à l'autre, dans UN lot : une coupure réseau entre les deux
// écritures le ferait disparaître, ou le doublerait.

function normalizeIdea(raw) {
  return {
    id: raw.id,
    ...place(raw),
    category: enumValue(raw?.category, STOP_CATEGORY_IDS, DEFAULT_CATEGORY),
    notes: optText(raw?.notes, 1000),
    ...readMeta(raw),
  }
}

function ideaPayload(idea, existing, currentUid) {
  return {
    ...place(idea),
    name: text(idea.name, 160),
    category: enumValue(idea.category, STOP_CATEGORY_IDS, DEFAULT_CATEGORY),
    notes: optText(idea.notes, 1000),
    ...stamp(existing, currentUid),
  }
}

/** Les lieux à caser d'un voyage. `onSync` : cf. listen.js. */
export function subscribeToIdeas(tripId, callback, onError, onSync) {
  return listen(partCol(tripId, 'ideas'), {
    label: 'ideas',
    onData: (snap) => callback(snap.docs.map((d) => normalizeIdea({ id: d.id, ...d.data() }))),
    onSync,
    onError,
  })
}

/** Repérer un lieu, ou le modifier (`existing` reporte son créateur). */
export function saveIdea(tripId, idea, existing, currentUid) {
  return setDoc(partDoc(tripId, 'ideas', idea.id), ideaPayload(idea, existing, currentUid))
}

export function deleteIdea(tripId, ideaId) {
  return deleteDoc(partDoc(tripId, 'ideas', ideaId))
}

/**
 * Le lieu entre dans la journée (`stops` : la nouvelle liste du jour, qui le
 * contient) et quitte la liste à caser, ensemble.
 */
export function placeIdea(tripId, ideaId, date, stops, existingDay, currentUid) {
  const batch = writeBatch(db)
  batch.set(partDoc(tripId, 'days', date), dayDocPayload(date, { stops }, existingDay, currentUid), { merge: true })
  batch.delete(partDoc(tripId, 'ideas', ideaId))
  return batch.commit()
}

/**
 * L'inverse : l'étape quitte sa journée (`stops` : la liste du jour sans
 * elle) et repart à caser. `existingIdea` : la fiche d'origine, quand on
 * annule un placement — elle garde son créateur et sa date.
 */
export function shelveStop(tripId, idea, date, stops, existingDay, currentUid, existingIdea = null) {
  const batch = writeBatch(db)
  batch.set(partDoc(tripId, 'days', date), dayDocPayload(date, { stops }, existingDay, currentUid), { merge: true })
  batch.set(partDoc(tripId, 'ideas', idea.id), ideaPayload(idea, existingIdea, currentUid))
  return batch.commit()
}
