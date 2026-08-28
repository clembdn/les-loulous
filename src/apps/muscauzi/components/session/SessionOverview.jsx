import { Check, ChevronRight, Dumbbell, Play, Plus, SkipForward } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Progress } from '@/shared/ui/Progress.jsx'
import { doneSets } from '../../utils/sets.js'
import { formatSets } from '../../utils/metrics.js'

/**
 * Ce qu'il y a à faire, d'un coup d'œil.
 *
 * En lecture seule : aucun champ, aucune pastille, rien qui puisse
 * s'enregistrer par mégarde en scrollant. On y arrive, on voit la liste dans
 * l'ordre, on appuie sur « Commencer » — et tout le reste se passe dans
 * l'écran d'un exercice.
 */
export default function SessionOverview({
  lines,
  extras,
  session,
  exerciseById,
  onOpen,
  onStart,
  onAdd,
  startLabel,
}) {
  return (
    <>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <OverviewRow
            key={line.instanceId}
            line={line}
            entry={session?.entries?.[line.instanceId] || null}
            exercise={exerciseById[line.exerciseId] || null}
            onClick={() => onOpen(i)}
          />
        ))}
      </div>

      {extras.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-[0.18em] text-faint mb-2">Hors programme</h2>
          <p className="text-[11px] text-faint mb-2.5 leading-relaxed">
            Saisi ce jour-là sous une autre prescription — à corriger ou à retirer.
          </p>
          <div className="space-y-2">
            {extras.map((line, i) => (
              <OverviewRow
                key={line.instanceId}
                line={line}
                entry={session?.entries?.[line.instanceId] || null}
                exercise={exerciseById[line.exerciseId] || null}
                onClick={() => onOpen(lines.length + i)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Une machine prise, dix minutes de rab : on ajoute le mouvement ici,
          pour aujourd'hui seulement. Il fallait auparavant sortir vers les
          réglages et modifier le programme de toutes les semaines. */}
      <Button variant="dashed" size="lg" className="w-full mt-3 text-sm" onClick={onAdd}>
        <Plus size={16} /> Ajouter un exercice
      </Button>

      {/* Le bouton principal colle en bas : téléphone en main, on ne doit pas
          avoir à remonter la liste pour démarrer. */}
      <div className="sticky bottom-16 lg:bottom-0 -mx-4 mt-5 px-4 py-3
                      bg-gradient-to-t from-bg via-bg to-transparent">
        <Button size="lg" className="w-full" onClick={onStart}>
          <Play size={16} strokeWidth={2.6} /> {startLabel}
        </Button>
      </div>
    </>
  )
}

function OverviewRow({ line, entry, exercise, onClick }) {
  const skipped = entry?.skipped === true
  const done = doneSets(entry)
  const savedDone = done.length
  const isComplete = skipped || savedDone >= line.prescribedSets
  const isPartial = !skipped && savedDone > 0 && !isComplete
  const recap = formatSets(done, exercise)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-surface text-left',
        'transition active:scale-[0.99] hover:border-border-strong',
        skipped ? 'border-border opacity-60' : isComplete ? 'border-accent/40' : 'border-border',
      )}
    >
      <StatusDot skipped={skipped} complete={isComplete} partial={isPartial} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-fg truncate">{line.name}</span>
        <span className="block text-xs text-muted mt-0.5 tabular">
          {line.prescribedSets} × {line.prescribedReps}
          {skipped && ' · non fait'}
          {isPartial && ` · ${savedDone}/${line.prescribedSets}`}
        </span>
        {recap && (
          <span className="block text-[11px] text-faint tabular mt-1 truncate">{recap}</span>
        )}
        {isPartial && (
          <Progress
            className="mt-2 h-1"
            value={savedDone}
            max={line.prescribedSets}
            label={`${savedDone} séries sur ${line.prescribedSets}`}
          />
        )}
      </span>
      <ChevronRight size={18} className="shrink-0 text-faint" />
    </button>
  )
}

// Les classes Tailwind sont écrites en toutes lettres : une taille interpolée
// (`h-${size}`) n'existe pas dans le CSS généré, le scanner ne la voit jamais.
const DOT = 'h-6 w-6'

export function StatusDot({ skipped, complete, partial }) {
  const box = DOT
  if (skipped) {
    return (
      <span className={cn(box, 'shrink-0 rounded-full border border-border flex items-center justify-center text-faint')}>
        <SkipForward size={12} />
      </span>
    )
  }
  if (complete) {
    return (
      <span className={cn(box, 'shrink-0 rounded-full bg-accent text-accent-fg flex items-center justify-center')}>
        <Check size={14} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span className={cn(
      box, 'shrink-0 rounded-full border-2',
      partial ? 'border-accent border-dashed' : 'border-border-strong',
    )} />
  )
}

export function EmptyDay() {
  return (
    <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
      <Dumbbell size={28} className="mx-auto text-faint" />
      <p className="text-base font-medium text-fg mt-3">Rien de prévu ce jour-là</p>
      <p className="text-sm text-muted mt-1">
        Repos — ou ajoute des exercices à ce jour dans les réglages.
      </p>
    </div>
  )
}
