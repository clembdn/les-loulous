import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getApp } from './apps.config.js'
import { COLOR_BY_ID } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

export default function ComingSoonView({ appId }) {
  const app = getApp(appId)
  const Icon = app?.icon
  const color = COLOR_BY_ID[app?.accent] || COLOR_BY_ID.amber

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6 fade-in">
      {Icon && (
        <span className={cn(
          'h-16 w-16 rounded-2xl flex items-center justify-center border',
          color.bgClass, color.textClass, color.borderClass,
        )}>
          <Icon size={30} strokeWidth={2} />
        </span>
      )}
      <div>
        <h1 className="text-xl font-semibold text-white">{app?.name || 'App'}</h1>
        <p className="text-sm text-white/40 mt-1">Bientôt disponible.</p>
      </div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition">
        <ArrowLeft size={14} /> Nos apps
      </Link>
    </div>
  )
}
