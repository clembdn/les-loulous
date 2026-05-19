import { useMemo, useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import { useFinAuziData } from '../../hooks/useFinAuziData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { seedTimelineSuggestions } from '../../services/timelineService.js'
import { toast } from '../ui/sonner.jsx'
import TimelineItem from './TimelineItem.jsx'
import TimelineAddModal from './TimelineAddModal.jsx'

export default function Timeline() {
  const { timeline, isTimelineLoading } = useFinAuziData()
  const { currentUser } = useAuth()
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const items = useMemo(
    () => [...timeline].sort((a, b) => a.date.localeCompare(b.date)),
    [timeline],
  )

  async function onSeed() {
    setSeeding(true)
    try {
      await seedTimelineSuggestions(currentUser?.uid)
      toast.success('Timeline initialisée')
    } catch (err) {
      toast.error(err.message || 'Erreur d\'initialisation')
    } finally {
      setSeeding(false)
    }
  }

  function openAdd() {
    setEditing(null)
    setAdding(true)
  }

  function openEdit(item) {
    setEditing(item)
    setAdding(true)
  }

  function closeModal() {
    setAdding(false)
    setEditing(null)
  }

  return (
    <>
      {isTimelineLoading ? (
        <div className="py-12 flex justify-center">
          <span className="h-5 w-5 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState onSeed={onSeed} onAddManually={openAdd} seeding={seeding} />
      ) : (
        <PopulatedView items={items} onEdit={openEdit} onAdd={openAdd} />
      )}

      <TimelineAddModal
        open={adding}
        onClose={closeModal}
        existing={editing}
        currentUid={currentUser?.uid}
      />
    </>
  )
}

function EmptyState({ onSeed, onAddManually, seeding }) {
  return (
    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 text-center">
      <div className="h-12 w-12 mx-auto rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-4">
        <Sparkles size={20} strokeWidth={2} />
      </div>
      <p className="text-sm font-medium text-white mb-1">Aucun jalon pour l'instant</p>
      <p className="text-xs text-white/40 mb-6 max-w-sm mx-auto">
        Pose les grandes étapes de l'année : visa, vol, école, road trip, retour…
        Tu pourras tout modifier ensuite.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto">
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition disabled:opacity-50"
        >
          <Sparkles size={14} />
          {seeding ? 'Initialisation…' : 'Initialiser avec les suggestions'}
        </button>
        <button
          type="button"
          onClick={onAddManually}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm font-medium hover:bg-white/[0.06] transition"
        >
          <Plus size={14} />
          Ajouter un jalon
        </button>
      </div>
    </div>
  )
}

function PopulatedView({ items, onEdit, onAdd }) {
  return (
    <div className="lg:max-w-2xl">
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 lg:p-6">
        {items.map((item, idx) => (
          <TimelineItem
            key={item.id}
            item={item}
            onEdit={onEdit}
            isLast={idx === items.length - 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.04] transition border border-dashed border-white/10 hover:border-white/20"
      >
        <Plus size={12} strokeWidth={2.4} />
        Ajouter un jalon
      </button>
    </div>
  )
}
