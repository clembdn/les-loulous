import { cn } from '@/shared/lib/utils.js'

/**
 * Tableau de données.
 *
 * Le conteneur défile HORIZONTALEMENT plutôt que de laisser les colonnes se
 * comprimer : un tableau qui rétrécit jusqu'à couper ses nombres ne se lit
 * plus, alors qu'un tableau qui déborde se pousse du doigt.
 *
 * Aucune bordure verticale : les colonnes se lisent à leur alignement. Un
 * quadrillage complet ajoute du trait sans ajouter d'information.
 */
export function Table({ className, containerClassName, ...props }) {
  return (
    <div className={cn('relative w-full overflow-x-auto', containerClassName)}>
      <table className={cn('w-full caption-bottom text-sm border-collapse', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, selected = false, ...props }) {
  return (
    <tr
      // La ligne sélectionnée porte l'accent ET un liseré à gauche : sur un
      // tableau long, une simple teinte de fond se perd dès qu'on fait défiler.
      data-state={selected ? 'selected' : undefined}
      className={cn(
        'border-b border-border transition-colors',
        'data-[state=selected]:bg-accent/10',
        className,
      )}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        'h-9 px-3 text-left align-middle whitespace-nowrap',
        'text-[10px] font-medium uppercase tracking-[0.14em] text-faint',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />
}

export function TableCaption({ className, ...props }) {
  return <caption className={cn('mt-3 text-[11px] text-faint', className)} {...props} />
}
