import { useState, useMemo } from 'react'
import { Plus, Filter } from 'lucide-react'
import { useChecklistData } from '../hooks/useChecklistData.js'
import { useAustraliaData } from '../hooks/useAustraliaData.js'
import ChecklistSection from '../components/checklist/ChecklistSection.jsx'
import ChecklistFormModal from '../components/checklist/ChecklistFormModal.jsx'
import ProgressSummary from '../components/checklist/ProgressSummary.jsx'
import { defaultChecklistItems } from '../components/checklist/defaultItems.js'

const SECTIONS = [
  'Avant le départ',
  'Après l’arrivée',
  'Valise',
  'Documents importants',
  'Optionnel / idées'
]

export default function ChecklistView() {
  const { items, isLoading, handleSaveItem, handleDeleteItem, handleChangeStatus } = useChecklistData()
  const australiaData = useAustraliaData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  
  const [searchFilter, setSearchFilter] = useState('')
  const [hideDone, setHideDone] = useState(false)

  const openCreateModal = () => {
    setEditingItem(null)
    setModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleImportDefaults = async () => {
    for (const item of defaultChecklistItems) {
      await handleSaveItem(item)
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (hideDone && item.status === 'done') return false
      if (searchFilter && !item.title.toLowerCase().includes(searchFilter.toLowerCase())) return false
      return true
    })
  }, [items, hideDone, searchFilter])

  const stats = useMemo(() => {
    const total = items.length
    const done = items.filter(i => i.status === 'done').length
    const todo = items.filter(i => i.status === 'todo').length
    const inProgress = items.filter(i => i.status === 'in_progress').length
    const plannedCost = items.reduce((sum, i) => sum + (Number(i.plannedCost) || 0), 0)
    const actualCost = items.reduce((sum, i) => sum + (Number(i.actualCost) || 0), 0)
    
    return { total, done, todo, inProgress, plannedCost, actualCost }
  }, [items])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="inline-block h-6 w-6 border-2 border-brand/30 border-t-brand-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Checklist Australie</h1>
          <p className="text-sm text-text-muted mt-1">
            Suivez les démarches, documents et éléments à préparer.
          </p>
        </div>
        <div className="flex gap-2">
          {items.length === 0 && (
            <button
              onClick={handleImportDefaults}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-bg-elevated border border-border-subtle hover:border-brand/50 text-sm font-medium transition-all"
            >
              Importer liste par défaut
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-brand text-white text-sm font-medium shadow-glow hover:bg-brand/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter une tâche</span>
          </button>
        </div>
      </div>

      <ProgressSummary stats={stats} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Rechercher une tâche..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-4 text-sm outline-none focus:border-brand transition-colors"
          />
        </div>
        <button
          onClick={() => setHideDone(!hideDone)}
          className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium border transition-colors ${
            hideDone ? 'bg-brand/10 border-brand/30 text-brand-glow' : 'bg-bg-elevated border-border-subtle text-text-secondary'
          }`}
        >
          <Filter className="h-4 w-4" />
          Masquer terminés
        </button>
      </div>

      <div className="space-y-8">
        {SECTIONS.map(section => {
          const sectionItems = filteredItems.filter(i => i.section === section)
          const allSectionItems = items.filter(i => i.section === section) // for progress bar
          
          if (allSectionItems.length === 0) return null
          
          return (
            <ChecklistSection 
              key={section}
              title={section}
              items={sectionItems}
              allSectionItems={allSectionItems}
              onEdit={openEditModal}
              onChangeStatus={handleChangeStatus}
            />
          )
        })}

        {items.length === 0 && (
          <div className="text-center py-12 px-4 border border-dashed border-border-strong rounded-2xl">
            <h3 className="text-lg font-medium text-text-primary mb-2">Aucun élément</h3>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
              Votre checklist est vide. Vous pouvez ajouter des tâches manuellement ou importer la checklist par défaut pour bien commencer.
            </p>
            <button
              onClick={handleImportDefaults}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-bg-elevated border border-border-subtle hover:border-brand/50 text-sm font-medium transition-all"
            >
              Importer la checklist par défaut
            </button>
          </div>
        )}
      </div>

      <ChecklistFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        item={editingItem}
        sections={SECTIONS}
        transactions={australiaData.transactions || []}
      />
    </div>
  )
}
