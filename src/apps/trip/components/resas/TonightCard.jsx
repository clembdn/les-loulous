import { BedDouble, ChevronRight, Navigation, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { getStayKind } from '../../config/reservations.js'
import { stayColor } from '../../config/palette.js'
import { directionsUrl } from '../../utils/mapsUrl.js'
import { hasCoords } from '../../utils/geo.js'
import AttachmentThumb from '../attachments/AttachmentThumb.jsx'
import CopyValue from '../CopyValue.jsx'

/**
 * « Ce soir » : où l'on dort, et tout ce qu'il faut à l'arrivée — l'adresse
 * (Y aller), le code de la boîte à clés, la référence, la capture du mail de
 * réservation à montrer à l'accueil. Hors-ligne compris.
 *
 * Sans hébergement pour cette nuit (sauf la dernière), un rappel pointillé :
 * c'est le genre de trou qu'il vaut mieux voir avant de partir.
 * `hideLabel` : le titre « Ce soir » est déjà posé au-dessus (écran Aujourd'hui).
 */
export default function TonightCard({ date, stay, colorIndex, attachments = [], isLastDay, onOpen, onAdd, onViewAttachment, hideLabel = false, className }) {
  if (!stay) {
    // Dernière nuit, ou invité qui ne peut rien y faire : rien à signaler.
    if (isLastDay || !onAdd) return null
    // Enveloppé : les marges de `className` s'appliquent autour, un bouton
    // `w-full` avec des marges déborderait de l'écran.
    return (
      <div className={className}>
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3.5 flex items-center gap-3 text-left transition hover:border-amber-500"
        >
          <span className="h-9 w-9 shrink-0 rounded-[10px] bg-amber-500 text-white flex items-center justify-center">
            <BedDouble size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-amber-950">Pas d’hébergement cette nuit</span>
            <span className="block text-[13px] text-amber-900">Ajoutez-le pour l’avoir sous la main sur place.</span>
          </span>
          <Plus size={18} className="shrink-0 text-amber-800" />
        </button>
      </div>
    )
  }

  const kind = getStayKind(stay.kind)
  const color = stayColor(colorIndex)
  const arriving = stay.checkIn.date === date
  const [first] = attachments
  const located = hasCoords(stay) || stay.address
  const when = arriving ? (stay.checkIn.time ? `arrivée ${stay.checkIn.time}` : 'arrivée') : null

  return (
    <section className={cn('rounded-2xl bg-surface shadow-sm overflow-hidden', className)}>
      <div className="p-4 flex gap-3">
        <div className="flex-1 min-w-0">
          {!hideLabel && <p className="text-[13px] font-semibold text-muted">Ce soir{when ? ` · ${when}` : ''}</p>}
          <button type="button" onClick={onOpen} className={cn('flex items-center gap-2.5 max-w-full text-left', !hideLabel && 'mt-1.5')}>
            <span className="h-8 w-8 shrink-0 rounded-[9px] text-white flex items-center justify-center" style={{ backgroundColor: color.hex }}>
              <BedDouble size={16} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold text-fg truncate">{stay.name}</span>
              <span className="block text-[13px] text-muted">{kind.label}{hideLabel && when ? ` · ${when}` : ''}</span>
            </span>
          </button>
          {stay.address && <p className="text-[14px] text-muted mt-2 truncate">{stay.address}</p>}

          {(stay.accessCode || stay.confirmation) && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {stay.accessCode && <CopyValue label="Code d’accès" value={stay.accessCode} mono={false} large />}
              {stay.confirmation && <CopyValue label="Référence" value={stay.confirmation} />}
            </div>
          )}
        </div>
        {first && (
          <AttachmentThumb
            attachment={first}
            onClick={() => onViewAttachment(attachments, 0)}
            className="h-24 w-[4.5rem] shrink-0"
          />
        )}
      </div>
      <div className="flex border-t border-border text-[15px]">
        {located && (
          <a
            href={directionsUrl(stay)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 font-semibold text-accent hover:bg-surface-2 transition"
          >
            <Navigation size={15} /> Y aller
          </a>
        )}
        <button
          type="button"
          onClick={onOpen}
          className={cn('flex-1 inline-flex items-center justify-center gap-1 h-12 text-fg hover:bg-surface-2 transition', located && 'border-l border-border')}
        >
          Réservation <ChevronRight size={15} className="text-muted" />
        </button>
      </div>
    </section>
  )
}
