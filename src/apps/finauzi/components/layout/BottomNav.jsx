import { MOBILE_TABS } from '../../config/navigation.js'
import { cn } from '@/shared/lib/utils.js'

// Mobile-only bottom tab bar.
export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-bg/80 backdrop-blur-xl border-t border-border sm:hidden">
      {/* Cinq onglets doivent tenir sur 360 px : chacun prend une fraction
          égale de la largeur plutôt qu'un padding fixe. */}
      <div className="flex items-stretch px-1 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.activeFor.includes(active)
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.route)}
              className={cn(
                'flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-1.5 rounded-xl text-[10px] font-medium transition',
                isActive ? 'text-accent' : 'text-muted hover:text-fg',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              <span className="truncate max-w-full">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
