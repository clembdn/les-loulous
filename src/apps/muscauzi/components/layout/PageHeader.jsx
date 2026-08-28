import { cn } from '@/shared/lib/utils.js'

/**
 * L'en-tête d'un écran : surtitre, titre, sous-titre, action à droite.
 *
 * Il était recopié en haut de chaque vue, avec les mêmes trois lignes de
 * classes — donc avec de petites dérives d'une vue à l'autre (marges, tailles,
 * graisse du surtitre). Un seul composant, et les cinq écrans commencent
 * exactement pareil.
 *
 * Local à MuscAuzi : Cook'It et FinAuzi ont leurs propres en-têtes, réglés
 * écran par écran, et il n'y a rien à gagner à les aligner de force.
 */
export default function PageHeader({ eyebrow, title, subtitle, action, className }) {
  return (
    <header className={cn('mb-5 flex items-start gap-3', className)}>
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.18em] text-faint">{eyebrow}</p>
        )}
        <h1 className={cn(
          'text-2xl font-semibold tracking-[-0.02em] text-fg',
          eyebrow && 'mt-1',
        )}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 mt-1">{action}</div>}
    </header>
  )
}
