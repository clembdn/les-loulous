import { Dialog, DialogContent, DialogBody, DialogFooter } from './dialog.jsx'

/**
 * Wrapper kept for API back-compat with existing call sites.
 * Internally uses Radix Dialog (focus trap, scroll lock, escape, accessibility).
 */
export default function Modal({ open, onClose, title, children, footer }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent title={title}>
        <DialogBody>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
