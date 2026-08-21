import { cn } from '@/shared/lib/utils.js'

// Contrôle segmenté façon iOS : un curseur qui GLISSE d'un segment à l'autre
// plutôt qu'un fond qui saute. Sur desktop chaque sous-page a sa propre entrée
// de sidebar, donc le contrôle ne sert qu'en dessous de `lg`.
export default function SegmentedTabs({ items, active, onChange, className, desktopHidden = true }) {
  if (!items || items.length < 2) return null
  const index = Math.max(0, items.findIndex((i) => i.id === active))

  return (
    <div
      role="tablist"
      className={cn(
        'relative flex items-center p-1 rounded-2xl bg-surface-2 border border-border',
        desktopHidden && 'lg:hidden',
        className,
      )}
    >
      {/* Curseur : une seule couche animée, transform uniquement — pas de
          reflow, donc pas d'à-coup sur téléphone. */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-xl bg-accent shadow-sm ease-ios duration-300 transition-transform"
        style={{
          width: `calc((100% - 0.5rem) / ${items.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(item.id)}
            className={cn(
              'relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl',
              'text-[13px] font-medium transition-colors duration-200',
              isActive ? 'text-accent-fg' : 'text-muted hover:text-fg',
            )}
          >
            {Icon && <Icon size={14} strokeWidth={isActive ? 2.4 : 2} />}
            <span>{item.short || item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
