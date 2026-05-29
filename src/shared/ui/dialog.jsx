import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

// Centered card on desktop, bottom sheet on mobile (matches existing FinAuzi UX).
export function DialogContent({ className, children, showClose = true, title, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-[#11151C] border border-white/10 shadow-2xl',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          // Desktop: centered
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-full sm:max-w-md sm:rounded-2xl sm:bottom-auto',
          'sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2',
          'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
          'duration-200',
          className,
        )}
        {...props}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
            {title && (
              <DialogPrimitive.Title className="text-base font-semibold text-white">
                {title}
              </DialogPrimitive.Title>
            )}
            {!title && <span />}
            {showClose && (
              <DialogPrimitive.Close
                className="text-white/40 hover:text-white p-1 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Fermer"
              >
                <X size={18} />
              </DialogPrimitive.Close>
            )}
          </div>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogBody({ className, ...props }) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)} {...props} />
  )
}

export function DialogFooter({ className, ...props }) {
  return (
    <div className={cn('px-5 py-4 border-t border-white/5 flex-shrink-0', className)} {...props} />
  )
}
