import ItemRow from './ItemRow.jsx'

export default function AisleSection({ aisle, items, onToggle, onEdit }) {
  const Icon = aisle.icon
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={aisle.colorClass} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{aisle.label}</h3>
        <span className="text-xs text-faint">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} onToggle={onToggle} onEdit={onEdit} />
        ))}
      </div>
    </section>
  )
}
