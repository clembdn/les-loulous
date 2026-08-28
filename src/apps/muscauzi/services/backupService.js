import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { PARITIES } from './programService.js'

/**
 * Sauvegarde BRUTE de tout ce que MuscAuzi possède sur un profil.
 *
 * ── Pourquoi pas un script Node ─────────────────────────────────────────────
 *
 * Les règles Firestore n'ouvrent `users/{uid}` qu'au titulaire connecté, et la
 * configuration du projet vit dans les variables Vite du navigateur. Un script
 * hors ligne demanderait une clé de service à installer et à garder — beaucoup
 * de surface pour une lecture qu'on fait depuis une page déjà authentifiée.
 *
 * ── Brut, volontairement ────────────────────────────────────────────────────
 *
 * Aucune normalisation, aucun filtrage : c'est le contenu exact des documents,
 * champs hérités compris (`programSnapshot`, `bodyweight`…). Une sauvegarde qui
 * passe par les normalisations de l'appli ne sauvegarde que ce que l'appli sait
 * déjà lire — donc pas ce qu'on voudrait justement pouvoir récupérer.
 *
 * L'export CSV (`utils/exportCsv.js`) reste le fichier à LIRE ; celui-ci est le
 * fichier à GARDER.
 */
const VERSION = 1

async function readCollection(uid, name) {
  const snap = await getDocs(collection(db, 'users', uid, name))
  const out = {}
  for (const d of snap.docs) out[d.id] = d.data()
  return out
}

async function readDoc(uid, ...path) {
  const snap = await getDoc(doc(db, 'users', uid, ...path))
  return snap.exists() ? snap.data() : null
}

/** Tout le profil, en un objet sérialisable. */
export async function collectBackup(uid) {
  const [exercises, sessions, exerciseNotes, weights, ...programs] = await Promise.all([
    readCollection(uid, 'exercises'),
    readCollection(uid, 'sessions'),
    readCollection(uid, 'exerciseNotes'),
    readCollection(uid, 'weights'),
    ...PARITIES.map((parity) => readDoc(uid, 'program', parity)),
  ])

  return {
    version: VERSION,
    app: 'muscauzi',
    uid,
    exportedAt: new Date().toISOString(),
    program: Object.fromEntries(PARITIES.map((parity, i) => [parity, programs[i]])),
    exercises,
    sessions,
    exerciseNotes,
    weights,
    // Cache dérivé, plus lu par l'appli. Conservé dans la sauvegarde : il ne
    // coûte qu'un document et il témoigne de l'état d'avant la refonte.
    meta: { lastPerf: await readDoc(uid, 'meta', 'lastPerf') },
  }
}
