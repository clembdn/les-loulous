import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetBody } from '@/shared/ui/sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { formatSets } from '../../utils/metrics.js'

/**
 * Ajouter un mouvement à la séance du jour, sans toucher au programme.
 *
 * ── Ce qui manquait ─────────────────────────────────────────────────────────
 *
 * La machine est prise, on remplace par autre chose ; il reste dix minutes, on
 * ajoute des abdos. Jusqu'ici il fallait sortir vers Réglages › Programme —
 * donc modifier le programme de TOUTES les semaines pour un ajout d'un seul
 * jour, puis revenir. La plupart du temps on ne notait simplement rien.
 *
 * Le modèle de données le permettait déjà : une entrée de séance dont
 * l'`instanceId` ne correspond à aucune ligne du programme s'affiche en « hors
 * programme ». Il n'y avait aucun chemin pour en créer une.
 *
 * ── Ce qui est proposé ──────────────────────────────────────────────────────
 *
 * Tout le catalogue, y compris ce qui est déjà dans la séance : refaire un
 * mouvement une deuxième fois dans la journée est un cas normal, et les séries
 * des deux passages se recollent d'elles-mêmes dans l'historique.
 *
 * Ce qu'on a fait la dernière fois est annoncé sous chaque nom — c'est ce qui
 * permet de choisir, debout dans la salle, entre deux variantes qu'on hésite à
 * reprendre.
 */
export default function AddExerciseSheet({ open, onOpenChange, exercises, previousIndex, onPick }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return exercises
    return exercises.filter((e) => e.name.toLowerCase().includes(needle))
  }, [exercises, query])

  // Rangés par groupe musculaire : quatre-vingts mouvements en liste plate se
  // parcourent à la recherche, pas à l'œil.
  const groups = useMemo(() => {
    const out = new Map()
    for (const exercise of filtered) {
      const key = exercise.group || 'Autre'
      if (!out.has(key)) out.set(key, [])
      out.get(key).push(exercise)
    }
    return [...out.entries()]
  }, [filtered])

  const close = (next) => {
    if (!next) setQuery('')
    onOpenChange(next)
  }

  const pick = (exercise) => {
    setQuery('')
    onOpenChange(false)
    onPick(exercise)
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="bottom"
        desktopSide="right"
        title="Ajouter à la séance"
        className="bg-surface border-border"
      >
        <SheetBody>
          <p className="text-[13px] leading-relaxed text-muted mb-3">
            Ajouté à la séance d'aujourd'hui seulement — ton programme ne bouge pas.
          </p>

          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un exercice"
              aria-label="Chercher un exercice"
              className="pl-9"
            />
          </div>

          {exercises.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Catalogue vide — ajoute des exercices dans Réglages › Exercices.
            </p>
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Aucun exercice ne correspond.</p>
          ) : (
            groups.map(([group, items]) => (
              <section key={group} className="mb-4 last:mb-0">
                <h3 className="text-[10px] uppercase tracking-[0.16em] text-faint mb-1.5 px-1">
                  {group}
                </h3>
                <div className="space-y-1">
                  {items.map((exercise) => {
                    const previous = previousIndex[exercise.id]
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => pick(exercise)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition',
                          'hover:bg-surface-2 active:scale-[0.99]',
                        )}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] text-fg truncate">{exercise.name}</span>
                          {previous && (
                            <span className="block text-[11px] text-faint tabular truncate mt-0.5">
                              {formatSets(previous.sets, exercise)}
                            </span>
                          )}
                        </span>
                        <Plus size={16} className="shrink-0 text-accent" />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
