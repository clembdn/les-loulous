import { useState, useEffect } from 'react'

/**
 * Suit une media query depuis React.
 *
 * Utile quand la mise en page ne peut PAS se décider en CSS seul : ici, un
 * écran large affiche la liste et le détail côte à côte, tandis qu'un
 * téléphone navigue de l'un à l'autre. Ce sont deux arbres de composants
 * différents, pas deux habillages du même — les rendre tous les deux pour n'en
 * montrer qu'un ferait travailler deux fois pour rien.
 *
 * L'état initial est lu SYNCHRONEMENT : passer par un effet aurait affiché un
 * premier rendu en version téléphone avant de basculer, ce qui se voit.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    // La fenêtre a pu changer entre le premier rendu et cet effet.
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}
