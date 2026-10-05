import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { KeyboardInsetProbe } from '@/shared/lib/keyboardInset.js'
import { cn } from '@/shared/lib/utils.js'
import { Button } from './Button.jsx'

/**
 * Feuille qui suit les TOKENS du thème : panneau bas sur mobile, modale
 * centrée dès `sm`.
 *
 * `sheet.jsx` et `dialog.jsx` sont codés en dur sombres (fond #11151C, titre
 * blanc) : sur une app claire, le titre disparaît dans le fond. Cook'It avait
 * sa propre copie à tokens ; Trip Planner en a besoin aussi, d'où ce composant
 * partagé — Cook'It le ré-exporte tel quel.
 *
 * `size` n'élargit que la modale desktop, pour les longs formulaires : sur
 * téléphone la feuille prend toujours toute la largeur. `footer` reste collé
 * en bas, hors de la zone qui défile, et laisse la place à la barre d'accueil
 * de l'iPhone.
 */
const SIZES = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
}

export function ThemedSheet({ open, onOpenChange, title, description, footer, size = 'md', children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          // Sans description, Radix réclame en console un `aria-describedby`
          // explicite : le lien vers un texte absent ne décrirait rien.
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed z-50 inset-x-0 kb-safe flex flex-col rounded-t-2xl border-t border-border bg-surface text-fg shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:rounded-2xl sm:border',
            SIZES[size] || SIZES.md,
          )}
        >
          <KeyboardInsetProbe />
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-fg">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-muted mt-0.5">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="text-muted hover:text-fg p-1 rounded-lg transition" aria-label="Fermer">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-4 border-t border-border flex-shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Garde-fou avant une action irréversible, à tokens.
 *
 * `details` énumère ce qui disparaît en plus de l'objet lui-même — personne ne
 * doit découvrir après coup qu'un voyage a emporté ses captures. La feuille se
 * ferme dès la confirmation : l'écriture part sans être attendue (hors-ligne,
 * elle ne se résoudrait qu'au retour du réseau).
 */
export function ThemedConfirm({
  open,
  title,
  message,
  details,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  onConfirm,
  onClose,
}) {
  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={title}
      footer={(
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{cancelLabel}</Button>
          <Button
            className="flex-1 bg-danger text-white hover:opacity-90"
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </Button>
        </div>
      )}
    >
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
    </ThemedSheet>
  )
}
