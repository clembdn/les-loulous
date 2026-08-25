import { useState, useMemo } from 'react'
import { Search, ScanBarcode, Plus, Pencil } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { normalizeName } from '../utils/aisleGuess.js'
import { saveFood, deleteFood, updateFood } from '../services/foodsService.js'
import { fetchByBarcode } from '../services/openFoodFactsService.js'
import BarcodeScanner from '../components/BarcodeScanner.jsx'
import FoodEditSheet from '../components/FoodEditSheet.jsx'
import FoodPickerSheet from '../components/FoodPickerSheet.jsx'

// Bibliothèque d'aliments : tout ce qui a été scanné ou saisi, réutilisable
// partout (recettes, journal). C'est la mémoire du couple — un produit
// australien saisi une fois n'est plus jamais à ressaisir.

export default function FoodsView({ foods, isLoading }) {
  const { currentUid } = useAuth()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const filtered = useMemo(() => {
    const needle = normalizeName(q)
    return foods
      .filter((f) => !needle || f.nameLower.includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [foods, q])

  async function onScanned(barcode) {
    setScanOpen(false)
    const known = foods.find((f) => f.barcode === barcode)
    if (known) { setEditing(known); return }
    const found = await fetchByBarcode(barcode)
    setEditing(found || { barcode, source: 'off', name: '', per100: {} })
  }

  function persist(food) {
    if (food.id && foods.some((f) => f.id === food.id)) updateFood(food.id, food, currentUid)
    else saveFood(food, currentUid)
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-28 pt-2">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un aliment" className="pl-9" />
        </div>
        <Button variant="secondary" size="icon" onClick={() => setScanOpen(true)} aria-label="Scanner">
          <ScanBarcode size={18} />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted px-1">Chargement…</p>}

      {!isLoading && foods.length === 0 && (
        <div className="text-center py-14 px-6">
          <p className="text-sm text-muted mb-1">Aucun aliment pour l’instant.</p>
          <p className="text-xs text-faint mb-5">
            Scanne un produit ou cherche un aliment brut : sa fiche est mémorisée pour toujours.
          </p>
          <Button onClick={() => setScanOpen(true)}><ScanBarcode size={16} /> Scanner un produit</Button>
        </div>
      )}

      <div className="divide-y divide-border">
        {filtered.map((f) => (
          <button
            key={f.id}
            onClick={() => setEditing(f)}
            className="w-full flex items-center gap-3 py-2.5 text-left group"
          >
            {f.imageUrl
              ? <img src={f.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface-2 shrink-0" />
              : <div className="w-10 h-10 rounded-lg bg-surface-2 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-fg truncate">{f.name}</span>
              <span className="block text-xs text-faint truncate">
                {[f.brand, `${Math.round(f.per100.kcal)} kcal / 100 g`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <Pencil size={15} className="text-faint opacity-0 group-hover:opacity-100 transition shrink-0" />
          </button>
        ))}
      </div>

      {!isLoading && foods.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted px-1 py-6">Aucun aliment ne correspond à « {q.trim()} ».</p>
      )}

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 lg:left-60 z-20 p-4 pointer-events-none">
        <div className="max-w-xl mx-auto flex justify-end">
          <Button className="pointer-events-auto shadow-lift" onClick={() => setPickerOpen(true)}>
            <Plus size={16} /> Ajouter
          </Button>
        </div>
      </div>

      <BarcodeScanner open={scanOpen} onDetected={onScanned} onClose={() => setScanOpen(false)} />

      <FoodPickerSheet
        open={pickerOpen}
        foods={foods}
        title="Ajouter un aliment"
        onClose={() => setPickerOpen(false)}
        onPick={() => setPickerOpen(false)}
      />

      <FoodEditSheet
        food={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={persist}
        onDelete={deleteFood}
      />
    </div>
  )
}
