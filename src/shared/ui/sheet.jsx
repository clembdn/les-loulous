import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetPortal = DialogPrimitive.Portal

function SheetOverlay({ className, ...props }) {
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

const sideStyles = {
  right:
    'inset-y-0 right-0 h-full w-full max-w-md border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
  left:
    'inset-y-0 left-0 h-full w-full max-w-md border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
  top:
    'inset-x-0 top-0 w-full border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
  bottom:
    'inset-x-0 bottom-0 w-full max-h-[90vh] rounded-t-2xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
}

/**
 * Side panel sheet. On mobile defaults to bottom for thumb-reach;
 * on desktop (sm+) you can pass `desktopSide="right"` (default) to slide from the side.
 */
export function SheetContent({
  className,
  children,
  side = 'bottom',
  desktopSide = 'right',
  title,
  showClose = true,
  ...props
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-[#11151C] border-white/10 shadow-2xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
          // Mobile side
          sideStyles[side],
          // Desktop side override (sm+) — reset mobile inset/anim then apply desktop
          desktopSide !== side &&
            'sm:inset-auto sm:rounded-none sm:max-h-none ' +
              (desktopSide === 'right'
                ? 'sm:inset-y-0 sm:right-0 sm:h-full sm:w-full sm:max-w-md sm:border-l sm:border-t-0 sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right'
                : desktopSide === 'left'
                  ? 'sm:inset-y-0 sm:left-0 sm:h-full sm:w-full sm:max-w-md sm:border-r sm:border-t-0 sm:data-[state=open]:slide-in-from-left sm:data-[state=closed]:slide-out-to-left'
                  : ''),
          className,
        )}
        {...props}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
            {title ? (
              <DialogPrimitive.Title className="text-base font-semibold text-white">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <span />
            )}
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
    </SheetPortal>
  )
}

export function SheetBody({ className, ...props }) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)} {...props} />
  )
}

export function SheetFooter({ className, ...props }) {
  return (
    <div className={cn('px-5 py-4 border-t border-white/5 flex-shrink-0', className)} {...props} />
  )
}
