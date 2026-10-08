import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { useTrips } from '../../context/TripsContext.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { usePackingActions } from '../../hooks/usePacking.js'
import { readPacking } from '../../services/packingService.js'
import { formatTripRange, plural } from '../../utils/format.js'
import { itemsToAdd } from '../../utils/packing.js'

/**
 * « Reprendre la valise d'un autre voyage » : ses affaires arrivent ici
 * décochées, pour les mêmes personnes, sans ce qui y est déjà. Les voyages
 * sans valise ne sont pas proposés.
 */
export default function CopyPackingSheet({ open, onClose }) {
  const { trips } = useTrips()
  const { tripId, packing } = useTripData()
  const actions = usePackingActions()
  const others = useMemo(
    () => trips.filter((t) => t.id !== tripId).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [trips, tripId],
  )
  // Lues à l'ouverture, une fois : `{ [tripId]: affaires }`.
  const [lists, setLists] = useState(null)

  useEffect(() => {
    if (!open || lists) return undefined
    let alive = true
    Promise.all(others.map((t) => readPacking(t.id).catch(() => [])))
      .then((all) => { if (alive) setLists(Object.fromEntries(others.map((t, i) => [t.id, all[i]]))) })
    return () => { alive = false }
  }, [open, lists, others])

  const withPacking = lists ? others.filter((t) => lists[t.id]?.length) : []

  function copy(trip) {
    actions.addMany(itemsToAdd(lists[trip.id], packing), `de « ${trip.title} »`)
    onClose()
  }

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Reprendre une valise"
      description="Ses affaires arrivent décochées, sans ce qui est déjà là."
    >
      {!lists ? (
        <p className="py-8 flex justify-center text-muted"><Loader2 className="animate-spin" /></p>
      ) : withPacking.length === 0 ? (
        <p className="py-6 text-[15px] text-muted text-center">Aucun autre voyage n’a encore de valise.</p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {withPacking.map((trip) => (
            <li key={trip.id}>
              <button type="button" onClick={() => copy(trip)} className="w-full min-h-14 flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 transition">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-fg truncate">{trip.title}</span>
                  <span className="block text-[13px] text-muted">
                    {formatTripRange(trip.startDate, trip.endDate)} · {plural(lists[trip.id].length, 'affaire')}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ThemedSheet>
  )
}
