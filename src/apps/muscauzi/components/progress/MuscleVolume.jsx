import { useMemo, useState } from 'react'
import { PersonStanding } from 'lucide-react'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { cn } from '@/shared/lib/utils.js'
import { shiftDateKey, formatDateFr, fromLocalDateKey } from '@/shared/lib/dates.js'
import { doneSets } from '../../utils/sets.js'
import { isBodyweight } from '../../config/exercises.js'
import { MUSCLE_GROUPS, OTHER_GROUP } from '../../config/exerciseLibrary.js'
import { compare, formatTrend } from '../../utils/trend.js'

/**
 * Le volume par GROUPE MUSCULAIRE — la question qu'aucun autre écran ne pose.
 *
 * « Est-ce que mon développé monte » se lit exercice par exercice. « Est-ce que
 * mes Push valent ceux du mois dernier » se lit séance par séance. Ni l'un ni
 * l'autre ne répond à « est-ce que je néglige mes jambes » — la seule question
 * dont la réponse change un programme.
 *
 * ── Comment le volume se compte ─────────────────────────────────────────────
 *
 * Charge × répétitions, additionné. Un mouvement au poids du corps a une charge
 * nulle et pèserait donc zéro : ses répétitions sont comptées à part, dans un
 * second onglet. Additionner des kilos et des répétitions dans une seule barre
 * aurait produit un chiffre que rien ne permet d'interpréter.
 *
 * ── Deux périodes, comparées ────────────────────────────────────────────────
 *
 * La fenêtre choisie, et celle qui la précède immédiatement. C'est ce qui
 * transforme une barre en information : 12 000 kg de dos ne veut rien dire ;
 * « 12 000 kg, +18 % » se lit tout de suite.
 */
const RANGES = [
  { id: '28', label: '4 semaines', short: '4 sem.', days: 28 },
  { id: '84', label: '12 semaines', short: '12 sem.', days: 84 },
]

const METRICS = [
  { id: 'volume', label: 'Volume', short: 'Volume' },
  { id: 'sets', label: 'Séries', short: 'Séries' },
]

export default function MuscleVolume({ sessions, exerciseById, today }) {
  const [rangeId, setRangeId] = useState('28')
  const [metricId, setMetricId] = useState('volume')

  const range = RANGES.find((r) => r.id === rangeId)
  const metric = METRICS.find((m) => m.id === metricId)

  const { rows, max, from, previousFrom } = useMemo(() => {
    const start = shiftDateKey(today, -(range.days - 1))
    const before = shiftDateKey(start, -range.days)

    const tally = (fromKey, toKey) => {
      const out = {}
      for (const session of sessions) {
        if (session.date < fromKey || session.date > toKey) continue
        for (const entry of Object.values(session.entries || {})) {
          const exercise = exerciseById[entry.exerciseId]
          const group = exercise?.group || OTHER_GROUP
          for (const set of doneSets(entry)) {
            if (!out[group]) out[group] = { volume: 0, sets: 0, reps: 0 }
            out[group].sets += 1
            out[group].reps += set.reps
            // Un mouvement au poids du corps n'apporte pas de volume : sa
            // charge est nulle, et un lest n'est pas la charge soulevée.
            if (!isBodyweight(exercise)) out[group].volume += set.weightKg * set.reps
          }
        }
      }
      return out
    }

    const current = tally(start, today)
    const past = tally(before, shiftDateKey(start, -1))

    const list = MUSCLE_GROUPS
      .map((group) => ({
        group,
        value: current[group]?.[metric.id] || 0,
        before: past[group]?.[metric.id] || 0,
        sets: current[group]?.sets || 0,
        reps: current[group]?.reps || 0,
      }))
      .filter((r) => r.value > 0 || r.sets > 0)
      .sort((a, b) => b.value - a.value)

    return {
      rows: list,
      max: list.reduce((m, r) => Math.max(m, r.value), 0),
      from: start,
      previousFrom: before,
    }
  }, [sessions, exerciseById, today, range, metric])

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <SegmentedTabs
          items={RANGES}
          active={rangeId}
          onChange={setRangeId}
          desktopHidden={false}
          className="flex-1"
        />
        <SegmentedTabs
          items={METRICS}
          active={metricId}
          onChange={setMetricId}
          desktopHidden={false}
          className="flex-1"
        />
      </div>

      <p className="text-[11px] text-faint mb-4">
        Depuis le {formatDateFr(fromLocalDateKey(from))} — comparé aux {range.days} jours
        précédents (à partir du {formatDateFr(fromLocalDateKey(previousFrom))}).
      </p>

      {rows.length === 0 ? (
        <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
          <PersonStanding size={28} className="mx-auto text-faint" />
          <p className="text-base font-medium text-fg mt-3">Rien sur cette période</p>
          <p className="text-sm text-muted mt-1">
            Enregistre des séries — la répartition apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {rows.map((row) => {
            const trend = compare(row.value, row.before)
            return (
              <div key={row.group} className="px-4 py-3 border-b border-border last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-fg truncate">{row.group}</span>
                  <span className="shrink-0 text-[13px] text-fg tabular">
                    {formatValue(row.value, metric.id)}
                    {trend && (
                      <span className={cn(
                        'ml-2 text-[11px]',
                        trend.direction === 'up' ? 'text-accent'
                          : trend.direction === 'down' ? 'text-muted' : 'text-faint',
                      )}>
                        {formatTrend(trend)}
                      </span>
                    )}
                  </span>
                </div>
                {/* La barre porte la PART de chaque groupe dans la période, pas
                    un pourcentage d'objectif : c'est la comparaison entre
                    groupes qui apprend quelque chose, pas une note absolue. */}
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500 ease-ios"
                    style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-faint tabular mt-1.5">
                  {row.sets} série{row.sets > 1 ? 's' : ''} · {row.reps} reps
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatValue(value, metricId) {
  if (metricId === 'sets') return String(Math.round(value))
  return `${Math.round(value).toLocaleString('fr-FR')} kg`
}
