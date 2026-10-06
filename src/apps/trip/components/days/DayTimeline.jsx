import { BedDouble, GripVertical, Paperclip } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { getCategory } from '../../config/categories.js'
import { getStayKind, getTransportMode } from '../../config/reservations.js'
import { stayColor } from '../../config/palette.js'
import { directionsUrl } from '../../utils/mapsUrl.js'
import { formatDistance, hasCoords } from '../../utils/geo.js'
import { formatDuration } from '../../utils/format.js'
import { pastKeys } from '../../utils/timeline.js'
import { transportText } from './itemText.js'

// En dessous, on marche ; au-dessus, Google choisit le mode habituel.
const WALKING_MAX_M = 1500

/**
 * La frise d'une journée : étapes numérotées (les numéros de la mini-carte),
 * trajets réservés, arrivées et départs d'hébergement, et la distance entre
 * deux lieux avec son lien « Itinéraire ».
 *
 * `now` (« HH:MM ») grise ce qui est passé — l'écran Aujourd'hui (cf. `pastKeys`).
 * `dnd` active le glisser-déposer des étapes (éditeur desktop) :
 *   { draggingId, dropBeforeId, dropActive, onDragStart, onDragOver, onDrop, onDragEnd }
 * Une étape lâchée se range AVANT `dropBeforeId` (en fin de liste s'il est nul).
 */
export default function DayTimeline({ items, legs = {}, attachmentsByParent = {}, colorIndexByStay = {}, onStop, onResa, now = null, dnd = null }) {
  if (!items.length) return null

  // La première étape qui suit l'élément `i` : c'est devant elle qu'on range
  // une étape lâchée sur un trajet ou un hébergement (qui, eux, ne bougent pas).
  const nextStopId = (i) => items.slice(i + 1).find((it) => it.type === 'stop')?.stop.id ?? null
  const done = now ? pastKeys(items, now) : null

  return (
    <ol className="relative">
      {items.map((item, i) => {
        const past = done?.has(item.key)
        const leg = legs[item.key]
        const indicator = dnd?.dropActive && item.type === 'stop' && dnd.dropBeforeId === item.stop.id
        return (
          <li key={item.key}>
            {indicator && <DropLine />}
            <div
              className={cn('transition-opacity', past && 'opacity-45', dnd?.draggingId && item.stop?.id === dnd.draggingId && 'opacity-40')}
              draggable={!!dnd && item.type === 'stop'}
              onDragStart={dnd && item.type === 'stop' ? (e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', item.stop.id)
                dnd.onDragStart(item.stop.id)
              } : undefined}
              onDragOver={dnd ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const upper = e.clientY < rect.top + rect.height / 2
                dnd.onDragOver(e, item.type === 'stop' && upper ? item.stop.id : nextStopId(i))
              } : undefined}
              onDrop={dnd ? (e) => dnd.onDrop(e) : undefined}
              onDragEnd={dnd ? () => dnd.onDragEnd() : undefined}
            >
              {item.type === 'stop' && <StopRow item={item} onClick={() => onStop(item.stop)} draggable={!!dnd} />}
              {item.type === 'transport' && (
                <TransportRow
                  item={item}
                  attachments={attachmentsByParent[item.transport.id]}
                  onClick={() => onResa('transport', item.transport.id)}
                />
              )}
              {(item.type === 'checkin' || item.type === 'checkout') && (
                <StayEventRow
                  item={item}
                  colorIndex={colorIndexByStay[item.stay.id]}
                  attachments={attachmentsByParent[item.stay.id]}
                  onClick={() => onResa('stay', item.stay.id)}
                />
              )}
            </div>
            {leg && <LegRow leg={leg} />}
          </li>
        )
      })}
      {dnd?.dropActive && dnd.dropBeforeId === null && <li><DropLine /></li>}
    </ol>
  )
}

function DropLine() {
  return <div aria-hidden="true" className="h-0.5 my-0.5 ml-[54px] rounded-full bg-accent" />
}

// Grille commune : heure · repère · contenu.
const ROW = 'w-full grid grid-cols-[44px_24px_minmax(0,1fr)] gap-2.5 items-start py-2 text-left rounded-xl transition hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function Time({ value }) {
  return <span className="font-mono text-xs text-muted leading-6 tabular pl-1">{value || '—'}</span>
}

function StopRow({ item, onClick, draggable }) {
  const { stop, number } = item
  const category = getCategory(stop.category)
  const Icon = category.icon
  const located = hasCoords(stop)
  const meta = [category.label, formatDuration(stop.durationMin)].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={onClick} className={cn(ROW, 'group')}>
      <Time value={stop.time} />
      <span
        className={cn(
          'h-6 w-6 rounded-full font-mono text-[11px] font-semibold flex items-center justify-center',
          located ? 'bg-fg text-bg' : 'border border-dashed border-border-strong text-muted',
        )}
        title={located ? undefined : 'Pas encore localisé : absent de la carte'}
      >
        {number}
      </span>
      <span className="min-w-0 flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg leading-6 truncate">{stop.name}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Icon size={12} className="shrink-0" /> {meta}
            {!located && <span className="text-amber-700">· à localiser</span>}
          </span>
          {stop.notes && <span className="block text-xs text-faint mt-0.5 line-clamp-2">{stop.notes}</span>}
        </span>
        {draggable && (
          <GripVertical size={16} className="mt-1 shrink-0 text-faint opacity-0 group-hover:opacity-100 cursor-grab" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}

function TransportRow({ item, attachments, onClick }) {
  const mode = getTransportMode(item.transport.mode)
  const Icon = mode.icon
  const { title, sub } = transportText(item)
  return (
    <button type="button" onClick={onClick} className={ROW}>
      <Time value={item.time} />
      <span className="h-6 w-6 rounded-full bg-accent/10 text-accent flex items-center justify-center">
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-fg leading-6">
          <span className="truncate">{title}</span>
          {attachments?.length > 0 && <Paperclip size={12} className="shrink-0 text-faint" />}
        </span>
        <span className="block text-xs text-muted truncate">{sub}</span>
      </span>
    </button>
  )
}

function StayEventRow({ item, colorIndex, attachments, onClick }) {
  const { stay } = item
  const arriving = item.type === 'checkin'
  return (
    <button type="button" onClick={onClick} className={ROW}>
      <Time value={item.time} />
      <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-fg/70', stayColor(colorIndex).bar)}>
        <BedDouble size={13} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-fg leading-6">
          <span className="truncate">{arriving ? 'Arrivée' : 'Départ'} · {stay.name}</span>
          {attachments?.length > 0 && <Paperclip size={12} className="shrink-0 text-faint" />}
        </span>
        <span className="block text-xs text-muted truncate">
          {getStayKind(stay.kind).label}
          {arriving && stay.accessCode ? ` · ${stay.accessCode}` : ''}
        </span>
      </span>
    </button>
  )
}

function LegRow({ leg }) {
  const walking = leg.distanceM <= WALKING_MAX_M
  return (
    <div className="grid grid-cols-[44px_24px_minmax(0,1fr)] gap-2.5 items-center">
      <span />
      <span aria-hidden="true" className="justify-self-center h-5 border-l-2 border-dotted border-border-strong" />
      <a
        href={directionsUrl(leg.to, { origin: leg.from, mode: walking ? 'walking' : null })}
        target="_blank"
        rel="noreferrer"
        className="justify-self-start text-[11.5px] text-faint hover:text-accent transition"
        title="À vol d’oiseau — ouvrir l’itinéraire dans Google Maps"
      >
        ≈ {formatDistance(leg.distanceM)} · Itinéraire ↗
      </a>
    </div>
  )
}
