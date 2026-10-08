import { Clock, ExternalLink, Navigation } from 'lucide-react'
import { formatDayFr } from '@/shared/lib/dates.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { getCategory } from '../../config/categories.js'
import { goUrl, placeUrl } from '../../utils/mapsUrl.js'
import { formatDuration } from '../../utils/format.js'

const PRIMARY = 'h-12 flex-1 rounded-xl bg-accent text-accent-fg inline-flex items-center justify-center gap-2 text-[15px] font-semibold hover:opacity-90 transition'
const SECONDARY = 'h-12 flex-1 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center gap-2 text-[15px] font-medium hover:bg-border transition'

/**
 * Une étape en lecture seule (vue invité) : là où le couple ouvre sa fiche
 * de modification, l'invité voit le lieu, l'heure, les notes, et « Y aller ».
 */
export default function StopView({ open, date, stop, onClose }) {
  if (!stop) return null
  const category = getCategory(stop.category)
  const Icon = category.icon
  const go = goUrl(stop)
  const maps = placeUrl(stop)
  const when = [stop.time, formatDuration(stop.durationMin)].filter(Boolean).join(' · ')

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={stop.name || 'Étape'}
      description={date ? formatDayFr(date) : null}
      footer={(go || maps) && (
        <div className="flex gap-2">
          {go && (
            <a href={go} target="_blank" rel="noreferrer" className={PRIMARY}>
              <Navigation size={16} /> Y aller
            </a>
          )}
          {maps && (
            <a href={maps} target="_blank" rel="noreferrer" className={SECONDARY}>
              Google Maps <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="h-8 pl-2 pr-3 rounded-full inline-flex items-center gap-1.5 text-[14px] font-medium text-white"
            style={{ backgroundColor: category.color }}
          >
            <Icon size={15} /> {category.label}
          </span>
          {when && (
            <span className="h-8 px-3 rounded-full bg-surface-2 inline-flex items-center gap-1.5 text-[14px] text-fg tabular">
              <Clock size={14} className="text-muted" /> {when}
            </span>
          )}
        </div>
        {stop.address && <p className="text-[15px] text-muted">{stop.address}</p>}
        {stop.notes && <p className="text-[15px] text-fg whitespace-pre-line">{stop.notes}</p>}
        {!stop.address && !stop.notes && !when && (
          <p className="text-[15px] text-muted">Pas de détail pour cette étape.</p>
        )}
      </div>
    </ThemedSheet>
  )
}
