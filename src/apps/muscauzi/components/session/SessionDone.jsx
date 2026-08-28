import { useMemo } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Award, Minus, Trophy } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { formatDateFr, fromLocalDateKey } from '@/shared/lib/dates.js'
import { hasCompletedWork } from '../../services/sessionsService.js'
import {
  bestScore, bestSet, formatSets, pickReferenceSession, sessionTotals, setScore, workByExercise,
} from '../../utils/metrics.js'
import { buildPreviousIndex } from '../../utils/previous.js'
import { beatsRecord } from '../../utils/records.js'
import { compare } from '../../utils/trend.js'

/**
 * Le bilan de fin de séance — un ÉCRAN, plus un encart.
 *
 * Il s'insérait au-dessus de la liste dès le dernier exercice terminé, et
 * poussait vers le bas la carte qu'on était précisément en train de regarder.
 * Il arrive maintenant à sa place : après le dernier exercice, quand on a fini.
 *
 * ── Deux comparaisons, parce qu'il y a deux questions ───────────────────────
 *
 * 1. LES TOTAUX se comparent à la dernière séance DE MÊME NOM. Rapprocher une
 *    séance de celle qui la précède, quelle qu'elle soit, ne veut rien dire :
 *    un jour de jambes pèse trois fois le volume d'un jour de bras. À défaut de
 *    nom, on retombe sur la même case du programme (même parité, même jour).
 *
 * 2. CHAQUE EXERCICE se compare à la dernière fois qu'il a été fait, où que ce
 *    soit — la seule comparaison qui reste vraie quand le programme bouge.
 *
 * Tout se lit dans la fenêtre de séances récentes déjà ouverte par le contexte,
 * bornée à la veille : ce bilan n'ouvre aucune écoute à lui seul, et ne peut
 * pas se comparer à lui-même.
 */
export default function SessionDone({
  session, dateKey, name, parity, dayOfWeek, exerciseById, recentSessions, records,
  onBack, onSeeProgress,
}) {
  const past = useMemo(
    () => (recentSessions || []).filter((s) => s.date < dateKey && hasCompletedWork(s)),
    [recentSessions, dateKey],
  )

  const reference = useMemo(
    () => pickReferenceSession(past, { name, parity, dayOfWeek }),
    [past, name, parity, dayOfWeek],
  )

  const totals = useMemo(() => sessionTotals(session), [session])
  const referenceTotals = useMemo(
    () => (reference ? sessionTotals(reference.session) : null),
    [reference],
  )

  const previousByExercise = useMemo(
    () => buildPreviousIndex(past, dateKey),
    [past, dateKey],
  )

  const rows = useMemo(() => (
    Object.values(workByExercise(session))
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const exercise = exerciseById?.[item.exerciseId] || null
        const best = bestSet(item.sets, exercise)
        const before = previousByExercise[item.exerciseId]
        return {
          key: item.exerciseId,
          name: exercise?.name || item.name,
          best: best ? formatSets([best], exercise) : null,
          // Le record se juge sur la MEILLEURE série du jour, face au record
          // d'avant aujourd'hui (`records` exclut déjà la séance en cours).
          isRecord: best
            ? beatsRecord(setScore(best, exercise), records?.[item.exerciseId])
            : false,
          // Sans passage précédent, il n'y a pas de verdict à rendre.
          trend: before
            ? compare(bestScore(item.sets, exercise), bestScore(before.sets, exercise))
            : null,
        }
      })
  ), [session, previousByExercise, exerciseById, records])

  const empty = totals.sets === 0
  const recordCount = rows.filter((r) => r.isRecord).length

  return (
    <section className="fade-in">
      <div className="flex items-center gap-3">
        <span className={cn(
          'h-11 w-11 shrink-0 rounded-full flex items-center justify-center',
          empty ? 'bg-surface-2 text-faint' : 'bg-accent text-accent-fg',
        )}>
          <Trophy size={20} strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-fg truncate">
            {empty ? 'Rien d’enregistré' : name ? `${name} — terminée` : 'Séance terminée'}
          </h2>
          <p className="text-xs text-muted mt-0.5 truncate">
            {empty ? 'Reviens en arrière pour saisir tes séries.' : caption(reference, name)}
          </p>
          {/* Le moment où un record se savoure, c'est ici — pas noyé dans une
              ligne de tableau qu'on survole. */}
          {recordCount > 0 && (
            <p className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full
                          bg-accent/12 text-accent text-[11px] font-semibold">
              <Award size={11} strokeWidth={2.8} />
              {recordCount} record{recordCount > 1 ? 's' : ''} battu{recordCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {!empty && (
        <>
          <div className="grid grid-cols-3 gap-2 mt-5">
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
            <div className="mt-5 rounded-2xl border border-border bg-surface overflow-hidden">
              {/* Les flèches ne suivent pas la séance de référence mais chaque
                  mouvement pris à part : le dire évite de lire un écart pour
                  un autre. */}
              <p className="px-4 pt-3.5 text-[10px] uppercase tracking-[0.14em] text-faint">
                Chaque exercice face à la dernière fois
              </p>
              <ul className="mt-2">
                {rows.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center gap-3 px-4 py-2.5 border-t border-border"
                  >
                    <Trend trend={row.trend} />
                    <span className="flex-1 min-w-0 text-[13px] text-fg truncate">{row.name}</span>
                    {row.isRecord && (
                      <Trophy size={12} strokeWidth={2.6} className="shrink-0 text-accent" aria-label="Record battu" />
                    )}
                    <span className="shrink-0 text-[12px] text-muted tabular">{row.best}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 mt-6">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onBack}>
          <ArrowLeft size={16} /> La séance
        </Button>
        <Button variant="outline" size="lg" className="flex-1" onClick={onSeeProgress}>
          Mes progrès <ArrowRight size={16} />
        </Button>
      </div>
    </section>
  )
}

// Dire À QUOI on compare, sinon les écarts ne veulent rien dire.
function caption(reference, name) {
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
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
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
  if (trend?.direction === 'up') {
    return <ArrowUp size={14} strokeWidth={2.8} className="shrink-0 text-accent" aria-label="En progrès" />
  }
  if (trend?.direction === 'down') {
    return <ArrowDown size={14} strokeWidth={2.8} className="shrink-0 text-muted" aria-label="En retrait" />
  }
  if (trend?.direction === 'flat') {
    return <Minus size={14} strokeWidth={2.8} className="shrink-0 text-faint" aria-label="Identique" />
  }
  // Premier passage : un point neutre, pas une flèche qui mentirait.
  return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong mx-[6px]" />
}

function diff(now, before) {
  if (before == null) return null
  return Math.round(now - before)
}

function formatKg(value) {
  return Math.round(value).toLocaleString('fr-FR')
}
