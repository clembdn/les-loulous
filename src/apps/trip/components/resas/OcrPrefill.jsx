import { useEffect, useRef, useState } from 'react'
import { ScanText } from 'lucide-react'
import { toast } from '@/shared/ui/sonner.jsx'
import { disposeOcr, readImageText } from '@/shared/lib/ocr.js'
import { attachmentSrc } from '../../services/attachmentsService.js'
import { parseReservationText } from '../../utils/resaParse.js'

/**
 * « Pré-remplir depuis la capture » : la capture jointe est lue sur le
 * téléphone (Tesseract, sans envoyer l'image nulle part), et ce qu'on y
 * reconnaît remplit les champs encore vides du formulaire, surlignés pour
 * qu'on les relise. Rien n'est enregistré sans « Enregistrer ».
 *
 * La première lecture télécharge le moteur (~6 Mo, mis en cache ensuite) :
 * il faut du réseau cette fois-là.
 *
 * `capture` : `{ mime, data }` (une capture jointe ou en cours d'ajout).
 * `onRead(parsed)` reçoit le résultat de `parseReservationText`.
 */
export default function OcrPrefill({ capture, near, onRead }) {
  const [progress, setProgress] = useState(null) // null : au repos ; 0..1 : en lecture
  // La lecture prend quelques secondes : le résultat va au formulaire tel
  // qu'il est À LA FIN (on a pu taper entre-temps), pas tel qu'au clic.
  const onReadRef = useRef(onRead)
  onReadRef.current = onRead

  // Le moteur garde des dizaines de Mo : on le libère en quittant le formulaire.
  useEffect(() => () => { disposeOcr() }, [])

  async function read() {
    setProgress(0)
    try {
      const text = await readImageText(attachmentSrc(capture), (p) => {
        if (typeof p === 'number') setProgress(p)
      })
      onReadRef.current(parseReservationText(text, { near }))
    } catch {
      toast.error(navigator.onLine === false
        ? 'La première lecture demande du réseau (le moteur se télécharge une fois).'
        : 'La capture n’a pas pu être lue.')
    } finally {
      setProgress(null)
    }
  }

  const reading = progress !== null
  return (
    <button
      type="button"
      onClick={read}
      disabled={reading}
      className="w-full min-h-12 rounded-xl bg-accent/10 px-4 py-2.5 flex items-center gap-3 text-left text-accent transition hover:bg-accent/15 disabled:cursor-wait"
    >
      <ScanText size={20} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">
          {reading ? 'Lecture de la capture…' : 'Pré-remplir depuis la capture'}
        </span>
        {reading ? (
          <span className="mt-1.5 block h-1 rounded-full bg-accent/20 overflow-hidden" aria-hidden="true">
            <span className="block h-1 bg-accent transition-[width]" style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }} />
          </span>
        ) : (
          <span className="block text-[13px] text-accent/80">Dates, heures, référence… à vérifier ensuite</span>
        )}
      </span>
    </button>
  )
}
