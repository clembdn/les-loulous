import { MOBILE_TABS } from '../../config/navigation.js'
import { cn } from '@/shared/lib/utils.js'

// Mobile-only bottom tab bar.
export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[#0B0E13]/90 backdrop-blur-xl border-t border-white/5 sm:hidden">
      <div className="flex items-center justify-around px-2 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.activeFor.includes(active)
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.route)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-[10px] font-medium transition',
                isActive ? 'text-white' : 'text-white/40 hover:text-white/80',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
