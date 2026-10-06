import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeToStays, subscribeToTransports } from '../services/reservationsService.js'
import { subscribeToDays } from '../services/daysService.js'
import { subscribeToAttachments } from '../services/attachmentsService.js'
import { markSynced } from '../services/offlineService.js'
import { tripDays } from '../utils/tripDates.js'
import { buildDayTimeline } from '../utils/timeline.js'
import { nightsOf, stayOrder, staySegments } from '../utils/nights.js'

/**
 * Tout le contenu d'UN voyage : hébergements, trajets, jours, captures — et
 * ce qui s'en déduit (frises, nuits, couleurs), calculé une fois ici plutôt
 * que dans chaque écran.
 *
 * Quatre écoutes, ouvertes tant que le voyage est affiché. C'est aussi ce qui
 * l'emporte hors-ligne : une fois lus, ces documents restent dans le cache
 * IndexedDB de Firestore, captures comprises, et se relisent sans réseau.
 * Quand les quatre sont confirmées par le serveur, l'heure de synchro du
 * voyage est notée (cf. services/offlineService.js).
 *
 * Le voyage lui-même (titre, dates) vient de `useTrips()` — il est déjà
 * écouté par la liste — et arrive ici en prop.
 */
const TripDataContext = createContext(null)

const PARTS = ['stays', 'transports', 'days', 'attachments']
const NOT_READY = Object.fromEntries(PARTS.map((p) => [p, false]))
const NO_STOPS = []

export function TripDataProvider({ trip, children }) {
  const tripId = trip.id
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

    // « Disponible hors-ligne » : les quatre parties confirmées par le
    // serveur en même temps. Tenu hors de l'état React — l'heure de synchro
    // vit dans offlineService, seul l'indicateur se redessine.
    const fresh = {}
    const sync = (part) => (fromServer) => {
      fresh[part] = fromServer
      if (fromServer && PARTS.every((p) => fresh[p])) markSynced(tripId)
    }

    const unsubs = [
      subscribeToStays(tripId, (x) => { setStays(x); done('stays') }, () => done('stays'), sync('stays')),
      subscribeToTransports(tripId, (x) => { setTransports(x); done('transports') }, () => done('transports'), sync('transports')),
      subscribeToDays(tripId, (x) => { setDays(x); done('days') }, () => done('days'), sync('days')),
      subscribeToAttachments(tripId, (x) => { setAttachments(x); done('attachments') }, () => done('attachments'), sync('attachments')),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [tripId])

  // Le voyage est renormalisé à chaque écho de la liste : on ne dépend que
  // de ses dates, sinon toutes les frises se recalculeraient pour rien.
  const { startDate, endDate } = trip
  const dayKeys = useMemo(() => tripDays({ startDate, endDate }), [startDate, endDate])

  const stopsByDate = useMemo(
    () => Object.fromEntries(Object.entries(days).map(([date, day]) => [date, day.stops])),
    [days],
  )

  const timelines = useMemo(() => Object.fromEntries(dayKeys.map((date) => [
    date,
    buildDayTimeline(date, stopsByDate[date] || NO_STOPS, stays, transports),
  ])), [dayKeys, stopsByDate, stays, transports])

  const nights = useMemo(() => nightsOf(dayKeys, stays), [dayKeys, stays])
  const segments = useMemo(() => staySegments(dayKeys, stays), [dayKeys, stays])
  const colorIndexByStay = useMemo(
    () => Object.fromEntries(stayOrder(stays).map((s, i) => [s.id, i])),
    [stays],
  )

  const attachmentsByParent = useMemo(() => {
    const map = {}
    for (const a of attachments) (map[a.parentId] ||= []).push(a)
    return map
  }, [attachments])

  const value = useMemo(() => ({
    trip,
    tripId,
    stays,
    transports,
    days,
    stopsByDate,
    attachments,
    attachmentsByParent,
    dayKeys,
    timelines,
    nights,
    segments,
    colorIndexByStay,
    isLoading: !PARTS.every((p) => ready[p]),
  }), [
    trip, tripId, stays, transports, days, stopsByDate, attachments, attachmentsByParent,
    dayKeys, timelines, nights, segments, colorIndexByStay, ready,
  ])

  return <TripDataContext.Provider value={value}>{children}</TripDataContext.Provider>
}

export function useTripData() {
  const ctx = useContext(TripDataContext)
  if (!ctx) throw new Error('useTripData doit être utilisé sous <TripDataProvider>')
  return ctx
}
