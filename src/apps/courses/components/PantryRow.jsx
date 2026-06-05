import { Plus, Check } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'
import { getStatusMeta, STATUS_CYCLE, isNeeded } from '../config/pantryStatus.js'

// Ligne d'un produit du frigo : statut cyclable (tap), nom (tap → édition),
// et raccourci « ajouter à la liste » quand le produit est à racheter.
export default function PantryRow({ item, inList, onCycleStatus, onEdit, onSendToList }) {
  const person = getPerson(item.createdBy)
  const meta = getStatusMeta(item.status)
  const needed = isNeeded(item.status)

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => onCycleStatus(item, STATUS_CYCLE[item.status] || 'ok')}
        aria-label={`Statut : ${meta.label}. Changer.`}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 transition active:scale-95',
          meta.pillClass,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} />
        {meta.short}
      </button>

      <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
        <div>
          <span className="text-[15px] text-fg">{item.name}</span>
          {item.quantityLabel && <span className="ml-2 text-sm text-muted">{item.quantityLabel}</span>}
        </div>
        {item.note && <p className="text-xs text-faint truncate">{item.note}</p>}
      </button>

      {needed && (
        inList ? (
          <span className="inline-flex items-center gap-1 text-xs text-accent shrink-0" title="Déjà sur la liste">
            <Check size={14} strokeWidth={3} /> Listé
          </span>
        ) : (
          <button
            onClick={() => onSendToList(item)}
            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-surface-2 transition shrink-0"
            aria-label="Ajouter à la liste de courses"
            title="Ajouter à la liste"
          >
            <Plus size={16} />
          </button>
        )
      )}

      {person && (
        <span
          className={cn('h-2 w-2 rounded-full shrink-0', person.dotClass)}
          title={`Ajouté par ${person.label}`}
        />
      )}
    </div>
  )
}
