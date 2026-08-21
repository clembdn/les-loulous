import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { cn } from '@/shared/lib/utils.js'
import { EXERCISE_TYPES, DEFAULT_TYPE, getExerciseType } from '../config/exercises.js'
import { useExercises } from '../hooks/useMuscData.js'
import { SETTINGS_SUBS } from '../config/navigation.js'
import { addExercise, updateExercise, deleteExercise } from '../services/exercisesService.js'

// Catalogue commun aux deux profils : y ajouter un exercice le rend disponible
// dans les deux programmes. Seuls les historiques sont cloisonnés.
export default function CatalogueView({ onNavigate }) {
  const { currentUid } = useAuth()
  const { exercises, isLoading } = useExercises()
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Réglages</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Exercices</h1>
        <p className="text-sm text-muted mt-1">Catalogue partagé entre les deux profils.</p>
      </header>

      <SegmentedTabs items={SETTINGS_SUBS} active="catalogue" onChange={onNavigate} className="mb-5" />

      {creating ? (
        <ExerciseForm
          onCancel={() => setCreating(false)}
          onSubmit={(draft) => {
            addExercise(draft, currentUid).catch(() => toast.error('Ajout impossible'))
            setCreating(false)
          }}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full h-12 mb-4 rounded-xl border border-dashed border-border-strong text-sm font-medium text-muted hover:text-fg hover:border-accent transition inline-flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Nouvel exercice
        </button>
      )}

      {isLoading && exercises.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[58px] rounded-xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : exercises.length === 0 && !creating ? (
        <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
          <ListChecks size={28} className="mx-auto text-faint" />
          <p className="text-base font-medium text-fg mt-3">Catalogue vide</p>
          <p className="text-sm text-muted mt-1">Commence par ajouter tes exercices.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {exercises.map((ex) => (
            editingId === ex.id ? (
              <ExerciseForm
                key={ex.id}
                initial={ex}
                onCancel={() => setEditingId(null)}
                onSubmit={(draft) => {
                  updateExercise(ex.id, draft, currentUid).catch(() => toast.error('Modification impossible'))
                  setEditingId(null)
                }}
              />
            ) : (
              <div
                key={ex.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-fg truncate">{ex.name}</span>
                  <span className="block text-xs text-muted mt-0.5">
                    {getExerciseType(ex.type).label}
                    {ex.bodyweight && ex.type !== 'bodyweight' && ' · poids du corps'}
                  </span>
                </span>
                <button
                  onClick={() => setEditingId(ex.id)}
                  aria-label={`Modifier ${ex.name}`}
                  className="p-2 rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => {
                    // L'historique reste attaché à l'id : supprimer l'exercice
                    // le retire du catalogue et des programmes à venir.
                    deleteExercise(ex.id).catch(() => toast.error('Suppression impossible'))
                    toast.success(`${ex.name} supprimé`)
                  }}
                  aria-label={`Supprimer ${ex.name}`}
                  className="p-2 rounded-lg text-faint hover:text-danger hover:bg-surface-2 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

function ExerciseForm({ initial, onCancel, onSubmit }) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || DEFAULT_TYPE)
  const [bodyweight, setBodyweight] = useState(initial?.bodyweight || false)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({ name: trimmed, type, bodyweight: bodyweight || type === 'bodyweight' })
  }

  return (
    <div className="p-4 mb-4 rounded-2xl border border-accent/30 bg-surface slide-up">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder="Nom de l'exercice"
        className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-border text-[15px] text-fg placeholder:text-faint
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition"
      />

      <div className="grid grid-cols-2 gap-2 mt-3">
        {EXERCISE_TYPES.map((t) => {
          const Icon = t.icon
          const isActive = t.id === type
          return (
            <button
              key={t.id}
              onClick={() => {
                setType(t.id)
                if (t.id === 'bodyweight') setBodyweight(true)
              }}
              className={cn(
                'h-11 rounded-xl text-sm font-medium border transition inline-flex items-center justify-center gap-2',
                isActive
                  ? 'bg-accent text-accent-fg border-accent'
                  : 'bg-surface-2 text-muted border-border hover:text-fg',
              )}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Une machine à assistance ou des dips lestés restent « poids du corps »
          côté métrique : le volume vaut 0, seule la somme des reps progresse. */}
      {type !== 'bodyweight' && (
        <label className="flex items-center gap-3 mt-3 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={bodyweight}
            onChange={(e) => setBodyweight(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          <span className="text-sm text-muted">Compter en reps (poids du corps)</span>
        </label>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted hover:text-fg transition inline-flex items-center justify-center gap-2"
        >
          <X size={15} /> Annuler
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="flex-1 h-11 rounded-xl bg-accent text-accent-fg text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
        >
          <Check size={15} strokeWidth={2.6} /> Enregistrer
        </button>
      </div>
    </div>
  )
}
