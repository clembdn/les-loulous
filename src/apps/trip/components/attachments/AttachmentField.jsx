import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { compressImage } from '../../services/imageService.js'
import AttachmentThumb from './AttachmentThumb.jsx'
import AttachmentViewer from './AttachmentViewer.jsx'

// Au-delà, le lot d'enregistrement (fiche + captures) approcherait la limite
// de 10 Mo d'une requête Firestore.
export const MAX_ATTACHMENTS = 6

/**
 * Les captures d'une réservation, dans son formulaire.
 *
 * Rien n'est écrit ici : le champ tient la liste des ajouts (déjà compressés)
 * et des retraits, et le formulaire les enregistre AVEC la fiche, dans le
 * même lot. Annuler ne laisse donc rien derrière soi.
 *
 * Trois façons d'ajouter : choisir un fichier, glisser une image, ou coller
 * (Ctrl+V) une capture prise à l'instant — le geste le plus rapide sur
 * ordinateur.
 */
export default function AttachmentField({ existing = [], value, onChange }) {
  const inputRef = useRef(null)
  const [pending, setPending] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [viewing, setViewing] = useState(null)

  const kept = existing.filter((a) => !value.remove.includes(a.id))
  const shown = [...kept, ...value.add]
  const room = MAX_ATTACHMENTS - shown.length - pending

  // `value` change à chaque ajout : la référence courante évite qu'une
  // compression qui se termine écrase un ajout fait pendant qu'elle tournait.
  const latest = useRef(value)
  latest.current = value

  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room))
    if (!images.length) {
      if (files.length) toast.error(room > 0 ? 'Seules les images sont acceptées' : `${MAX_ATTACHMENTS} captures maximum`)
      return
    }
    setPending((n) => n + images.length)
    for (const file of images) {
      try {
        const compressed = await compressImage(file)
        onChange({ ...latest.current, add: [...latest.current.add, { ...compressed, key: `${Date.now()}-${Math.random()}` }] })
      } catch {
        toast.error(`« ${file.name || 'Image'} » n’a pas pu être lue`)
      } finally {
        setPending((n) => n - 1)
      }
    }
  }

  // Coller une capture n'importe où dans le formulaire. Un collage de TEXTE
  // (dans un champ) n'a pas d'image : il passe sans être touché.
  useEffect(() => {
    function onPaste(e) {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      addFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  })

  function removeExisting(id) {
    onChange({ ...value, remove: [...value.remove, id] })
  }

  function removeAdded(key) {
    onChange({ ...value, add: value.add.filter((a) => a.key !== key) })
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        className={cn('grid grid-cols-3 sm:grid-cols-4 gap-2 rounded-2xl transition', dragOver && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
      >
        {kept.map((a, i) => (
          <AttachmentThumb key={a.id} attachment={a} onClick={() => setViewing(i)} className="aspect-[3/4]">
            <RemoveButton onClick={() => removeExisting(a.id)} />
          </AttachmentThumb>
        ))}
        {value.add.map((a, i) => (
          <AttachmentThumb key={a.key} attachment={a} onClick={() => setViewing(kept.length + i)} className="aspect-[3/4]">
            <RemoveButton onClick={() => removeAdded(a.key)} />
          </AttachmentThumb>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className="aspect-[3/4] rounded-xl border border-border bg-surface-2 flex items-center justify-center">
            <Loader2 size={18} className="text-faint animate-spin" />
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-[3/4] rounded-xl border border-dashed border-border-strong text-muted hover:text-fg hover:border-accent transition flex flex-col items-center justify-center gap-1.5 px-2 text-center"
          >
            <ImagePlus size={20} />
            <span className="text-[11px] leading-tight">Ajouter une capture</span>
          </button>
        )}
      </div>
      <p className="hidden sm:block mt-1.5 text-xs text-faint">Astuce : collez directement une capture d’écran avec Ctrl+V.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
      />
      <AttachmentViewer attachments={shown} index={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
      aria-label="Retirer la capture"
    >
      <X size={14} />
    </button>
  )
}
