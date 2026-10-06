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
        'group relative overflow-hidden rounded-2xl border bg-surface transition hover:border-border-strong hover:shadow-lift',
        ongoing ? 'border-accent/40' : 'border-border',
      )}
    >
      {ongoing && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.10] via-accent/[0.03] to-transparent" />
      )}
      <Link
        to={tripPath(trip.id, ongoing ? 'aujourdhui' : 'jours')}
        className="relative block p-4 pr-14 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <p className={cn('text-base font-semibold truncate', past ? 'text-muted' : 'text-fg')}>{trip.title}</p>
        <p className="text-sm text-muted mt-0.5 tabular">
          {formatTripRange(trip.startDate, trip.endDate)} · {plural(progress.length, 'jour')}
        </p>
        <p
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 text-xs font-medium',
            ongoing ? 'text-accent' : past ? 'text-faint' : 'text-muted',
          )}
        >
          {ongoing && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
          {formatProgress(progress, trip.endDate)}
          {offline && (
            <span className="inline-flex items-center gap-1 font-normal text-faint" title="Lisible sans réseau sur cet appareil">
              · <CircleCheck size={12} className="text-emerald-600" aria-hidden="true" /> hors-ligne
            </span>
          )}
        </p>
      </Link>
      <button
        type="button"
        onClick={() => onEdit(trip)}
        className="absolute top-3 right-3 h-9 w-9 inline-flex items-center justify-center rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition"
        aria-label={`Modifier « ${trip.title} »`}
        title="Modifier"
      >
        <Pencil size={15} />
      </button>
    </div>
  )
}
