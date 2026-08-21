import { cn } from '@/shared/lib/utils.js'

const VARIANTS = {
  neutral: 'border-border bg-surface-2 text-muted',
  accent: 'border-accent/30 bg-accent/5 text-muted',
  success: 'border-success/30 bg-success/5 text-muted',
  warning: 'border-warning/30 bg-warning/5 text-muted',
  danger: 'border-danger/30 bg-danger/5 text-muted',
}

const ICON_TONE = {
  neutral: 'text-faint',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

export function Alert({ variant = 'neutral', icon: Icon, title, children, className }) {
  return (
    <div className={cn('flex items-start gap-2.5 p-3 rounded-xl border', VARIANTS[variant], className)}>
      {Icon && <Icon size={15} className={cn('shrink-0 mt-0.5', ICON_TONE[variant])} />}
      <div className="min-w-0 flex-1">
        {title && <p className="text-xs font-semibold text-fg mb-0.5">{title}</p>}
        <div className="text-[11px] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
