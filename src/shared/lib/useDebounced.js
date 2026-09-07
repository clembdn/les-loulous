import { useEffect, useState } from 'react'

/**
 * La valeur, mais seulement quand elle a cessé de bouger.
 *
 * Un champ de recherche produit une valeur par caractère. Quand ce qui pend au
 * bout est cher — déplier des années d'échéances récurrentes puis en rendre
 * toutes les lignes — chaque frappe paie le calcul entier, et le clavier
 * décroche sur téléphone.
 *
 * Ce qui est affiché reste la valeur brute (le champ répond au doigt) ; c'est
 * le CALCUL qui attend. Les deux ne servent pas la même chose et n'ont aucune
 * raison d'aller à la même vitesse.
 */
export function useDebounced(value, delayMs = 180) {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}
