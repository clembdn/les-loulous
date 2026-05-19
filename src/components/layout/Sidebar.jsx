import { Plus, Settings } from 'lucide-react'
import { TABS } from './BottomNav.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useUI } from '../../context/UIContext.jsx'
import { getPerson } from '../../config/people.js'

// Desktop-only vertical sidebar (lg+). Replaces the top header on large screens.
export default function Sidebar({ active, onChange }) {
  const { currentUser } = useAuth()
  const { openForm, openSettings } = useUI()
  const me = getPerson(currentUser?.uid)

  return (
    <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 flex-col border-r border-white/5 bg-[#0B0E13]/90 backdrop-blur-xl z-30">
      <div className="px-5 pt-6 pb-4">
        <p className="text-sm font-semibold tracking-tight text-white">FinAuzi</p>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-white/[0.06] text-white'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.3 : 2} />
              {tab.label}
            </button>
          )
        })}

        <div className="pt-3 mt-3 border-t border-white/5">
          <button
            onClick={() => openForm(null)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 active:scale-[0.98] transition"
          >
            <Plus size={15} strokeWidth={2.6} />
            Nouvelle transaction
          </button>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-white/5 space-y-1">
        <button
          onClick={openSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/40 hover:text-white hover:bg-white/[0.03] transition"
        >
          <Settings size={15} strokeWidth={2} />
          Réglages
        </button>

        {me && (
          <button
            onClick={openSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition"
            title="Ouvrir les réglages"
          >
            <span
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border ${me.bgClass} ${me.textClass} ${me.borderClass}`}
            >
              {me.initial}
            </span>
            <span className="text-sm text-white/70">{me.label}</span>
          </button>
        )}
      </div>
    </aside>
  )
}
