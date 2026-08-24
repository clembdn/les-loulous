import { useState, useMemo } from 'react'
import { ChevronRight, ArrowLeft, ArrowUp, ArrowDown, Minus, CalendarRange } from 'lucide-react'
import LineChart from '@/shared/ui/LineChart.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { SkeletonList } from '@/shared/ui/Skeleton.jsx'
import { cn } from '@/shared/lib/utils.js'
import { fromLocalDateKey, formatDateFr, formatDateShortFr } from '@/shared/lib/dates.js'
import {
  groupSessions, SESSION_METRICS, sessionMetric, formatSessionMetric,
} from '../utils/sessionGroups.js'
import { workByExercise, bestSet, formatSets } from '../utils/metrics.js'

/**
 * Comparer des SÉANCES entre elles, pas seulement des exercices.
 *
 * L'écran Progrès ne savait suivre qu'un mouvement à la fois. Or on ne se
 * demande pas que « est-ce que mon développé monte » : on se demande aussi
 * « est-ce que mes Push d'aujourd'hui valent ceux d'il y a un mois ». C'est la
 * même question posée un cran au-dessus, et elle demandait de rapprocher les
 * séances comparables — cf. `groupSessions`.
 */
export default function SessionsProgressView({ sessions, isLoading, exerciseById }) {
  const [focusedKey, setFocusedKey] = useState(null)
  const groups = useMemo(() => groupSessions(sessions), [sessions])
  const focused = focusedKey ? groups.find((g) => g.key === focusedKey) : null

  if (focused) {
    return (
      <GroupDetail
        group={focused}
        exerciseById={exerciseById}
        onBack={() => setFocusedKey(null)}
      />
    )
  }

  if (isLoading && groups.length === 0) return <SkeletonList count={4} itemClassName="h-[66px]" />

  if (groups.length === 0) {
    return (
      <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
        <CalendarRange size={28} className="mx-auto text-faint" />
        <p className="text-base font-medium text-fg mt-3">Aucune séance enregistrée</p>
        <p className="text-sm text-muted mt-1">
          Les séances se regrouperont ici par nom, dès la première terminée.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {groups.map((group) => {
        const last = group.occurrences[group.occurrences.length - 1]
        const before = group.occurrences[group.occurrences.length - 2] || null
        return (
          <button
            key={group.key}
            onClick={() => setFocusedKey(group.key)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-surface text-left active:bg-surface-2 transition"
          >
            <Trend now={last.totals.volume} before={before?.totals.volume} />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium text-fg truncate first-letter:uppercase">
                {group.label}
              </span>
              <span className="block text-xs text-muted mt-0.5 truncate tabular">
                {group.occurrences.length} fois · dernière le {formatDateFr(fromLocalDateKey(last.date))}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-faint" />
          </button>
        )
      })}
    </div>
  )
}

function GroupDetail({ group, exerciseById, onBack }) {
  const [metricId, setMetricId] = useState('volume')
  const metric = sessionMetric(metricId)

  const series = useMemo(
    () => group.occurrences.map((o) => ({ date: o.date, value: metric.of(o.totals) })),
    [group, metric],
  )

  // De la plus récente à la plus ancienne : on lit d'abord ce qu'on vient de
  // faire. L'écart, lui, se calcule toujours sur l'occurrence PRÉCÉDENTE.
  const rows = useMemo(() => {
    return group.occurrences
      .map((occurrence, i) => ({
        ...occurrence,
        previous: i > 0 ? group.occurrences[i - 1] : null,
      }))
      .reverse()
  }, [group])

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition mb-4"
      >
        <ArrowLeft size={16} /> Toutes les séances
      </button>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg first-letter:uppercase">
          {group.label}
        </h1>
        <p className="text-xs text-muted mt-1">
          {group.occurrences.length} séance{group.occurrences.length > 1 ? 's' : ''} enregistrée{group.occurrences.length > 1 ? 's' : ''}
        </p>
      </header>

      <SegmentedTabs
        items={SESSION_METRICS}
        active={metric.id}
        onChange={setMetricId}
        desktopHidden={false}
        className="mb-4"
      />

      <div className="rounded-2xl border border-border bg-surface p-4 mb-6">
        {series.length < 2 ? (
          // Un point unique n'est pas une courbe : il n'y a encore rien à
          // comparer, et tracer une ligne plate le laisserait croire.
          <p className="py-16 text-center text-sm text-muted">
            Refais cette séance pour voir son évolution.
          </p>
        ) : (
          <LineChart
            data={series}
            formatValue={(v) => formatSessionMetric(v, metric)}
            formatLabel={(d) => formatDateShortFr(fromLocalDateKey(d.date))}
          />
        )}
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-[0.18em] text-faint mb-2">Séance par séance</h2>
        <div className="space-y-1.5">
          {rows.map((occurrence) => (
            <Occurrence
              key={occurrence.date}
              occurrence={occurrence}
              metric={metric}
              exerciseById={exerciseById}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Occurrence({ occurrence, metric, exerciseById }) {
  const [open, setOpen] = useState(false)
  const value = metric.of(occurrence.totals)
  const before = occurrence.previous ? metric.of(occurrence.previous.totals) : null

  // Le détail se déplie à la demande : la liste sert d'abord à repérer une
  // séance, pas à tout lire d'un coup.
  const details = useMemo(() => {
    if (!open) return []
    return Object.values(workByExercise(occurrence.session))
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const exercise = exerciseById?.[item.exerciseId] || null
        const best = bestSet(item.sets, exercise)
        return {
          key: item.exerciseId,
          name: exercise?.name || item.name,
          best: best ? formatSets([best], exercise) : null,
        }
      })
  }, [open, occurrence, exerciseById])

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-surface-2 transition"
      >
        <span className="flex-1 min-w-0 text-sm text-fg">
          {formatDateFr(fromLocalDateKey(occurrence.date), { withYear: true })}
        </span>
        <span className="shrink-0 text-sm text-fg tabular">
          {formatSessionMetric(value, metric)}
        </span>
        <Delta now={value} before={before} />
      </button>

      {open && details.length > 0 && (
        <ul className="border-t border-border">
          {details.map((detail) => (
            <li
              key={detail.key}
              className="flex items-baseline justify-between gap-3 px-4 py-2 border-b border-border last:border-0"
            >
              <span className="min-w-0 text-[13px] text-muted truncate">{detail.name}</span>
              <span className="shrink-0 text-[12px] text-faint tabular">{detail.best}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// L'écart chiffré face à l'occurrence précédente de la MÊME séance.
function Delta({ now, before }) {
  if (before == null) {
    return <span className="w-14 shrink-0 text-right text-[11px] text-faint">1ʳᵉ</span>
  }
  const delta = Math.round(now - before)
  return (
    <span className={cn(
      'w-14 shrink-0 text-right text-[11px] tabular',
      delta > 0 ? 'text-accent' : delta < 0 ? 'text-muted' : 'text-faint',
    )}>
      {delta === 0 ? '=' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('fr-FR')}`}
    </span>
  )
}

function Trend({ now, before }) {
  if (before == null || before <= 0) {
    return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong mx-[6px]" />
  }
  // Même marge de 1 % qu'ailleurs : un arrondi ne doit pas passer pour un
  // progrès.
  if (now > before * 1.01) {
    return <ArrowUp size={14} strokeWidth={2.8} className="shrink-0 text-accent" aria-label="En progrès" />
  }
  if (now < before * 0.99) {
    return <ArrowDown size={14} strokeWidth={2.8} className="shrink-0 text-muted" aria-label="En retrait" />
  }
  return <Minus size={14} strokeWidth={2.8} className="shrink-0 text-faint" aria-label="Stable" />
}

