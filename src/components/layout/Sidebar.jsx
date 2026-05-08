import { Plane, Settings, LogOut, Scale } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPersonByUid, getPersonUidForAuthUser } from '../../config/people.js'

const NAV = [
  { id: 'australia', label: 'Trésorerie', icon: Plane },
  { id: 'equilibre', label: 'Équilibre', icon: Scale },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

export default function Sidebar({ active, onSelect, mobileOpen, onCloseMobile }) {
  const { currentUser, logout } = useAuth()
  const personUid = getPersonUidForAuthUser(currentUser)
  const person = getPersonByUid(personUid)

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 border-r border-border-subtle bg-bg-elevated/80 backdrop-blur-xl transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 border border-brand/30">
              <Plane className="h-4 w-4 text-brand-glow" />
            </div>
            <span className="font-semibold tracking-tight">FinAuzi</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden rounded-md p-1.5 text-text-secondary hover:bg-bg-hover"
            aria-label="Close menu"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = item.id === active
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`nav-item w-full ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {person?.label || 'Utilisateur'}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
