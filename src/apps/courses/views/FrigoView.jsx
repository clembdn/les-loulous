import { useState, useMemo } from 'react'
import { Refrigerator, ListPlus } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { usePantry } from '../hooks/usePantry.js'
import {
  addPantryItem, updatePantryItem, deletePantryItem, setPantryStatus,
} from '../services/pantryService.js'
import { isNeeded } from '../config/pantryStatus.js'
import { normalizeName } from '../utils/aisleGuess.js'
import { resolveAisleForName, addNamedItem } from '../utils/addItems.js'
import { groupByAisle } from '../utils/grouping.js'
import QuickAddBar from '../components/QuickAddBar.jsx'
import PantrySection from '../components/PantrySection.jsx'
import PantryEditSheet from '../components/PantryEditSheet.jsx'
import AddIngredientsSheet from '../components/AddIngredientsSheet.jsx'

export default function FrigoView({ items, catalog, onGoToList }) {
  const { currentUid } = useAuth()
  const { pantry, isLoading } = usePantry()
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'needed'
  const [bulkOpen, setBulkOpen] = useState(false)

  const needed = useMemo(() => pantry.filter((p) => isNeeded(p.status)), [pantry])
  const shown = filter === 'needed' ? needed : pantry
  const groups = useMemo(() => groupByAisle(shown), [shown])

  // Produits du frigo déjà présents (et non cochés) sur la liste de courses → pastille « Listé ».
  const listedNames = useMemo(
    () => new Set(items.filter((i) => !i.checked).map((i) => normalizeName(i.name))),
    [items],
  )
  // Catalogue non encore présent dans le frigo → suggestions de remplissage rapide.
  const suggestions = useMemo(() => {
    const inPantry = new Set(pantry.map((p) => normalizeName(p.name)))
    return [...catalog]
      .filter((c) => !inPantry.has(c.nameLower))
      .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount) || a.name.localeCompare(b.name))
      .slice(0, 6)
  }, [catalog, pantry])

  // Manquants pas encore listés → ce que proposera l'ajout groupé.
  const toRestock = useMemo(
    () => needed.filter((p) => !listedNames.has(normalizeName(p.name))),
    [needed, listedNames],
  )

  function handleAdd(name) {
    const aisle = resolveAisleForName(name, catalog)
    return addPantryItem({ name, aisle, status: 'ok' }, currentUid)
  }
  const handleCycle = (item, status) => setPantryStatus(item, status, currentUid)
  const handleSave = (id, updates) => updatePantryItem(id, updates, currentUid)
  const handleDelete = (id) => deletePantryItem(id)
  function handleSendOne(item) {
    addNamedItem({ name: item.name, quantityLabel: item.quantityLabel }, { catalog, currentUid })
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-44 lg:pb-28 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Frigo &amp; placards</h1>
      </div>

      <QuickAddBar catalog={catalog} suggestions={suggestions} onAdd={handleAdd} />

      {pantry.length > 0 && (
        <div className="flex items-center gap-2 mt-5">
          {[
            { id: 'all', label: `Tout (${pantry.length})` },
            { id: 'needed', label: `À racheter (${needed.length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                filter === f.id
                  ? 'bg-accent text-accent-fg border-accent'
                  : 'bg-surface-2 text-muted border-border hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        {isLoading ? (
          <p className="text-center text-muted py-16">Chargement…</p>
        ) : pantry.length === 0 ? (
          <div className="text-center py-16">
            <Refrigerator size={32} className="mx-auto text-faint" />
            <p className="text-fg font-medium mt-3">Ton frigo est vide</p>
            <p className="text-sm text-muted mt-1">Ajoute ce que tu as à la maison pour suivre tes stocks.</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-center text-muted py-12">Rien à racheter pour l'instant 🎉</p>
        ) : (
          groups.map(({ aisle, items: its }) => (
            <PantrySection
              key={aisle.id}
              aisle={aisle}
              items={its}
              listedNames={listedNames}
              onCycleStatus={handleCycle}
              onEdit={setEditing}
              onSendToList={handleSendOne}
            />
          ))
        )}
      </div>

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 lg:left-60 z-20 p-4 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <Button
            className="w-full shadow-lift"
            size="lg"
            onClick={() => setBulkOpen(true)}
            disabled={toRestock.length === 0}
          >
            <ListPlus size={18} /> Ajouter les manquants{toRestock.length > 0 ? ` (${toRestock.length})` : ''}
          </Button>
        </div>
      </div>

      <PantryEditSheet item={editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={handleDelete} />
      <AddIngredientsSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        ingredients={toRestock.map((p) => ({ name: p.name, quantityLabel: p.quantityLabel }))}
        items={items}
        catalog={catalog}
        onAdded={onGoToList}
        title="Ajouter les manquants à la liste"
      />
    </div>
  )
}
