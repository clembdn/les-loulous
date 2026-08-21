import { useState, useEffect, useMemo } from 'react'
import { Check, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import LineChart from '@/shared/ui/LineChart.jsx'
import { toLocalDateKey, fromLocalDateKey, formatDayFr, formatDateShortFr, formatDateFr } from '@/shared/lib/dates.js'
import { useWeights } from '../hooks/useMuscData.js'
import { recordWeight } from '../services/weightsService.js'
import WeightWheel from '../components/weight/WeightWheel.jsx'
import ConsistencyCalendar from '../components/tracking/ConsistencyCalendar.jsx'

const FALLBACK_KG = 70

export default function TrackingView() {
  const { currentUid } = useAuth()
  const { weights, isLoading } = useWeights()
  const todayId = toLocalDateKey(new Date())

  const last = weights.length > 0 ? weights[weights.length - 1] : null
  const [value, setValue] = useState(FALLBACK_KG)
  const [touched, setTouched] = useState(false)

  // La molette démarre sur la dernière pesée enregistrée — tant qu'on n'y a
  // pas touché, elle suit ce que Firestore renvoie.
  useEffect(() => {
    if (!touched && last) setValue(last.value)
  }, [last, touched])

  const series = useMemo(
    () => weights.map((w) => ({ date: w.date, value: w.value })),
    [weights],
  )

  const alreadyToday = weights.some((w) => w.date === todayId)

  const save = () => {
    recordWeight(currentUid, value, currentUid)
    setTouched(false)
    toast.success(`${value.toFixed(1)} kg enregistré`)
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Suivi</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Poids et régularité</h1>
      </header>

      <div className="rounded-2xl border border-border bg-surface p-4 mb-6">
        {isLoading && series.length === 0 ? (
          <div className="h-[220px] animate-pulse rounded-xl bg-surface-2" />
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

      <div className="mb-6">
        <ConsistencyCalendar />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-sm font-semibold text-fg inline-flex items-center gap-2">
            <Scale size={16} className="text-accent" /> Nouvelle pesée
          </h2>
          {/* La date n'est pas modifiable : on enregistre la pesée du jour. */}
          <span className="text-xs text-muted first-letter:uppercase">{formatDayFr(new Date())}</span>
        </div>
        {alreadyToday && (
          <p className="text-[11px] text-faint mb-2">
            Déjà pesé aujourd'hui — enregistrer à nouveau remplace la valeur.
          </p>
        )}

        <div className="flex items-center gap-4 mt-3">
          <div className="shrink-0 w-32 text-right">
            <span className="text-4xl font-semibold text-fg tabular tracking-[-0.03em]">
              {value.toFixed(1)}
            </span>
            <span className="text-sm text-muted ml-1">kg</span>
            {last && (
              <p className="text-[11px] text-faint mt-1 tabular">
                {formatDelta(value, last)}
              </p>
            )}
          </div>
          <div className="flex-1 min-w-0 max-w-[200px]">
            <WeightWheel value={value} onChange={(v) => { setTouched(true); setValue(v) }} />
          </div>
        </div>

        <button
          onClick={save}
          className="w-full mt-4 h-12 rounded-xl bg-accent text-accent-fg text-sm font-semibold active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
        >
          <Check size={16} strokeWidth={2.6} /> Enregistrer
        </button>
      </section>
    </div>
  )
}

function formatDelta(value, last) {
  const delta = Math.round((value - last.value) * 10) / 10
  const sign = delta > 0 ? '+' : ''
  const when = formatDateFr(fromLocalDateKey(last.date))
  if (delta === 0) return `identique au ${when}`
  return `${sign}${delta.toFixed(1)} kg vs ${when}`
}
