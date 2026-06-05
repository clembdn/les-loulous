import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, X, ImagePlus } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import QuantityField from './QuantityField.jsx'
import { readQuantity, toNumber } from '../utils/quantity.js'
import ImagePickerSheet from './ImagePickerSheet.jsx'

const EMPTY_ING = { name: '', quantity: '', unit: '' }
const TEXTAREA_CLS =
  'w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition resize-none'

export default function RecipeEditor({ recipe, onCancel, onSave }) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [ingredients, setIngredients] = useState([{ ...EMPTY_ING }])
  const [steps, setSteps] = useState([''])
  const [image, setImage] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title)
      setNote(recipe.note || '')
      setImage(recipe.imageUrl || '')
      setIngredients(
        recipe.ingredients.length
          ? recipe.ingredients.map((i) => {
            const q = readQuantity(i)
            return { name: i.name, quantity: q.quantity != null ? String(q.quantity) : '', unit: q.unit || '' }
          })
          : [{ ...EMPTY_ING }],
      )
      setSteps(recipe.steps.length ? [...recipe.steps] : [''])
    } else {
      setTitle('')
      setNote('')
      setImage('')
      setIngredients([{ ...EMPTY_ING }])
      setSteps([''])
    }
  }, [recipe])

  const canSave = title.trim().length > 0 && ingredients.some((i) => i.name.trim())

  function setIngredient(i, field, value) {
    setIngredients((arr) => arr.map((it, j) => (j === i ? { ...it, [field]: value } : it)))
  }
  function setIngredientQty(i, { quantity, unit }) {
    setIngredients((arr) => arr.map((it, j) => (j === i ? { ...it, quantity, unit: unit || '' } : it)))
  }
  function addIngredient() { setIngredients((arr) => [...arr, { ...EMPTY_ING }]) }
  function removeIngredient(i) { setIngredients((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)) }

  function setStep(i, value) { setSteps((arr) => arr.map((s, j) => (j === i ? value : s))) }
  function addStep() { setSteps((arr) => [...arr, '']) }
  function removeStep(i) { setSteps((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)) }

  function submit() {
    if (!canSave) return
    onSave({
      title,
      note: note.trim() || null,
      imageUrl: image || null,
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), quantity: toNumber(i.quantity), unit: i.unit || null })),
      steps: steps.map((s) => s.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition">
            <ArrowLeft size={16} /> Annuler
          </button>
          <Button size="sm" onClick={submit} disabled={!canSave}>Enregistrer</Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pb-16 pt-4 space-y-6">
        <div>
          <label className="block text-xs text-muted mb-1.5">Titre</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Curry de pois chiches" autoFocus />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Note (optionnel)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Pour 4 · plat du soir…" className={TEXTAREA_CLS} />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Photo</label>
          {image ? (
            <div className="relative overflow-hidden rounded-xl">
              <img src={image} alt="" className="w-full aspect-[16/9] object-cover" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>Changer</Button>
                <Button size="sm" variant="secondary" aria-label="Retirer la photo" onClick={() => setImage('')}>
                  <X size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 aspect-[16/9] rounded-xl border border-dashed border-border text-sm text-muted hover:text-fg hover:border-border-strong transition"
            >
              <ImagePlus size={18} /> Ajouter une photo
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Ingrédients</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <Input value={ing.name} onChange={(e) => setIngredient(i, 'name', e.target.value)} placeholder="Ingrédient" className="flex-1 min-w-[7rem]" />
                <div className="flex gap-2 items-center">
                  <QuantityField
                    quantity={ing.quantity}
                    unit={ing.unit}
                    onChange={(q) => setIngredientQty(i, q)}
                    numberClassName="w-16"
                  />
                  <button onClick={() => removeIngredient(i)} aria-label="Retirer l'ingrédient" disabled={ingredients.length === 1} className="shrink-0 p-2 text-faint hover:text-danger transition disabled:opacity-30 disabled:pointer-events-none">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addIngredient} className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:opacity-80 transition">
            <Plus size={16} /> Ajouter un ingrédient
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Préparation</label>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="flex h-7 w-7 mt-1 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border text-xs font-semibold text-muted">
                  {i + 1}
                </span>
                <textarea value={step} onChange={(e) => setStep(i, e.target.value)} rows={2} placeholder={`Étape ${i + 1}`} className={TEXTAREA_CLS} />
                <button onClick={() => removeStep(i)} aria-label="Retirer l'étape" disabled={steps.length === 1} className="shrink-0 p-2 mt-1 text-faint hover:text-danger transition disabled:opacity-30 disabled:pointer-events-none">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addStep} className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:opacity-80 transition">
            <Plus size={16} /> Ajouter une étape
          </button>
        </div>
      </div>

      <ImagePickerSheet
        open={pickerOpen}
        initialQuery={title}
        onClose={() => setPickerOpen(false)}
        onPick={(url) => { setImage(url); setPickerOpen(false) }}
      />
    </div>
  )
}
