import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { shiftDateKey } from '@/shared/lib/dates.js'
import { subscribeToExercises } from '../services/exercisesService.js'
import { subscribeToProgram, emptyProgram } from '../services/programService.js'
import { subscribeToSessions } from '../services/sessionsService.js'
import { subscribeToWeights } from '../services/weightsService.js'
import { subscribeToNotes } from '../services/notesService.js'
import { useToday } from '../hooks/useToday.js'

/**
 * Source unique — UN jeu d'abonnements Firestore pour toute l'application.
 *
 * Chaque hook ouvrait auparavant son propre `onSnapshot`, et l'écran de séance
 * restant monté en permanence, ouvrir Progrès rouvrait par-dessus le catalogue,
 * les notes et les pesées : sept à huit écoutes simultanées pour cinq jeux de
 * données. Le cache Firestore encaissait, mais chaque écoute est un canal
 * ouvert, une facture de lectures, et une occasion de plus de voir deux écrans
 * afficher deux versions de la même chose.
 *
 * ── Pourquoi l'historique COMPLET, finalement ───────────────────────────────
 *
 * Une fenêtre glissante de 120 jours servait la séance du jour, l'écran Progrès
 * gardant sa propre lecture non bornée. Les records personnels ont tranché
 * autrement : un record est un record de toujours, pas des quatre derniers
 * mois, et le calculer sur une fenêtre en aurait fait un chiffre qui recule
 * tout seul avec le temps.
 *
 * Le coût est modeste et se paie une seule fois : un document par jour
 * d'entraînement, soit deux cents documents par an, relus ensuite depuis le
 * cache IndexedDB. Une lecture unique remplace donc deux écoutes, et les cinq
 * écrans lisent enfin le même tableau — plus de fenêtre à faire coïncider.
 *
 * `recentSessions` reste exposé : le calendrier de régularité et le bilan de
 * séance n'ont que faire de trois ans d'historique.
 */
const RECENT_DAYS = 120

const MuscDataContext = createContext(null)

const EMPTY = {
  today: '',
  exercises: [],
  exerciseById: {},
  programs: { even: emptyProgram(), odd: emptyProgram() },
  notes: {},
  weights: [],
  sessions: [],
  recentSessions: [],
  isLoading: true,
}

export function MuscDataProvider({ children }) {
  const { currentUid } = useAuth()
  const today = useToday()

  const [exercises, setExercises] = useState([])
  const [programs, setPrograms] = useState(() => ({ even: emptyProgram(), odd: emptyProgram() }))
  const [notes, setNotes] = useState({})
  const [weights, setWeights] = useState([])
  const [sessions, setSessions] = useState([])

  // Un drapeau par flux : « chargé » ne veut rien dire tant que le catalogue
  // n'est pas là pour donner un nom aux lignes du programme.
  const [ready, setReady] = useState({
    exercises: false, even: false, odd: false, notes: false, weights: false, sessions: false,
  })

  useEffect(() => {
    if (!currentUid) return undefined
    const done = (key) => setReady((r) => (r[key] ? r : { ...r, [key]: true }))

    const unsubs = [
      subscribeToExercises(
        currentUid,
        (x) => { setExercises(x); done('exercises') },
        () => done('exercises'),
      ),
      subscribeToProgram(
        currentUid, 'even',
        (p) => { setPrograms((prev) => ({ ...prev, even: p })); done('even') },
        () => done('even'),
      ),
      subscribeToProgram(
        currentUid, 'odd',
        (p) => { setPrograms((prev) => ({ ...prev, odd: p })); done('odd') },
        () => done('odd'),
      ),
      subscribeToNotes(
        currentUid,
        (n) => { setNotes(n); done('notes') },
        () => done('notes'),
      ),
      subscribeToWeights(
        currentUid,
        (w) => { setWeights(w); done('weights') },
        () => done('weights'),
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [currentUid])

  useEffect(() => {
    if (!currentUid) return undefined
    const done = () => setReady((r) => (r.sessions ? r : { ...r, sessions: true }))
    return subscribeToSessions(
      currentUid,
      (s) => { setSessions(s); done() },
      done,
    )
  }, [currentUid])

  // La fenêtre récente se découpe dans le tableau complet : ce qui a besoin
  // d'un horizon court (calendrier, bilan) n'a pas à filtrer lui-même.
  const rangeStart = useMemo(() => shiftDateKey(today, -RECENT_DAYS), [today])
  const recentSessions = useMemo(
    () => sessions.filter((s) => s.date >= rangeStart),
    [sessions, rangeStart],
  )

  const exerciseById = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const value = useMemo(() => ({
    today,
    exercises,
    exerciseById,
    programs,
    notes,
    weights,
    sessions,
    recentSessions,
    isLoading: !Object.values(ready).every(Boolean),
    // Le catalogue seul décide si une ligne de programme est orpheline ; les
    // vues en ont besoin séparément du chargement global.
    catalogueReady: ready.exercises,
  }), [today, exercises, exerciseById, programs, notes, weights, sessions, recentSessions, ready])

  return <MuscDataContext.Provider value={value}>{children}</MuscDataContext.Provider>
}

export function useMuscData() {
  return useContext(MuscDataContext) || EMPTY
}
