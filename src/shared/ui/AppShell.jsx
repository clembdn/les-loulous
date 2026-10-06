import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft } from 'lucide-react'
import AppSidebar from './AppSidebar.jsx'
import AppBottomNav, { isTabActive } from './AppBottomNav.jsx'
import { cn } from '@/shared/lib/utils.js'

// Coquille commune à toutes les apps : sidebar (lg+), top-bar mobile,
// barre d'onglets tablette optionnelle, bottom-nav, et le contenu au milieu.
// Les vues ne rendent que leur propre contenu. `back` ({ to, label }) remplace
// la flèche vers le portail de la top-bar mobile par un retour au parent ;
// `action` ({ icon, label, onClick }) y ajoute un bouton à droite.
export default function AppShell({
  title,
  icon,
  heading,
  active,
  onChange,
  sections,
  tabs,
  tabletNav = false,
  sidebarAction,
  sidebarExtra,
  userColors,
  onUserClick,
  back = null,
  action = null,
  children,
}) {
  return (
    <div className="min-h-screen bg-bg text-fg lg:flex">
      <AppSidebar
        title={title}
        icon={icon}
        sections={sections}
        active={active}
        onChange={onChange}
        action={sidebarAction}
        extra={sidebarExtra}
        userColors={userColors}
        onUserClick={onUserClick}
      />

      <div className="flex-1 min-w-0 lg:ml-60">
        <div
          className={cn(
            'sticky top-0 z-20 bg-bg/85 backdrop-blur-xl border-b border-border',
            tabletNav ? 'sm:hidden' : 'lg:hidden',
          )}
        >
          {back ? (
            // Un niveau à remonter dans l'app (un voyage → la liste) : le
            // libellé du parent, comme la barre de navigation d'un téléphone.
            <div className="max-w-xl mx-auto px-1 h-12 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <Link to={back.to} className="justify-self-start h-11 pl-1 pr-2 inline-flex items-center gap-0.5 text-[15px] text-accent min-w-0">
                <ChevronLeft size={22} strokeWidth={2.2} className="shrink-0" />
                <span className="truncate">{back.label}</span>
              </Link>
              <p className="max-w-[56vw] text-[15px] font-semibold tracking-tight text-fg truncate">{heading || title}</p>
              {action ? (
                <button
                  type="button"
                  onClick={action.onClick}
                  aria-label={action.label}
                  className="justify-self-end h-11 w-11 inline-flex items-center justify-center text-accent"
                >
                  <action.icon size={24} strokeWidth={2.2} />
                </button>
              ) : <span />}
            </div>
          ) : (
            <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
              <BackLink size={18} />
              <p className="text-sm font-semibold tracking-tight text-fg">{heading || title}</p>
            </div>
          )}
        </div>

        {tabletNav && (
          <header className="hidden sm:block lg:hidden sticky top-0 z-20 bg-bg/80 backdrop-blur-xl border-b border-border">
            <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-6">
              <BackLink size={16} />
              <p className="text-sm font-semibold tracking-tight text-fg">{title}</p>
              <div className="flex items-center gap-1 ml-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = isTabActive(tab, active)
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onChange(tab.route || tab.id)}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                        isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-fg hover:bg-surface-2',
                      )}
                    >
                      <Icon size={15} strokeWidth={isActive ? 2.3 : 2} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </header>
        )}

        <main>{children}</main>

        {/* Un écran sans onglets (la liste des voyages de Trip Planner) n'a pas
            de barre du bas : vide, elle resterait collée sous le contenu. */}
        {tabs?.length > 0 && (
          <AppBottomNav tabs={tabs} active={active} onChange={onChange} tabletNav={tabletNav} />
        )}
      </div>
    </div>
  )
}

function BackLink({ size }) {
  return (
    <Link to="/" className="text-muted hover:text-fg transition shrink-0" title="Nos apps">
      <ArrowLeft size={size} />
    </Link>
  )
}
