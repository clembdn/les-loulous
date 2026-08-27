import { useState, useEffect, useRef } from 'react'
import { X, Camera, ScanText, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { readImageText, disposeOcr } from '../services/ocrService.js'
import { parseNutritionLabel } from '../utils/nutritionLabel.js'

// Photographier le tableau nutritionnel plutôt que de le retaper.
//
// L'OCR se trompe régulièrement (reflets, étiquette courbe, petits caractères).
// D'où l'écran de relecture : les valeurs lues sont proposées à côté de la
// photo, toutes modifiables, et rien n'est enregistré sans validation. Une
// suggestion qu'on corrige est utile ; une valeur fausse enregistrée en silence
// pollue le journal pour des mois.

const FIELDS = [
  { key: 'kcal', label: 'Calories', suffix: 'kcal' },
  { key: 'proteins', label: 'Protéines', suffix: 'g' },
  { key: 'carbs', label: 'Glucides', suffix: 'g' },
  { key: 'fat', label: 'Lipides', suffix: 'g' },
  { key: 'sugars', label: 'dont sucres', suffix: 'g' },
  { key: 'satFat', label: 'dont saturés', suffix: 'g' },
  { key: 'fiber', label: 'Fibres', suffix: 'g' },
  { key: 'salt', label: 'Sel', suffix: 'g' },
]

const str = (v) => (v == null ? '' : String(v).replace('.', ','))

export default function LabelScanner({ open, onClose, onApply }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(null)
  const [values, setValues] = useState({})
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) return undefined
    // Le moteur wasm garde des dizaines de Mo : on le libère en sortant.
    disposeOcr()
    setImageUrl((url) => { if (url) URL.revokeObjectURL(url); return null })
    setResult(null); setValues({}); setError(null); setProgress(0)
    return undefined
  }, [open])

  async function handleFile(file) {
    if (!file) return
    setError(null)
    setResult(null)
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setBusy(true)
    setProgress(0)
    try {
      const text = await readImageText(file, (p, s) => {
        if (p != null) setProgress(p)
        if (s) setStatus(s === 'loading tesseract core' ? 'Préparation du moteur…' : 'Chargement…')
      })
      const parsed = parseNutritionLabel(text)
      setResult(parsed)
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, str(parsed.per100[f.key])])))
    } catch {
      setError('La lecture a échoué. Réessaie avec une photo plus nette, ou saisis les valeurs à la main.')
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    onApply({
      per100: Object.fromEntries(FIELDS.map((f) => {
        const raw = String(values[f.key] ?? '').replace(',', '.').trim()
        const n = Number(raw)
        return [f.key, raw !== '' && Number.isFinite(n) ? n : null]
      })),
      servingGrams: result?.servingGrams ?? null,
    })
    onClose()
  }

  if (!open) return null

  const weak = result && result.confidence < 1

  return (
    <div className="fixed inset-0 z-[65] bg-bg flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium text-fg">Scanner l’étiquette</span>
        <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-muted hover:text-fg transition" aria-label="Fermer">
          <X size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-xl mx-auto space-y-4">
          {!imageUrl && !busy && (
            <div className="text-center py-10">
              <ScanText size={30} className="mx-auto text-faint mb-3" />
              <p className="text-sm text-muted mb-1">Photographie le tableau nutritionnel.</p>
              <p className="text-xs text-faint mb-5">
                Cadre serré, à plat, bien éclairé. Les valeurs « pour 100 g » sont reprises
                automatiquement, tu pourras les corriger avant d’enregistrer.
              </p>
              <Button onClick={() => inputRef.current?.click()}>
                <Camera size={16} /> Prendre la photo
              </Button>
              <p className="text-[11px] text-faint mt-4">
                Le lecteur de texte (~6 Mo) se télécharge au premier usage, puis reste disponible hors-ligne.
              </p>
            </div>
          )}

          {imageUrl && (
            <img src={imageUrl} alt="Étiquette photographiée" className="w-full rounded-2xl border border-border" />
          )}

          {busy && (
            <div>
              <p className="text-sm text-muted mb-2">
                {progress > 0 ? `Lecture de l’étiquette… ${Math.round(progress * 100)} %` : (status || 'Préparation…')}
              </p>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(progress * 100, 4)}%` }} />
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-danger">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}

          {result && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Valeurs lues, pour 100 g
                </p>
                {result.twoColumns && (
                  <span className="text-[11px] text-faint">colonne 100 g retenue</span>
                )}
              </div>

              {weak && (
                <p className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Lecture partielle — vérifie chaque valeur avant d’enregistrer.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] text-faint mb-1">{f.label}</span>
                    <div className="relative">
                      <Input
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        inputMode="decimal"
                        placeholder="—"
                        className={cn('pr-12 tabular', !values[f.key] && 'border-warning/40')}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">
                        {f.suffix}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  <Camera size={16} /> Reprendre
                </Button>
                <Button className="flex-1" onClick={apply}>Utiliser ces valeurs</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* `capture` ouvre directement l'appareil photo arrière sur Android. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
