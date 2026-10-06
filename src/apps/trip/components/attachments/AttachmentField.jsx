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
 *
 * `compact` : une rangée de vignettes, et tant qu'il n'y en a aucune, un
 * seul grand bouton — la capture est en tête du formulaire.
 */
export default function AttachmentField({ existing = [], value, onChange, compact = false }) {
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
        className={cn(
          'rounded-2xl transition',
          compact ? 'flex gap-2 overflow-x-auto no-scrollbar' : 'grid grid-cols-3 sm:grid-cols-4 gap-2',
          dragOver && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
        )}
      >
        {kept.map((a, i) => (
          <AttachmentThumb key={a.id} attachment={a} onClick={() => setViewing(i)} className={cn('aspect-[3/4]', compact && 'w-[84px] shrink-0')}>
            <RemoveButton onClick={() => removeExisting(a.id)} />
          </AttachmentThumb>
        ))}
        {value.add.map((a, i) => (
          <AttachmentThumb key={a.key} attachment={a} onClick={() => setViewing(kept.length + i)} className={cn('aspect-[3/4]', compact && 'w-[84px] shrink-0')}>
            <RemoveButton onClick={() => removeAdded(a.key)} />
          </AttachmentThumb>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className={cn('aspect-[3/4] rounded-xl border border-border bg-surface-2 flex items-center justify-center', compact && 'w-[84px] shrink-0')}>
            <Loader2 size={18} className="text-muted animate-spin" />
          </div>
        ))}
        {room > 0 && compact && shown.length + pending === 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-[72px] rounded-2xl border border-dashed border-border-strong px-4 py-3 flex items-center gap-3 text-left transition hover:border-accent hover:bg-accent/5"
          >
            <span className="h-11 w-11 shrink-0 rounded-xl bg-accent text-accent-fg flex items-center justify-center">
              <ImagePlus size={20} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-fg">Ajouter la capture</span>
              <span className="block text-[13px] text-muted">Le mail ou le billet : on le montre sur place, même sans réseau</span>
            </span>
          </button>
        )}
        {room > 0 && !(compact && shown.length + pending === 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'aspect-[3/4] rounded-xl border border-dashed border-border-strong text-muted hover:text-fg hover:border-accent transition flex flex-col items-center justify-center gap-1.5 px-2 text-center',
              compact && 'w-[84px] shrink-0',
            )}
          >
            <ImagePlus size={20} />
            <span className="text-[12px] leading-tight">Ajouter</span>
          </button>
        )}
      </div>
      <p className="hidden sm:block mt-1.5 text-[13px] text-muted">Astuce : collez directement une capture d’écran avec Ctrl+V.</p>
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
