import { ArrowDown, ArrowUp, Info, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDateFr, fromLocalDateKey } from '@/shared/lib/dates.js'
import { isBodyweight } from '../../config/exercises.js'
import { formatLoad, formatSets, formatWeight } from '../../utils/metrics.js'

/**
 * Les repères qu'on cherche des yeux avant de charger la barre.
 *
 * De haut en bas, dans l'ordre où on les lit entre deux séries :
 *
 * 1. LA DERNIÈRE FOIS — toutes les séries, telles qu'elles ont été faites ;
 * 2. LA BARRE D'XP — où l'on en est, et la charge à mettre, en une phrase ;
 * 3. LE RECORD — en petit, en bas.
 *
 * ── Dernière séance ET aujourd'hui ──────────────────────────────────────────
 *
 * Avant la première série, la barre montre la dernière séance. Dès qu'une
 * série est saisie, elle se remplit avec celle du jour et la dernière séance
 * reste en repère (un trait sur la barre) : on voit en direct si l'on est en
 * train de la battre. À une charge NOUVELLE, la barre repart de zéro, sans
 * repère — c'est un nouveau niveau, pas la suite de l'ancien.
 *
 * @param previous   cf. `buildPreviousIndex` — la dernière fois, toutes séries
 * @param progress   cf. `exerciseProgress` (historique d'avant aujourd'hui)
 * @param today      `passageXp` des séries du jour, ou null
 * @param leveled    la nouvelle charge a été faite aujourd'hui
 * @param targetReps le haut de la fourchette du jour
 */
export default function XpCard({
  previous, progress, today, exercise, record, warning, celebrate, leveled = false, targetReps,
}) {
  const last = progress?.last || null
  const suggestion = progress?.suggestion || { kind: 'first', load: null }
  const bodyweight = isBodyweight(exercise)

  const live = !!today && today.load !== null
  const sameLevel = live && last && Math.abs(today.load - last.load) < 1e-6
  const value = live ? today.xp : (last?.xp ?? 0)
  const marker = live && sameLevel ? last.xp : null

  // Première fois, rien de saisi : pas encore de barre à montrer.
  if (!previous?.sets?.length && !last && !live) {
    return (
      <p className="mt-3 px-3.5 py-2.5 rounded-xl border border-dashed border-border text-[11px] text-faint">
        Première fois sur ce mouvement — pas encore de repère.
      </p>
    )
  }

  const { icon: Icon, tone, title, detail } = leveled
    ? {
      // La montée est faite : on ne répète plus « passe à 47 kg » à quelqu'un
      // qui vient de le faire. La barre repart de zéro, à ce nouveau niveau.
      icon: Sparkles,
      tone: 'accent',
      title: `Niveau atteint — ${formatLoad(suggestion.load, exercise)}`,
      detail: `Remplis la barre à cette charge : ${targetReps} reps sur chaque série.`,
    }
    : describe(suggestion, last, exercise, bodyweight)

  return (
    <div className="mt-3 rounded-2xl border border-border bg-surface overflow-hidden">
      {previous?.sets?.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border">
          <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
            Dernière fois · {formatDateFr(fromLocalDateKey(previous.date))}
          </p>
          <p className="text-[13px] text-fg tabular mt-1 leading-relaxed">
            {formatSets(previous.sets, exercise)}
          </p>
        </div>
      )}

      <div className="px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-faint truncate">
            Barre d’XP · {live ? 'aujourd’hui' : 'dernière séance'}
          </p>
          <p className="shrink-0 text-xs text-muted tabular">
            <span className={cn('text-sm font-semibold', value >= 1 ? 'text-accent' : 'text-fg')}>
              {Math.round(value * 100)} %
            </span>
            {marker !== null && <span className="text-faint ml-1.5">dernière {Math.round(marker * 100)} %</span>}
          </p>
        </div>

        <XpBar value={value} marker={marker} celebrate={celebrate} />

        <div className="flex items-center gap-2 mt-2.5">
          {Icon && (
            <span className={cn(
              'h-7 w-7 shrink-0 rounded-full flex items-center justify-center',
              tone === 'accent' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted',
            )}>
              <Icon size={15} strokeWidth={2.6} />
            </span>
          )}
          <p className={cn(
            'text-[17px] font-semibold tracking-[-0.01em] leading-tight tabular',
            tone === 'accent' ? 'text-accent' : 'text-fg',
          )}>
            {title}
          </p>
        </div>

        {detail && <p className="text-[13px] text-muted mt-1.5 leading-snug">{detail}</p>}

        {warning && (
          <p className="flex items-start gap-2 mt-2.5 px-3 py-2 rounded-xl bg-surface-2 text-[12px] text-muted leading-snug">
            <Info size={14} className="shrink-0 mt-px text-faint" />
            Tu as monté avant d’avoir rempli la barre.
          </p>
        )}
      </div>

      {record && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
          <Trophy size={12} className="shrink-0 text-accent" />
          <span className="text-[11px] text-muted">Record</span>
          <span className="flex-1 min-w-0 text-right text-[12px] text-fg tabular truncate">
            {formatSets([record.set], exercise)}
            <span className="text-faint ml-1.5">{formatDateFr(fromLocalDateKey(record.date))}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function XpBar({ value, marker, celebrate }) {
  const ratio = Math.min(1, Math.max(0, value))
  const full = ratio >= 1
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-label="Barre d’XP"
      className={cn('relative h-3 mt-2 rounded-full bg-surface-2', celebrate && 'xp-burst')}
    >
      {ratio > 0 && (
        <div
          className={cn(
            'h-full rounded-full bg-accent transition-[width] duration-500 ease-ios',
            full && 'shadow-[0_0_14px_rgb(var(--accent)/0.55)]',
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      )}
      {marker !== null && marker > 0 && marker < 1 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg/70"
          style={{ left: `calc(${marker * 100}% - 1px)` }}
        />
      )}
    </div>
  )
}

/**
 * Ce que la barre veut dire, en une phrase : l'ACTION — la charge à mettre —
 * parce que c'est ce qu'on fait juste après l'avoir lue.
 */
function describe(suggestion, last, exercise, bodyweight) {
  switch (suggestion.kind) {
    case 'levelUp':
      return {
        icon: ArrowUp,
        tone: 'accent',
        title: bodyweight && !(last.load > 0)
          ? `Niveau suivant : ajoute ${formatWeight(suggestion.load)} kg de lest`
          : `Niveau suivant : passe à ${formatLoad(suggestion.load, exercise)}`,
        detail: null,
      }
    case 'full':
      return {
        icon: Sparkles,
        tone: 'accent',
        title: 'Barre pleine !',
        detail: bodyweight
          ? 'Ajoute du lest — règle son pas dans la fiche de l’exercice.'
          : 'Règle le pas de charge dans la fiche de l’exercice pour la suite.',
      }
    case 'deload':
      return {
        icon: ArrowDown,
        tone: 'muted',
        title: `Redescends à ${formatLoad(suggestion.load, exercise)}`,
        detail: `Deux séances de suite sous ${last.range.min} reps à ${formatLoad(last.load, exercise)}.`,
      }
    case 'stay': {
      const where = bodyweight && !(last.load > 0) ? 'Reste au poids du corps' : `Reste à ${formatLoad(suggestion.load, exercise)}`
      return { icon: null, tone: 'fg', title: `${where} — bats ${last.done.join('/')}`, detail: null }
    }
    default:
      return {
        icon: null,
        tone: 'fg',
        title: 'Trouve ta charge de travail',
        detail: 'La barre d’XP démarre à partir de cette séance.',
      }
  }
}
