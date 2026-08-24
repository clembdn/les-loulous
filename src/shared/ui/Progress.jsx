import { cn } from '@/shared/lib/utils.js'

/**
 * Barre de progression. `value` et `max` en unités réelles (3 sur 5), pas en
 * pourcentage : l'appelant ne doit pas avoir à faire la division, et la valeur
 * accessible annonce « 3 sur 5 » plutôt qu'un pourcentage sans repère.
 */
export function Progress({ value = 0, max = 1, className, barClassName, label }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('h-1.5 w-full rounded-full bg-surface-2 overflow-hidden', className)}
    >
      <div
        className={cn('h-full rounded-full bg-accent transition-[width] duration-500 ease-ios', barClassName)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}

/**
 * Le même compte, en anneau.
 *
 * Le tracé part à midi (rotation -90°) et se remplit dans le sens des aiguilles.
 * `strokeDasharray`/`dashoffset` plutôt qu'un arc calculé : une seule propriété
 * animée, donc pas de recalcul de chemin à chaque image.
 */
export function ProgressRing({
  value = 0,
  max = 1,
  size = 44,
  stroke = 4,
  className,
  trackClassName = 'text-fg/10',
  barClassName = 'text-accent',
  children,
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke="currentColor" className={trackClassName}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke="currentColor" strokeLinecap="round" className={cn(barClassName, 'transition-[stroke-dashoffset] duration-500 ease-ios')}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      {children != null && (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      )}
    </div>
  )
}
