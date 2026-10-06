import { Pencil } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useToday } from '@/shared/lib/useToday.js'
import { tripProgress } from '../../utils/tripDates.js'
import { formatProgress, formatTripRange, plural } from '../../utils/format.js'
import OfflineBadge from '../OfflineBadge.jsx'

// L'en-tête d'un voyage sur ordinateur : où on en est, son titre, ses dates —
// et de quoi le modifier, et s'il est disponible hors-ligne. Sur téléphone,
// le titre est déjà dans la barre du haut. `actions` reçoit les boutons
// propres à l'écran.
export default function TripHeader({ trip, onEdit, actions, className }) {
  const today = useToday()
  const progress = tripProgress(trip, today)
  return (
    <header className={cn('flex items-start gap-3', className)}>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-semibold', progress.status === 'ongoing' ? 'text-accent' : 'text-muted')}>
          {formatProgress(progress, trip.endDate)}
        </p>
        <h1 className="mt-0.5 text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-fg truncate">{trip.title}</h1>
        <p className="mt-0.5 text-[15px] text-muted tabular">
          {formatTripRange(trip.startDate, trip.endDate)} · {plural(progress.length, 'jour')}
        </p>
        <OfflineBadge tripId={trip.id} className="mt-1.5" />
      </div>
      <div className="shrink-0 flex items-center gap-2 mt-1">
        {actions}
        <button
          type="button"
          onClick={onEdit}
          className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-muted hover:text-fg hover:bg-surface transition"
          aria-label="Modifier le voyage"
          title="Modifier le voyage"
        >
          <Pencil size={17} />
        </button>
      </div>
    </header>
  )
}
