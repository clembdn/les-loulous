import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { newId, readMeta, stamp } from '../utils/fields.js'

// Les pays et lieux déjà visités HORS de Trip Planner (avant l'app, ou sans
// la prévenir), saisis à la main pour la carte du monde. Un seul document,
// partagé par les deux comptes :
//   couples/main/tripWorld/visited → { entries: [{ id, name, lat, lng, country, kind, radiusKm }] }
// `arrayUnion` / `arrayRemove` : ajouter et retirer sans relire, et sans
// écraser ce que l'autre vient d'ajouter.

const WORLD_DOC = 'couples/main/tripWorld/visited'
const KINDS = ['country', 'island', 'place']

function normalizeEntry(raw) {
  if (!raw || typeof raw.id !== 'string' || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) return null
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : '',
    lat: raw.lat,
    lng: raw.lng,
    country: typeof raw.country === 'string' && /^[A-Z]{2}$/.test(raw.country) ? raw.country : null,
    kind: KINDS.includes(raw.kind) ? raw.kind : 'place',
    radiusKm: Number.isFinite(raw.radiusKm) ? raw.radiusKm : 8,
  }
}

/** Les saisies, et le document brut (pour reporter son créateur). */
export function subscribeToVisited(callback, onError) {
  return onSnapshot(doc(db, WORLD_DOC), (snap) => {
    const raw = snap.exists() ? snap.data() : {}
    callback({
      entries: (Array.isArray(raw.entries) ? raw.entries : []).map((e) => ({ raw: e, entry: normalizeEntry(e) })).filter((x) => x.entry),
      meta: snap.exists() ? readMeta(raw) : null,
    })
  }, (err) => {
    console.error('[Trip] tripWorld error:', err)
    onError?.(err)
  })
}

/** Ajoute un lieu de `photonArea` (pays, île, ville). Rend la promesse d'écriture, à ne pas attendre. */
export function addVisited(area, meta, currentUid) {
  const entry = {
    id: newId(),
    name: area.name,
    lat: area.lat,
    lng: area.lng,
    country: area.country,
    kind: area.kind,
    radiusKm: area.radiusKm,
  }
  return setDoc(doc(db, WORLD_DOC), { entries: arrayUnion(entry), ...stamp(meta, currentUid) }, { merge: true })
}

/** Retire une saisie (`raw` : l'objet tel qu'il est en base, que `arrayRemove` compare). */
export function removeVisited(raw, meta, currentUid) {
  return setDoc(doc(db, WORLD_DOC), { entries: arrayRemove(raw), ...stamp(meta, currentUid) }, { merge: true })
}
