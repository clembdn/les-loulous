import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

// Sidebar verticale desktop (lg+), partagée par toutes les apps.
// La structure vient de `sections` : soit une liste d'items à plat, soit un
// groupe (label + sous-items indentés) pour que les sous-features aient leur
// propre entrée au lieu d'être empilées derrière un onglet parent.
export default function AppSidebar({
  title,
  icon: TitleIcon,
  sections,
  active,
  onChange,
  action,
  extra,
  userColors,
  onUserClick,
}) {
  const { currentUid } = useAuth()
  const me = getPerson(currentUid, userColors)
  const ActionIcon = action?.icon

  return (
    <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 flex-col border-r border-border bg-bg/80 backdrop-blur-xl z-30">
      <div className="px-3 pt-5 pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-surface-2 transition"
        >
          <ArrowLeft size={14} /> Nos apps
        </Link>
        <div className="flex items-center gap-2 px-2 mt-2">
          {TitleIcon && <TitleIcon size={18} className="text-accent" />}
          <p className="text-sm font-semibold tracking-tight text-fg">{title}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarSection
            key={section.label || idx}
            section={section}
            active={active}
            onChange={onChange}
            withDivider={idx > 0}
          />
        ))}

        {extra}

        {action && (
          <div className="pt-3 mt-3 border-t border-border">
            <button
              onClick={action.onClick}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg hover:opacity-90 active:scale-[0.98] transition"
            >
              {ActionIcon && <ActionIcon size={15} strokeWidth={2.6} />}
              {action.label}
            </button>
          </div>
        )}
      </nav>

      {me && (
        <div className="px-3 py-4 border-t border-border">
          <UserBadge me={me} onClick={onUserClick} />
        </div>
      )}
    </aside>
  )
}

function UserBadge({ me, onClick }) {
  const avatar = (
    <>
      <span
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border',
          me.bgClass, me.textClass, me.borderClass,
        )}
      >
        {me.initial}
      </span>
      <span className="text-sm text-muted">{me.label}</span>
    </>
  )
  if (!onClick) {
    return <div className="flex items-center gap-3 px-3 py-2">{avatar}</div>
  }
  return (
    <button
      onClick={onClick}
      title="Ouvrir les réglages"
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition"
    >
      {avatar}
    </button>
  )
}

function SidebarSection({ section, active, onChange, withDivider }) {
  // Section plate : une simple pile d'items.
  if (section.type !== 'group') {
    return (
      <div className={cn('space-y-1', withDivider && 'mt-2 pt-2 border-t border-border')}>
        {section.items.map((item) => (
          <SidebarItem key={item.id} item={item} active={active} onChange={onChange} />
        ))}
      </div>
    )
  }

  const GroupIcon = section.icon
  const groupActive = section.items.some((sub) => sub.id === active)
  return (
    <div className={cn(withDivider && 'mt-3 pt-3 border-t border-border')}>
      <div className="px-3 mb-1.5 flex items-center gap-2">
        {GroupIcon && (
          <GroupIcon
            size={12}
            strokeWidth={2.4}
            className={groupActive ? section.accentClass || 'text-fg' : 'text-faint'}
          />
        )}
        <p className={cn(
          'text-[10px] uppercase tracking-[0.2em] font-medium transition',
          groupActive ? 'text-muted' : 'text-faint',
        )}>
          {section.label}
        </p>
      </div>
      <div className="space-y-1">
        {section.items.map((item) => (
          <SidebarItem key={item.id} item={item} active={active} onChange={onChange} indented />
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
        isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-fg hover:bg-surface-2',
      )}
    >
      <Icon size={indented ? 14 : 16} strokeWidth={isActive ? 2.3 : 2} />
      {item.label}
    </button>
  )
}
