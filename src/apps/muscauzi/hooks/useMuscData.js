import { useMemo } from 'react'
import { useMuscData } from '../context/MuscDataContext.jsx'

/**
 * Les lectures de séances qui demandent un DÉCOUPAGE.
 *
 * Ce fichier tenait aussi `useExercises`, `useProgram`, `useNotes` et
 * `useWeights`. Chacun ouvrait autrefois son propre `onSnapshot` ; une fois le
 * contexte devenu la source unique, ils n'étaient plus que des renvois d'une
 * ligne vers `useMuscData()` — et plus personne ne les appelait, les cinq vues
 * lisant le contexte directement. Une couche d'indirection que rien ne
 * traversait n'est pas une couche, c'est un détour à maintenir.
 *
 * Ne restent que les deux lectures qui font un vrai travail par-dessus le
 * contexte : borner une fenêtre, et nommer l'historique complet.
 */

/**
 * Fenêtre bornée de séances.
 *
 * Elle se découpe dans celle que le contexte tient déjà plutôt que d'ouvrir une
 * seconde requête : tous les appelants demandent moins que ça.
 */
export function useSessionRange(startKey, endKey) {
  const { recentSessions, isLoading } = useMuscData()
  const sessions = useMemo(
    () => recentSessions.filter((s) => s.date >= startKey && s.date <= endKey),
    [recentSessions, startKey, endKey],
  )
  return { sessions, isLoading }
}

// Historique COMPLET — tenu par le contexte, comme le reste.
//
// Il ouvrait sa propre écoute non bornée, en plus de la fenêtre glissante du
// contexte : deux lectures de la même collection, décalées, dont l'une pouvait
// afficher une séance que l'autre n'avait pas encore. Les records personnels
// ont demandé l'historique entier partout ; il n'y a plus qu'un tableau.
export function useSessions() {
  const { sessions, isLoading } = useMuscData()
  return { sessions, isLoading }
}
