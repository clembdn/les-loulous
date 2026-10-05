import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeToStays, subscribeToTransports } from '../services/reservationsService.js'
import { subscribeToDays } from '../services/daysService.js'
import { subscribeToAttachments } from '../services/attachmentsService.js'

/**
 * Tout le contenu d'UN voyage : hébergements, trajets, jours, captures.
 *
 * Quatre écoutes, ouvertes tant que le voyage est affiché. C'est aussi ce qui
 * l'emporte hors-ligne : une fois lus, ces documents restent dans le cache
 * IndexedDB de Firestore, captures comprises, et se relisent sans réseau.
 *
 * Le voyage lui-même (titre, dates) vient de `useTrips()` — il est déjà
 * écouté par la liste.
 */
const TripDataContext = createContext(null)

const PARTS = ['stays', 'transports', 'days', 'attachments']
const NOT_READY = Object.fromEntries(PARTS.map((p) => [p, false]))

export function TripDataProvider({ tripId, children }) {
  const [stays, setStays] = useState([])
  const [transports, setTransports] = useState([])
  const [days, setDays] = useState({})
  const [attachments, setAttachments] = useState([])
  const [ready, setReady] = useState(NOT_READY)

  useEffect(() => {
    // Changer de voyage : rien de l'ancien ne doit s'afficher, même une
    // fraction de seconde, sous le titre du nouveau.
    setStays([])
    setTransports([])
    setDays({})
    setAttachments([])
    setReady(NOT_READY)

    const done = (part) => setReady((r) => (r[part] ? r : { ...r, [part]: true }))
    const unsubs = [
      subscribeToStays(tripId, (x) => { setStays(x); done('stays') }, () => done('stays')),
      subscribeToTransports(tripId, (x) => { setTransports(x); done('transports') }, () => done('transports')),
      subscribeToDays(tripId, (x) => { setDays(x); done('days') }, () => done('days')),
      subscribeToAttachments(tripId, (x) => { setAttachments(x); done('attachments') }, () => done('attachments')),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [tripId])

  const attachmentsByParent = useMemo(() => {
    const map = {}
    for (const a of attachments) (map[a.parentId] ||= []).push(a)
    return map
  }, [attachments])

  const value = useMemo(() => ({
    tripId,
    stays,
    transports,
    days,
    attachments,
    attachmentsByParent,
    isLoading: !PARTS.every((p) => ready[p]),
  }), [tripId, stays, transports, days, attachments, attachmentsByParent, ready])

  return <TripDataContext.Provider value={value}>{children}</TripDataContext.Provider>
}

export function useTripData() {
  const ctx = useContext(TripDataContext)
  if (!ctx) throw new Error('useTripData doit être utilisé sous <TripDataProvider>')
  return ctx
}
