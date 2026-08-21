import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

// Case à cocher accessible bâtie sur l'input natif : le focus, le clavier et
// le libellé viennent gratuitement, et on évite une dépendance Radix de plus
// pour un contrôle aussi simple.
export function Checkbox({ checked, onCheckedChange, label, className, id, ...props }) {
  return (
    <label className={cn('inline-flex items-center gap-2.5 cursor-pointer group', className)}>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'h-5 w-5 rounded-md border flex items-center justify-center transition-all duration-200 ease-ios',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
            checked
              ? 'bg-accent border-accent text-accent-fg'
              : 'bg-surface-2 border-border group-hover:border-border-strong text-transparent',
          )}
        >
          <Check size={13} strokeWidth={3} />
        </span>
      </span>
      {label && <span className="text-sm text-muted select-none">{label}</span>}
    </label>
  )
}
