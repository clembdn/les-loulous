import { doc, onSnapshot } from 'firebase/firestore'
import { optNumber, optText, readMeta } from '../utils/fields.js'
import { partCol, partDoc } from './refs.js'

// Justificatifs : une capture d'écran par document, en base64.
//
// Pas de Firebase Storage : il exigerait la formule Blaze. Un document
// Firestore plafonne à 1 Mo, d'où une capture par document (compressée sous
// 900 000 caractères, cf. imageService) — et le cache Firestore déjà en place
// les rend lisibles hors-ligne, sans rien de plus.
//
// La capture désigne son parent (`parentKind` + `parentId`), le parent ne la
// liste pas : une seule source de vérité, rien à tenir synchronisé entre deux
// documents. Elle s'écrit dans le MÊME lot que sa réservation — annuler le
// formulaire ne laisse donc aucune capture orpheline en base.

function normalizeAttachment(raw) {
  return {
    id: raw.id,
    parentKind: raw.parentKind === 'transport' ? 'transport' : 'stay',
    parentId: raw.parentId || '',
    name: optText(raw.name, 200),
    mime: raw.mime || 'image/jpeg',
    data: typeof raw.data === 'string' ? raw.data : '',
    width: optNumber(raw.width),
    height: optNumber(raw.height),
    ...readMeta(raw),
  }
}

export function subscribeToAttachments(tripId, callback, onError) {
  return onSnapshot(partCol(tripId, 'attachments'), (snap) => {
    callback(snap.docs.map((d) => normalizeAttachment({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Trip] attachments error:', err)
    onError?.(err)
  })
}

/**
 * Ajoute au lot `batch` les captures nouvelles (`add`, déjà compressées) et
 * les suppressions (`remove`, des ids). Une capture ne se modifie jamais.
 */
export function queueAttachmentChanges(batch, tripId, { parentKind, parentId, add = [], remove = [] }, currentUid) {
  const now = new Date().toISOString()
  for (const a of add) {
    batch.set(doc(partCol(tripId, 'attachments')), {
      parentKind,
      parentId,
      name: optText(a.name, 200),
      mime: a.mime,
      data: a.data,
      width: optNumber(a.width),
      height: optNumber(a.height),
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  }
  for (const id of remove) batch.delete(partDoc(tripId, 'attachments', id))
}

export function attachmentSrc(attachment) {
  return `data:${attachment.mime};base64,${attachment.data}`
}
