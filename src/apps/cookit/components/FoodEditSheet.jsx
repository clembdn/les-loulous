import { useState, useEffect } from 'react'
import { Trash2, ScanText } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import LabelScanner from './LabelScanner.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AISLES } from '../config/aisles.js'
import { resolveFoodAisle } from '../utils/foodAisle.js'
import { cleanName } from '../utils/aisleGuess.js'
import { toNumber } from '../utils/quantity.js'

// Saisie / correction d'une fiche nutritionnelle.
//
// Ce n'est pas un écran de repli exotique : beaucoup de produits australiens
// (Woolworths, Coles) sont absents d'Open Food Facts, et les fiches OFF
// contiennent parfois des valeurs aberrantes saisies par d'autres. C'est donc
// un chemin courant, à un tap de l'échec de scan.

const MACROS = [
  { key: 'kcal', label: 'Calories', suffix: 'kcal', required: true },
  { key: 'proteins', label: 'Protéines', suffix: 'g' },
  { key: 'carbs', label: 'Glucides', suffix: 'g' },
  { key: 'fat', label: 'Lipides', suffix: 'g' },
  { key: 'sugars', label: 'dont sucres', suffix: 'g' },
  { key: 'satFat', label: 'dont saturés', suffix: 'g' },
  { key: 'fiber', label: 'Fibres', suffix: 'g' },
  { key: 'salt', label: 'Sel', suffix: 'g' },
]

const str = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','))

export default function FoodEditSheet({ food, open, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [per100, setPer100] = useState({})
  const [gramsPerPiece, setGramsPerPiece] = useState('')
  const [densityGPerMl, setDensity] = useState('')
  const [aisle, setAisle] = useState('autres')
  const [labelOpen, setLabelOpen] = useState(false)
  const [servingGrams, setServingGrams] = useState(null)

  useEffect(() => {
    if (!open) return
    setName(food?.name || '')
    setBrand(food?.brand || '')
    setPer100(Object.fromEntries(MACROS.map((m) => [m.key, str(food?.per100?.[m.key])])))
    setGramsPerPiece(str(food?.gramsPerPiece))
    setDensity(str(food?.densityGPerMl))
    // Rayon propose d'office : il est presque toujours bon, on ne demande a
    // l'utilisateur que de le corriger quand il se trompe.
    setAisle(food ? resolveFoodAisle(food) : 'autres')
    setServingGrams(food?.servingGrams ?? null)
  }, [food, open])

  const canSave = cleanName(name).length > 0 && toNumber(per100.kcal) != null

  function save() {
    if (!canSave) return
    onSave({
      ...food,
      name: cleanName(name),
      brand: brand.trim() || null,
      per100: Object.fromEntries(MACROS.map((m) => [m.key, toNumber(per100[m.key])])),
      gramsPerPiece: toNumber(gramsPerPiece),
      densityGPerMl: toNumber(densityGPerMl),
      aisle,
      // Une fiche corrigée à la main cesse d'être une simple copie d'Open Food Facts.
      source: food?.source === 'off' && food?.barcode ? 'off' : (food?.source || 'manual'),
    })
    onClose()
  }

  return (
    <>
    <Sheet open={open && !labelOpen} onOpenChange={(o) => !o && onClose()} title={food?.id ? 'Modifier l’aliment' : 'Nouvel aliment'}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Nom</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Blanc de poulet" autoFocus={!food?.name} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Marque (facultatif)</label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Woolworths" />
        </div>

        {food?.barcode && (
          <p className="text-xs text-faint tabular">Code-barres {food.barcode}</p>
        )}

        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs text-muted">
              Valeurs pour 100 g <span className="text-faint">(comme sur l’étiquette)</span>
            </p>
            <button
              onClick={() => setLabelOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:opacity-80 transition shrink-0"
            >
              <ScanText size={14} /> Scanner
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MACROS.map((m) => (
              <label key={m.key} className="block">
                <span className="block text-[11px] text-faint mb-1">{m.label}</span>
                <div className="relative">
                  <Input
                    value={per100[m.key] ?? ''}
                    onChange={(e) => setPer100((p) => ({ ...p, [m.key]: e.target.value }))}
                    inputMode="decimal"
                    placeholder={m.required ? '0' : '—'}
                    className="pr-10 tabular"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">
                    {m.suffix}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Rayon</label>
          <div className="flex flex-wrap gap-2">
            {AISLES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAisle(a.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs border transition',
                  aisle === a.id
                    ? 'bg-accent text-accent-fg border-accent'
                    : 'bg-surface-2 text-muted border-border hover:text-fg',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[11px] text-faint mb-1">Poids d’une pièce</span>
            <div className="relative">
              <Input
                value={gramsPerPiece}
                onChange={(e) => setGramsPerPiece(e.target.value)}
                inputMode="decimal" placeholder="—" className="pr-8 tabular"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">g</span>
            </div>
          </label>
          <label className="block">
            <span className="block text-[11px] text-faint mb-1">Densité</span>
            <div className="relative">
              <Input
                value={densityGPerMl}
                onChange={(e) => setDensity(e.target.value)}
                inputMode="decimal" placeholder="1" className="pr-12 tabular"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">g/mL</span>
            </div>
          </label>
        </div>
        <p className="text-[11px] text-faint -mt-2">
          Le poids d’une pièce permet de compter « 2 œufs » ou « 3 tranches ».
          La densité convertit les mL en grammes (huile ≈ 0,92).
        </p>

        <div className="flex items-center gap-2 pt-1">
          {onDelete && food?.id && (
            <Button variant="danger" size="icon" onClick={() => { onDelete(food.id); onClose() }} aria-label="Supprimer">
              <Trash2 size={16} />
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={!canSave}>Enregistrer</Button>
        </div>
      </div>
    </Sheet>

    <LabelScanner
      open={labelOpen}
      onClose={() => setLabelOpen(false)}
      onApply={({ per100: read, servingGrams: g }) => {
        // On ne remplace que ce que l'OCR a effectivement lu : une valeur deja
        // saisie a la main ne doit pas etre effacee par une lecture partielle.
        setPer100((prev) => {
          const next = { ...prev }
          for (const [k, v] of Object.entries(read)) if (v != null) next[k] = str(v)
          return next
        })
        if (g) setServingGrams(g)
      }}
    />
    </>
  )
}
