import { useState, useMemo, useEffect } from 'react'
import { Store, MoreVertical, Star } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import {
  setItemChecked, updateItem, deleteItem, clearChecked, clearAll, restoreItems,
} from '../services/shoppingItemsService.js'
import {
  toggleFavorite, setCatalogAisle, removeCatalogEntry,
} from '../services/catalogService.js'
import { setPantryStatus } from '../services/pantryService.js'
import { normalizeName } from '../utils/aisleGuess.js'
import { addNamedItem } from '../utils/addItems.js'
import { groupByAisle } from '../utils/grouping.js'
import QuickAddBar from '../components/QuickAddBar.jsx'
import AisleSection from '../components/AisleSection.jsx'
import CheckedZone from '../components/CheckedZone.jsx'
import ItemEditSheet from '../components/ItemEditSheet.jsx'
import StoreModeView from '../components/StoreModeView.jsx'
import FavoritesSheet from '../components/FavoritesSheet.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function ListView({ items, catalog, pantry, isLoading }) {
  const { currentUid } = useAuth()
  const [storeMode, setStoreMode] = useState(false)
  const [editing, setEditing] = useState(null)
  const [favOpen, setFavOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [undo, setUndo] = useState(null)
  const [restock, setRestock] = useState(null)

  const active = useMemo(() => items.filter((i) => !i.checked), [items])
  const checked = useMemo(() => items.filter((i) => i.checked), [items])
  const groups = useMemo(() => groupByAisle(active), [active])
  const suggestions = useMemo(() => {
    const inList = new Set(items.map((i) => normalizeName(i.name)))
    return [...catalog]
      .filter((c) => !inList.has(c.nameLower))
      .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount) || a.name.localeCompare(b.name))
      .slice(0, 6)
  }, [catalog, items])

  // Frigo indexé par nom → pour la boucle « acheté → en stock ».
  const pantryByName = useMemo(
    () => new Map((pantry || []).map((p) => [normalizeName(p.name), p])),
    [pantry],
  )

  const handleAdd = (name) => addNamedItem({ name }, { catalog, currentUid })
  function handleToggle(it) {
    const willCheck = !it.checked
    setItemChecked(it, willCheck, currentUid)
    // Cocher (= acheter) remet le produit correspondant du frigo « En stock ».
    if (willCheck) {
      const p = pantryByName.get(normalizeName(it.name))
      if (p && p.status !== 'ok') {
        setPantryStatus(p, 'ok', currentUid)
        setRestock({ id: p.id, name: p.name, prevStatus: p.status })
      }
    }
  }
  const handleSave = (id, updates) => updateItem(id, updates, currentUid)
  const handleDelete = (id) => deleteItem(id)

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(t)
  }, [undo])

  useEffect(() => {
    if (!restock) return
    const t = setTimeout(() => setRestock(null), 6000)
    return () => clearTimeout(t)
  }, [restock])

  function doClearChecked() {
    if (checked.length === 0) return
    setUndo({ items: checked, label: `${checked.length} article${checked.length > 1 ? 's' : ''} retiré${checked.length > 1 ? 's' : ''}` })
    clearChecked()
  }
  function doClearAll() {
    setUndo({ items, label: 'Liste vidée' })
    clearAll()
  }
  function handleUndo() {
    if (undo) restoreItems(undo.items, currentUid)
    setUndo(null)
  }
  function undoRestock() {
    if (restock) setPantryStatus({ id: restock.id }, restock.prevStatus, currentUid)
    setRestock(null)
  }

  if (storeMode) {
    return <StoreModeView items={items} onToggle={handleToggle} onExit={() => setStoreMode(false)} />
  }

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pb-44 lg:pb-28 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Nos courses</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setFavOpen(true)} className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Favoris">
            <Star size={18} />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Menu">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 w-52 rounded-xl border border-border bg-surface shadow-lift py-1">
                  <button
                    onClick={() => { doClearChecked(); setMenuOpen(false) }}
                    disabled={checked.length === 0}
                    className="w-full text-left px-4 py-2.5 text-sm text-fg hover:bg-surface-2 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Vider les cochés ({checked.length})
                  </button>
                  <button
                    onClick={() => { setConfirmAll(true); setMenuOpen(false) }}
                    disabled={items.length === 0}
                    className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-surface-2 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Tout vider
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lg:max-w-2xl">
        <QuickAddBar catalog={catalog} suggestions={suggestions} onAdd={handleAdd} />
      </div>

      <div className="mt-5">
        {isLoading ? (
          <p className="text-center text-muted py-16">Chargement…</p>
        ) : active.length === 0 && checked.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-fg font-medium">Ta liste est vide</p>
            <p className="text-sm text-muted mt-1">Ajoute un article ci-dessus ou via les fréquents.</p>
          </div>
        ) : (
          <>
            <div className="lg:columns-2 xl:columns-3 lg:gap-x-8">
              {groups.map(({ aisle, items: its }) => (
                <AisleSection key={aisle.id} aisle={aisle} items={its} onToggle={handleToggle} onEdit={setEditing} />
              ))}
            </div>
            <CheckedZone items={checked} onToggle={handleToggle} onEdit={setEditing} />
          </>
        )}
      </div>

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 lg:left-60 z-20 p-4 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto space-y-2">
          {restock && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface shadow-lift px-4 py-2.5">
              <span className="text-sm text-fg">« {restock.name} » remis en stock 🧊</span>
              <button onClick={undoRestock} className="text-sm font-medium text-accent hover:opacity-80 transition">
                Annuler
              </button>
            </div>
          )}
          {undo && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface shadow-lift px-4 py-2.5">
              <span className="text-sm text-fg">{undo.label}</span>
              <button onClick={handleUndo} className="text-sm font-medium text-accent hover:opacity-80 transition">
                Annuler
              </button>
            </div>
          )}
          <Button className="w-full shadow-lift" size="lg" onClick={() => setStoreMode(true)}>
            <Store size={18} /> Mode magasin
          </Button>
        </div>
      </div>

      <ItemEditSheet item={editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={handleDelete} />
      <FavoritesSheet
        open={favOpen}
        onClose={() => setFavOpen(false)}
        catalog={catalog}
        onToggleFavorite={(c) => toggleFavorite(c, currentUid)}
        onSetAisle={(c, aisle) => setCatalogAisle(c, aisle, currentUid)}
        onRemove={removeCatalogEntry}
      />
      <ConfirmDialog
        open={confirmAll}
        title="Tout vider ?"
        message="Tous les articles de la liste seront supprimés. Les favoris et l'historique sont conservés."
        confirmLabel="Tout vider"
        onConfirm={doClearAll}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  )
}
