import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useOnline } from '@/shared/lib/useOnline.js'
import { useToday } from '@/shared/lib/useToday.js'
import { useTripConfirmed, useTripData } from '../context/TripDataContext.jsx'
import { saveDay } from '../services/daysService.js'
import { fetchRun } from '../services/routesService.js'
import { legRuns, mergeLegs, missingLegs, routedLegs } from '../utils/legs.js'
import { timelineLegs } from '../utils/route.js'

// OpenRouteService : 40 requêtes par minute au plus.
const REQUEST_GAP_MS = 1600
// Laisser retomber une rafale de modifications avant de calculer.
const START_DELAY_MS = 1500

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * Calcule en tâche de fond les trajets qui manquent au voyage ouvert, une
 * journée à la fois (aujourd'hui et la suite d'abord), et les range dans le
 * jour. Chaque trajet n'est calculé qu'une fois : ensuite il est en base, lu
 * hors-ligne, montré aux invités, sans nouvel appel.
 *
 * Comme les vitrines invité (TripSharesContext) : seulement en ligne et sur
 * des données confirmées par le serveur — on ne calcule pas l'ancienne
 * version d'une journée que l'autre vient de modifier.
 */
export function useRouteFiller() {
  const { currentUid } = useAuth()
  const online = useOnline()
  const today = useToday()
  const { tripId, days, dayKeys, timelines, isLoading } = useTripData()
  const isConfirmed = useTripConfirmed()
  const busy = useRef(false)
  // Ce qui a déjà été tenté n'est retenté que si la journée change (ou au
  // retour du réseau) : ni boucle sur un échec, ni sur un trajet qui ne
  // rentre plus dans le jour. Sans clé, plus rien jusqu'au prochain chargement.
  const tried = useRef(new Set())
  const disabled = useRef(false)
  const [settled, setSettled] = useState(0)

  useEffect(() => {
    if (online) tried.current.clear()
  }, [online])

  useEffect(() => {
    if (!online || isLoading || !isConfirmed || busy.current || disabled.current) return undefined
    const order = [...dayKeys.filter((d) => d >= today), ...dayKeys.filter((d) => d < today).reverse()]
    let job = null
    for (const date of order) {
      const routed = routedLegs(timelineLegs(timelines[date] || []), days[date]?.legs)
      const missing = missingLegs(routed)
      if (!missing.length) continue
      const signature = `${date}|${missing.map((l) => `${l.key}:${l.mode}`).join(',')}`
      if (tried.current.has(signature)) continue
      job = { date, routed, missing, signature }
      break
    }
    if (!job) return undefined

    const timer = setTimeout(async () => {
      busy.current = true
      tried.current.add(job.signature)
      try {
        const results = {}
        for (const [i, run] of legRuns(job.missing).entries()) {
          if (i > 0) await wait(REQUEST_GAP_MS)
          for (const [key, result] of await fetchRun(run)) results[key] = result
        }
        // Pas attendu : hors-ligne entre-temps, l'écriture partira au retour du réseau.
        saveDay(tripId, job.date, { legs: mergeLegs(job.routed, results) }, days[job.date], currentUid)
          .catch((err) => console.warn('[Trip] trajets non enregistrés :', err))
      } catch (err) {
        if (err.fatal) disabled.current = true
        console.warn('[Trip] trajets non calculés :', err.message)
      } finally {
        await wait(REQUEST_GAP_MS)
        busy.current = false
        setSettled((n) => n + 1)
      }
    }, START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [online, isLoading, isConfirmed, dayKeys, timelines, days, today, tripId, currentUid, settled])
}

/** Monté dans un voyage ouvert par le couple (jamais pour un invité). */
export function RouteFiller() {
  useRouteFiller()
  return null
}
