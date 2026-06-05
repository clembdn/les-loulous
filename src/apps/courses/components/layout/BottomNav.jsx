import { COURSES_TABS } from '../../config/navigation.js'
import { cn } from '@/shared/lib/utils.js'

// Mobile/tablet bottom tab bar (caché sur lg+ où la sidebar prend le relais).
export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg/85 backdrop-blur-xl border-t border-border lg:hidden">
      <div className="flex items-center justify-around px-2 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {COURSES_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-[10px] font-medium transition',
                isActive ? 'text-accent' : 'text-muted hover:text-fg',
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
