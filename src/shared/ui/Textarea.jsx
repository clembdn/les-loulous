import { cn } from '@/shared/lib/utils.js'

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full min-h-[80px] px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition resize-y',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}
