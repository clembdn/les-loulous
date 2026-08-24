import { useMemo } from 'react'
import { Trophy, ArrowRight, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { shiftDateKey, fromLocalDateKey, formatDateFr } from '@/shared/lib/dates.js'
import { useSessionRange } from '../../hooks/useMuscData.js'
import { hasCompletedWork } from '../../services/sessionsService.js'
import {
  sessionTotals, workByExercise, bestSet, bestScore, formatSets,
} from '../../utils/metrics.js'

/**
 * Le bilan de fin de séance.
 *
 * Coché le dernier exercice, il ne se passait rien : l'écran restait le même et
 * on quittait sans jamais voir la séance comme un tout. C'est pourtant le seul
 * moment où l'on a envie de savoir si on a fait mieux.
 *
 * ── Comparé à QUOI ──────────────────────────────────────────────────────────
 *
 * À la dernière séance qui a porté du vrai travail, pas à la veille : un jour
 * de repos, ou une séance ouverte puis abandonnée, ne sont pas un point de
 * comparaison. On la cherche dans une fenêtre bornée, en remontant depuis hier.
 *
 * Le cache `lastPerf` ne pouvait PAS servir : il est réécrit au fil de la
 * saisie du jour, donc au moment où ce bilan s'affiche il contient déjà les
 * chiffres d'aujourd'hui. Comparer aujourd'hui à lui-même n'aurait rien montré.
 */
const LOOKBACK_DAYS = 60

export default function SessionSummary({ session, dateKey, exerciseById, onSeeProgress }) {
  const start = useMemo(() => shiftDateKey(dateKey, -LOOKBACK_DAYS), [dateKey])
  const end = useMemo(() => shiftDateKey(dateKey, -1), [dateKey])
  const { sessions, isLoading } = useSessionRange(start, end)

  // `sessions` est trié par date croissante : la dernière qui compte est la
  // plus récente.
  const previous = useMemo(
    () => [...sessions].reverse().find(hasCompletedWork) || null,
    [sessions],
  )

  const totals = useMemo(() => sessionTotals(session), [session])
  const previousTotals = useMemo(
    () => (previous ? sessionTotals(previous) : null),
    [previous],
  )

  // Les mouvements du jour, dans l'ordre où ils ont été faits, chacun avec sa
  // meilleure série et son verdict face à la dernière fois.
  const rows = useMemo(() => {
    const today = workByExercise(session)
    const before = previous ? workByExercise(previous) : {}
    return Object.values(today)
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const exercise = exerciseById?.[item.exerciseId] || null
        const best = bestSet(item.sets, exercise)
        const past = before[item.exerciseId]
        return {
          key: item.exerciseId,
          name: exerciseById?.[item.exerciseId]?.name || item.name,
          best: best ? formatSets([best], exercise) : null,
          // Sans passage précédent, il n'y a pas de verdict à rendre.
          trend: past ? compare(bestScore(item.sets, exercise), bestScore(past.sets, exercise)) : null,
        }
      })
  }, [session, previous, exerciseById])

  return (
    <section className="slide-up mb-4 rounded-2xl border border-accent/40 bg-accent/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="h-10 w-10 shrink-0 rounded-full bg-accent text-accent-fg flex items-center justify-center">
          <Trophy size={18} strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-fg">Séance terminée</p>
          <p className="text-xs text-muted mt-0.5">
            {isLoading
              ? 'Comparaison en cours…'
              : previous
                ? `Comparé au ${formatDateFr(fromLocalDateKey(previous.date))}`
                : 'Première séance enregistrée'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mt-4">
        {/* Le volume disparaît si la séance était entièrement au poids du
            corps : « 0 kg » se lirait comme une perte, pas comme une absence. */}
        {totals.volume > 0 && (
          <Stat label="Volume" value={formatKg(totals.volume)} unit="kg"
            delta={diff(totals.volume, previousTotals?.volume)} format={formatKg} />
        )}
        <Stat label="Séries" value={totals.sets}
          delta={diff(totals.sets, previousTotals?.sets)} />
        <Stat label="Reps" value={totals.reps}
          delta={diff(totals.reps, previousTotals?.reps)} />
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 border-t border-accent/15">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-accent/10 last:border-0"
            >
              <Trend trend={row.trend} />
              <span className="flex-1 min-w-0 text-[13px] text-fg truncate">{row.name}</span>
              <span className="shrink-0 text-[12px] text-muted tabular">{row.best}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 pb-4 pt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onSeeProgress}>
          Voir mes progrès <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  )
}

function Stat({ label, value, unit, delta, format = String }) {
  return (
    <div className="rounded-xl bg-bg/40 px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="text-xl font-semibold text-fg tabular tracking-[-0.02em] mt-0.5">
        {value}
        {unit && <span className="text-[11px] font-normal text-muted ml-1">{unit}</span>}
      </p>
      {/* Sans séance de référence, aucune ligne d'écart — un « +0 » inventé
          vaudrait moins que rien. */}
      <p className={cn(
        'text-[11px] tabular mt-0.5',
        delta == null ? 'text-transparent' : delta > 0 ? 'text-accent' : delta < 0 ? 'text-muted' : 'text-faint',
      )}>
        {delta == null ? '—' : delta === 0 ? '=' : `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}`}
      </p>
    </div>
  )
}

function Trend({ trend }) {
  if (trend === 'up') {
    return <ArrowUp size={14} strokeWidth={2.8} className="shrink-0 text-accent" aria-label="En progrès" />
  }
  if (trend === 'down') {
    return <ArrowDown size={14} strokeWidth={2.8} className="shrink-0 text-muted" aria-label="En retrait" />
  }
  if (trend === 'same') {
    return <Minus size={14} strokeWidth={2.8} className="shrink-0 text-faint" aria-label="Identique" />
  }
  // Premier passage : un point neutre, pas une flèche qui mentirait.
  return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong ml-[6px] mr-[6px]" />
}

function compare(now, before) {
  if (before <= 0) return null
  // Une marge de 1 % : deux séances identiques ne doivent pas s'afficher en
  // progrès à cause d'un arrondi sur l'estimation de charge maximale.
  if (now > before * 1.01) return 'up'
  if (now < before * 0.99) return 'down'
  return 'same'
}

function diff(now, before) {
  if (before == null) return null
  return Math.round(now - before)
}

function formatKg(value) {
  return Math.round(value).toLocaleString('fr-FR')
}
