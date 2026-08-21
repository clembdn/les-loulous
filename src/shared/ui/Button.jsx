import { cva } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils.js'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        accent: 'bg-accent text-accent-fg hover:opacity-90',
        secondary: 'bg-surface-2 text-fg border border-border hover:border-border-strong',
        ghost: 'text-muted hover:text-fg hover:bg-surface-2',
        outline: 'border border-border text-fg hover:bg-surface-2',
        // Bouton d'ajout : le pointillé dit « il n'y a rien ici pour l'instant ».
        dashed: 'border border-dashed border-border-strong text-muted hover:text-fg hover:border-accent',
        // Action destructive, discrète tant qu'on ne la survole pas.
        danger: 'text-faint hover:text-danger hover:bg-surface-2',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
        // Boutons à icône seule : carrés, sans padding horizontal.
        icon: 'h-9 w-9 rounded-lg',
        iconSm: 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'accent', size: 'md' },
  },
)

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}
