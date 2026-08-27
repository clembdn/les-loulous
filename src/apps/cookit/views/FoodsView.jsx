import { useState, useMemo } from 'react'
import { Search, ScanBarcode, Plus, Pencil, ListPlus, Check } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { cn } from '@/shared/lib/utils.js'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { normalizeName } from '../utils/aisleGuess.js'
import { AISLES } from '../config/aisles.js'
import { saveFood, deleteFood, updateFood } from '../services/foodsService.js'
import { addNamedItem } from '../utils/addItems.js'
import { useBarcodeLookup } from '../hooks/useBarcodeLookup.js'
import BarcodeScanner from '../components/BarcodeScanner.jsx'
import LookupOverlay from '../components/LookupOverlay.jsx'
import FoodEditSheet from '../components/FoodEditSheet.jsx'
import FoodPickerSheet from '../components/FoodPickerSheet.jsx'

// Bibliothèque d'aliments : tout ce qui a été scanné ou saisi, réutilisable
// partout (recettes, journal, liste de courses). C'est la mémoire du couple —
// un produit australien saisi une fois n'est plus jamais à ressaisir.

const SORTS = [
  { id: 'frequents', label: 'Fréquents' },
  { id: 'recents', label: 'Récents' },
  { id: 'alpha', label: 'A-Z' },
]

function byName(a, b) { return a.name.localeCompare(b.name, 'fr') }

export default function FoodsView({ foods, isLoading, items, catalog, activeListId }) {
  const { currentUid } = useAuth()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('frequents')
  const [editing, setEditing] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selection, setSelection] = useState(null) // null = mode normal, Set = sélection multiple
  const { looking, lookup } = useBarcodeLookup(foods)

  const filtered = useMemo(() => {
    const needle = normalizeName(q)
    return foods.filter((f) => !needle || f.nameLower.includes(needle))
  }, [foods, q])

  // En A-Z on regroupe par rayon (on parcourt la bibliothèque comme un magasin).
  // Les deux autres tris sont des classements : les regrouper les casserait.
  const sorted = useMemo(() => {
    if (sort === 'alpha') return null
    const list = [...filtered]
    if (sort === 'recents') {
      list.sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')) || byName(a, b))
    } else {
      list.sort((a, b) => (b.useCount - a.useCount) || byName(a, b))
    }
    return list
  }, [filtered, sort])

  const grouped = useMemo(() => {
    if (sort !== 'alpha') return null
    return AISLES
      .map((aisle) => ({ aisle, list: filtered.filter((f) => f.aisle === aisle.id).sort(byName) }))
      .filter((g) => g.list.length > 0)
  }, [filtered, sort])

  async function onScanned(barcode) {
    setScanOpen(false)
    const { food } = await lookup(barcode)
    setEditing(food)
  }

  function persist(food) {
    if (food.id && foods.some((f) => f.id === food.id)) updateFood(food.id, food, currentUid)
    else saveFood(food, currentUid)
  }

  // Passe toujours par addNamedItem : c'est le seul endroit qui compose
  // dédoublonnage, fusion des quantités, rayon et compteur du catalogue.
  function addToList(food) {
    addNamedItem(
      { name: food.name, foodId: food.id },
      { catalog, currentUid, items, listId: activeListId },
    )
  }

  function toggleSelected(id) {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addSelectionToList() {
    const chosen = foods.filter((f) => selection.has(f.id))
    chosen.forEach(addToList)
    toast.success(`${chosen.length} article${chosen.length > 1 ? 's' : ''} ajouté${chosen.length > 1 ? 's' : ''}`, {
      description: 'Dans ta liste de courses',
    })
    setSelection(null)
  }

  const selecting = selection !== null

  function Row({ food }) {
    const picked = selecting && selection.has(food.id)
    return (
      <div className="flex items-center gap-3 py-2.5 group">
        <button
          onClick={() => (selecting ? toggleSelected(food.id) : setEditing(food))}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          {selecting ? (
            <span className={cn(
              'w-10 h-10 rounded-lg shrink-0 grid place-items-center border transition',
              picked ? 'bg-accent border-accent text-accent-fg' : 'bg-surface-2 border-border text-transparent',
            )}
            >
              <Check size={18} />
            </span>
          ) : food.imageUrl ? (
            <img src={food.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface-2 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-surface-2 shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-fg truncate">{food.name}</span>
            <span className="block text-xs text-faint truncate">
              {[food.brand, `${Math.round(food.per100.kcal)} kcal / 100 g`].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
        {!selecting && (
          <>
            <button
              onClick={() => { addToList(food); toast.success(food.name, { description: 'Ajouté à ta liste de courses' }) }}
              className="p-2 rounded-lg text-faint hover:text-accent hover:bg-surface-2 transition shrink-0"
              aria-label={`Ajouter ${food.name} à la liste`}
            >
              <ListPlus size={16} />
            </button>
            <Pencil size={15} className="text-faint opacity-0 lg:group-hover:opacity-100 transition shrink-0 mr-1" />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-28 pt-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un aliment" className="pl-9" />
        </div>
        <Button variant="secondary" size="icon" onClick={() => setScanOpen(true)} aria-label="Scanner">
          <ScanBarcode size={18} />
        </Button>
      </div>

      {foods.length > 0 && (
        <SegmentedTabs items={SORTS} active={sort} onChange={setSort} desktopHidden={false} className="mb-4" />
      )}

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

      {grouped && grouped.map(({ aisle, list }) => {
        const Icon = aisle.icon
        return (
          <section key={aisle.id} className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className={aisle.colorClass} />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{aisle.label}</h3>
              <span className="text-xs text-faint">{list.length}</span>
            </div>
            <div className="divide-y divide-border">
              {list.map((f) => <Row key={f.id} food={f} />)}
            </div>
          </section>
        )
      })}

      {sorted && (
        <div className="divide-y divide-border">
          {sorted.map((f) => <Row key={f.id} food={f} />)}
        </div>
      )}

      {!isLoading && foods.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted px-1 py-6">Aucun aliment ne correspond à « {q.trim()} ».</p>
      )}

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 lg:left-60 z-20 p-4 pointer-events-none">
        <div className="max-w-xl mx-auto flex justify-end gap-2">
          {selecting ? (
            <>
              <Button variant="secondary" className="pointer-events-auto shadow-lift" onClick={() => setSelection(null)}>
                Annuler
              </Button>
              <Button
                className="pointer-events-auto shadow-lift"
                onClick={addSelectionToList}
                disabled={selection.size === 0}
              >
                <ListPlus size={16} /> Ajouter {selection.size > 0 ? `(${selection.size})` : ''}
              </Button>
            </>
          ) : (
            <>
              {foods.length > 0 && (
                <Button variant="secondary" className="pointer-events-auto shadow-lift" onClick={() => setSelection(new Set())}>
                  <ListPlus size={16} /> Sélectionner
                </Button>
              )}
              <Button className="pointer-events-auto shadow-lift" onClick={() => setPickerOpen(true)}>
                <Plus size={16} /> Ajouter
              </Button>
            </>
          )}
        </div>
      </div>

      <BarcodeScanner open={scanOpen} onDetected={onScanned} onClose={() => setScanOpen(false)} />

      <LookupOverlay open={looking} />

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
