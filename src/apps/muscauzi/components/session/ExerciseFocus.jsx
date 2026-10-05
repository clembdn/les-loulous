import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CopyCheck, Flame, LineChart, Plus, RotateCcw, SkipForward, Trash2, TrendingUp,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { confirm as hapticConfirm } from '@/shared/lib/haptics.js'
import { isBodyweight, weightHint } from '../../config/exercises.js'
import { doneSets, isEntryComplete, isWarmup } from '../../utils/sets.js'
import { beatsPrevious, formatWeight, setScore } from '../../utils/metrics.js'
import { beatsRecord } from '../../utils/records.js'
import { previousSetAt } from '../../utils/previous.js'
import { entryRange, formatPrescription } from '../../utils/repRange.js'
import { jumpedEarly, passageXp, reachedLoad } from '../../utils/progression.js'
import {
  addSet, addWarmup, buildRows, clearRow, fillRow, parseNumber, removeRow, rowLabels, setField,
  toField, toSets, toggleWarmup,
} from '../../utils/setRows.js'
import SetInput from './SetInput.jsx'
import ExerciseNote from './ExerciseNote.jsx'
import XpCard from './XpCard.jsx'

/**
 * UN exercice, en grand.
 *
 * ── Pourquoi un exercice à la fois ──────────────────────────────────────────
 *
 * L'écran affichait toute la séance en accordéons. Chaque carte gardait un
 * brouillon de saisie qui ne se resynchronisait qu'à l'ouverture, pendant que
 * son en-tête, lui, lisait Firestore en direct : les deux moitiés d'une même
 * carte pouvaient afficher deux vérités. Et il fallait tenir, en plus, quel
 * accordéon était ouvert, ce qu'il avait de sale, et vers quelle date écrire si
 * le jour changeait sous la saisie.
 *
 * Ici il n'y a qu'un exercice à l'écran, donc qu'un brouillon, et la date ne
 * peut pas changer pendant qu'on tape. Toute la mécanique de sauvegarde
 * différée (minuteur de 700 ms, écrivain figé, vidange au démontage) disparaît
 * avec le problème qu'elle rattrapait.
 *
 * ── Une seule façon d'enregistrer ───────────────────────────────────────────
 *
 * `commit()`. Appelée à la sortie d'un champ, au clic sur une pastille, à
 * l'ajout ou au retrait d'une série, et avant de changer d'exercice. Pas de
 * minuteur, pas d'écriture au démontage, pas de second chemin.
 *
 * ── La barre d'XP mène ──────────────────────────────────────────────────────
 *
 * En tête, avant les champs : la dernière fois, la barre, la charge à mettre
 * (cf. `XpCard`). Rien n'est pré-rempli : quand la barre dit de monter ou de
 * redescendre, la charge conseillée devient le placeholder, et c'est elle que
 * la pastille et « Répéter » enregistrent à la place de celle de la dernière
 * fois.
 */
export default function ExerciseFocus({
  line,
  extra = false,
  exercise,
  entry,
  previous,
  progress,
  record,
  note,
  index,
  total,
  prevLabel,
  onPrev,
  onNext,
  onSave,
  onClear,
  onRemove,
  onOpenDetail,
  onSaveNote,
  className,
}) {
  const bodyweight = isBodyweight(exercise)
  const skipped = entry?.skipped === true
  const range = entryRange(line)
  const prescribedSets = line.prescribedSets

  const suggestion = progress?.suggestion || null
  const last = progress?.last || null
  // La charge qui REMPLACE celle de la dernière fois : seulement quand la barre
  // dit de changer — monter (barre pleine) ou redescendre. Au poids du corps
  // non lesté elle vaut 0 : rien à proposer.
  const changeLoad = (suggestion?.kind === 'levelUp' || suggestion?.kind === 'deload') && suggestion.load > 0
    ? suggestion.load
    : null
  const levelUpLoad = suggestion?.kind === 'levelUp' ? suggestion.load : null

  /**
   * Le brouillon de saisie, semé UNE fois.
   *
   * Le composant est monté avec une clé qui contient la date et l'occurrence :
   * changer d'exercice ou de jour le remonte, donc le ressème. En revanche un
   * écho de Firestore ne le touche jamais — c'est ce qui réécrivait les séries
   * 2 à 4 en pleine frappe quand on enregistrait la série 1.
   */
  const [rows, setRows] = useState(() => buildRows({ prescribedSets, entry }))
  const [celebrate, setCelebrate] = useState(false)
  const labels = rowLabels(rows, prescribedSets)

  const working = (list) => toSets(list).filter((s) => !isWarmup(s) && s.reps > 0)

  const write = (next) => {
    // Niveau suivant : la PREMIÈRE série validée à la nouvelle charge se fête.
    // Une fois par ouverture — revenir sur l'exercice ne la rejoue pas, la
    // série étant déjà là avant le geste.
    if (levelUpLoad && !celebrate
      && !reachedLoad(working(rows), levelUpLoad) && reachedLoad(working(next), levelUpLoad)) {
      setCelebrate(true)
      hapticConfirm()
    }
    setRows(next)
    onSave({ sets: toSets(next), skipped: false })
  }

  const commit = () => write(rows)

  const changeField = (i, field, value) => setRows((prev) => setField(prev, i, field, value))

  /**
   * Ce que la pastille enregistre quand on la touche sans rien taper — et donc
   * ce que dit le placeholder, en gris : on valide ce qu'on voit.
   *
   * La dernière fois, série par série. Quand la barre dit de changer de charge,
   * la charge conseillée, et le bas de la fourchette pour les reps : à une
   * charge nouvelle, battre les reps d'avant n'est pas l'objectif.
   */
  const repsTarget = (i) => {
    const label = labels[i]
    if (label.warmup) return 0
    if (changeLoad) return range.min
    return previousSetAt(previous, label.workIndex)?.reps || range.min
  }

  const weightTarget = (i) => {
    if (labels[i].warmup) return 0
    if (changeLoad) return changeLoad
    return previousSetAt(previous, labels[i].workIndex)?.weightKg || 0
  }

  const toggle = (i) => {
    const row = rows[i]
    if (!row) return
    if (parseNumber(row.reps) > 0) {
      write(clearRow(rows, i))
      return
    }
    const reps = repsTarget(i)
    if (reps <= 0) return
    write(fillRow(rows, i, { weightKg: parseNumber(row.weightKg) || weightTarget(i), reps }))
  }

  /**
   * « Comme la dernière fois » — remplit d'un geste les séries de travail encore
   * vides. Ne touche JAMAIS une série déjà saisie : le raccourci sert à éviter
   * de retaper l'identique, pas à écraser le travail du jour.
   *
   * Quand la barre dit de changer de charge, ce sont les reps de la dernière
   * fois à la charge conseillée : on ne refait pas, par réflexe, la charge
   * qu'on vient justement de valider — ou de rater deux fois.
   */
  const repeatLast = () => {
    write(rows.map((r, i) => {
      const label = labels[i]
      if (label.warmup || parseNumber(r.reps) > 0) return r
      const ref = previousSetAt(previous, label.workIndex)
      if (!ref || !(ref.reps > 0)) return r
      return { ...r, weightKg: toField(changeLoad || ref.weightKg, true), reps: String(ref.reps) }
    }))
  }

  const skip = () => onSave({ sets: [], skipped: true })

  /**
   * Deux gestes distincts derrière la même écriture.
   *
   * « Reprendre » annule un « non fait » : l'exercice reste au programme du
   * jour et on continue dessus. « Retirer » enlève une occurrence ajoutée à la
   * volée : elle n'a plus de raison d'exister, et on repart vers la liste.
   * Les confondre renvoyait à l'aperçu quelqu'un qui voulait juste se remettre
   * à un exercice qu'il avait sauté.
   */
  const reopen = () => {
    setRows(buildRows({ prescribedSets, entry: null }))
    onClear()
  }

  const remove = () => {
    setRows(buildRows({ prescribedSets, entry: null }))
    onRemove()
  }

  const go = (fn) => { commit(); fn?.() }

  const done = doneSets(entry)
  const isComplete = isEntryComplete(entry, prescribedSets)
  const improved = !skipped && beatsPrevious(done, previous?.sets, exercise)

  // La barre d'aujourd'hui se lit dans le BROUILLON, pas dans Firestore : elle
  // bouge dès qu'on valide une série, sans attendre l'écho du cache.
  const todayWorking = working(rows)
  const today = skipped ? null : passageXp({ sets: todayWorking, prescribedSets, range }, { bodyweight })
  const warning = !skipped && jumpedEarly(todayWorking, progress)
  const leveledToday = !!levelUpLoad && reachedLoad(todayWorking, levelUpLoad)
  const level = (progress?.level || 0) + (leveledToday ? 1 : 0)

  /**
   * Le rang de la série qui bat le record — au plus une.
   *
   * Le record de référence est celui d'AVANT aujourd'hui (cf.
   * `utils/records.js`). Si plusieurs séries du jour le dépassent, c'est la
   * meilleure qui porte le badge : deux trophées sur le même exercice ne
   * voudraient plus rien dire. Un échauffement ne bat jamais rien.
   */
  const recordRank = useMemo(() => {
    if (skipped || !record) return null
    let best = null
    let bestScore = 0
    for (const set of entry?.sets || []) {
      if (isWarmup(set)) continue
      const score = setScore(set, exercise)
      if (!beatsRecord(score, record) || score <= bestScore) continue
      bestScore = score
      best = set.rank
    }
    return best
  }, [entry, exercise, record, skipped])
  const hint = weightHint(exercise)
  const canRepeat = !skipped && !isComplete && !!previous?.sets?.length

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex-1 min-h-0 lg:overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-faint">
              Exercice {index + 1} sur {total}
            </p>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-fg truncate">
                {line.name}
              </h2>
              {/* Le niveau : les montées de charge validées sur ce mouvement,
                  recalculées depuis l'historique. Il passe au suivant sous les
                  yeux à la première série faite à la nouvelle charge. */}
              {last && (
                <span
                  key={level}
                  className={cn(
                    'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular',
                    leveledToday ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted',
                    celebrate && 'level-pop',
                  )}
                  title="Niveau : nombre de montées de charge validées (barre pleine, puis montée)"
                >
                  Niv. {level}
                </span>
              )}
              {improved && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                             bg-accent/12 text-accent text-[10px] font-semibold"
                  title="Meilleure séance que la dernière fois"
                >
                  <TrendingUp size={10} strokeWidth={3} /> Mieux
                </span>
              )}
            </div>
            <p className="text-sm text-muted mt-0.5 tabular">
              {formatPrescription(prescribedSets, range)}
              {extra && ' · hors programme'}
            </p>
          </div>
        </div>

        <XpCard
          previous={previous}
          progress={progress}
          today={today}
          exercise={exercise}
          record={record}
          warning={warning}
          celebrate={celebrate}
          leveled={leveledToday}
          targetReps={range.max}
        />

        <div className="flex items-center justify-between gap-2 mt-4 mb-3">
          <button
            onClick={() => onOpenDetail(line.exerciseId)}
            className="inline-flex items-center gap-1.5 h-9 text-xs font-medium text-accent hover:opacity-80 transition"
          >
            <LineChart size={13} /> Voir la progression
          </button>
          {skipped ? (
            <button
              onClick={reopen}
              className="inline-flex items-center gap-1.5 h-9 text-xs text-muted hover:text-fg transition"
            >
              <RotateCcw size={13} /> Reprendre
            </button>
          ) : extra ? (
            <button
              onClick={remove}
              className="inline-flex items-center gap-1.5 h-9 text-xs text-muted hover:text-danger transition"
            >
              <Trash2 size={13} /> Retirer
            </button>
          ) : (
            <button
              onClick={skip}
              className="inline-flex items-center gap-1.5 h-9 text-xs text-muted hover:text-fg transition"
            >
              <SkipForward size={13} /> Non fait
            </button>
          )}
        </div>

        {skipped ? (
          <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-border">
            <SkipForward size={24} className="mx-auto text-faint" />
            <p className="text-sm text-muted mt-3">Marqué non fait pour aujourd'hui.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((row, i) => {
                const label = labels[i]
                const name = label.warmup ? 'Échauffement' : `Série ${label.number}${label.extra ? ' (en plus)' : ''}`
                const weightTargetValue = weightTarget(i)
                const repsTargetValue = repsTarget(i)
                return (
                  <SetInput
                    key={i}
                    label={name}
                    number={label.number}
                    warmup={label.warmup}
                    weightKg={row.weightKg}
                    reps={row.reps}
                    weightPlaceholder={weightTargetValue > 0 ? formatWeight(weightTargetValue) : '0'}
                    repsPlaceholder={repsTargetValue > 0 ? String(repsTargetValue) : '—'}
                    isRecord={i === recordRank}
                    bodyweight={bodyweight}
                    onChange={(field, value) => changeField(i, field, value)}
                    onCommit={commit}
                    onToggle={() => toggle(i)}
                    onToggleWarmup={() => write(toggleWarmup(rows, i, { prescribedSets }))}
                    onRemove={label.warmup || label.extra ? () => write(removeRow(rows, i)) : null}
                  />
                )
              })}
            </div>

            <div className="flex gap-2 mt-3">
              <Button variant="dashed" className="flex-1 text-xs" onClick={() => write(addSet(rows))}>
                <Plus size={14} /> série
              </Button>
              <Button variant="dashed" className="flex-1 text-xs" onClick={() => write(addWarmup(rows))}>
                <Flame size={14} /> échauffement
              </Button>
              {canRepeat && (
                <Button variant="secondary" className="flex-1 text-xs" onClick={repeatLast}>
                  <CopyCheck size={14} /> Répéter
                </Button>
              )}
            </div>

            {/* Le geste se découvre une fois ; dès qu'un échauffement existe,
                l'explication n'apprend plus rien et se retire. */}
            {(hint || !rows.some((r) => r.warmup)) && (
              <p className="text-[11px] text-faint mt-3 leading-relaxed">
                {!rows.some((r) => r.warmup) && (
                  <span className="block">
                    Touche le numéro d’une série pour la passer en échauffement — elle ne comptera
                    ni dans la barre d’XP ni dans les records.
                  </span>
                )}
                {hint && <span className="block mt-1">{hint}</span>}
              </p>
            )}

            <div className="mt-4">
              <ExerciseNote note={note} onSave={(text) => onSaveNote(line.exerciseId, text)} />
            </div>
          </>
        )}
      </div>

      {/* La barre d'avancement colle en bas, au-dessus de la barre d'onglets.
          C'est le seul contrôle dont on a besoin la main sur la barre. */}
      <div className="sticky bottom-16 lg:bottom-0 -mx-4 lg:mx-0 mt-5 px-4 lg:px-0 py-3
                      bg-gradient-to-t from-bg via-bg to-transparent">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => go(onPrev)}
            disabled={!prevLabel}
          >
            <ArrowLeft size={16} /> {prevLabel || 'Précédent'}
          </Button>
          <Button
            variant={isComplete ? 'accent' : 'secondary'}
            size="lg"
            className="flex-1"
            onClick={() => go(onNext)}
          >
            {isComplete ? <Check size={16} strokeWidth={2.6} /> : null}
            {index === total - 1 ? 'Terminer' : 'Suivant'}
            {!isComplete && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
