import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import BottomNav from './BottomNav.jsx'
import { getTab } from '../../config/navigation.js'

// Shell de l'app Courses : sidebar (lg+), top-bar + bottom-nav (mobile/tablette).
// Les vues ne rendent que leur contenu (+ leur propre toolbar d'actions).
export default function Shell({ active, onChange, children }) {
  const tab = getTab(active)

  return (
    <div className="min-h-screen bg-bg text-fg lg:flex">
      <Sidebar active={active} onChange={onChange} />

      <div className="flex-1 min-w-0 lg:ml-60">
        {/* Top-bar mobile/tablette : retour plateforme + libellé de la sous-feature. */}
        <div className="lg:hidden sticky top-0 z-20 bg-bg/85 backdrop-blur-xl border-b border-border">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link to="/" className="text-muted hover:text-fg transition" title="Nos apps">
              <ArrowLeft size={18} />
            </Link>
            <p className="text-sm font-semibold tracking-tight text-fg">{tab.label}</p>
          </div>
        </div>

        <main>{children}</main>

        <BottomNav active={active} onChange={onChange} />
      </div>
    </div>
  )
}
