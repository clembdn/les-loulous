import { useMemo } from 'react'
import { useMuscData } from '../context/MuscDataContext.jsx'

/**
 * Les hooks de données de MuscAuzi.
 *
 * Ils ouvraient chacun leur propre `onSnapshot`. L'écran de séance restant
 * monté en permanence, ouvrir Progrès rouvrait par-dessus le catalogue, les
 * notes et les pesées : sept à huit écoutes simultanées pour cinq jeux de
 * données, et autant d'occasions de voir deux écrans afficher deux versions de
 * la même chose.
 *
 * Ce ne sont plus que des lectures du contexte (`context/MuscDataContext.jsx`),
 * qui tient l'unique jeu d'abonnements. Aucun d'eux n'ouvre plus rien.
 */

export function useExercises() {
  const { exercises, exerciseById, catalogueReady } = useMuscData()
  return { exercises, exerciseById, isLoading: !catalogueReady }
}

export function useProgram(parity) {
  const { programs, isLoading } = useMuscData()
  const program = programs[parity] || programs.odd
  return { days: program.days, names: program.names, isLoading }
}

export function useNotes() {
  const { notes, isLoading } = useMuscData()
  return { notes, isLoading }
}

export function useWeights() {
  const { weights, isLoading } = useMuscData()
  return { weights, isLoading }
}

/**
 * Fenêtre bornée de séances.
 *
 * Elle se découpe dans celle que le contexte tient déjà (120 jours) plutôt que
 * d'ouvrir une seconde requête : tous les appelants demandent moins que ça.
 */
export function useSessionRange(startKey, endKey) {
  const { recentSessions, isLoading } = useMuscData()
  const sessions = useMemo(
    () => recentSessions.filter((s) => s.date >= startKey && s.date <= endKey),
    [recentSessions, startKey, endKey],
  )
  return { sessions, isLoading }
}

// Historique COMPLET — désormais tenu par le contexte, comme le reste.
//
// Il ouvrait sa propre écoute non bornée, en plus de la fenêtre glissante du
// contexte : deux lectures de la même collection, décalées, dont l'une pouvait
// afficher une séance que l'autre n'avait pas encore. Les records personnels
// ont demandé l'historique entier partout ; il n'y a plus qu'un tableau.
export function useSessions() {
  const { sessions, isLoading } = useMuscData()
  return { sessions, isLoading }
}
