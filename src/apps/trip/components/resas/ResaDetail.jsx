import { ExternalLink, Mail, MapPin, Navigation, Pencil, Phone } from 'lucide-react'
import { formatDayFr } from '@/shared/lib/dates.js'
import { Button } from '@/shared/ui/Button.jsx'
import { getStayKind, getTransportMode } from '../../config/reservations.js'
import { directionsUrl, placeUrl } from '../../utils/mapsUrl.js'
import { hasCoords } from '../../utils/geo.js'
import { daysBetween } from '../../utils/tripDates.js'
import { formatPrice, plural } from '../../utils/format.js'
import AttachmentThumb from '../attachments/AttachmentThumb.jsx'
import CopyValue from '../CopyValue.jsx'
import { ResaIcon, resaTitle } from './resaDisplay.jsx'

/**
 * La fiche d'une réservation : tout ce qu'on peut avoir à montrer ou à
 * recopier sur place — dates, adresse, codes, référence, et la capture du
 * mail de réservation en plein écran.
 */
export default function ResaDetail({ kind, item, attachments = [], colorIndex, onEdit, onViewAttachment }) {
  const isStay = kind === 'stay'
  const label = isStay ? getStayKind(item.kind).label : getTransportMode(item.mode).label
  const mode = isStay ? null : getTransportMode(item.mode)

  return (
    <article className="rounded-2xl border border-border bg-surface">
      <header className="p-5 flex items-start gap-3.5">
        <ResaIcon kind={kind} item={item} colorIndex={colorIndex} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">{label}</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-fg">{resaTitle(kind, item)}</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit} aria-label="Modifier" className="shrink-0">
          <Pencil size={14} /> <span className="hidden sm:inline">Modifier</span>
        </Button>
      </header>

      <div className="px-5 pb-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {isStay ? (
            <>
              <Moment label="Arrivée" point={item.checkIn} />
              <Moment label="Départ" point={item.checkOut} />
            </>
          ) : (
            <>
              <Moment label={mode.fromLabel} point={item.from} place={item.from.name} />
              <Moment label={mode.toLabel} point={item.to} place={item.to.name} />
            </>
          )}
        </div>
        {isStay && (
          <p className="-mt-2 text-xs text-faint">{plural(daysBetween(item.checkIn.date, item.checkOut.date), 'nuit')}</p>
        )}

        {isStay && (item.address || hasCoords(item)) && (
          <Place place={item} />
        )}
        {!isStay && (hasCoords(item.from) || item.from.address) && <Place place={item.from} label={mode.fromLabel} />}

        {(item.accessCode || item.confirmation || item.seat) && (
          <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl bg-surface-2 px-4 py-3">
            {item.accessCode && <CopyValue label="Code d’accès" value={item.accessCode} mono={false} large />}
            {item.confirmation && <CopyValue label="Référence" value={item.confirmation} large={!item.accessCode} />}
            {item.seat && <CopyValue label="Place" value={item.seat} mono={false} />}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {item.phone && (
            <a href={`tel:${item.phone.replace(/\s/g, '')}`} className={LINK}>
              <Phone size={14} /> {item.phone}
            </a>
          )}
          {item.mailUrl && (
            <a href={item.mailUrl} target="_blank" rel="noreferrer" className={LINK}>
              <Mail size={14} /> Ouvrir le mail <ExternalLink size={11} />
            </a>
          )}
          {item.price != null && (
            <span className="inline-flex items-center h-9 px-3 rounded-lg bg-surface-2 text-sm text-fg tabular">
              {formatPrice(item.price, item.currency)}
            </span>
          )}
        </div>

        {attachments.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-faint mb-2">Captures · disponibles hors-ligne</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {attachments.map((a, i) => (
                <AttachmentThumb key={a.id} attachment={a} onClick={() => onViewAttachment(attachments, i)} className="aspect-[3/4]" />
              ))}
            </div>
          </section>
        )}

        {item.notes && (
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-faint mb-1">Notes</h3>
            <p className="text-sm text-fg whitespace-pre-line">{item.notes}</p>
          </section>
        )}
      </div>
    </article>
  )
}

const LINK = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-fg hover:bg-surface-2 transition'

function Moment({ label, point, place }) {
  return (
    <div className="rounded-xl border border-border px-3.5 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 text-sm font-medium text-fg first-letter:uppercase">{point.date ? formatDayFr(point.date) : '—'}</p>
      {point.time && <p className="font-mono text-lg font-semibold text-fg tabular">{point.time}</p>}
      {place && <p className="mt-0.5 text-xs text-muted truncate">{place}</p>}
    </div>
  )
}

function Place({ place, label }) {
  const mapUrl = placeUrl(place)
  return (
    <div className="flex items-start gap-3">
      <MapPin size={16} className="mt-0.5 shrink-0 text-faint" />
      <div className="flex-1 min-w-0">
        {label && <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</p>}
        <p className="text-sm text-fg">{place.address || place.name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-accent text-accent-fg text-sm font-medium hover:opacity-90 transition">
            <Navigation size={14} /> Y aller
          </a>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className={LINK}>
              Voir sur la carte <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
