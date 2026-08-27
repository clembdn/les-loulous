import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import ItemRow from './ItemRow.jsx'

export default function CheckedZone({ items, onToggle, onEdit }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-fg transition"
      >
        <ChevronRight size={16} className={cn('transition-transform', open && 'rotate-90')} />
        Cochés ({items.length})
      </button>
      {open && (
        <div className="mt-1 opacity-70 divide-y divide-border">
          {items.map((it) => (
            <ItemRow key={it.id} item={it} onToggle={onToggle} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
