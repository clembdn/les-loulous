import { Copy } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { confirm as haptic } from '@/shared/lib/haptics.js'

/**
 * Une valeur à recopier ailleurs — référence de réservation, code d'accès —
 * copiée d'un tap. Le presse-papiers peut être refusé (page pas au premier
 * plan, vieux navigateur) : la valeur reste sélectionnable à la main.
 */
export default function CopyValue({ label, value, mono = true, large = false, className }) {
  if (!value) return null
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      haptic()
      toast.success(`${label} copié${label.endsWith('e') ? 'e' : ''}`)
    } catch {
      toast.error('Copie impossible : sélectionnez le texte à la main')
    }
  }
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</p>
      <button
        type="button"
        onClick={copy}
        className="group mt-0.5 inline-flex max-w-full items-center gap-2 text-left select-text"
        title="Copier"
      >
        <span className={cn('truncate text-fg', mono && 'font-mono', large ? 'text-xl font-semibold tracking-wide' : 'text-sm')}>{value}</span>
        <Copy size={13} className="shrink-0 text-faint group-hover:text-accent transition" />
      </button>
    </div>
  )
}
