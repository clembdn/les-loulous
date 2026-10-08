import { Check, MoreHorizontal } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'
import { getPackingCategory } from '../../config/packing.js'

/**
 * Une affaire de la valise. Toute la ligne coche et décoche : on fait sa
 * valise d'une main, l'autre tient le pull. « ⋯ » ouvre sa fiche.
 * L'initiale dit à qui elle est (rien : commune), sur la couleur de la
 * personne en fond plein — ses teintes claires ne se lisent pas en texte sur
 * le fond clair de l'app. Cochée, un point dit qui l'a rangée.
 */
export default function PackingRow({ item, onToggle, onEdit }) {
  const owner = item.owner ? getPerson(item.owner) : null
  const packer = item.checked && item.checkedBy ? getPerson(item.checkedBy) : null
  const color = getPackingCategory(item.category).color

  return (
    <li className="flex items-center">
      <button
        type="button"
        onClick={() => onToggle(item)}
        aria-pressed={item.checked}
        className="min-w-0 flex-1 min-h-12 flex items-center gap-3 pl-2 pr-1 py-2 rounded-xl text-left transition active:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className={cn('h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition', item.checked ? 'text-white' : 'text-transparent')}
          style={item.checked ? { backgroundColor: color, borderColor: color } : { borderColor: color }}
        >
          <Check size={14} strokeWidth={3} />
        </span>
        <span className={cn('min-w-0 flex-1 text-[15px] truncate', item.checked ? 'text-muted line-through' : 'text-fg')}>
          {item.name}
        </span>
        {owner && (
          <span
            title={`À ${owner.label}`}
            style={{ backgroundColor: owner.color }}
            className="shrink-0 h-6 min-w-6 px-1.5 rounded-full text-[12px] font-bold text-[#11141B] flex items-center justify-center"
          >
            {owner.initial}
          </span>
        )}
        {packer && (
          <span className={cn('shrink-0 h-2 w-2 rounded-full', packer.dotClass)} title={`Rangée par ${packer.label}`} />
        )}
      </button>
      <button
        type="button"
        onClick={() => onEdit(item)}
        aria-label={`Modifier « ${item.name} »`}
        className="shrink-0 h-11 w-10 rounded-xl flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition"
      >
        <MoreHorizontal size={18} />
      </button>
    </li>
  )
}
