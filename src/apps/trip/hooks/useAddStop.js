import { useCallback, useRef } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { confirm as haptic } from '@/shared/lib/haptics.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { DEFAULT_CATEGORY } from '../config/categories.js'
import { MAX_STOPS_PER_DAY, saveDay } from '../services/daysService.js'
import { guessCategory } from '../utils/categoryGuess.js'
import { newId } from '../utils/fields.js'
import { insertStopByTime } from '../utils/timeline.js'

/**
 * Ajouter une étape d'un geste — saisie rapide, lieu touché sur la carte,
 * lieu partagé depuis Google Maps. Pas de formulaire : le lieu, son heure si
 * on la connaît, la catégorie devinée. Le reste se complète en touchant
 * l'étape.
 *
 * Écrit sans attendre (hors-ligne compris) ; « Annuler » dans le message
 * remet la journée comme avant. Rend l'étape créée, ou `null` si la journée
 * est pleine.
 *
 * `place` : `{ name, address?, lat?, lng?, mapsUrl?, category? }`.
 */
export function useAddStop() {
  const { currentUid } = useAuth()
  const { tripId, days, stopsByDate, isLoading } = useTripData()
  // Annuler arrive plus tard : il doit voir la journée telle qu'elle est
  // devenue (le document existe désormais), pas celle d'avant l'ajout.
  const daysRef = useRef(days)
  daysRef.current = days

  return useCallback((date, place, { time = null } = {}) => {
    // La journée se réécrit en entier (son tableau d'étapes) : l'écrire avant
    // de l'avoir lue effacerait les étapes déjà prévues.
    if (isLoading) {
      toast('Le voyage se charge encore, réessayez dans un instant.')
      return null
    }
    const before = stopsByDate[date] || []
    if (before.length >= MAX_STOPS_PER_DAY) {
      toast.error(`${MAX_STOPS_PER_DAY} étapes maximum par jour`)
      return null
    }
    const name = (place.name || '').trim()
    if (!name) return null
    const stop = {
      id: newId(),
      name,
      address: place.address ?? null,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      mapsUrl: place.mapsUrl ?? null,
      time: time || null,
      durationMin: null,
      category: place.category || guessCategory({ name }) || DEFAULT_CATEGORY,
      notes: '',
    }
    saveDay(tripId, date, { stops: insertStopByTime(before, stop) }, days[date], currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
    haptic()
    toast.success(`« ${name} » ajouté${time ? ` à ${time}` : ''}`, {
      action: {
        label: 'Annuler',
        onClick: () => saveDay(tripId, date, { stops: before }, daysRef.current[date], currentUid)
          .catch(() => toast.error('Impossible d’annuler')),
      },
    })
    return stop
  }, [tripId, days, stopsByDate, isLoading, currentUid])
}
