import { useMemo, useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { CHECKLIST_SECTIONS } from '../../config/checklistSuggestions.js'
import {
  updateChecklistItem,
  seedChecklistSuggestions,
} from '../../services/checklistService.js'
import { toast } from '@/shared/ui/sonner.jsx'
import ChecklistSection from './ChecklistSection.jsx'
import ChecklistAddModal from './ChecklistAddModal.jsx'
import { cn } from '@/shared/lib/utils.js'

export default function Checklist() {
  const { checklist, isChecklistLoading } = useAppData()
  const { currentUser } = useAuth()
  const [activeSection, setActiveSection] = useState('before') // mobile-only inner tab
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addSection, setAddSection] = useState('before')

  const bySection = useMemo(() => {
    const map = { before: [], arrival: [], luggage: [] }
    for (const item of checklist) {
      if (map[item.section]) map[item.section].push(item)
    }
    return map
  }, [checklist])

  const totals = useMemo(() => {
    const done = checklist.filter((i) => i.status === 'done').length
    return {
      done,
      total: checklist.length,
      pct: checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0,
    }
  }, [checklist])

  // Écritures optimistes : l'UI est mise à jour par le cache local, fonctionne hors-ligne.
  function onCycleStatus(item, nextStatus) {
    updateChecklistItem(item.id, { status: nextStatus }, currentUser?.uid)
      .catch((err) => toast.error(err.message || 'Impossible de mettre à jour'))
  }

  function onSeed() {
    seedChecklistSuggestions(currentUser?.uid)
      .catch((err) => toast.error(err.message || 'Erreur d\'initialisation'))
    toast.success('Checklist initialisée')
  }

  function openAdd(section) {
    setAddSection(section)
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
      {isChecklistLoading ? (
        <div className="py-12 flex justify-center">
          <span className="h-5 w-5 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
        </div>
      ) : checklist.length === 0 ? (
        <EmptyState
          onSeed={onSeed}
          onAddManually={() => openAdd('before')}
        />
      ) : (
        <PopulatedView
          totals={totals}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          bySection={bySection}
          onCycleStatus={onCycleStatus}
          onEdit={openEdit}
          onAdd={openAdd}
        />
      )}

      <ChecklistAddModal
        open={adding}
        onClose={closeModal}
        existing={editing}
        defaultSection={addSection}
        currentUid={currentUser?.uid}
      />
    </>
  )
}

function EmptyState({ onSeed, onAddManually }) {
  return (
    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 text-center">
      <div className="h-12 w-12 mx-auto rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-4">
        <Sparkles size={20} strokeWidth={2} />
      </div>
      <p className="text-sm font-medium text-white mb-1">Ta checklist est vide</p>
      <p className="text-xs text-white/40 mb-6 max-w-sm mx-auto">
        On peut la pré-remplir avec les démarches essentielles : visa, billet d'avion, TFN, etc.
        Tu pourras ensuite ajouter / modifier / supprimer ce que tu veux.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto">
        <button
          type="button"
          onClick={onSeed}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition"
        >
          <Sparkles size={14} />
          Initialiser avec les suggestions
        </button>
        <button
          type="button"
          onClick={onAddManually}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm font-medium hover:bg-white/[0.06] transition"
        >
          <Plus size={14} />
          Commencer à zéro
        </button>
      </div>
    </div>
  )
}

function PopulatedView({
  totals,
  activeSection,
  setActiveSection,
  bySection,
  onCycleStatus,
  onEdit,
  onAdd,
}) {
  return (
    <>
      {/* Overall progress */}
      <div className="mb-6 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Avancement</p>
          <span className="text-xs text-white/60 tabular">
            {totals.done} / {totals.total} <span className="text-white/30">· {totals.pct}%</span>
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500/80 transition-all duration-500 ease-out"
            style={{ width: `${totals.pct}%` }}
          />
        </div>
      </div>

      {/* Mobile inner tabs (one section at a time) */}
      <div className="lg:hidden flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl mb-4">
        {CHECKLIST_SECTIONS.map((s) => {
          const Icon = s.icon
          const active = activeSection === s.id
          const sectionDone = bySection[s.id].filter((i) => i.status === 'done').length
          const sectionTotal = bySection[s.id].length
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition',
                active ? `${s.bgClass} ${s.accentClass}` : 'text-white/40 hover:text-white/70',
              )}
            >
              <Icon size={12} strokeWidth={2.2} />
              <span>{s.short}</span>
              {sectionTotal > 0 && (
                <span className="text-[10px] opacity-70 tabular">
                  {sectionDone}/{sectionTotal}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Mobile: only the active section */}
      <div className="lg:hidden">
        {CHECKLIST_SECTIONS.filter((s) => s.id === activeSection).map((s) => (
          <ChecklistSection
            key={s.id}
            section={s}
            items={bySection[s.id]}
            onCycleStatus={onCycleStatus}
            onEdit={onEdit}
            onAdd={onAdd}
          />
        ))}
      </div>

      {/* Desktop: 3 columns side by side */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4 xl:gap-5">
        {CHECKLIST_SECTIONS.map((s) => (
          <ChecklistSection
            key={s.id}
            section={s}
            items={bySection[s.id]}
            onCycleStatus={onCycleStatus}
            onEdit={onEdit}
            onAdd={onAdd}
          />
        ))}
      </div>
    </>
  )
}
