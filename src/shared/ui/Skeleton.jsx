import { cn } from '@/shared/lib/utils.js'

// Fantôme de chargement. Il reprend la HAUTEUR et le rayon du contenu qu'il
// remplace : un fantôme qui ne fait pas la bonne taille fait sauter la page au
// moment où les vraies données arrivent.
export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl border border-border bg-surface', className)}
      {...props}
    />
  )
}

// Une pile de fantômes identiques — le cas courant d'une liste.
export function SkeletonList({ count = 4, className, itemClassName }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={itemClassName} />
      ))}
    </div>
  )
}
