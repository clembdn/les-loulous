import { Plus, Settings } from 'lucide-react'
import { SIDEBAR_SECTIONS } from '../../config/navigation.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useUI } from '../../context/UIContext.jsx'
import { getPerson } from '../../config/people.js'
import { cn } from '../../lib/utils.js'

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

      <nav className="flex-1 px-3 overflow-y-auto">
        {SIDEBAR_SECTIONS.map((section, idx) => (
          <SidebarSection
            key={idx}
            section={section}
            active={active}
            onChange={onChange}
            withDivider={idx > 0}
          />
        ))}

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
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                me.bgClass, me.textClass, me.borderClass,
              )}
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

function SidebarSection({ section, active, onChange, withDivider }) {
  if (section.type === 'items') {
    return (
      <div className={cn('space-y-1', withDivider && 'mt-2 pt-2 border-t border-white/5')}>
        {section.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            active={active}
            onChange={onChange}
          />
        ))}
      </div>
    )
  }

  // Group: a label + sub-items indented below.
  const GroupIcon = section.icon
  const groupActive = section.items.some((sub) => sub.id === active)
  return (
    <div className={cn(withDivider && 'mt-3 pt-3 border-t border-white/5')}>
      <div className="px-3 mb-1.5 flex items-center gap-2">
        {GroupIcon && (
          <GroupIcon
            size={12}
            strokeWidth={2.4}
            className={cn(groupActive ? section.accentClass || 'text-white' : 'text-white/30')}
          />
        )}
        <p className={cn(
          'text-[10px] uppercase tracking-[0.2em] font-medium transition',
          groupActive ? 'text-white/60' : 'text-white/30',
        )}>
          {section.label}
        </p>
      </div>
      <div className="space-y-1">
        {section.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            active={active}
            onChange={onChange}
            indented
          />
        ))}
      </div>
    </div>
  )
}

function SidebarItem({ item, active, onChange, indented }) {
  const Icon = item.icon
  const isActive = active === item.id
  return (
    <button
      onClick={() => onChange(item.id)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
        indented && 'ml-1',
        isActive
          ? 'bg-white/[0.06] text-white'
          : 'text-white/40 hover:text-white hover:bg-white/[0.03]',
      )}
    >
      <Icon size={indented ? 14 : 16} strokeWidth={isActive ? 2.3 : 2} />
      {item.label}
    </button>
  )
}
