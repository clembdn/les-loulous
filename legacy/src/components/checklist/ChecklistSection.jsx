import { CheckCircle2, Circle, Clock, MoreHorizontal } from 'lucide-react'
import ChecklistItemCard from './ChecklistItemCard.jsx'

export default function ChecklistSection({ title, items, allSectionItems, onEdit, onChangeStatus }) {
  const total = allSectionItems.length
  const done = allSectionItems.filter(i => i.status === 'done').length
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full border border-border-subtle">
            {done} / {total} terminés — {percentage}%
          </span>
        </h2>
      </div>

      <div className="h-1.5 w-full bg-bg-elevated rounded-full overflow-hidden border border-border-subtle">
        <div 
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted italic px-2">Tous les éléments de cette section sont masqués par vos filtres.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <ChecklistItemCard 
              key={item.id} 
              item={item} 
              onEdit={() => onEdit(item)}
              onChangeStatus={(status) => onChangeStatus(item.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
