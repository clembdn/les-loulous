import { ExternalLink, Plus } from 'lucide-react'
import { formatDayFr, shiftDateKey } from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'

// Petits morceaux communs aux deux vues d'une journée (téléphone, desktop).

/** « Aujourd'hui » / « Demain » à côté de la date, quand c'est le cas. */
export function DayPill({ date, today }) {
  const label = date === today ? 'Aujourd’hui' : date === shiftDateKey(today, 1) ? 'Demain' : null
  if (!label) return null
  return <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent normal-case tracking-normal">{label}</span>
}

export function DayDate({ date, today, className }) {
  return (
    <p className={cn('flex items-center gap-2 text-xs text-muted', className)}>
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
      className={cn('inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition', className)}
    >
      Parcours dans Google Maps <ExternalLink size={11} />
    </a>
  )
}

export function AddStopButton({ onClick, disabled, className, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-sm text-muted transition hover:text-fg hover:border-accent disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      <Plus size={16} /> Ajouter une étape
    </button>
  )
}
