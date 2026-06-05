import PantryRow from './PantryRow.jsx'
import { normalizeName } from '../utils/aisleGuess.js'

export default function PantrySection({ aisle, items, listedNames, onCycleStatus, onEdit, onSendToList }) {
  const Icon = aisle.icon
  return (
    <section className="mb-5 break-inside-avoid">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={aisle.colorClass} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{aisle.label}</h3>
        <span className="text-xs text-faint">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <PantryRow
            key={it.id}
            item={it}
            inList={listedNames.has(normalizeName(it.name))}
            onCycleStatus={onCycleStatus}
            onEdit={onEdit}
            onSendToList={onSendToList}
          />
        ))}
      </div>
    </section>
  )
}
