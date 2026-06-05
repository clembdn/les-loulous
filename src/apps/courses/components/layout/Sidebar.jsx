import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBasket } from 'lucide-react'
import { COURSES_TABS } from '../../config/navigation.js'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

// Desktop-only vertical sidebar (lg+). Remplace le header en-page sur grand écran.
export default function Sidebar({ active, onChange }) {
  const { currentUid } = useAuth()
  const me = getPerson(currentUid)

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
          <ShoppingBasket size={18} className="text-accent" />
          <p className="text-sm font-semibold tracking-tight text-fg">Courses</p>
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto space-y-1">
        {COURSES_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-fg hover:bg-surface-2',
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.3 : 2} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {me && (
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <span
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                me.bgClass, me.textClass, me.borderClass,
              )}
            >
              {me.initial}
            </span>
            <span className="text-sm text-muted">{me.label}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
