import { cn } from '@/shared/lib/utils.js'
import { formatDateFr } from '@/shared/lib/dates.js'
import { getStayKind, getTransportMode } from '../../config/reservations.js'
import { stayColor } from '../../config/palette.js'
import { daysBetween } from '../../utils/tripDates.js'
import { formatShortRange, plural } from '../../utils/format.js'

// Comment on PRÉSENTE une réservation, partout pareil : son icône, son titre,
// sa ligne de résumé.

export function resaTitle(kind, item) {
  if (kind === 'stay') return item.name
  const mode = getTransportMode(item.mode)
  if (item.ref) return item.mode === 'car' ? item.ref : `${mode.label} ${item.ref}`
  return [item.from.name, item.to.name].filter(Boolean).join(' → ') || mode.label
}

export function resaSummary(kind, item) {
  if (kind === 'stay') {
    const nights = daysBetween(item.checkIn.date, item.checkOut.date)
    return `${formatShortRange(item.checkIn.date, item.checkOut.date)} · ${plural(nights, 'nuit')}`
  }
  const places = [item.from.name, item.to.name].filter(Boolean).join(' → ')
  if (item.mode === 'car' || item.from.date !== item.to.date) {
    return [formatShortRange(item.from.date, item.to.date), places].filter(Boolean).join(' · ')
  }
  const times = [item.from.time, item.to.time].filter(Boolean).join(' → ')
  return [formatDateFr(item.from.date), times, item.ref ? places : null].filter(Boolean).join(' · ')
}

export function ResaIcon({ kind, item, colorIndex, size = 'md' }) {
  const Icon = kind === 'stay' ? getStayKind(item.kind).icon : getTransportMode(item.mode).icon
  return (
    <span
      className={cn(
        'shrink-0 rounded-xl flex items-center justify-center',
        size === 'lg' ? 'h-12 w-12' : 'h-10 w-10',
        kind === 'stay' ? stayColor(colorIndex).bar : 'bg-accent/10 text-accent',
      )}
    >
      <Icon size={size === 'lg' ? 22 : 18} />
    </span>
  )
}
