import { Dialog, DialogContent, DialogBody, DialogFooter } from './dialog.jsx'
import { Button } from './Button.jsx'

/**
 * Garde-fou avant une action irréversible.
 *
 * `details` (optionnel) énumère ce qui va disparaître en plus de l'objet
 * lui-même : personne ne doit découvrir après coup qu'une suppression a
 * emporté six mois d'historique.
 *
 * Le bouton de confirmation est plein et rouge — on ne le clique pas par
 * inadvertance en visant « Annuler ».
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent title={title} className="bg-surface border-border">
        <DialogBody>
          {message && <p className="text-sm text-muted leading-relaxed">{message}</p>}
          {details?.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {details.map((d) => (
                <li key={d} className="flex gap-2 text-sm text-fg">
                  <span aria-hidden="true" className="text-danger">•</span>
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{cancelLabel}</Button>
          <Button
            className="flex-1 bg-danger text-white hover:opacity-90"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
