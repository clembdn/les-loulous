import { useEffect, useState } from 'react'
import { useOnline } from '@/shared/lib/useOnline.js'
import { searchPlaces } from '../services/placesService.js'
import { looksLikeUrl } from '../utils/mapsUrl.js'

const IDLE = { results: [], loading: false, failed: false }

/**
 * Des suggestions de lieux PENDANT la frappe (Photon / OpenStreetMap), sans
 * bouton « Chercher » : 300 ms après la dernière lettre, la recherche part ;
 * une lettre de plus annule la précédente. Rien sous deux lettres, rien pour
 * un lien (il se lit, il ne se cherche pas), rien hors-ligne.
 *
 * `near` biaise vers là où l'on est ce jour-là : « Gare » doit trouver celle
 * de la ville du jour, pas celle du premier hôtel du voyage.
 */
export function usePlaceSearch(query, { near = null, enabled = true, delayMs = 300 } = {}) {
  const online = useOnline()
  const [state, setState] = useState(IDLE)
  const q = (query || '').trim()
  const active = enabled && online && q.length >= 2 && !looksLikeUrl(q)
  const lat = near?.lat
  const lng = near?.lng

  useEffect(() => {
    if (!active) {
      setState(IDLE)
      return undefined
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, failed: false }))
    const timer = setTimeout(() => {
      const bias = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
      searchPlaces(q, { near: bias, signal: controller.signal })
        .then((results) => {
          // Les vrais lieux (musée, plage, café : une catégorie devinée)
          // avant les adresses : « Jeronimos » doit d'abord proposer le
          // monastère, pas le 8 de la rue du même nom.
          const ranked = [...results.filter((r) => r.category), ...results.filter((r) => !r.category)]
          if (!controller.signal.aborted) setState({ results: ranked, loading: false, failed: false })
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ results: [], loading: false, failed: true })
        })
    }, delayMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, q, lat, lng, delayMs])

  return { ...state, online }
}
