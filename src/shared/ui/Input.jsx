import { forwardRef } from 'react'
import { cn } from '@/shared/lib/utils.js'

// `ref` transmis jusqu'au champ : un parent peut lui donner le focus.
export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full h-11 px-4 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition',
        className,
      )}
      {...props}
    />
  )
})
