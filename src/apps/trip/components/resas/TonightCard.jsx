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
 */
export default function TonightCard({ date, stay, colorIndex, attachments = [], isLastDay, onOpen, onAdd, onViewAttachment, className }) {
  if (!stay) {
    if (isLastDay) return null
    // Enveloppé : les marges de `className` s'appliquent autour, un bouton
    // `w-full` avec des marges déborderait de l'écran.
    return (
      <div className={className}>
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-2xl border border-dashed border-amber-400/70 bg-amber-50/60 px-4 py-3 flex items-center gap-3 text-left transition hover:border-amber-500"
        >
          <BedDouble size={18} className="shrink-0 text-amber-700" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-amber-900">Pas d’hébergement cette nuit</span>
            <span className="block text-xs text-amber-800/80">Ajoutez-le pour l’avoir sous la main sur place.</span>
          </span>
          <Plus size={16} className="shrink-0 text-amber-700" />
        </button>
      </div>
    )
  }

  const kind = getStayKind(stay.kind)
  const arriving = stay.checkIn.date === date
  const [first] = attachments
  const located = hasCoords(stay) || stay.address

  return (
    <section className={cn('rounded-2xl border border-border bg-surface overflow-hidden', className)}>
      <div className="p-4 flex gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Ce soir{arriving && stay.checkIn.time ? ` · arrivée ${stay.checkIn.time}` : arriving ? ' · arrivée' : ''}
          </p>
          <button type="button" onClick={onOpen} className="mt-1 flex items-center gap-2 max-w-full text-left">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', stayColor(colorIndex).dot)} />
            <span className="text-base font-semibold text-fg truncate">{stay.name}</span>
            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{kind.label}</span>
          </button>
          {stay.address && <p className="text-sm text-muted mt-0.5 truncate">{stay.address}</p>}

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {stay.accessCode && <CopyValue label="Code d’accès" value={stay.accessCode} mono={false} large />}
            {stay.confirmation && <CopyValue label="Référence" value={stay.confirmation} />}
          </div>
        </div>
        {first && (
          <AttachmentThumb
            attachment={first}
            onClick={() => onViewAttachment(attachments, 0)}
            className="h-24 w-[4.5rem] shrink-0"
          />
        )}
      </div>
      <div className="flex border-t border-border text-sm">
        {located && (
          <a
            href={directionsUrl(stay)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 font-medium text-accent hover:bg-surface-2 transition"
          >
            <Navigation size={14} /> Y aller
          </a>
        )}
        <button
          type="button"
          onClick={onOpen}
          className={cn('flex-1 inline-flex items-center justify-center gap-1 py-2.5 text-muted hover:text-fg hover:bg-surface-2 transition', located && 'border-l border-border')}
        >
          Réservation <ChevronRight size={14} />
        </button>
      </div>
    </section>
  )
}
