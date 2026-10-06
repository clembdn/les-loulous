import { cn } from '@/shared/lib/utils.js'

// Un champ de formulaire et son libellé. Le <label> englobe le contrôle :
// toucher le libellé place le curseur dans le champ, sans id à câbler.
export default function Field({ label, optional = false, hint, className, children }) {
  return (
    <label className={cn('block', className)}>
      <span className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted">{label}</span>
        {optional && <span className="text-[12px] text-muted">facultatif</span>}
      </span>
      {children}
      {hint && <span className="block text-[13px] text-muted mt-1.5">{hint}</span>}
    </label>
  )
}
