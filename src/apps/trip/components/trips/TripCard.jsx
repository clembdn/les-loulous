import { Link } from 'react-router-dom'
import { CircleCheck, Pencil } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { tripProgress } from '../../utils/tripDates.js'
import { formatProgress, formatTripRange, plural } from '../../utils/format.js'
import { tripPath } from '../../config/navigation.js'
import { useSyncedAt } from '../../hooks/useSyncedAt.js'

// Une carte de la liste. Le voyage en cours s'ouvre sur « Aujourd'hui », les
// autres sur leurs jours. Le crayon est un bouton FRÈRE du lien, pas un
// enfant : un bouton dans un lien est invalide, et le clic ouvrirait les deux.
// « ✓ hors-ligne » : le voyage a été lu en entier sur cet appareil (cf.
// offlineService) — utile avant de partir, inutile une fois rentrés.
export default function TripCard({ trip, today, onEdit }) {
  const progress = tripProgress(trip, today)
  const ongoing = progress.status === 'ongoing'
  const past = progress.status === 'past'
  const offline = useSyncedAt(trip.id) !== null && !past

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-surface shadow-sm transition hover:shadow-md',
        ongoing && 'ring-2 ring-accent',
      )}
    >
      <Link
        to={tripPath(trip.id, ongoing ? 'aujourdhui' : 'jours')}
        className="relative block p-4 pr-14 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <p className={cn('text-[17px] font-semibold truncate', past ? 'text-muted' : 'text-fg')}>{trip.title}</p>
        <p className="text-[14px] text-muted mt-0.5 tabular">
          {formatTripRange(trip.startDate, trip.endDate)} · {plural(progress.length, 'jour')}
        </p>
        <p
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold',
            ongoing ? 'text-accent' : 'text-muted',
          )}
        >
          {ongoing && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
          {formatProgress(progress, trip.endDate)}
          {offline && (
            <span className="inline-flex items-center gap-1 font-normal text-muted" title="Lisible sans réseau sur cet appareil">
              · <CircleCheck size={12} className="text-emerald-600" aria-hidden="true" /> hors-ligne
            </span>
          )}
        </p>
      </Link>
      <button
        type="button"
        onClick={() => onEdit(trip)}
        className="absolute top-2.5 right-2.5 h-10 w-10 inline-flex items-center justify-center rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition"
        aria-label={`Modifier « ${trip.title} »`}
        title="Modifier"
      >
        <Pencil size={15} />
      </button>
    </div>
  )
}
