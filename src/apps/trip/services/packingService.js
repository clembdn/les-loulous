import { deleteDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { isAuthorizedUid } from '@/shared/config/people.js'
import { DEFAULT_PACKING_CATEGORY, PACKING_CATEGORY_IDS } from '../config/packing.js'
import { enumValue, newId, readMeta, stamp, text } from '../utils/fields.js'
import { guessPackingCategory } from '../utils/packing.js'
import { listen } from './listen.js'
import { partCol, partDoc } from './refs.js'

// La valise d'un voyage, comme la liste de courses de Cook'It : un document
// par affaire, cochée par l'un ou l'autre.
//   packing/{id} → { name, category, owner, checked, checkedBy, checkedAt }
// `owner` : l'uid de la personne à qui elle est, ou `null` (commune).
//
// Écrites sans attendre, comme partout : cocher hors-ligne, dans une chambre
// d'hôtel sans wifi, doit répondre au doigt.

// Un lot Firestore plafonne à 500 opérations.
const BATCH_LIMIT = 450

function normalizeItem(raw) {
  return {
    id: raw.id,
    name: text(raw.name, 120),
    category: enumValue(raw.category, PACKING_CATEGORY_IDS, DEFAULT_PACKING_CATEGORY),
    owner: isAuthorizedUid(raw.owner) ? raw.owner : null,
    checked: raw.checked === true,
    checkedBy: raw.checkedBy || null,
    checkedAt: raw.checkedAt || null,
    ...readMeta(raw),
  }
}

/** La valise d'un voyage. `onSync` : cf. listen.js. */
export function subscribeToPacking(tripId, callback, onError, onSync) {
  return listen(partCol(tripId, 'packing'), {
    label: 'packing',
    onData: (snap) => callback(snap.docs.map((d) => normalizeItem({ id: d.id, ...d.data() }))),
    onSync,
    onError,
  })
}

function newItemPayload(input, currentUid) {
  const name = text(input.name, 120)
  return {
    name,
    category: enumValue(input.category, PACKING_CATEGORY_IDS, guessPackingCategory(name)),
    owner: input.owner || null,
    checked: false,
    checkedBy: null,
    checkedAt: null,
    ...stamp(null, currentUid),
  }
}

/** Ajoute une affaire ; rend son identifiant (pour « Annuler »). */
export function addPackingItem(tripId, input, currentUid) {
  const id = newId()
  const done = setDoc(partDoc(tripId, 'packing', id), newItemPayload(input, currentUid))
  return { id, done }
}

/** Plusieurs d'un coup (liste type, autre voyage) ; rend leurs identifiants. */
export function addPackingItems(tripId, inputs, currentUid) {
  const ids = []
  const commits = []
  for (let i = 0; i < inputs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const input of inputs.slice(i, i + BATCH_LIMIT)) {
      const id = newId()
      ids.push(id)
      batch.set(partDoc(tripId, 'packing', id), newItemPayload(input, currentUid))
    }
    commits.push(batch.commit())
  }
  return { ids, done: Promise.all(commits) }
}

export function updatePackingItem(tripId, item, patch, currentUid) {
  const out = { updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if ('name' in patch) out.name = text(patch.name, 120)
  if ('category' in patch) out.category = enumValue(patch.category, PACKING_CATEGORY_IDS, DEFAULT_PACKING_CATEGORY)
  if ('owner' in patch) out.owner = patch.owner || null
  return updateDoc(partDoc(tripId, 'packing', item.id), out)
}

function checkPatch(checked, currentUid) {
  const now = new Date().toISOString()
  return { checked, checkedBy: checked ? currentUid : null, checkedAt: checked ? now : null, updatedAt: now, updatedBy: currentUid }
}

export function setPacked(tripId, item, checked, currentUid) {
  return updateDoc(partDoc(tripId, 'packing', item.id), checkPatch(checked, currentUid))
}

/** Coche ou décoche plusieurs affaires d'un coup (« Tout décocher » pour le retour). */
export function setManyPacked(tripId, items, checked, currentUid) {
  const commits = []
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    items.slice(i, i + BATCH_LIMIT).forEach((it) => batch.update(partDoc(tripId, 'packing', it.id), checkPatch(checked, currentUid)))
    commits.push(batch.commit())
  }
  return Promise.all(commits)
}

export function deletePackingItem(tripId, itemId) {
  return deleteDoc(partDoc(tripId, 'packing', itemId))
}

export function deletePackingItems(tripId, itemIds) {
  const commits = []
  for (let i = 0; i < itemIds.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    itemIds.slice(i, i + BATCH_LIMIT).forEach((id) => batch.delete(partDoc(tripId, 'packing', id)))
    commits.push(batch.commit())
  }
  return Promise.all(commits)
}

/** Remet des affaires supprimées telles qu'elles étaient (« Annuler »). */
export function restorePackingItems(tripId, items, currentUid) {
  const batch = writeBatch(db)
  for (const it of items) {
    const { id, ...rest } = it
    batch.set(partDoc(tripId, 'packing', id), { ...rest, updatedAt: new Date().toISOString(), updatedBy: currentUid })
  }
  return batch.commit()
}

/** La valise d'un autre voyage, pour la reprendre (lecture attendue : elle retombe sur le cache hors-ligne). */
export async function readPacking(tripId) {
  const snap = await getDocs(partCol(tripId, 'packing'))
  return snap.docs.map((d) => normalizeItem({ id: d.id, ...d.data() }))
}
