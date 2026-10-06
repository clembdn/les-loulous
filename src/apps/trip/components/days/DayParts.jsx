import { ExternalLink } from 'lucide-react'
import { formatDayFr, shiftDateKey } from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'

// Petits morceaux communs aux deux vues d'une journée (téléphone, desktop).

/** « Aujourd'hui » / « Demain » à côté de la date, quand c'est le cas. */
export function DayPill({ date, today }) {
  const label = date === today ? 'Aujourd’hui' : date === shiftDateKey(today, 1) ? 'Demain' : null
  if (!label) return null
  return <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-semibold text-accent">{label}</span>
}

export function DayDate({ date, today, className }) {
  return (
    <p className={cn('flex items-center gap-2 text-[13px] text-muted', className)}>
      <span className="first-letter:uppercase">{formatDayFr(date)}</span>
      <DayPill date={date} today={today} />
    </p>
  )
}

/** Le parcours complet du jour, ouvert dans Google Maps. */
export function RouteLink({ url, className }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn('inline-flex items-center gap-1 text-[13px] text-muted hover:text-accent transition', className)}
    >
      Parcours dans Google Maps <ExternalLink size={11} />
    </a>
  )
}
