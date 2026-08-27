import { useEffect, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { subscribeToWeights } from '@/apps/muscauzi/services/weightsService.js'

// Dernier poids connu, lu dans MuscAuzi (users/{uid}/weights).
//
// Dépendance assumée d'une app à l'autre : le poids est déjà saisi côté séances,
// le redemander ici serait une double saisie qui divergerait aussitôt. On tape
// le service feuille et pas le hook useMuscData, qui embarquerait tout MuscAuzi
// dans le bundle de Cook’It.
export function useLatestWeight() {
  const { currentUid } = useAuth()
  const [weight, setWeight] = useState(null)

  useEffect(() => {
    if (!currentUid) return undefined
    return subscribeToWeights(
      currentUid,
      (list) => setWeight(list.length ? list[list.length - 1] : null),
      () => setWeight(null),
    )
  }, [currentUid])

  return weight // { date, value } | null
}
