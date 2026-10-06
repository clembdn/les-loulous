import { useCallback, useSyncExternalStore } from 'react'
import { getSyncedAt, subscribeSynced } from '../services/offlineService.js'

/** Dernière synchro complète du voyage sur cet appareil (ms), ou `null`. Cf. offlineService. */
export function useSyncedAt(tripId) {
  const read = useCallback(() => getSyncedAt(tripId), [tripId])
  return useSyncExternalStore(subscribeSynced, read)
}
