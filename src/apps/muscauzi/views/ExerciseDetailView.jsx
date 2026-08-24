import { useState, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import LineChart from '@/shared/ui/LineChart.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { cn } from '@/shared/lib/utils.js'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { formatDateFr, formatDateShortFr, fromLocalDateKey } from '@/shared/lib/dates.js'
import {
  metricsFor, defaultMetricId, formatMetric, formatSets, historyForExercise,
} from '../utils/metrics.js'
import { getExerciseType, weightHint } from '../config/exercises.js'
import ExerciseNote from '../components/session/ExerciseNote.jsx'

/**
 * La progression d'un mouvement.
 *
 * `embedded` rend le composant DANS UNE MODALE : il perd son enveloppe pleine
 * page, son retour arrière (la croix de la modale s'en charge) et son titre
 * (celui de la modale le porte déjà — l'afficher deux fois pousserait la
 * courbe hors de l'écran). Le défilement appartient au corps de la modale, pas
 * à l'historique : deux ascenseurs imbriqués et on ne sait plus lequel on
 * pousse.
 */
export default function ExerciseDetailView({
  exercise, sessions, isLoading, note, onSaveNote, onBack, embedded = false,
}) {
  const available = metricsFor(exercise)
  const [metricId, setMetricId] = useState(() => defaultMetricId(exercise))
  // On choisit dans les métriques VALABLES pour cet exercice, pas dans toutes.
  // Repasser un mouvement en poids du corps laissait sinon la courbe sur le
  // volume, qui vaut zéro partout : un graphe plat qu'on lit comme une
  // régression alors que rien n'a été perdu.
  const metric = available.find((m) => m.id === metricId) || available[0]

  // Un point par date : si le mouvement figure plusieurs fois dans la séance,
  // toutes ses occurrences sont agrégées — jamais deux points le même jour.
  const history = useMemo(() => historyForExercise(sessions, exercise.id), [sessions, exercise.id])
  const series = useMemo(
    () => history.map((h) => ({ date: h.date, value: metric.compute(h.sets) })),
    [history, metric],
  )

  return (
    <div className={embedded ? '' : 'max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6'}>
      {!embedded && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition mb-4"
        >
          <ArrowLeft size={16} /> Tous les exercices
        </button>
      )}

      <header className="mb-4">
        {!embedded && (
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">{exercise.name}</h1>
        )}
        <p className={cn('text-xs text-muted', !embedded && 'mt-1')}>
          {getExerciseType(exercise.type).label}
        </p>
      </header>

      <ExerciseNote note={note} onSave={(text) => onSaveNote(exercise.id, text)} />

      {/* Deux segments n'ont pas besoin de 670 px : borné dès qu'il y a de la
          place, plein largeur sur un téléphone étroit où le pouce vise mal. */}
      <SegmentedTabs
        items={available}
        active={metric.id}
        onChange={setMetricId}
        desktopHidden={false}
        className="mb-4 sm:max-w-xs"
      />

      <div className="rounded-2xl border border-border bg-surface p-4 mb-6">
        {isLoading && series.length === 0 ? (
          <Skeleton className="h-[220px] border-0 bg-surface-2" />
        ) : series.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            Pas encore de série validée pour cet exercice.
          </p>
        ) : (
          <LineChart
            data={series}
            formatValue={(v) => formatMetric(v, metric.id)}
            formatLabel={(d) => formatDateShortFr(fromLocalDateKey(d.date))}
          />
        )}
        {weightHint(exercise) && (
          <p className="text-[11px] text-faint mt-3 leading-relaxed">{weightHint(exercise)}</p>
        )}
      </div>

      {history.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-faint mb-2">Historique</h2>
          <div className="space-y-1.5">
            {[...history].reverse().map((h) => (
              <div
                key={h.date}
                className="flex items-baseline justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-surface"
              >
                <span className="text-sm text-fg shrink-0">
                  {formatDateFr(fromLocalDateKey(h.date), { withYear: true })}
                  {h.occurrences > 1 && (
                    <span className="block text-[11px] text-faint">{h.occurrences} passages</span>
                  )}
                </span>
                <span className="text-xs text-muted tabular text-right">{formatSets(h.sets, exercise)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
