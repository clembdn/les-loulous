import { cn } from '@/shared/lib/utils.js'

export function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        'text-xs font-medium text-muted leading-none peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
