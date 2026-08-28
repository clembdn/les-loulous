import { Flag, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { doneSets } from '../../utils/sets.js'
import { StatusDot } from './SessionOverview.jsx'

/**
 * La séance en colonne, sur grand écran.
 *
 * Sur téléphone on navigue d'un écran à l'autre : il n'y a pas la place pour
 * les deux. Sur un ordinateur il y en a, et voir en permanence où l'on en est
 * vaut mieux qu'un compteur « 3 sur 6 » — on saute directement au mouvement
 * qu'on veut corriger, sans repasser par l'aperçu.
 */
export default function SessionRail({ lines, session, activeIndex, onSelect, onFinish, onAdd }) {
  return (
    <nav className="space-y-1" aria-label="Exercices de la séance">
      {lines.map((line, i) => {
        const entry = session?.entries?.[line.instanceId] || null
        const skipped = entry?.skipped === true
        const savedDone = doneSets(entry).length
        const isComplete = skipped || savedDone >= line.prescribedSets
        const isActive = i === activeIndex

        return (
          <button
            key={line.instanceId}
            onClick={() => onSelect(i)}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition',
              isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-fg hover:bg-surface-2',
            )}
          >
            <StatusDot skipped={skipped} complete={isComplete} partial={!skipped && savedDone > 0 && !isComplete} />
            <span className="flex-1 min-w-0">
              <span className={cn(
                'block text-sm font-medium truncate',
                isActive ? 'text-accent' : 'text-fg',
              )}>
                {line.name}
              </span>
              <span className="block text-[11px] text-faint tabular mt-0.5">
                {line.prescribedSets} × {line.prescribedReps}
                {!skipped && savedDone > 0 && ` · ${savedDone} faite${savedDone > 1 ? 's' : ''}`}
              </span>
            </span>
          </button>
        )
      })}

      <button
        onClick={onAdd}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-xl text-left
                   text-muted hover:text-fg hover:bg-surface-2 transition"
      >
        <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-border-strong flex items-center justify-center">
          <Plus size={12} />
        </span>
        <span className="text-sm font-medium">Ajouter un exercice</span>
      </button>

      <button
        onClick={onFinish}
        aria-current={activeIndex === lines.length ? 'step' : undefined}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 mt-2 rounded-xl text-left transition border-t border-border pt-3',
          activeIndex === lines.length
            ? 'text-accent'
            : 'text-muted hover:text-fg hover:bg-surface-2',
        )}
      >
        <span className="h-6 w-6 shrink-0 rounded-full border border-border flex items-center justify-center">
          <Flag size={12} />
        </span>
        <span className="text-sm font-medium">Bilan</span>
      </button>
    </nav>
  )
}
