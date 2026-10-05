import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { attachmentSrc } from '../../services/attachmentsService.js'

/**
 * Les captures en plein écran — ce qu'on tend à l'accueil de l'hôtel.
 *
 * L'image prend toute la largeur et défile en hauteur : un mail de
 * réservation est long, le réduire pour qu'il tienne en entier le rendrait
 * illisible. Le zoom à deux doigts reste celui du téléphone.
 */
export default function AttachmentViewer({ attachments, index, onClose }) {
  const open = index !== null && attachments.length > 0
  const [current, setCurrent] = useState(index ?? 0)

  useEffect(() => {
    if (index !== null) setCurrent(index)
  }, [index])

  const attachment = attachments[current] || attachments[0]
  const many = attachments.length > 1
  const go = (delta) => setCurrent((i) => (i + delta + attachments.length) % attachments.length)

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (!many) return
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
          className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 text-white">
            <Dialog.Title className="flex-1 min-w-0 text-sm font-medium truncate">
              {attachment?.name || 'Capture'}
              {many && <span className="ml-2 text-white/50 tabular">{current + 1}/{attachments.length}</span>}
            </Dialog.Title>
            <Dialog.Close className="p-2 -mr-2 rounded-lg text-white/70 hover:text-white" aria-label="Fermer">
              <X size={20} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {attachment && (
              <img
                src={attachmentSrc(attachment)}
                alt={attachment.name || 'Capture de la réservation'}
                className="block w-full max-w-3xl mx-auto h-auto bg-white"
              />
            )}
          </div>
          {many && (
            <div className="flex justify-center gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
              <button type="button" onClick={() => go(-1)} className="h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Capture précédente">
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={() => go(1)} className="h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Capture suivante">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
