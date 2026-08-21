import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Checkbox } from '@/shared/ui/Checkbox.jsx'
import { cn } from '@/shared/lib/utils.js'
import { EXERCISE_TYPES, DEFAULT_TYPE, getExerciseType } from '../config/exercises.js'
import { useExercises } from '../hooks/useMuscData.js'
import { SETTINGS_SUBS } from '../config/navigation.js'
import { addExercise, updateExercise, deleteExercise } from '../services/exercisesService.js'

// Catalogue personnel : chaque profil a ses propres exercices, comme il a ses
// propres séances. Supprimer ici n'affecte que ce compte.
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
        <p className="text-sm text-muted mt-1">Ton catalogue à toi — l’autre profil a le sien.</p>
      </header>

      <SegmentedTabs items={SETTINGS_SUBS} active="catalogue" onChange={onNavigate} className="mb-5" />

      {creating ? (
        <ExerciseForm
          onCancel={() => setCreating(false)}
          onSubmit={(draft) => {
            addExercise(currentUid, draft, currentUid).catch(() => toast.error('Ajout impossible'))
            setCreating(false)
          }}
        />
      ) : (
        <Button variant="dashed" size="lg" className="w-full mb-4 text-sm" onClick={() => setCreating(true)}>
          <Plus size={16} /> Nouvel exercice
        </Button>
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
                  updateExercise(currentUid, ex.id, draft, currentUid).catch(() => toast.error('Modification impossible'))
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
                <Button variant="ghost" size="icon" aria-label={`Modifier ${ex.name}`} onClick={() => setEditingId(ex.id)}>
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="danger"
                  size="icon"
                  aria-label={`Supprimer ${ex.name}`}
                  onClick={() => {
                    // Catalogue personnel : ne retire l'exercice que de CE
                    // compte. Le programme garde son nom recopié.
                    deleteExercise(currentUid, ex.id).catch(() => toast.error('Suppression impossible'))
                    toast.success(`${ex.name} supprimé`)
                  }}
                >
                  <Trash2 size={15} />
                </Button>
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
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder="Nom de l'exercice"
        className="h-12 text-[15px]"
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
        <Checkbox
          className="mt-3 px-1"
          checked={bodyweight}
          onCheckedChange={setBodyweight}
          label="Compter en reps (poids du corps)"
        />
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <X size={15} /> Annuler
        </Button>
        <Button className="flex-1" onClick={submit} disabled={!name.trim()}>
          <Check size={15} strokeWidth={2.6} /> Enregistrer
        </Button>
      </div>
    </div>
  )
}
