import { useMemo } from 'react'
import { Trophy, ArrowRight, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { shiftDateKey, fromLocalDateKey, formatDateFr } from '@/shared/lib/dates.js'
import { useSessionRange } from '../../hooks/useMuscData.js'
import { hasCompletedWork } from '../../services/sessionsService.js'
import {
  sessionTotals, workByExercise, bestSet, bestScore, formatSets, latestByExercise,
  pickReferenceSession,
} from '../../utils/metrics.js'

/**
 * Le bilan de fin de séance.
 *
 * ── Deux comparaisons, parce qu'il y a deux questions ───────────────────────
 *
 * 1. LES TOTAUX se comparent à la dernière séance DE MÊME NOM. Rapprocher une
 *    séance de celle qui la précède, quelle qu'elle soit, ne veut rien dire :
 *    un jour de jambes pèse trois fois le volume d'un jour de bras, et l'écart
 *    ne mesurait alors que l'alternance du programme. À défaut de nom, on
 *    retombe sur la même case du programme (même parité, même jour) — la
 *    séance d'il y a deux semaines, qui est bien la même.
 *
 * 2. CHAQUE EXERCICE se compare à la dernière fois qu'il a été fait, où que ce
 *    soit. C'est la seule comparaison qui reste vraie quand le programme
 *    bouge : déplacer le développé couché du lundi au jeudi, l'ajouter à une
 *    autre séance ou en changer l'ordre ne doit pas rompre le fil de sa
 *    progression.
 *
 * Le cache `lastPerf` ne pouvait servir ni à l'un ni à l'autre : il est réécrit
 * au fil de la saisie, donc au moment où ce bilan s'affiche il contient déjà
 * les chiffres du jour. Tout se relit dans une fenêtre bornée de séances, qui
 * s'arrête la veille.
 */
const LOOKBACK_DAYS = 90

export default function SessionSummary({
  session, dateKey, name, parity, dayOfWeek, exerciseById, onSeeProgress,
}) {
  const start = useMemo(() => shiftDateKey(dateKey, -LOOKBACK_DAYS), [dateKey])
  const end = useMemo(() => shiftDateKey(dateKey, -1), [dateKey])
  const { sessions, isLoading } = useSessionRange(start, end)

  // `sessions` est trié par date croissante : la dernière du filtre est la
  // plus récente.
  const reference = useMemo(
    () => pickReferenceSession(sessions.filter(hasCompletedWork), { name, parity, dayOfWeek }),
    [sessions, name, parity, dayOfWeek],
  )

  const totals = useMemo(() => sessionTotals(session), [session])
  const referenceTotals = useMemo(
    () => (reference ? sessionTotals(reference.session) : null),
    [reference],
  )

  // La dernière trace de CHAQUE mouvement dans la fenêtre, séance par séance.
  const previousByExercise = useMemo(() => latestByExercise(sessions), [sessions])

  const rows = useMemo(() => {
    return Object.values(workByExercise(session))
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const exercise = exerciseById?.[item.exerciseId] || null
        const best = bestSet(item.sets, exercise)
        const past = previousByExercise[item.exerciseId]
        return {
          key: item.exerciseId,
          name: exercise?.name || item.name,
          best: best ? formatSets([best], exercise) : null,
          // Sans passage précédent, il n'y a pas de verdict à rendre.
          trend: past
            ? compare(bestScore(item.sets, exercise), bestScore(past.sets, exercise))
            : null,
        }
      })
  }, [session, previousByExercise, exerciseById])

  return (
    <section className="slide-up mb-4 rounded-2xl border border-accent/40 bg-accent/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="h-10 w-10 shrink-0 rounded-full bg-accent text-accent-fg flex items-center justify-center">
          <Trophy size={18} strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-fg truncate">
            {name ? `${name} — terminée` : 'Séance terminée'}
          </p>
          <p className="text-xs text-muted mt-0.5 truncate">{caption(isLoading, reference, name)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mt-4">
        {/* Le volume disparaît si la séance était entièrement au poids du
            corps : « 0 kg » se lirait comme une perte, pas comme une absence. */}
        {totals.volume > 0 && (
          <Stat label="Volume" value={formatKg(totals.volume)} unit="kg"
            delta={diff(totals.volume, referenceTotals?.volume)} format={formatKg} />
        )}
        <Stat label="Séries" value={totals.sets}
          delta={diff(totals.sets, referenceTotals?.sets)} />
        <Stat label="Reps" value={totals.reps}
          delta={diff(totals.reps, referenceTotals?.reps)} />
      </div>

      {rows.length > 0 && (
        <>
          {/* Les flèches ne suivent pas la séance de référence mais chaque
              mouvement pris à part : le dire évite de lire un écart pour un
              autre. */}
          <p className="px-4 mt-4 text-[10px] uppercase tracking-[0.14em] text-faint">
            Chaque exercice face à la dernière fois
          </p>
          <ul className="mt-2 border-t border-accent/15">
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
        </>
      )}

      <div className="px-4 pb-4 pt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onSeeProgress}>
          Voir mes progrès <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  )
}

// Dire À QUOI on compare, sinon les écarts ne veulent rien dire.
function caption(isLoading, reference, name) {
  if (isLoading) return 'Comparaison en cours…'
  if (!reference) {
    return name ? `Première séance « ${name} »` : 'Première séance enregistrée'
  }
  const when = formatDateFr(fromLocalDateKey(reference.session.date))
  return reference.by === 'name'
    ? `Comparé à « ${name} » du ${when}`
    : `Comparé au même jour, le ${when}`
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
  return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong mx-[6px]" />
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
