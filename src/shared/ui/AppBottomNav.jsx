import { cn } from '@/shared/lib/utils.js'

// Barre d'onglets du bas (mobile). `tabletNav` dit jusqu'où elle reste visible :
// les apps qui ont une barre d'onglets tablette la coupent dès `sm`, les autres
// la gardent jusqu'à ce que la sidebar prenne le relais en `lg`.
// Les deux classes sont écrites en toutes lettres — Tailwind ne sait pas
// générer une classe construite dynamiquement.
export default function AppBottomNav({ tabs, active, onChange, tabletNav = false }) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 bg-bg/85 backdrop-blur-xl border-t border-border',
        tabletNav ? 'sm:hidden' : 'lg:hidden',
      )}
    >
      {/* Chaque onglet prend une fraction égale de la largeur : à cinq onglets,
          un padding fixe fait déborder la barre sur un écran de 360 px. */}
      <div className="flex items-stretch px-1 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = isTabActive(tab, active)
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.route || tab.id)}
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

// Un onglet mobile peut regrouper plusieurs sous-pages (`activeFor`) qui ont
// chacune leur entrée dans la sidebar desktop.
export function isTabActive(tab, active) {
  return tab.activeFor ? tab.activeFor.includes(active) : tab.id === active
}
