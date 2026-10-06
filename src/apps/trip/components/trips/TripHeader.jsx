import { Pencil } from 'lucide-react'
import { useToday } from '@/shared/lib/useToday.js'
import { tripProgress } from '../../utils/tripDates.js'
import { formatProgress, formatTripRange, plural } from '../../utils/format.js'
import OfflineBadge from '../OfflineBadge.jsx'

// L'en-tête d'un voyage : où on en est, son titre, ses dates — et de quoi le
// modifier, et s'il est disponible hors-ligne. `actions` reçoit les boutons
// propres à l'écran (desktop).
export default function TripHeader({ trip, onEdit, actions }) {
  const today = useToday()
  const progress = tripProgress(trip, today)
  return (
    <header className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">{formatProgress(progress, trip.endDate)}</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1 truncate">{trip.title}</h1>
        <p className="text-sm text-muted mt-0.5 tabular">
          {formatTripRange(trip.startDate, trip.endDate)} · {plural(progress.length, 'jour')}
        </p>
        <OfflineBadge tripId={trip.id} className="mt-1" />
      </div>
      <div className="shrink-0 flex items-center gap-2 mt-1">
        {actions}
        <button
          type="button"
          onClick={onEdit}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition"
          aria-label="Modifier le voyage"
          title="Modifier le voyage"
        >
          <Pencil size={16} />
        </button>
      </div>
    </header>
  )
}
