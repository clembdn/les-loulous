import { Sheet } from './Sheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', onConfirm, onClose }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title}>
      <p className="text-sm text-muted mb-5">{message}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button className="flex-1" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  )
}
