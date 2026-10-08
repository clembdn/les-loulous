import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeToStays, subscribeToTransports } from '../services/reservationsService.js'
import { subscribeToDays } from '../services/daysService.js'
import { subscribeToAttachments } from '../services/attachmentsService.js'
import { subscribeToIdeas } from '../services/ideasService.js'
import { markSynced } from '../services/offlineService.js'
import { tripDays } from '../utils/tripDates.js'
import { buildDayTimeline } from '../utils/timeline.js'
import { nightsOf, stayOrder, staySegments } from '../utils/nights.js'

/**
 * Tout le contenu d'UN voyage : hébergements, trajets, jours, captures, lieux
 * à caser — et
 * ce qui s'en déduit (frises, nuits, couleurs), calculé une fois ici plutôt
 * que dans chaque écran.
 *
 * Cinq écoutes, ouvertes tant que le voyage est affiché. C'est aussi ce qui
 * l'emporte hors-ligne : une fois lus, ces documents restent dans le cache
 * IndexedDB de Firestore, captures comprises, et se relisent sans réseau.
 * Quand toutes sont confirmées par le serveur, l'heure de synchro du
 * voyage est notée (cf. services/offlineService.js).
 *
 * Le voyage lui-même (titre, dates) vient de `useTrips()` — il est déjà
 * écouté par la liste — et arrive ici en prop.
 */
const TripDataContext = createContext(null)
// À part : il bascule à chaque écriture (en attente → confirmée), et seul
// l'éditeur des vitrines invité s'en sert — les écrans n'ont pas à se redessiner.
const TripConfirmedContext = createContext(false)

const PARTS = ['stays', 'transports', 'days', 'attachments', 'ideas']
const NOT_READY = Object.fromEntries(PARTS.map((p) => [p, false]))
const NO_STOPS = []
const NO_IDEAS = []

export function TripDataProvider({ trip, children }) {
  const tripId = trip.id
  const [stays, setStays] = useState([])
  const [transports, setTransports] = useState([])
  const [days, setDays] = useState({})
  const [attachments, setAttachments] = useState([])
  const [ideas, setIdeas] = useState([])
  const [ready, setReady] = useState(NOT_READY)
  // Toutes les parties confirmées par le serveur, sans écriture en attente :
  // ce qu'on affiche est ce qui est en base (cf. TripSharesContext).
  const [isConfirmed, setConfirmed] = useState(false)

  useEffect(() => {
    // Changer de voyage : rien de l'ancien ne doit s'afficher, même une
    // fraction de seconde, sous le titre du nouveau.
    setStays([])
    setTransports([])
    setDays({})
    setAttachments([])
    setIdeas([])
    setReady(NOT_READY)
    setConfirmed(false)

    const done = (part) => setReady((r) => (r[part] ? r : { ...r, [part]: true }))

    // « Disponible hors-ligne » : toutes les parties confirmées par le
    // serveur en même temps. Tenu hors de l'état React — l'heure de synchro
    // vit dans offlineService, seul l'indicateur se redessine.
    const fresh = {}
    const sync = (part) => (fromServer) => {
      fresh[part] = fromServer
      const all = PARTS.every((p) => fresh[p])
      setConfirmed(all)
      if (fromServer && all) markSynced(tripId)
    }

    const unsubs = [
      subscribeToStays(tripId, (x) => { setStays(x); done('stays') }, () => done('stays'), sync('stays')),
      subscribeToTransports(tripId, (x) => { setTransports(x); done('transports') }, () => done('transports'), sync('transports')),
      subscribeToDays(tripId, (x) => { setDays(x); done('days') }, () => done('days'), sync('days')),
      subscribeToAttachments(tripId, (x) => { setAttachments(x); done('attachments') }, () => done('attachments'), sync('attachments')),
      subscribeToIdeas(tripId, (x) => { setIdeas(x); done('ideas') }, () => done('ideas'), sync('ideas')),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [tripId])

  return (
    <TripConfirmedContext.Provider value={isConfirmed}>
      <TripDataValue
        trip={trip}
        stays={stays}
        transports={transports}
        days={days}
        attachments={attachments}
        ideas={ideas}
        isLoading={!PARTS.every((p) => ready[p])}
      >
        {children}
      </TripDataValue>
    </TripConfirmedContext.Provider>
  )
}

/**
 * Ce qui se déduit du contenu d'un voyage, d'où qu'il vienne : les écoutes
 * du couple (ci-dessus) ou la vitrine d'un lien invité (guest/GuestApp.jsx),
 * qui ne publie pas les lieux à caser.
 */
export function TripDataValue({ trip, stays, transports, days, attachments, ideas = NO_IDEAS, isLoading, children }) {
  const tripId = trip.id

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
    ideas,
    dayKeys,
    timelines,
    nights,
    segments,
    colorIndexByStay,
    isLoading,
  }), [
    trip, tripId, stays, transports, days, stopsByDate, attachments, attachmentsByParent, ideas,
    dayKeys, timelines, nights, segments, colorIndexByStay, isLoading,
  ])

  return <TripDataContext.Provider value={value}>{children}</TripDataContext.Provider>
}

export function useTripData() {
  const ctx = useContext(TripDataContext)
  if (!ctx) throw new Error('useTripData doit être utilisé sous <TripDataProvider>')
  return ctx
}

/** Toutes les parties du voyage ouvert confirmées par le serveur, sans écriture en attente. */
export function useTripConfirmed() {
  return useContext(TripConfirmedContext)
}
