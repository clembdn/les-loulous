import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

// Bottom-sheet token-based (le sheet.jsx partagé est codé en dur sombre).
// Mobile : panneau bas ; desktop (sm+) : modale centrée.
export function Sheet({ open, onOpenChange, title, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed z-50 inset-x-0 bottom-0 max-h-[90vh] flex flex-col rounded-t-2xl border-t border-border bg-surface text-fg shadow-2xl
            data-[state=open]:animate-in data-[state=closed]:animate-out duration-300
            data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom
            sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <Dialog.Title className="text-base font-semibold text-fg">{title}</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-fg p-1 rounded-lg transition" aria-label="Fermer">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
