import { useEffect, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { subscribeToExercises } from '../services/exercisesService.js'
import { subscribeToProgram, emptyProgram } from '../services/programService.js'
import {
  subscribeToSession, subscribeToSessions, subscribeToSessionRange, subscribeToLastPerf,
} from '../services/sessionsService.js'
import { subscribeToWeights } from '../services/weightsService.js'
import { subscribeToNotes } from '../services/notesService.js'

// Catalogue d'exercices du profil connecté — cloisonné comme le reste.
export function useExercises() {
  const { currentUid } = useAuth()
  const [exercises, setExercises] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid) return undefined
    const unsub = subscribeToExercises(
      currentUid,
      (x) => { setExercises(x); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid])

  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))
  return { exercises, exerciseById: byId, isLoading }
}

// Programme du profil connecté pour une parité donnée : les lignes de chaque
// jour, et le nom de la séance qu'elles composent.
export function useProgram(parity) {
  const { currentUid } = useAuth()
  const [program, setProgram] = useState(emptyProgram)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid || !parity) return undefined
    setIsLoading(true)
    const unsub = subscribeToProgram(
      currentUid, parity,
      (p) => { setProgram(p); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid, parity])

  return { days: program.days, names: program.names, isLoading }
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
// `byInstance` pré-remplit la saisie de l'occurrence, `byExercise` donne
// l'aperçu du mouvement. C'est un cache : jamais la source des courbes.
const EMPTY_LAST_PERF = { byInstance: {}, byExercise: {} }

export function useLastPerf() {
  const { currentUid } = useAuth()
  const [lastPerf, setLastPerf] = useState(EMPTY_LAST_PERF)
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

// Fenêtre bornée de séances — calendrier de régularité (90 jours).
export function useSessionRange(startKey, endKey) {
  const { currentUid } = useAuth()
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid || !startKey || !endKey) return undefined
    setIsLoading(true)
    const unsub = subscribeToSessionRange(
      currentUid, startKey, endKey,
      (s) => { setSessions(s); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid, startKey, endKey])

  return { sessions, isLoading }
}

// Notes de réglages du profil connecté, indexées par exerciceId.
export function useNotes() {
  const { currentUid } = useAuth()
  const [notes, setNotes] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUid) return undefined
    const unsub = subscribeToNotes(
      currentUid,
      (n) => { setNotes(n); setIsLoading(false) },
      () => setIsLoading(false),
    )
    return () => unsub()
  }, [currentUid])

  return { notes, isLoading }
}
