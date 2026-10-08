import { ArrowLeftRight, Copy, ExternalLink, Mail, Navigation, Pencil, Phone } from 'lucide-react'
import { formatDayFr } from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { getStayKind, getTransportMode } from '../../config/reservations.js'
import { stayColor, TRANSPORT_COLOR } from '../../config/palette.js'
import { directionsUrl, placeUrl } from '../../utils/mapsUrl.js'
import { hasCoords } from '../../utils/geo.js'
import { daysBetween } from '../../utils/tripDates.js'
import { formatPrice, plural } from '../../utils/format.js'
import AttachmentThumb from '../attachments/AttachmentThumb.jsx'
import CopyValue, { copyValue } from '../CopyValue.jsx'
import TripMap, { placeItems, stayPlaceItems } from '../map/TripMap.jsx'
import { resaTitle } from './resaDisplay.jsx'

const MAP_PADDING = { top: 30, bottom: 30, left: 30, right: 30 }

/**
 * La fiche d'une réservation, en « mode comptoir » : ce qu'on montre ou
 * recopie sur place, du plus utile au moins utile — le code de la porte ou
 * la place, en très grand ; la référence ; la capture du mail, en grand,
 * d'un tap en plein écran ; puis où c'est, « Y aller », « Appeler ».
 */
export default function ResaDetail({ kind, item, attachments = [], colorIndex, onEdit, onViewAttachment, onReverse }) {
  const isStay = kind === 'stay'
  const mode = isStay ? null : getTransportMode(item.mode)
  const label = isStay ? getStayKind(item.kind).label : mode.label
  const color = isStay ? stayColor(colorIndex).hex : TRANSPORT_COLOR.hex
  const big = isStay
    ? item.accessCode && { label: 'Code d’accès', value: item.accessCode }
    : item.seat && { label: 'Place', value: item.seat }
  const place = isStay ? item : item.from
  const located = hasCoords(place) || place.address

  return (
    <article className="rounded-3xl bg-surface shadow-[0_1px_2px_rgb(17_20_27/0.06),0_8px_24px_rgb(17_20_27/0.06)] overflow-hidden">
      <div className="h-2" style={{ backgroundColor: color }} />
      <header className="px-5 pt-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-muted">
            {label}{item.price != null ? ` · ${formatPrice(item.price, item.currency)}` : ''}
          </p>
          <h2 className="mt-0.5 text-[26px] leading-8 font-bold tracking-[-0.02em] text-fg">{resaTitle(kind, item)}</h2>
        </div>
        {onEdit && (
          <Button variant="secondary" size="sm" onClick={onEdit} aria-label="Modifier" className="shrink-0">
            <Pencil size={14} /> <span className="hidden sm:inline">Modifier</span>
          </Button>
        )}
      </header>

      <div className="px-5 pt-4 grid grid-cols-2 gap-2.5">
        {isStay ? (
          <>
            <Moment label="Arrivée" point={item.checkIn} />
            <Moment label={`Départ · ${plural(daysBetween(item.checkIn.date, item.checkOut.date), 'nuit')}`} point={item.checkOut} />
          </>
        ) : (
          <>
            <Moment label={mode.fromLabel} point={item.from} place={item.from.name} />
            <Moment label={mode.toLabel} point={item.to} place={item.to.name} />
          </>
        )}
      </div>

      {(big || item.confirmation) && (
        <div className="mx-5 mt-5 pt-5 border-t border-dashed border-border-strong">
          {big && <BigValue label={big.label} value={big.value} />}
          {item.confirmation && (
            <div className={cn('flex justify-center', big && 'mt-3')}>
              <CopyValue label="Référence" value={item.confirmation} large={!big} className="text-center" />
            </div>
          )}
        </div>
      )}

      <div className="px-5 pb-5 pt-5 space-y-6">
        {attachments.length > 0 && (
          <section>
            <h3 className="text-[15px] font-semibold text-fg">À montrer sur place</h3>
            <p className="text-[13px] text-muted">Lisible sans réseau · un tap pour le plein écran</p>
            <div className="mt-2.5 flex gap-2.5 overflow-x-auto no-scrollbar">
              {attachments.map((a, i) => (
                <AttachmentThumb
                  key={a.id}
                  attachment={a}
                  onClick={() => onViewAttachment(attachments, i)}
                  className={cn('shrink-0 aspect-[3/4]', i === 0 ? 'w-40' : 'w-28')}
                />
              ))}
            </div>
          </section>
        )}

        {located && (
          <section>
            <h3 className="text-[15px] font-semibold text-fg">{isStay ? 'Adresse' : mode.fromLabel}</h3>
            {hasCoords(place) && (
              <div className="mt-2.5 rounded-2xl overflow-hidden">
                <TripMap
                  items={isStay ? stayPlaceItems(item) : placeItems(place)}
                  colorIndexByStay={isStay ? { [item.id]: colorIndex } : {}}
                  padding={MAP_PADDING}
                  className="h-36"
                />
              </div>
            )}
            <p className="mt-2 text-[15px] text-fg">{place.address || place.name}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className={cn(PRIMARY, !item.phone && 'col-span-2')}>
                <Navigation size={16} /> Y aller
              </a>
              {item.phone && (
                <a href={`tel:${item.phone.replace(/\s/g, '')}`} className={SECONDARY}>
                  <Phone size={16} /> Appeler
                </a>
              )}
            </div>
          </section>
        )}

        {(item.mailUrl || (!located && item.phone) || placeUrl(place)) && (
          <div className="flex flex-wrap gap-2">
            {!located && item.phone && (
              <a href={`tel:${item.phone.replace(/\s/g, '')}`} className={LINK}><Phone size={14} /> {item.phone}</a>
            )}
            {item.mailUrl && (
              <a href={item.mailUrl} target="_blank" rel="noreferrer" className={LINK}>
                <Mail size={14} /> Le mail <ExternalLink size={11} />
              </a>
            )}
            {located && placeUrl(place) && (
              <a href={placeUrl(place)} target="_blank" rel="noreferrer" className={LINK}>
                Voir dans Google Maps <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {item.notes && (
          <section>
            <h3 className="text-[15px] font-semibold text-fg">Notes</h3>
            <p className="mt-1 text-[15px] text-fg whitespace-pre-line">{item.notes}</p>
          </section>
        )}

        {!isStay && item.mode !== 'car' && onReverse && (
          <Button variant="secondary" className="w-full" onClick={onReverse}>
            <ArrowLeftRight size={16} /> Créer le retour
          </Button>
        )}
      </div>
    </article>
  )
}

const PRIMARY = 'h-12 rounded-xl bg-accent text-accent-fg inline-flex items-center justify-center gap-2 text-[15px] font-semibold hover:opacity-90 transition'
const SECONDARY = 'h-12 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center gap-2 text-[15px] font-medium hover:bg-border transition'
const LINK = 'inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-surface-2 text-[14px] text-fg hover:bg-border transition'

/** La valeur à montrer au comptoir, en très grand ; un tap la copie. */
function BigValue({ label, value }) {
  const copy = () => copyValue(label, value)
  return (
    <div className="text-center">
      <p className="text-[13px] text-muted">{label}</p>
      <button type="button" onClick={copy} className="group mt-1 inline-flex items-center gap-2 select-text" title="Copier">
        <span className="font-mono text-[52px] leading-[60px] font-semibold tracking-[0.08em] text-fg break-all">{value}</span>
        <Copy size={18} className="shrink-0 text-muted group-hover:text-accent transition" />
      </button>
    </div>
  )
}

function Moment({ label, point, place }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3 min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-fg first-letter:uppercase">{point.date ? formatDayFr(point.date) : '—'}</p>
      {point.time && <p className="font-mono text-[20px] font-semibold text-fg tabular">{point.time}</p>}
      {place && <p className="mt-0.5 text-[13px] text-muted truncate">{place}</p>}
    </div>
  )
}
