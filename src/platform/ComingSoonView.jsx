import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getApp } from './apps.config.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'

export default function ComingSoonView({ appId }) {
  const app = getApp(appId)
  useAppTheme(app?.theme || 'light', app?.accent || 'emerald')
  const Icon = app?.icon

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6 fade-in">
      {Icon && (
        <span className="h-16 w-16 rounded-2xl flex items-center justify-center bg-accent/10 text-accent border border-accent/20">
          <Icon size={30} strokeWidth={2} />
        </span>
      )}
      <div>
        <h1 className="text-xl font-semibold text-fg">{app?.name || 'App'}</h1>
        <p className="text-sm text-muted mt-1">Bientôt disponible.</p>
      </div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition">
        <ArrowLeft size={14} /> Nos apps
      </Link>
    </div>
  )
}
