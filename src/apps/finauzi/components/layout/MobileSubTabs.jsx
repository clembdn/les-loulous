import { cn } from '@/shared/lib/utils.js'

// Bascule entre les sous-pages d'un groupe, sur mobile uniquement —
// sur desktop chaque sous-page a sa propre entrée dans la sidebar.
export default function MobileSubTabs({ subs, active, onNavigate, className }) {
  if (!subs || subs.length < 2) return null
  return (
    <div className={cn('lg:hidden flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl', className)}>
      {subs.map((sub) => {
        const Icon = sub.icon
        const isActive = active === sub.id
        return (
          <button
            key={sub.id}
            type="button"
            onClick={() => onNavigate?.(sub.id)}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition',
              isActive ? 'bg-white text-black' : 'text-white/40 hover:text-white/70',
            )}
          >
            <Icon size={12} strokeWidth={2.2} />
            <span>{sub.short}</span>
          </button>
        )
      })}
    </div>
  )
}
