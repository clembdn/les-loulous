import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { slugify, normalizeName } from '../utils/aisleGuess.js'
import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'

const CATALOG_PATH = 'couples/main/shoppingCatalog'
function catalogCol() { return collection(db, CATALOG_PATH) }
function catalogDoc(slug) { return doc(db, CATALOG_PATH, slug) }

function resolveAisle(raw) {
  return AISLE_BY_ID[raw] ? raw : DEFAULT_AISLE
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    nameLower: raw.nameLower || '',
    aisle: resolveAisle(raw.aisle),
    favorite: raw.favorite === true,
    useCount: Number(raw.useCount) || 0,
    lastUsedAt: raw.lastUsedAt || null,
  }
}

export function subscribeToCatalog(callback, onError) {
  return onSnapshot(catalogCol(), (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] catalog error:', err)
    onError?.(err)
  })
}

// Upsert appelé à chaque ajout : compte d'usage + rayon mémorisé.
// (createdBy n'est posé qu'à la création pour satisfaire les règles Firestore.)
export async function recordUsage(name, aisle, currentUid) {
  const slug = slugify(name)
  const ref = catalogDoc(slug)
  const now = new Date().toISOString()
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const prev = snap.data()
    await updateDoc(ref, {
      name: String(name).trim(),
      nameLower: normalizeName(name),
      aisle: resolveAisle(aisle),
      useCount: (Number(prev.useCount) || 0) + 1,
      lastUsedAt: now,
      updatedAt: now,
      updatedBy: currentUid,
    })
  } else {
    await setDoc(ref, {
      name: String(name).trim(),
      nameLower: normalizeName(name),
      aisle: resolveAisle(aisle),
      favorite: false,
      useCount: 1,
      lastUsedAt: now,
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  }
  return slug
}

export async function toggleFavorite(entry, currentUid) {
  await updateDoc(catalogDoc(entry.id), {
    favorite: !entry.favorite,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function setCatalogAisle(entry, aisle, currentUid) {
  await updateDoc(catalogDoc(entry.id), {
    aisle: resolveAisle(aisle),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function removeCatalogEntry(slug) {
  await deleteDoc(catalogDoc(slug))
}
