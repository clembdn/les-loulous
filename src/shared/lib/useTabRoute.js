import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Navigation interne d'une app, portée par l'URL plutôt que par un `useState`.
 *
 * Tant que l'onglet courant vivait dans un état React, l'app entière n'occupait
 * qu'une seule entrée d'historique : le bouton retour du téléphone sautait
 * par-dessus tout le parcours pour retomber sur l'écran de choix des apps.
 * Chaque écran a maintenant son chemin (`/muscauzi/progres`), donc sa propre
 * entrée : retour = écran précédent, et un lien vers un écran précis se partage.
 *
 * @param base      racine de l'app, sans slash final (« /muscauzi »)
 * @param ids       identifiants d'écran valides
 * @param fallback  écran affiché à la racine de l'app
 * @returns {{ tab, sub, goTab, goBack }} `sub` est le second segment
 *          (« /muscauzi/progres/<exerciseId> ») : la sous-page d'un écran.
 */
export function useTabRoute(base, ids, fallback) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const segments = pathname.startsWith(base)
    ? pathname.slice(base.length).split('/').filter(Boolean)
    : []
  const known = ids.includes(segments[0])
  const tab = known ? segments[0] : fallback
  const sub = known && segments[1] ? decodeURIComponent(segments[1]) : null

  // `/muscauzi` (le lien du dashboard) ou un écran inconnu (vieux marque-page)
  // → l'écran par défaut. En `replace` : cette redirection ne doit pas coûter
  // une pression sur « retour ».
  useEffect(() => {
    if (!known) navigate(`${base}/${fallback}`, { replace: true })
  }, [known, base, fallback, navigate])

  /**
   * `replace` : pour un changement qui ne mérite pas son propre « retour » —
   * passer d'un jour au suivant dans le même écran ne doit pas obliger à
   * remonter tous les jours consultés un par un pour sortir.
   */
  const goTab = useCallback((nextTab, nextSub = null, { replace = false } = {}) => {
    const next = [base, nextTab, nextSub && encodeURIComponent(nextSub)]
      .filter(Boolean)
      .join('/')
    // Retaper sur l'onglet déjà ouvert ne doit pas empiler un doublon dans
    // l'historique, sinon « retour » ne fait visuellement rien.
    if (next !== pathname) navigate(next, { replace })
  }, [base, navigate, pathname])

  /**
   * Fermer une sous-page : on redescend d'un cran dans l'historique plutôt que
   * d'empiler le chemin du parent — sans quoi le retour du navigateur rouvrirait
   * la sous-page qu'on vient de quitter. `idx` est l'index de l'entrée courante
   * dans la pile de React Router ; à 0, on est arrivé directement ici (lien
   * partagé, PWA rouverte) et il n'y a rien derrière.
   */
  const goBack = useCallback((fallbackPath) => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(fallbackPath, { replace: true })
  }, [navigate])

  return { tab, sub, goTab, goBack }
}
