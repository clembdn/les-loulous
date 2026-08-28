import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CopyCheck, LineChart, Plus, RotateCcw, SkipForward, Trash2, TrendingUp, Trophy,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { formatDateFr, fromLocalDateKey } from '@/shared/lib/dates.js'
import { isBodyweight, weightHint } from '../../config/exercises.js'
import { doneSets } from '../../utils/sets.js'
import { beatsPrevious, formatSets, formatWeight, setScore } from '../../utils/metrics.js'
import { beatsRecord } from '../../utils/records.js'
import { previousSetAt } from '../../utils/previous.js'
import SetInput from './SetInput.jsx'
import ExerciseNote from './ExerciseNote.jsx'

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
 */
export default function ExerciseFocus({
  line,
  extra = false,
  exercise,
  entry,
  previous,
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

  /**
   * Le brouillon de saisie, semé UNE fois.
   *
   * Le composant est monté avec une clé qui contient la date et l'occurrence :
   * changer d'exercice ou de jour le remonte, donc le ressème. En revanche un
   * écho de Firestore ne le touche jamais — c'est ce qui réécrivait les séries
   * 2 à 4 en pleine frappe quand on enregistrait la série 1.
   */
  const [rows, setRows] = useState(() => buildRows(line.prescribedSets, entry))

  const write = (next) => {
    setRows(next)
    onSave({ sets: toSets(next), skipped: false })
  }

  const commit = () => write(rows)

  const setField = (rank, field, value) => {
    setRows((prev) => prev.map((r) => (r.rank === rank ? { ...r, [field]: value } : r)))
  }

  /**
   * La pastille : valider, ou annuler.
   *
   * Valider écrit ce qui est TAPÉ. À défaut, la dernière fois ; à défaut, la
   * prescription du jour — mais seulement sur un geste explicite, jamais au
   * passage d'un doigt. Sans rien de tout ça, il n'y a rien à valider et la
   * pastille ne fait rien.
   */
  const toggle = (rank) => {
    const row = rows.find((r) => r.rank === rank)
    if (!row) return
    if (parseNumber(row.reps) > 0) {
      write(rows.map((r) => (r.rank === rank ? { ...r, weightKg: '', reps: '' } : r)))
      return
    }
    const ref = previousSetAt(previous, rank)
    const reps = Math.round(parseNumber(row.reps) || ref?.reps || line.prescribedReps || 0)
    if (reps <= 0) return
    const weightKg = parseNumber(row.weightKg) || ref?.weightKg || 0
    write(rows.map((r) => (r.rank === rank
      ? { ...r, weightKg: toField(weightKg, true), reps: String(reps) }
      : r)))
  }

  const addRow = () => {
    write([...rows, { rank: rows.length, extra: true, weightKg: '', reps: '' }])
  }

  // Les rangs sont renumérotés : retirer la 5e série ne doit pas laisser un
  // trou que la reconstruction rouvrirait à la ligne suivante.
  const removeRow = (rank) => {
    write(rows
      .filter((r) => r.rank !== rank)
      .map((r, i) => ({ ...r, rank: i, extra: i >= line.prescribedSets })))
  }

  /**
   * « Comme la dernière fois » — remplit d'un geste les séries encore vides.
   * Ne touche JAMAIS une série déjà saisie : le raccourci sert à éviter de
   * retaper l'identique, pas à écraser le travail du jour.
   */
  const repeatLast = () => {
    write(rows.map((r) => {
      if (parseNumber(r.reps) > 0) return r
      const ref = previousSetAt(previous, r.rank)
      if (!ref || !(ref.reps > 0)) return r
      return { ...r, weightKg: toField(ref.weightKg, true), reps: String(ref.reps) }
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
    setRows(buildRows(line.prescribedSets, null))
    onClear()
  }

  const remove = () => {
    setRows(buildRows(line.prescribedSets, null))
    onRemove()
  }

  const go = (fn) => { commit(); fn?.() }

  const done = doneSets(entry)
  const savedDone = done.length
  const isComplete = skipped || savedDone >= line.prescribedSets
  const improved = !skipped && beatsPrevious(done, previous?.sets, exercise)

  /**
   * Le rang de la série qui bat le record — au plus une.
   *
   * Le record de référence est celui d'AVANT aujourd'hui (cf.
   * `utils/records.js`). Si plusieurs séries du jour le dépassent, c'est la
   * meilleure qui porte le badge : deux trophées sur le même exercice ne
   * voudraient plus rien dire.
   */
  const recordRank = useMemo(() => {
    if (skipped || !record) return null
    let best = null
    let bestScore = 0
    for (const set of entry?.sets || []) {
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
              {improved && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                             bg-accent/12 text-accent text-[10px] font-semibold"
                  title="Meilleure série que la dernière fois"
                >
                  <TrendingUp size={10} strokeWidth={3} /> Mieux
                </span>
              )}
            </div>
            <p className="text-sm text-muted mt-0.5 tabular">
              {line.prescribedSets} × {line.prescribedReps}
              {extra && ' · hors programme'}
            </p>
          </div>
        </div>

        {/* Le repère de la séance précédente, en clair et en haut : c'est ce
            qu'on cherche des yeux avant de charger la barre. Il vient de
            l'historique réel, strictement antérieur à aujourd'hui — donc il ne
            se transforme plus en la série qu'on vient de taper. */}
        <PreviousRecap previous={previous} record={record} exercise={exercise} />

        <div className="flex items-center justify-between gap-2 mt-4 mb-3">
          <button
            onClick={() => onOpenDetail(line.exerciseId)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition"
          >
            <LineChart size={13} /> Voir la progression
          </button>
          {skipped ? (
            <button
              onClick={reopen}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition"
            >
              <RotateCcw size={13} /> Reprendre
            </button>
          ) : extra ? (
            <button
              onClick={remove}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger transition"
            >
              <Trash2 size={13} /> Retirer
            </button>
          ) : (
            <button
              onClick={skip}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition"
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
              {rows.map((row) => (
                <SetInput
                  key={row.rank}
                  label={row.extra ? `Série ${row.rank + 1} (en plus)` : `Série ${row.rank + 1}`}
                  weightKg={row.weightKg}
                  reps={row.reps}
                  previous={previousSetAt(previous, row.rank)}
                  isRecord={row.rank === recordRank}
                  bodyweight={bodyweight}
                  prescribedReps={line.prescribedReps}
                  onChange={(field, value) => setField(row.rank, field, value)}
                  onCommit={commit}
                  onToggle={() => toggle(row.rank)}
                  onRemove={row.extra ? () => removeRow(row.rank) : null}
                />
              ))}
            </div>

            <div className="flex gap-2 mt-3">
              <Button variant="dashed" className="flex-1 text-xs" onClick={addRow}>
                <Plus size={14} /> série
              </Button>
              {canRepeat && (
                <Button variant="secondary" className="flex-1 text-xs" onClick={repeatLast}>
                  <CopyCheck size={14} /> Répéter
                </Button>
              )}
            </div>

            {hint && <p className="text-[11px] text-faint mt-3 leading-relaxed">{hint}</p>}

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

/**
 * Les deux repères qu'on cherche des yeux avant de charger la barre.
 *
 * La dernière fois répond à « où j'en étais » ; le record à « qu'est-ce que je
 * vise ». Les deux sont côte à côte, en haut, avant les champs — pas cachés
 * derrière un onglet Progrès.
 */
function PreviousRecap({ previous, record, exercise }) {
  if (!previous?.sets?.length) {
    return (
      <p className="mt-3 px-3.5 py-2.5 rounded-xl border border-dashed border-border text-[11px] text-faint">
        Première fois sur ce mouvement — pas encore de repère.
      </p>
    )
  }
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
          Dernière fois · {formatDateFr(fromLocalDateKey(previous.date))}
        </p>
        <p className="text-[13px] text-fg tabular mt-1 leading-relaxed">
          {formatSets(previous.sets, exercise)}
        </p>
      </div>
      {record && (
        <div className="flex items-center gap-2 px-3.5 py-2 border-t border-border">
          <Trophy size={12} className="shrink-0 text-accent" />
          <span className="text-[11px] text-muted">Record</span>
          <span className="flex-1 min-w-0 text-right text-[12px] text-fg tabular truncate">
            {formatSets([record.set], exercise)}
            <span className="text-faint ml-1.5">
              {formatDateFr(fromLocalDateKey(record.date))}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

// Relire une charge doit rendre exactement ce qu'on a tapé : « 62,5 », pas
// « 62.5 ». Le champ accepte les deux, mais n'en affiche qu'une.
function toField(value, decimal = false) {
  if (!(value > 0)) return ''
  return decimal ? formatWeight(value) : String(value)
}

function parseNumber(value) {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Les lignes affichées : une par série prescrite, plus les séries ajoutées à la
 * main. Une série enregistrée à 0 revient comme un champ vide — un 0 stocké
 * veut dire « rien saisi », jamais « zéro kilo validé ».
 */
function buildRows(prescribedSets, entry) {
  const stored = new Map((entry?.sets || []).map((s) => [s.rank, s]))
  const lastRank = stored.size > 0 ? Math.max(...stored.keys()) : -1
  const count = Math.max(prescribedSets, lastRank + 1)

  return Array.from({ length: count }, (_, rank) => {
    const saved = stored.get(rank)
    return {
      rank,
      extra: rank >= prescribedSets,
      weightKg: saved ? toField(saved.weightKg, true) : '',
      reps: saved ? toField(saved.reps) : '',
    }
  })
}

function toSets(rows) {
  return rows
    .map((r) => ({ rank: r.rank, weightKg: parseNumber(r.weightKg), reps: Math.round(parseNumber(r.reps)) }))
    .filter((s) => s.weightKg > 0 || s.reps > 0)
}
