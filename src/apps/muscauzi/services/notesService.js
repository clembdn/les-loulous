import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Notes de réglages, PAR UTILISATEUR : la hauteur de siège de l'un n'est pas
// celle de l'autre. Surtout pas dans le catalogue commun `exercises/`.
//
// La note est attachée au MOUVEMENT, pas à l'occurrence : elle vaut quel que
// soit le jour où l'exercice apparaît.
function notesCol(uid) { return collection(db, 'users', uid, 'exerciseNotes') }
function noteDoc(uid, exerciseId) { return doc(db, 'users', uid, 'exerciseNotes', exerciseId) }

export function subscribeToNotes(uid, callback, onError) {
  return onSnapshot(notesCol(uid), (snap) => {
    const out = {}
    for (const d of snap.docs) {
      const text = d.data()?.text
      if (typeof text === 'string' && text.trim()) out[d.id] = text
    }
    callback(out)
  }, (err) => {
    console.error('[MuscAuzi] notes error:', err)
    onError?.(err)
    callback({})
  })
}

// Une note vide (ou faite d'espaces) n'est pas stockée : on supprime le
// document, et l'accordéon n'affiche alors rien du tout.
export function saveNote(uid, exerciseId, text, currentUid) {
  const trimmed = String(text || '').trim()
  const op = trimmed
    ? setDoc(noteDoc(uid, exerciseId), {
        text: trimmed,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUid,
      })
    : deleteDoc(noteDoc(uid, exerciseId))
  op.catch((err) => console.error('[MuscAuzi] saveNote failed:', err))
}
