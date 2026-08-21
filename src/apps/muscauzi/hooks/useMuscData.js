import { useEffect, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { subscribeToExercises } from '../services/exercisesService.js'
import { subscribeToProgram, emptyProgram } from '../services/programService.js'
import { subscribeToSession, subscribeToSessions, subscribeToLastPerf } from '../services/sessionsService.js'
import { subscribeToWeights } from '../services/weightsService.js'

// Catalogue d'exercices — commun aux deux profils, donc hors du cloisonnement.
export function useExercises() {
  const [exercises, setExercises] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeToExercises(
      (x) => { setExercises(x); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [])

  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))
  return { exercises, exerciseById: byId, isLoading }
}

// Programme du profil connecté pour une parité donnée.
export function useProgram(parity) {
  const { currentUid } = useAuth()
  const [days, setDays] = useState(emptyProgram)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid || !parity) return undefined
    setIsLoading(true)
    const unsub = subscribeToProgram(
      currentUid, parity,
      (d) => { setDays(d); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid, parity])

  return { days, isLoading }
}

export function useSession(dateId) {
  const { currentUid } = useAuth()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid || !dateId) return undefined
    setIsLoading(true)
    const unsub = subscribeToSession(
      currentUid, dateId,
      (s) => { setSession(s); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid, dateId])

  return { session, isLoading }
}

// Une seule lecture pour tous les rappels « dernière fois » de la séance.
export function useLastPerf() {
  const { currentUid } = useAuth()
  const [lastPerf, setLastPerf] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid) return undefined
    const unsub = subscribeToLastPerf(
      currentUid,
      (p) => { setLastPerf(p); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid])

  return { lastPerf, isLoading }
}

// Historique complet — chargé seulement par l'écran Progrès.
export function useSessions() {
  const { currentUid } = useAuth()
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid) return undefined
    const unsub = subscribeToSessions(
      currentUid,
      (s) => { setSessions(s); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid])

  return { sessions, isLoading }
}

export function useWeights() {
  const { currentUid } = useAuth()
  const [weights, setWeights] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid) return undefined
    const unsub = subscribeToWeights(
      currentUid,
      (w) => { setWeights(w); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid])

  return { weights, isLoading }
}
