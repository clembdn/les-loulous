import { useCallback, useEffect, useMemo, useState } from 'react'
import { toLocalDateKey } from '@/shared/lib/dates.js'

function stampOf(d = new Date()) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${toLocalDateKey(d)}T${h}:${m}`
}

/**
 * Le jour ET l'heure murale, `{ today: 'AAAA-MM-JJ', time: 'HH:MM' }`, justes
 * à la minute — l'horloge de l'écran Aujourd'hui : « dans 1 h 20 », le passé
 * grisé, la prochaine étape, et la bascule sur le lendemain à minuit.
 *
 * Comme useToday (shared/lib) : un minuteur posé sur la prochaine minute
 * PILE, qui se repose à chaque tic (un intervalle de 60 s dériverait), et un
 * recalage au retour de visibilité ou de focus — un téléphone en veille
 * n'exécute pas ses minuteurs, on ne veut pas lire « dans 40 min » pour un
 * train déjà parti.
 */
export function useNow() {
  const [stamp, setStamp] = useState(stampOf)

  const sync = useCallback(() => {
    setStamp((current) => {
      const next = stampOf()
      return next === current ? current : next
    })
  }, [])

  useEffect(() => {
    let timer
    const schedule = () => {
      const now = new Date()
      // 50 ms de marge : ne pas tirer pile sur la frontière et relire la même minute.
      const wait = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50
      timer = setTimeout(() => { sync(); schedule() }, wait)
    }
    const onVisible = () => { if (!document.hidden) sync() }

    schedule()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sync])

  return useMemo(() => ({ today: stamp.slice(0, 10), time: stamp.slice(11) }), [stamp])
}
