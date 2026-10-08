import { CalendarPlus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { getCategory } from '../../config/categories.js'
import { dayChip } from '../../utils/format.js'
import { formatDistance, hasCoords } from '../../utils/geo.js'

/**
 * Un lieu à caser : sa pastille de catégorie (creuse, comme son repère sur
 * la carte — pointillée s'il n'est pas localisé), son nom, et de quoi le
 * placer d'un tap.
 *
 *  · `suggestion` (`{ date, distanceM }`) : « + Mar 14 », le jour le plus proche ;
 *  · `distanceM` : la distance à la journée affichée (carte « près d'ici ») ;
 *  · `onAdd` : un seul bouton « + » (placer dans la journée affichée) ;
 *  · `onPlace` : « Placer… », le choix du jour.
 *
 * `draggable` (desktop) : on le glisse dans la frise ou sur un jour.
 */
export default function IdeaRow({
  idea, suggestion = null, distanceM = null, onOpen, onAdd = null, onPlace = null, onSuggested = null,
  active = false, onHover = null, draggable = false, onDragStart, onDragEnd, compact = false,
}) {
  const category = getCategory(idea.category)
  const located = hasCoords(idea)
  const chip = suggestion && dayChip(suggestion.date)
  const detail = distanceM != null
    ? `à ${formatDistance(distanceM)}`
    : [category.id !== 'other' && category.label, idea.address].filter(Boolean).join(' · ')

  return (
    <li
      draggable={draggable || undefined}
      onDragStart={draggable ? (e) => {
        e.dataTransfer.effectAllowed = 'move'
        // Firefox ne démarre pas un glisser sans donnée (comme la frise, cf. DayTimeline).
        e.dataTransfer.setData('text/plain', idea.id)
        onDragStart?.()
      } : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onMouseEnter={onHover ? () => onHover(`idea:${idea.id}`) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      data-key={`idea:${idea.id}`}
      className={cn(
        'flex items-center gap-2 rounded-xl transition',
        active && 'bg-accent/5',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <button type="button" onClick={() => onOpen(idea)} className={cn('min-w-0 flex-1 flex items-center gap-3 text-left', compact ? 'py-2 pl-2' : 'py-2.5 pl-2')}>
        <span
          aria-hidden="true"
          className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center bg-surface"
          style={{ border: `2.5px ${located ? 'solid' : 'dashed'} ${category.color}`, color: category.color }}
        >
          <category.icon size={13} strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-fg truncate">{idea.name}</span>
          {(detail || !located) && (
            <span className="block text-[13px] text-muted truncate">
              {detail || 'Pas encore localisé'}
            </span>
          )}
        </span>
      </button>

      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(idea)}
          aria-label={`Ajouter « ${idea.name} » à cette journée`}
          className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-accent hover:bg-accent/10 transition"
        >
          <Plus size={20} strokeWidth={2.4} />
        </button>
      )}
      {chip && onSuggested && (
        <button
          type="button"
          onClick={() => onSuggested(idea, suggestion.date)}
          title={`Le jour le plus proche : à ${formatDistance(suggestion.distanceM)}`}
          className="shrink-0 h-9 pl-2.5 pr-3 rounded-full inline-flex items-center gap-1 bg-accent/10 text-[14px] font-semibold text-accent hover:bg-accent/15 transition tabular"
        >
          <Plus size={15} strokeWidth={2.6} /> {chip.dow} {chip.day}
        </button>
      )}
      {onPlace && (
        <button
          type="button"
          onClick={() => onPlace(idea)}
          aria-label={`Placer « ${idea.name} » dans un jour`}
          title="Choisir le jour"
          className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition"
        >
          <CalendarPlus size={18} />
        </button>
      )}
    </li>
  )
}
