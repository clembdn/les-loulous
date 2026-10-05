import { cn } from '@/shared/lib/utils.js'
import { attachmentSrc } from '../../services/attachmentsService.js'

// Vignette d'une capture : le HAUT de l'image (là où sont la référence et le
// nom de l'hôtel), recadré plutôt que réduit en entier.
export default function AttachmentThumb({ attachment, onClick, className, children }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border bg-surface-2', className)}>
      <button type="button" onClick={onClick} className="block h-full w-full" title={attachment.name || 'Voir la capture'}>
        <img
          src={attachmentSrc(attachment)}
          alt={attachment.name || 'Capture'}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
        />
      </button>
      {children}
    </div>
  )
}
