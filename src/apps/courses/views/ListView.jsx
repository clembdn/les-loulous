import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Store, MoreVertical, Star } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { useCoursesData } from '../hooks/useCoursesData.js'
import {
  addItem, setItemChecked, updateItem, deleteItem, clearChecked, clearAll,
} from '../services/shoppingItemsService.js'
import {
  recordUsage, toggleFavorite, setCatalogAisle, removeCatalogEntry,
} from '../services/catalogService.js'
import { guessAisle, slugify, normalizeName } from '../utils/aisleGuess.js'
import { groupByAisle } from '../utils/grouping.js'
import QuickAddBar from '../components/QuickAddBar.jsx'
import AisleSection from '../components/AisleSection.jsx'
import CheckedZone from '../components/CheckedZone.jsx'
import ItemEditSheet from '../components/ItemEditSheet.jsx'
import StoreModeView from '../components/StoreModeView.jsx'
import FavoritesSheet from '../components/FavoritesSheet.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function ListView() {
  const { currentUid } = useAuth()
  const { items, catalog, isLoading } = useCoursesData()
  const [storeMode, setStoreMode] = useState(false)
  const [editing, setEditing] = useState(null)
  const [favOpen, setFavOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)

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

  async function handleAdd(name) {
    const slug = slugify(name)
    const known = catalog.find((c) => c.id === slug)
    const aisle = known?.aisle || guessAisle(name)
    await addItem({ name, aisle }, currentUid)
    await recordUsage(name, aisle, currentUid)
  }
  const handleToggle = (it) => setItemChecked(it, !it.checked, currentUid)
  const handleSave = (id, updates) => updateItem(id, updates, currentUid)
  const handleDelete = (id) => deleteItem(id)

  if (storeMode) {
    return <StoreModeView items={items} onToggle={handleToggle} onExit={() => setStoreMode(false)} />
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition mb-1">
            <ArrowLeft size={14} /> Nos apps
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-fg">Nos courses</h1>
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
                        onClick={() => { clearChecked(); setMenuOpen(false) }}
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
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pb-28 pt-4">
        <QuickAddBar catalog={catalog} suggestions={suggestions} onAdd={handleAdd} />

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
              {groups.map(({ aisle, items: its }) => (
                <AisleSection key={aisle.id} aisle={aisle} items={its} onToggle={handleToggle} onEdit={setEditing} />
              ))}
              <CheckedZone items={checked} onToggle={handleToggle} onEdit={setEditing} />
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
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
        onConfirm={clearAll}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  )
}
