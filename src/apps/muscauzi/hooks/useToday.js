import { useCallback, useEffect, useState } from 'react'
import { toLocalDateKey } from '@/shared/lib/dates.js'

/**
 * La date du jour, en clé locale, qui reste JUSTE.
 *
 * `useMemo(() => toLocalDateKey(new Date()), [])` figeait la date au montage.
 * Ça ne se voyait pas dans un onglet ouvert cinq minutes ; ça se voyait dans la
 * PWA installée, qu'on laisse ouverte et qu'on rouvre le lendemain matin en
 * arrivant à la salle : l'écran affichait encore la veille, se croyait en
 * « rattrapage », et le bouton « Aujourd'hui » ramenait à hier.
 *
 * Trois réveils, parce qu'aucun ne suffit seul :
 *  · minuit local — l'onglet reste au premier plan pendant la bascule ;
 *  · retour de visibilité — le téléphone a dormi, les minuteurs aussi ;
 *  · `focus` — la fenêtre revient sans que `visibilitychange` se déclenche.
 *
 * Le minuteur se recale à chaque changement de jour plutôt que de battre à
 * intervalle fixe : une seule alarme, posée à la seconde près.
 */
export function useToday() {
  const [today, setToday] = useState(() => toLocalDateKey(new Date()))

  const sync = useCallback(() => {
    setToday((current) => {
      const next = toLocalDateKey(new Date())
      return next === current ? current : next
    })
  }, [])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) sync() }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onVisible)

    // Minuit local + une seconde de marge, pour ne pas tirer pile sur la
    // frontière et relire la même date.
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
    const timer = setTimeout(sync, midnight - now)

    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer)
    }
    // `today` en dépendance : le minuteur se repose après chaque bascule.
  }, [sync, today])

  return today
}
