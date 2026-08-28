import { useMemo, useState } from 'react'
import { Check, Library, ListChecks, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.jsx'
import { SkeletonList } from '@/shared/ui/Skeleton.jsx'
import { cn } from '@/shared/lib/utils.js'
import { DEFAULT_TYPE, EXERCISE_TYPES, getExerciseType } from '../config/exercises.js'
import { useMuscData } from '../context/MuscDataContext.jsx'
import { SETTINGS_SUBS } from '../config/navigation.js'
import {
  addExercise, addExercises, collectExerciseImpact, deleteExerciseCascade, updateExercise,
} from '../services/exercisesService.js'
import { MUSCLE_GROUPS, OTHER_GROUP, exerciseKey } from '../config/exerciseLibrary.js'
import PageHeader from '../components/layout/PageHeader.jsx'
import ExerciseLibrarySheet from '../components/catalogue/ExerciseLibrarySheet.jsx'

const plural = (n) => (n > 1 ? 's' : '')

// Ce que la suppression emporte, énuméré avant de la déclencher : on ne
// découvre pas après coup qu'elle a emporté six mois de courbe.
function impactDetails(impact) {
  if (!impact) return []
  const out = []
  if (impact.programCount > 0) {
    out.push(`${impact.programCount} ligne${plural(impact.programCount)} de ton programme`)
  }
  if (impact.sessionCount > 0) {
    out.push(`l'historique et la courbe de ${impact.sessionCount} séance${plural(impact.sessionCount)}`)
  }
  if (impact.hasNote) out.push('ta note de réglages')
  return out
}

function deleteMessage(pending) {
  if (!pending) return null
  if (!pending.impact) return 'Vérification de ce qui en dépend…'
  if (impactDetails(pending.impact).length === 0) {
    return 'Cet exercice n’est utilisé nulle part. La suppression est définitive.'
  }
  return 'La suppression est définitive et emporte tout ce qui en dépend :'
}

/**
 * Le catalogue personnel : chaque profil a ses propres exercices, comme il a
 * ses propres séances. Supprimer ici n'affecte que ce compte.
 *
 * Les lignes ne glissent plus. Le geste portait « modifier » d'un côté et
 * « supprimer » de l'autre — deux actions opposées derrière le même mouvement,
 * dans une liste qu'on parcourt surtout en la faisant défiler. Les deux boutons
 * étaient déjà là, ils suffisent.
 */
export default function CatalogueView({ onNavigate }) {
  const { currentUid } = useAuth()
  const { exercises, catalogueReady } = useMuscData()

  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  // { exercise, impact } — `impact` arrive après une lecture, la confirmation
  // s'affiche sans l'attendre.
  const [pending, setPending] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [library, setLibrary] = useState(false)
  const [importing, setImporting] = useState(false)

  // Ce que le catalogue contient déjà, sous une forme comparable aux noms de la
  // bibliothèque : accents et casse ne doivent pas créer de faux doublons.
  const existingKeys = useMemo(
    () => new Set(exercises.map((e) => exerciseKey(e.name))),
    [exercises],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return exercises
    return exercises.filter((e) => e.name.toLowerCase().includes(needle))
  }, [exercises, query])

  /**
   * Rangé par groupe musculaire, dans l'ordre de la bibliothèque.
   *
   * Une liste alphabétique de quatre-vingts mouvements se parcourt à la
   * recherche : on sait ce qu'on cherche avant de l'avoir vu. Par groupe, on
   * retrouve « ce que j'ai pour le dos » sans savoir d'avance comment je l'ai
   * appelé — et on voit d'un coup ce qui manque.
   */
  const grouped = useMemo(() => {
    const byGroup = new Map()
    for (const exercise of filtered) {
      const key = exercise.group || OTHER_GROUP
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key).push(exercise)
    }
    return MUSCLE_GROUPS
      .filter((g) => byGroup.has(g))
      .map((g) => [g, byGroup.get(g)])
  }, [filtered])

  const importFromLibrary = async (items) => {
    setImporting(true)
    try {
      await addExercises(currentUid, items, currentUid)
      toast.success(`${items.length} exercice${plural(items.length)} ajouté${plural(items.length)}`)
      setLibrary(false)
    } catch (err) {
      console.error('[MuscAuzi] import bibliothèque:', err)
      toast.error('Ajout impossible')
    } finally {
      setImporting(false)
    }
  }

  const askDelete = (exercise) => {
    setPending({ exercise, impact: null })
    collectExerciseImpact(currentUid, exercise.id)
      .then((impact) => {
        // L'utilisateur a pu fermer ou viser un autre exercice entre-temps.
        setPending((p) => (p?.exercise.id === exercise.id ? { ...p, impact } : p))
      })
      .catch((err) => console.error('[MuscAuzi] impact error:', err))
  }

  const confirmDelete = async () => {
    if (!pending) return
    const { exercise, impact } = pending
    setDeleting(true)
    try {
      await deleteExerciseCascade(currentUid, exercise.id, impact, currentUid)
      toast.success(`${exercise.name} supprimé`)
      setPending(null)
    } catch (err) {
      console.error('[MuscAuzi] delete failed:', err)
      toast.error('Suppression impossible')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <PageHeader
        eyebrow="Réglages"
        title="Exercices"
        subtitle="Ton catalogue à toi — l’autre profil a le sien."
      />

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
        // La bibliothèque d'abord : taper un nom à la main est le chemin de
        // secours, pas le chemin normal.
        <div className="grid grid-cols-2 gap-2 mb-4 lg:max-w-md">
          <Button size="lg" className="text-sm" onClick={() => setLibrary(true)}>
            <Library size={16} /> Bibliothèque
          </Button>
          <Button variant="dashed" size="lg" className="text-sm" onClick={() => setCreating(true)}>
            <Plus size={16} /> À la main
          </Button>
        </div>
      )}

      {/* Le champ de recherche n'apparaît qu'une fois la liste assez longue pour
          qu'on s'y perde : au-dessous, il occupe la place sans rien résoudre. */}
      {exercises.length > 8 && (
        <div className="relative mb-4 lg:max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher dans mon catalogue"
            aria-label="Chercher un exercice"
            className="pl-9"
          />
        </div>
      )}

      {!catalogueReady && exercises.length === 0 ? (
        <SkeletonList count={4} itemClassName="h-[58px]" />
      ) : exercises.length === 0 && !creating ? (
        <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
          <ListChecks size={28} className="mx-auto text-faint" />
          <p className="text-base font-medium text-fg mt-3">Catalogue vide</p>
          <p className="text-sm text-muted mt-1">
            Pioche dans la bibliothèque — les exercices courants y sont déjà.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Aucun exercice ne correspond.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, items]) => (
            <section key={group}>
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-faint mb-2 px-1">
                {group}
                <span className="text-faint/60 ml-2 tabular">{items.length}</span>
              </h2>
              <div className="space-y-1.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2">
                {items.map((ex) => (
                  editingId === ex.id ? (
                    <ExerciseForm
                      key={ex.id}
                      initial={ex}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(draft) => {
                        updateExercise(currentUid, ex.id, draft, currentUid)
                          .catch(() => toast.error('Modification impossible'))
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
                        </span>
                      </span>
                      <Button variant="ghost" size="icon" aria-label={`Modifier ${ex.name}`} onClick={() => setEditingId(ex.id)}>
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        aria-label={`Supprimer ${ex.name}`}
                        onClick={() => askDelete(ex)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  )
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ExerciseLibrarySheet
        open={library}
        onOpenChange={setLibrary}
        existing={existingKeys}
        onAdd={importFromLibrary}
        busy={importing}
      />

      <ConfirmDialog
        open={!!pending}
        title={`Supprimer ${pending?.exercise.name} ?`}
        message={deleteMessage(pending)}
        details={impactDetails(pending?.impact)}
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => { if (!deleting) setPending(null) }}
      />
    </div>
  )
}

function ExerciseForm({ initial, onCancel, onSubmit }) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || DEFAULT_TYPE)
  const [group, setGroup] = useState(initial?.group || OTHER_GROUP)

  // Le TYPE décide comment la charge se saisit ; le GROUPE, où le mouvement se
  // range et à quel total il compte. Deux questions distinctes, deux choix.
  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({ name: trimmed, type, group })
  }

  return (
    <div className="p-4 mb-4 rounded-2xl border border-accent/30 bg-surface slide-up lg:col-span-full">
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
              onClick={() => setType(t.id)}
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

      <p className="text-[10px] uppercase tracking-[0.16em] text-faint mt-4 mb-1.5">Groupe musculaire</p>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            aria-pressed={g === group}
            className={cn(
              'px-3 h-9 rounded-lg text-[13px] font-medium border transition',
              g === group
                ? 'bg-accent text-accent-fg border-accent'
                : 'bg-surface-2 text-muted border-border hover:text-fg',
            )}
          >
            {g}
          </button>
        ))}
      </div>

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
