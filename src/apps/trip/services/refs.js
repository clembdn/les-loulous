import { collection, doc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Tout l'espace voyages vit sous couples/main, comme les autres apps.
//   trips/{tripId}
//     stays/{id} · transports/{id} · days/{AAAA-MM-JJ} · attachments/{id}
const TRIPS_PATH = 'couples/main/trips'

// Les sous-collections d'un voyage : ce qu'il faut écouter pour l'emporter
// hors-ligne, et ce qu'il faut balayer pour le supprimer (Firestore ne
// supprime jamais les sous-collections avec leur parent).
export const TRIP_PARTS = ['stays', 'transports', 'days', 'attachments']

export function tripsCol() {
  return collection(db, TRIPS_PATH)
}

export function tripDoc(tripId) {
  return doc(db, TRIPS_PATH, tripId)
}

export function partCol(tripId, part) {
  return collection(db, TRIPS_PATH, tripId, part)
}

export function partDoc(tripId, part, id) {
  return doc(db, TRIPS_PATH, tripId, part, id)
}
