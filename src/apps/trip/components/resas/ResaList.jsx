import { ArrowRight, Paperclip } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDateFr, formatDayFr } from '@/shared/lib/dates.js'
import { getStayKind, getTransportMode } from '../../config/reservations.js'
import { stayColor, TRANSPORT_COLOR } from '../../config/palette.js'
import { daysBetween } from '../../utils/tripDates.js'
import { formatPrice, formatShortRange, plural } from '../../utils/format.js'

/**
 * Les réservations comme des cartes d'embarquement : groupées par jour (en-têtes
 * collants), une bande à la couleur du séjour (ou bleu nuit pour un trajet),
 * et en gros ce qu'on montre au comptoir — le code, la place, la référence.
 */
export default function ResaList({ entries, selectedKey, attachmentsByParent, colorIndexByStay, onSelect }) {
  const groups = []
  for (const entry of entries) {
    const date = entry.start.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last?.date === date) last.entries.push(entry)
    else groups.push({ date, entries: [entry] })
  }
  return (
    <div>
      {groups.map((group) => (
        <section key={group.date}>
          <h2 className="sticky top-12 lg:top-0 z-[1] -mx-1 px-2 pt-4 pb-2 bg-bg text-[15px] font-semibold text-fg first-letter:uppercase">
            {formatDayFr(group.date)}
          </h2>
          <ul className="space-y-2.5">
            {group.entries.map(({ key, kind, item }) => (
              <li key={key}>
                <ResaPass
                  kind={kind}
                  item={item}
                  active={key === selectedKey}
                  files={attachmentsByParent[item.id]?.length || 0}
                  color={kind === 'stay' ? stayColor(colorIndexByStay[item.id]).hex : TRANSPORT_COLOR.hex}
                  onClick={() => onSelect(kind, item.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ResaPass({ kind, item, active, files, color, onClick }) {
  const isStay = kind === 'stay'
  const mode = isStay ? null : getTransportMode(item.mode)
  const Icon = isStay ? getStayKind(item.kind).icon : mode.icon
  const label = isStay ? getStayKind(item.kind).label : [mode.short || mode.label, item.mode !== 'car' && item.ref].filter(Boolean).join(' · ')
  const title = isStay
    ? item.name
    : item.mode === 'car'
      ? item.ref || mode.label
      : [item.from.name, item.to.name].filter(Boolean).join(' → ') || item.ref || mode.label
  const keyValue = isStay
    ? item.accessCode && { label: 'Code', value: item.accessCode }
    : item.seat && { label: 'Place', value: item.seat }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex rounded-[18px] bg-surface text-left overflow-hidden shadow-sm transition hover:shadow-md',
        active && 'ring-2 ring-accent',
      )}
    >
      <span className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 px-3.5 py-3">
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span className="h-6 w-6 shrink-0 rounded-md text-white flex items-center justify-center" style={{ backgroundColor: color }}>
            <Icon size={14} />
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-fg/80">{label}</span>
          {item.price != null && <span className="shrink-0 tabular">{formatPrice(item.price, item.currency)}</span>}
        </span>
        <span className="mt-1.5 block text-[17px] font-semibold text-fg truncate">{title}</span>

        {isStay ? (
          <span className="mt-0.5 block text-[14px] text-muted">
            {formatShortRange(item.checkIn.date, item.checkOut.date)} · {plural(daysBetween(item.checkIn.date, item.checkOut.date), 'nuit')}
            {item.checkIn.time ? ` · arrivée ${item.checkIn.time}` : ''}
          </span>
        ) : (
          <span className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
            <Moment point={item.from} />
            <span className="h-px bg-border-strong relative">
              <ArrowRight size={14} className="absolute left-1/2 -top-[7px] -ml-[7px] bg-surface text-muted" aria-hidden="true" />
            </span>
            <Moment point={item.to} end />
          </span>
        )}

        {(keyValue || item.confirmation || files > 0) && (
          <span className="mt-3 pt-2.5 border-t border-dashed border-border-strong flex items-end gap-5">
            {keyValue && (
              <span>
                <span className="block text-[12px] text-muted">{keyValue.label}</span>
                <span className="block font-mono text-[22px] leading-7 font-semibold tracking-wide text-fg">{keyValue.value}</span>
              </span>
            )}
            {item.confirmation && (
              <span className="min-w-0">
                <span className="block text-[12px] text-muted">Référence</span>
                <span className="block font-mono text-[15px] font-medium text-fg truncate">{item.confirmation}</span>
              </span>
            )}
            {files > 0 && (
              <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[12px] text-muted">
                <Paperclip size={12} aria-hidden="true" /> {plural(files, 'capture')}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  )
}

function Moment({ point, end = false }) {
  return (
    <span className={cn('min-w-0', end && 'text-right')}>
      <span className="block font-mono text-[20px] leading-6 font-semibold text-fg tabular">{point.time || '—'}</span>
      <span className="block text-[12px] text-muted truncate">{formatDateFr(point.date)}</span>
    </span>
  )
}
