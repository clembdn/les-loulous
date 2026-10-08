import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { optText, readMeta, stamp, text } from '../utils/fields.js'
import {
  ATTACHMENT_BATCH_CHARS, attachmentChanges, chunkBySize, newShareToken, TOKEN_RE,
} from '../utils/publicTrip.js'
import { listen } from './listen.js'
import { partCol, partDoc } from './refs.js'
import { normalizeAttachment } from './attachmentsService.js'
import { normalizeDay } from './daysService.js'
import { readReservation } from './reservationsService.js'

// Liens invités : un lien par personne, en lecture seule, sans compte.
//
//   couples/main/trips/{id}/shares/{jeton}   le registre (nom, ce qui a été publié)
//   publicTrips/{jeton}                       la vitrine : le voyage entier, sans les captures
//   publicTrips/{jeton}/attachments/{id}      la copie des captures
//
// La vitrine vit HORS de couples/main : les règles laissent lire un document
// dont on connaît le jeton, jamais lister la collection. Le jeton (192 bits)
// est la clé : qui a le lien entre, personne ne devine les autres.
//
// La vitrine est une COPIE, republiée quand le voyage change (cf.
// context/TripSharesContext.jsx) : l'invité ne lit jamais les données du
// couple, et révoquer un lien supprime sa copie sans toucher au voyage.

const PUBLIC_PATH = 'publicTrips'

function publicDoc(token) {
  return doc(db, PUBLIC_PATH, token)
}

function publicAttachmentsCol(token) {
  return collection(db, PUBLIC_PATH, token, 'attachments')
}

function publicAttachmentDoc(token, id) {
  return doc(db, PUBLIC_PATH, token, 'attachments', id)
}

function normalizeShare(id, raw) {
  return {
    id,
    label: text(raw.label, 60) || 'Invité',
    publishedHash: optText(raw.publishedHash, 32),
    publishedAt: raw.publishedAt || null,
    publishedAttachmentIds: Array.isArray(raw.publishedAttachmentIds) ? raw.publishedAttachmentIds : [],
    ...readMeta(raw),
  }
}

/** Les liens d'un voyage, du plus ancien au plus récent. `onSync` : cf. listen.js. */
export function subscribeToShares(tripId, callback, onError, onSync) {
  return listen(partCol(tripId, 'shares'), {
    label: 'shares',
    onData: (snap) => callback(
      snap.docs
        .map((d) => normalizeShare(d.id, d.data()))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    ),
    onSync,
    onError,
  })
}

/**
 * Crée un lien et rend son jeton TOUT DE SUITE. Sa vitrine est publiée
 * ensuite par le voyage ouvert, dès que le serveur a confirmé le lien.
 */
export function createShare(tripId, label, currentUid) {
  const token = newShareToken()
  const done = setDoc(partDoc(tripId, 'shares', token), {
    label: text(label, 60) || 'Invité',
    publishedHash: null,
    publishedAttachmentIds: [],
    ...stamp(null, currentUid),
  })
  return { token, done }
}

/**
 * Révoque un lien : son registre, sa vitrine et ses captures partent ENSEMBLE.
 * Le lien affiche alors « Ce voyage n'est plus partagé ».
 */
export function revokeShare(tripId, share) {
  const batch = writeBatch(db)
  batch.delete(partDoc(tripId, 'shares', share.id))
  batch.delete(publicDoc(share.id))
  share.publishedAttachmentIds.forEach((id) => batch.delete(publicAttachmentDoc(share.id, id)))
  return batch.commit()
}

/**
 * Publie la vitrine d'un lien. Tâche de fond (jamais attendue par l'UI), qui
 * ne tourne qu'en ligne, sur des données confirmées par le serveur.
 *
 * Les captures nouvelles d'abord, par paquets (une requête plafonne à
 * 10 Mio) ; puis, dans un seul lot, la vitrine, le retrait des captures
 * supprimées et l'empreinte publiée. Si une étape échoue, l'empreinte reste
 * l'ancienne et la publication suivante reprend tout.
 */
export async function publishShare(tripId, share, { content, hash, attachments }, currentUid) {
  const { add, remove } = attachmentChanges(share.publishedAttachmentIds, content.attachmentIds)
  const toCopy = attachments.filter((a) => add.includes(a.id))
  for (const group of chunkBySize(toCopy, (a) => a.data.length, ATTACHMENT_BATCH_CHARS)) {
    const batch = writeBatch(db)
    for (const a of group) {
      batch.set(publicAttachmentDoc(share.id, a.id), {
        parentKind: a.parentKind,
        parentId: a.parentId,
        name: a.name,
        mime: a.mime,
        data: a.data,
        width: a.width,
        height: a.height,
      })
    }
    await batch.commit()
  }

  const now = new Date().toISOString()
  const { attachmentIds, ...rest } = content
  const batch = writeBatch(db)
  batch.set(publicDoc(share.id), { ...rest, tripId, publishedAt: now })
  remove.forEach((id) => batch.delete(publicAttachmentDoc(share.id, id)))
  batch.set(partDoc(tripId, 'shares', share.id), {
    label: share.label,
    publishedHash: hash,
    publishedAt: now,
    publishedAttachmentIds: attachmentIds,
    ...stamp(share, currentUid, now),
  }, { merge: true })
  await batch.commit()
}

/**
 * Les vitrines des liens `tokens` et leurs captures, à supprimer avec leur
 * voyage — sinon ses invités le verraient encore. Les captures sont relues
 * dans la vitrine elle-même, pour n'en oublier aucune.
 */
export async function publicRefsOf(tokens) {
  const files = await Promise.all(tokens.map((token) => getDocs(publicAttachmentsCol(token))))
  return tokens.flatMap((token, i) => [...files[i].docs.map((d) => d.ref), publicDoc(token)])
}

// ---------------------------------------------------------------------------
// Côté invité : la vitrine, en direct.

/** Une vitrine telle qu'on la lit, dans la forme des données du voyage. */
function readPublicTrip(token, raw) {
  const days = {}
  for (const [date, day] of Object.entries(raw.days || {})) {
    days[date] = normalizeDay({ id: date, ...day })
  }
  const trip = raw.trip || {}
  return {
    // L'identifiant du voyage côté invité : propre à la vitrine (heure de
    // synchro, dernier jour ouvert), sans rien révéler du voyage d'origine.
    trip: {
      id: `v-${token.slice(0, 12)}`,
      title: text(trip.title, 120) || 'Voyage',
      startDate: trip.startDate,
      endDate: trip.endDate || trip.startDate,
      notes: optText(trip.notes, 2000),
    },
    stays: (raw.stays || []).map((s) => readReservation('stay', s.id, s)),
    transports: (raw.transports || []).map((t) => readReservation('transport', t.id, t)),
    days,
  }
}

/**
 * Écoute la vitrine `token`. `callback(null)` : elle n'existe pas (lien
 * révoqué, voyage supprimé, jeton mal recopié) ; `callback(undefined)` : on
 * ne sait pas encore — rien en cache, le serveur n'a pas répondu (hors-ligne
 * à la première ouverture). `onSync(fromServer)` : cf. listen.js.
 */
export function subscribeToPublicTrip(token, callback, onError, onSync) {
  if (!TOKEN_RE.test(token)) {
    callback(null)
    return () => {}
  }
  // Comme listen.js : les réveils qui ne changent que la provenance (cache →
  // serveur) ne redonnent pas les données. Chaque publication change `publishedAt`.
  let last
  return onSnapshot(publicDoc(token), { includeMetadataChanges: true }, (snap) => {
    const exists = snap.exists()
    const version = exists ? `v:${snap.get('publishedAt') || ''}` : snap.metadata.fromCache ? 'unknown' : 'gone'
    if (version !== last) {
      last = version
      callback(exists ? readPublicTrip(token, snap.data()) : version === 'gone' ? null : undefined)
    }
    onSync?.(!snap.metadata.fromCache)
  }, (err) => {
    console.error('[Trip] vitrine error:', err)
    onError?.(err)
  })
}

export function subscribeToPublicAttachments(token, callback, onError, onSync) {
  return listen(publicAttachmentsCol(token), {
    label: 'vitrine attachments',
    onData: (snap) => callback(snap.docs.map((d) => normalizeAttachment({ id: d.id, ...d.data() }))),
    onSync,
    onError,
  })
}
