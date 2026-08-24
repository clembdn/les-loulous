import { useState, useEffect, useMemo, useRef } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import LineChart from '@/shared/ui/LineChart.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { toLocalDateKey, fromLocalDateKey, formatDayFr, formatDateShortFr, formatDateFr } from '@/shared/lib/dates.js'
import { useWeights } from '../hooks/useMuscData.js'
import { recordWeight } from '../services/weightsService.js'
import WeightScale from '../components/weight/WeightScale.jsx'
import ConsistencyCalendar from '../components/tracking/ConsistencyCalendar.jsx'

const FALLBACK_KG = 70

export default function TrackingView() {
  const { currentUid } = useAuth()
  const { weights, isLoading } = useWeights()
  const todayId = toLocalDateKey(new Date())

  const last = weights.length > 0 ? weights[weights.length - 1] : null

  /**
   * La molette démarre sur la DERNIÈRE pesée enregistrée.
   *
   * Elle démarrait en réalité toujours à 70 kg. L'ancienne version partait de
   * cette valeur de repli puis adoptait celle de Firestore « tant qu'on n'avait
   * pas touché la règle » — sauf que la règle signalait ses propres
   * repositionnements comme des gestes (cf. `WeightScale`). Le verrou se
   * fermait avant même l'arrivée des données, et 70 kg restait.
   *
   * Plus de verrou : on ATTEND que les pesées soient chargées, on sème une
   * seule fois, et plus rien ne réécrit ce chiffre ensuite. `null` dit
   * « pas encore décidé » — un état que 70 ne pouvait pas exprimer, puisqu'il
   * est aussi un poids parfaitement plausible.
   */
  const [value, setValue] = useState(null)
  const seeded = useRef(false)

  useEffect(() => {
    if (seeded.current || isLoading) return
    seeded.current = true
    setValue(last ? last.value : FALLBACK_KG)
  }, [isLoading, last])

  const series = useMemo(
    () => weights.map((w) => ({ date: w.date, value: w.value })),
    [weights],
  )

  const alreadyToday = weights.some((w) => w.date === todayId)

  const save = () => {
    recordWeight(currentUid, value, currentUid)
    toast.success(`${value.toFixed(1)} kg enregistré`)
  }

  /**
   * L'écart se mesure à la pesée PRÉCÉDENTE, jamais à celle du jour.
   *
   * Une fois pesé aujourd'hui, la plus récente est celle qu'on vient
   * d'enregistrer : l'écart s'annonçait « identique au 24 août » — comparé à
   * soi-même, donc muet précisément quand on veut le lire.
   */
  const reference = useMemo(
    () => [...weights].reverse().find((w) => w.date !== todayId) || null,
    [weights, todayId],
  )

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Suivi</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Poids et régularité</h1>
      </header>

      <div className="rounded-2xl border border-border bg-surface p-4 mb-6">
        {isLoading && series.length === 0 ? (
          <Skeleton className="h-[220px] border-0 bg-surface-2" />
        ) : series.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            Première pesée à enregistrer ci-dessous.
          </p>
        ) : (
          <LineChart
            data={series}
            formatValue={(v) => `${v.toFixed(1)} kg`}
            formatLabel={(d) => formatDateShortFr(fromLocalDateKey(d.date))}
          />
        )}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 mb-6">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-sm font-semibold text-fg inline-flex items-center gap-2">
            Nouvelle pesée
          </h2>
          {/* La date n'est pas modifiable : on enregistre la pesée du jour. */}
          <span className="text-xs text-muted first-letter:uppercase">{formatDayFr(new Date())}</span>
        </div>
        {alreadyToday && (
          <p className="text-[11px] text-faint mb-2">
            Déjà pesé aujourd'hui : enregistrer à nouveau remplace la valeur.
          </p>
        )}

        {/* La valeur au-dessus, la règle pleine largeur en dessous : on lit
            le chiffre et on ajuste sans que l'un gêne l'autre. */}
        {value == null ? (
          // La règle ne se monte pas avant de savoir où se placer : la voir
          // sauter de 70 kg à son vrai point de départ serait pire que d'attendre.
          <Skeleton className="h-[150px] mt-4 border-0 bg-surface-2" />
        ) : (
          <>
            <div className="mt-4 text-center">
              <span className="text-5xl font-semibold text-fg tabular tracking-[-0.035em]">
                {value.toFixed(1)}
              </span>
              <span className="text-base text-muted ml-1.5">kg</span>
              {reference && (
                <p className="text-[11px] text-faint mt-1 tabular">{formatDelta(value, reference)}</p>
              )}
            </div>

            <div className="mt-3 -mx-5">
              <WeightScale value={value} onChange={setValue} />
            </div>

            <Button size="lg" className="w-full mt-4" onClick={save}>
              <Check size={16} strokeWidth={2.6} /> Enregistrer
            </Button>
          </>
        )}
      </section>

      <div className="mb-6">
        <ConsistencyCalendar />
      </div>

    </div>
  )
}

function formatDelta(value, reference) {
  const delta = Math.round((value - reference.value) * 10) / 10
  const sign = delta > 0 ? '+' : ''
  const when = formatDateFr(fromLocalDateKey(reference.date))
  if (delta === 0) return `identique au ${when}`
  return `${sign}${delta.toFixed(1)} kg vs ${when}`
}
