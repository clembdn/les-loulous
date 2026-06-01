import { Check } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

export default function ItemRow({ item, onToggle, onEdit }) {
  const person = getPerson(item.createdBy)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => onToggle(item)}
        aria-label={item.checked ? 'Décocher' : 'Cocher'}
        className={cn(
          'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition',
          item.checked
            ? 'bg-accent border-accent text-accent-fg'
            : 'border-border-strong text-transparent hover:border-accent',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
        <span className={cn('text-[15px] text-fg', item.checked && 'line-through text-faint')}>
          {item.name}
        </span>
        {item.quantityLabel && <span className="ml-2 text-sm text-muted">{item.quantityLabel}</span>}
      </button>
      {person && (
        <span
          className={cn('h-2 w-2 rounded-full shrink-0', person.dotClass)}
          title={`Ajouté par ${person.label}`}
        />
      )}
    </div>
  )
}
