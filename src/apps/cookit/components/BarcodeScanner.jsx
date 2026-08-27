import { useEffect, useRef, useState } from 'react'
import { X, Keyboard, CameraOff } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { confirm as hapticConfirm } from '@/shared/lib/haptics.js'

// Scan de code-barres via l'API BarcodeDetector native (Chrome Android) :
// aucune dépendance ajoutée, aucun décodeur JS à télécharger.
//
// Elle n'est PAS disponible partout (Safari, certains Chrome desktop Linux) et
// exige HTTPS. Dans tous ces cas on bascule sans drame sur la saisie du code au
// clavier — ce n'est pas une erreur à afficher, juste l'autre façon de faire.

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const SCAN_INTERVAL_MS = 200 // ~5 images/s : suffisant pour un code-barres, doux pour la batterie

export function isScanSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export default function BarcodeScanner({ open, onDetected, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [manual, setManual] = useState(!isScanSupported())
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)

  // `onDetected` est recréée à chaque rendu du parent. La laisser en dépendance
  // de l'effet relançait getUserMedia en boucle — caméra qui clignote, batterie
  // qui fond. On la lit par référence pour que l'effet ne dépende que de l'état
  // réel du scanner.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    if (!open) setManual(!isScanSupported())
  }, [open])

  useEffect(() => {
    if (!open || manual) return undefined

    let cancelled = false
    let timer = null

    function stop() {
      if (timer) { clearInterval(timer); timer = null }
      const stream = streamRef.current
      if (stream) {
        // La caméra qui reste allumée après la fermeture est LE bug classique ici.
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }

    async function start() {
      try {
        const detector = new window.BarcodeDetector({ formats: FORMATS })
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        timer = setInterval(async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return
          try {
            const found = await detector.detect(videoRef.current)
            const value = found?.[0]?.rawValue
            if (value) {
              hapticConfirm()
              stop()
              onDetectedRef.current(String(value).replace(/\D/g, ''))
            }
          } catch {
            // Image non décodable : on retente à la frame suivante.
          }
        }, SCAN_INTERVAL_MS)
      } catch (err) {
        if (cancelled) return
        // Permission refusée, pas de caméra, page en HTTP : la saisie manuelle prend le relais.
        setError(err?.name === 'NotAllowedError' ? 'Accès caméra refusé' : 'Caméra indisponible')
        setManual(true)
      }
    }

    start()
    // L'app passe en arrière-plan (appel, verrouillage) → on libère la caméra.
    const onHide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', onHide)

    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', onHide) }
  }, [open, manual])

  if (!open) return null

  function submitManual(e) {
    e.preventDefault()
    const clean = code.replace(/\D/g, '')
    if (clean.length >= 6) onDetected(clean)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <span className="text-sm font-medium">Scanner un produit</span>
        <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-white/10 transition" aria-label="Fermer">
          <X size={20} />
        </button>
      </header>

      {manual ? (
        <form onSubmit={submitManual} className="flex-1 flex flex-col justify-center px-6 pb-24 gap-4 max-w-sm w-full mx-auto">
          <div className="flex flex-col items-center text-center gap-2 text-white/60">
            <CameraOff size={28} />
            <p className="text-sm">
              {error || 'Scan indisponible sur cet appareil'}
            </p>
            <p className="text-xs text-white/40">
              Saisis les chiffres sous le code-barres.
            </p>
          </div>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="3017620422003"
            autoFocus
            className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-center tracking-widest"
          />
          <Button type="submit" disabled={code.replace(/\D/g, '').length < 6}>
            Chercher ce produit
          </Button>
        </form>
      ) : (
        <>
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Viseur : cadre large et bas, comme tiennent les codes-barres. */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[78%] max-w-sm aspect-[5/2] rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
            </div>
          </div>
          <div className="shrink-0 px-6 py-5 flex flex-col items-center gap-3">
            <p className="text-xs text-white/50 text-center">Vise le code-barres du produit</p>
            <button
              onClick={() => setManual(true)}
              className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition"
            >
              <Keyboard size={16} /> Saisir le code à la main
            </button>
          </div>
        </>
      )}
    </div>
  )
}
