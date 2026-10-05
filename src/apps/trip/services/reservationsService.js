import { doc, onSnapshot, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { STAY_KIND_IDS, TRANSPORT_MODE_IDS } from '../config/reservations.js'
import {
  currencyCode, enumValue, money, optText, place, readMeta, stamp, timePoint,
} from '../utils/fields.js'
import { queueAttachmentChanges } from './attachmentsService.js'
import { partCol, partDoc } from './refs.js'

// Les deux sortes de réservations : hébergements (des nuits) et trajets
// réservés (un départ, une arrivée). Même cycle de vie, mêmes justificatifs —
// un seul service, deux formes.

const PART = { stay: 'stays', transport: 'transports' }

function commonFields(raw) {
  return {
    confirmation: optText(raw?.confirmation, 120),
    price: money(raw?.price),
    currency: currencyCode(raw?.currency),
    mailUrl: optText(raw?.mailUrl, 2000),
    notes: optText(raw?.notes, 2000),
  }
}

function stayFields(raw) {
  return {
    kind: enumValue(raw?.kind, STAY_KIND_IDS, 'hotel'),
    ...place(raw, { nameMax: 120 }),
    checkIn: timePoint(raw?.checkIn),
    checkOut: timePoint(raw?.checkOut),
    accessCode: optText(raw?.accessCode, 120),
    phone: optText(raw?.phone, 40),
    ...commonFields(raw),
  }
}

// Une extrémité de trajet : un lieu (gare, aéroport, agence) et un instant.
function endpoint(raw) {
  return { ...place(raw), ...timePoint(raw) }
}

function transportFields(raw) {
  return {
    mode: enumValue(raw?.mode, TRANSPORT_MODE_IDS, 'other'),
    ref: optText(raw?.ref, 120),
    from: endpoint(raw?.from),
    to: endpoint(raw?.to),
    seat: optText(raw?.seat, 60),
    ...commonFields(raw),
  }
}

const FIELDS = { stay: stayFields, transport: transportFields }

function subscribe(kind, tripId, callback, onError) {
  const toFields = FIELDS[kind]
  return onSnapshot(partCol(tripId, PART[kind]), (snap) => {
    callback(snap.docs.map((d) => {
      const raw = d.data()
      return { id: d.id, ...toFields(raw), ...readMeta(raw) }
    }))
  }, (err) => {
    console.error(`[Trip] ${PART[kind]} error:`, err)
    onError?.(err)
  })
}

export function subscribeToStays(tripId, callback, onError) {
  return subscribe('stay', tripId, callback, onError)
}

export function subscribeToTransports(tripId, callback, onError) {
  return subscribe('transport', tripId, callback, onError)
}

/**
 * Enregistre une réservation (`kind` : 'stay' | 'transport') et ses
 * changements de captures dans UN lot : la fiche et ses justificatifs
 * arrivent ensemble, ou pas du tout.
 *
 * Rend `{ id, done }` tout de suite — `done` ne se résout qu'au retour du
 * réseau hors-ligne, l'UI ne l'attend jamais.
 */
export function saveReservation(kind, tripId, existing, values, attachments, currentUid) {
  const ref = existing?.id ? partDoc(tripId, PART[kind], existing.id) : doc(partCol(tripId, PART[kind]))
  const batch = writeBatch(db)
  batch.set(ref, { ...FIELDS[kind](values), ...stamp(existing, currentUid) }, { merge: true })
  queueAttachmentChanges(batch, tripId, { parentKind: kind, parentId: ref.id, ...attachments }, currentUid)
  return { id: ref.id, done: batch.commit() }
}

/** Supprime une réservation avec ses captures. */
export function deleteReservation(kind, tripId, id, attachmentIds = []) {
  const batch = writeBatch(db)
  batch.delete(partDoc(tripId, PART[kind], id))
  attachmentIds.forEach((attachmentId) => batch.delete(partDoc(tripId, 'attachments', attachmentId)))
  return batch.commit()
}

