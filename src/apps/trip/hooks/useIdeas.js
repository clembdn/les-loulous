import { useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { confirm as haptic } from '@/shared/lib/haptics.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { DEFAULT_CATEGORY } from '../config/categories.js'
import { MAX_STOPS_PER_DAY } from '../services/daysService.js'
import { deleteIdea, placeIdea, saveIdea, shelveStop } from '../services/ideasService.js'
import { guessCategory } from '../utils/categoryGuess.js'
import { newId } from '../utils/fields.js'
import { closestDay, dayPoints, ideaToStop, ideasNear, sortIdeas, stopToIdea } from '../utils/ideas.js'
import { insertStopByTime } from '../utils/timeline.js'

/**
 * Les lieux à caser du voyage, du dernier repéré au premier, et où chacun
 * irait le mieux : `suggestions[id]` = `{ date, distanceM }` ou absent.
 * `pointsByDate` : les lieux connus de chaque jour (cf. utils/ideas.js).
 */
export function useIdeas() {
  const { ideas, dayKeys, timelines, nights, stopsByDate } = useTripData()
  const pointsByDate = useMemo(() => dayPoints(dayKeys, timelines, nights), [dayKeys, timelines, nights])
  const sorted = useMemo(() => sortIdeas(ideas), [ideas])
  const suggestions = useMemo(() => {
    const stopCounts = Object.fromEntries(Object.entries(stopsByDate).map(([d, s]) => [d, s.length]))
    const out = {}
    for (const idea of ideas) {
      const best = closestDay(idea, pointsByDate, { stopCounts })
      if (best) out[idea.id] = best
    }
    return out
  }, [ideas, pointsByDate, stopsByDate])
  return { ideas: sorted, pointsByDate, suggestions }
}

/** Les lieux à caser près d'une journée, du plus proche au plus lointain : `[{ idea, distanceM }]`. */
export function useNearbyIdeas(date) {
  const { ideas, pointsByDate } = useIdeas()
  const points = pointsByDate[date]
  return useMemo(() => ideasNear(ideas, points), [ideas, points])
}

/**
 * Repérer, placer, remettre à caser, supprimer — sans formulaire, sans
 * attendre (hors-ligne compris), avec « Annuler » dans le message.
 */
export function useIdeaActions() {
  const { currentUid } = useAuth()
  const { tripId, days, stopsByDate, isLoading } = useTripData()
  // « Annuler » arrive plus tard : il doit voir les journées telles qu'elles
  // sont devenues, pas celles d'avant le geste.
  const latest = useRef({ days, stopsByDate })
  latest.current = { days, stopsByDate }

  // Repérer n'a besoin de rien de chargé : un document à part, rien à relire.
  const add = useCallback((place) => {
    const name = (place.name || '').trim()
    if (!name) return null
    const idea = {
      id: newId(),
      name,
      address: place.address ?? null,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      mapsUrl: place.mapsUrl ?? null,
      category: place.category || guessCategory({ name }) || DEFAULT_CATEGORY,
      notes: place.notes || '',
    }
    saveIdea(tripId, idea, null, currentUid).catch(() => toast.error('Enregistrement impossible'))
    haptic()
    toast.success(`« ${name} » gardé à caser`, {
      action: { label: 'Annuler', onClick: () => deleteIdea(tripId, idea.id).catch(() => toast.error('Impossible d’annuler')) },
    })
    return idea
  }, [tripId, currentUid])

  const update = useCallback((idea, patch) => {
    saveIdea(tripId, { ...idea, ...patch }, idea, currentUid).catch(() => toast.error('Enregistrement impossible'))
  }, [tripId, currentUid])

  const remove = useCallback((idea) => {
    deleteIdea(tripId, idea.id).catch(() => toast.error('Suppression impossible'))
    toast(`« ${idea.name} » retiré`, {
      action: { label: 'Annuler', onClick: () => saveIdea(tripId, idea, idea, currentUid).catch(() => toast.error('Impossible de le remettre')) },
    })
  }, [tripId, currentUid])

  /**
   * Le lieu entre dans la journée : à son heure (`time`), ou avant l'étape
   * `beforeId` (glissé dans la frise ; `null` = en fin de journée). Rend
   * `false` si ce n'est pas possible.
   */
  const place = useCallback((idea, date, { time = null, beforeId } = {}) => {
    // La journée se réécrit en entier : l'écrire avant de l'avoir lue
    // effacerait les étapes déjà prévues.
    if (isLoading) {
      toast('Le voyage se charge encore, réessayez dans un instant.')
      return false
    }
    const before = stopsByDate[date] || []
    if (before.length >= MAX_STOPS_PER_DAY) {
      toast.error(`${MAX_STOPS_PER_DAY} étapes maximum par jour`)
      return false
    }
    const stop = ideaToStop(idea, time)
    const at = beforeId ? before.findIndex((s) => s.id === beforeId) : -1
    const stops = beforeId === undefined
      ? insertStopByTime(before, stop)
      : at === -1 ? [...before, stop] : [...before.slice(0, at), stop, ...before.slice(at)]
    placeIdea(tripId, idea.id, date, stops, days[date], currentUid).catch(() => toast.error('Enregistrement impossible'))
    haptic()
    toast.success(`« ${idea.name} » ajouté au ${formatDayFr(date)}`, {
      action: {
        label: 'Annuler',
        onClick: () => {
          const now = latest.current
          const without = (now.stopsByDate[date] || []).filter((s) => s.id !== idea.id)
          shelveStop(tripId, idea, date, without, now.days[date], currentUid, idea)
            .catch(() => toast.error('Impossible d’annuler'))
        },
      },
    })
    return true
  }, [tripId, days, stopsByDate, isLoading, currentUid])

  /** Une étape quitte sa journée et repart à caser. */
  const shelve = useCallback((date, stop) => {
    if (isLoading) return false
    const before = stopsByDate[date] || []
    const idea = stopToIdea(stop)
    shelveStop(tripId, idea, date, before.filter((s) => s.id !== stop.id), days[date], currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
    toast(`« ${stop.name} » remis à caser`, {
      action: {
        label: 'Annuler',
        onClick: () => placeIdea(tripId, stop.id, date, before, latest.current.days[date], currentUid)
          .catch(() => toast.error('Impossible d’annuler')),
      },
    })
    return true
  }, [tripId, days, stopsByDate, isLoading, currentUid])

  return { add, update, remove, place, shelve }
}
