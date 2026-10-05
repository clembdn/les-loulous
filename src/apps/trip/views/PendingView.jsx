import { useToday } from '@/shared/lib/useToday.js'
import { tripProgress } from '../utils/tripDates.js'
import { formatProgress, formatTripRange, plural } from '../utils/format.js'
import { TRIP_TABS } from '../config/navigation.js'

// PROVISOIRE — lot 1. Les écrans Jours et Résas arrivent au lot 2,
// Aujourd'hui au lot 3 ; ce fichier disparaît avec eux.
const LOT_BY_TAB = { jours: 2, resas: 2, aujourdhui: 3 }

export default function PendingView({ trip, tab }) {
  const today = useToday()
  const progress = tripProgress(trip, today)
  const label = TRIP_TABS.find((t) => t.id === tab)?.label || tab

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <p className="text-xs uppercase tracking-[0.18em] text-faint">{formatProgress(progress, trip.endDate)}</p>
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">{trip.title}</h1>
      <p className="text-sm text-muted mt-1 tabular">
        {formatTripRange(trip.startDate, trip.endDate)} · {plural(progress.length, 'jour')}
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-sm text-muted">
        L’écran « {label} » arrive avec le lot {LOT_BY_TAB[tab]}.
      </div>
    </div>
  )
}
