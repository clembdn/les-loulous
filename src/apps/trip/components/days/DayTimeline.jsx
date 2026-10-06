import { Footprints, GripVertical, Paperclip } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { getCategory } from '../../config/categories.js'
import { getStayKind } from '../../config/reservations.js'
import { directionsUrl } from '../../utils/mapsUrl.js'
import { formatDistance, hasCoords } from '../../utils/geo.js'
import { formatDuration } from '../../utils/format.js'
import { pastKeys } from '../../utils/timeline.js'
import ItemBadge from '../ItemBadge.jsx'
import { transportText } from './itemText.js'

// En dessous, on marche ; au-dessus, Google choisit le mode habituel.
const WALKING_MAX_M = 1500

/**
 * La frise d'une journée : étapes numérotées (les numéros et les couleurs de
 * la carte), trajets réservés, arrivées et départs d'hébergement, et la
 * distance entre deux lieux avec son lien « Itinéraire ».
 *
 * `now` (« HH:MM ») grise ce qui est passé — l'écran Aujourd'hui (cf. `pastKeys`).
 * `activeKey` / `onHover` : l'élément survolé, allumé en même temps sur la
 * carte (éditeur desktop).
 * `dnd` active le glisser-déposer des étapes (éditeur desktop) :
 *   { draggingId, dropBeforeId, dropActive, onDragStart, onDragOver, onDrop, onDragEnd }
 * Une étape lâchée se range AVANT `dropBeforeId` (en fin de liste s'il est nul).
 */
export default function DayTimeline({
  items, legs = {}, attachmentsByParent = {}, colorIndexByStay = {}, onStop, onResa,
  now = null, dnd = null, activeKey = null, onHover = null,
}) {
  if (!items.length) return null

  // La première étape qui suit l'élément `i` : c'est devant elle qu'on range
  // une étape lâchée sur un trajet ou un hébergement (qui, eux, ne bougent pas).
  const nextStopId = (i) => items.slice(i + 1).find((it) => it.type === 'stop')?.stop.id ?? null
  const done = now ? pastKeys(items, now) : null

  return (
    <ol className="relative" onMouseLeave={onHover ? () => onHover(null) : undefined}>
      {items.map((item, i) => {
        const past = !!done?.has(item.key)
        const leg = legs[item.key]
        const indicator = dnd?.dropActive && item.type === 'stop' && dnd.dropBeforeId === item.stop.id
        const row = {
          item,
          past,
          active: activeKey === item.key,
          colorIndexByStay,
          onMouseEnter: onHover ? () => onHover(item.key) : undefined,
        }
        return (
          <li key={item.key} data-key={item.key}>
            {indicator && <DropLine />}
            <div
              className={cn('transition-opacity', dnd?.draggingId && item.stop?.id === dnd.draggingId && 'opacity-40')}
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
              {item.type === 'stop' && <StopRow {...row} onClick={() => onStop(item.stop)} draggable={!!dnd} />}
              {item.type === 'transport' && (
                <TransportRow
                  {...row}
                  attachments={attachmentsByParent[item.transport.id]}
                  onClick={() => onResa('transport', item.transport.id)}
                />
              )}
              {(item.type === 'checkin' || item.type === 'checkout') && (
                <StayEventRow
                  {...row}
                  attachments={attachmentsByParent[item.stay.id]}
                  onClick={() => onResa('stay', item.stay.id)}
                />
              )}
            </div>
            {leg && <LegRow leg={leg} past={past} />}
          </li>
        )
      })}
      {dnd?.dropActive && dnd.dropBeforeId === null && <li><DropLine /></li>}
    </ol>
  )
}

function DropLine() {
  return <div aria-hidden="true" className="h-0.5 my-0.5 ml-[102px] rounded-full bg-accent" />
}

// Grille commune : heure · pastille · contenu · poignée.
const ROW = 'w-full grid grid-cols-[46px_28px_minmax(0,1fr)_auto] gap-x-2.5 items-start px-2 py-2.5 text-left rounded-xl transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function rowClass(active, past) {
  return cn(ROW, active && 'bg-accent/[0.07] hover:bg-accent/10', past && 'opacity-55')
}

function Time({ value }) {
  return <span className="font-mono text-[13px] text-muted leading-[26px] tabular pl-1">{value || '—'}</span>
}

function Badge({ item, past, colorIndexByStay }) {
  return (
    <span className="flex justify-center">
      <ItemBadge item={item} past={past} colorIndexByStay={colorIndexByStay} />
    </span>
  )
}

function Title({ children, attached }) {
  return (
    <span className="flex items-center gap-1.5 text-[15px] font-medium text-fg leading-[26px]">
      <span className="truncate">{children}</span>
      {attached && <Paperclip size={13} className="shrink-0 text-muted" aria-label="Capture jointe" />}
    </span>
  )
}

function StopRow({ item, past, active, colorIndexByStay, onMouseEnter, onClick, draggable }) {
  const { stop } = item
  const category = getCategory(stop.category)
  const Icon = category.icon
  const located = hasCoords(stop)
  const meta = [category.label, formatDuration(stop.durationMin)].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={onClick} onMouseEnter={onMouseEnter} className={cn(rowClass(active, past), 'group')}>
      <Time value={stop.time} />
      <Badge item={item} past={past} colorIndexByStay={colorIndexByStay} />
      <span className="min-w-0">
        <Title>{stop.name}</Title>
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <Icon size={13} className="shrink-0" style={{ color: past ? undefined : category.color }} aria-hidden="true" />
          {meta}
          {!located && <span className="text-amber-700">· à localiser</span>}
        </span>
        {stop.notes && <span className="block text-[13px] text-muted mt-0.5 line-clamp-2">{stop.notes}</span>}
      </span>
      {draggable ? (
        <GripVertical size={18} className="mt-1 shrink-0 text-faint group-hover:text-muted cursor-grab" aria-hidden="true" />
      ) : <span />}
    </button>
  )
}

function TransportRow({ item, past, active, colorIndexByStay, onMouseEnter, attachments, onClick }) {
  const { title, sub } = transportText(item)
  return (
    <button type="button" onClick={onClick} onMouseEnter={onMouseEnter} className={rowClass(active, past)}>
      <Time value={item.time} />
      <Badge item={item} past={past} colorIndexByStay={colorIndexByStay} />
      <span className="min-w-0">
        <Title attached={attachments?.length > 0}>{title}</Title>
        <span className="block text-[13px] text-muted truncate">{sub}</span>
      </span>
      <span />
    </button>
  )
}

function StayEventRow({ item, past, active, colorIndexByStay, onMouseEnter, attachments, onClick }) {
  const { stay } = item
  const arriving = item.type === 'checkin'
  return (
    <button type="button" onClick={onClick} onMouseEnter={onMouseEnter} className={rowClass(active, past)}>
      <Time value={item.time} />
      <Badge item={item} past={past} colorIndexByStay={colorIndexByStay} />
      <span className="min-w-0">
        <Title attached={attachments?.length > 0}>{arriving ? 'Arrivée' : 'Départ'} · {stay.name}</Title>
        <span className="block text-[13px] text-muted truncate">
          {getStayKind(stay.kind).label}
          {arriving && stay.accessCode ? ` · code ${stay.accessCode}` : ''}
        </span>
      </span>
      <span />
    </button>
  )
}

function LegRow({ leg, past }) {
  const walking = leg.distanceM <= WALKING_MAX_M
  return (
    <div className={cn('grid grid-cols-[46px_28px_minmax(0,1fr)] gap-x-2.5 items-center px-2', past && 'opacity-55')}>
      <span />
      <span aria-hidden="true" className="justify-self-center h-8 border-l-2 border-dotted border-border-strong" />
      <a
        href={directionsUrl(leg.to, { origin: leg.from, mode: walking ? 'walking' : null })}
        target="_blank"
        rel="noreferrer"
        className="justify-self-start h-8 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-accent transition"
        title="À vol d’oiseau — ouvrir l’itinéraire dans Google Maps"
      >
        {walking && <Footprints size={13} className="shrink-0" aria-hidden="true" />}
        ≈ {formatDistance(leg.distanceM)}
        <span className="text-accent">· Itinéraire</span>
      </a>
    </div>
  )
}
