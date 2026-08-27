import { cn } from '@/shared/lib/utils.js'
import { formatGrams } from '../utils/nutrition.js'

// Objectifs du jour : un anneau pour les calories, trois barres pour les macros.
//
// L'anneau est un simple cercle SVG avec strokeDasharray — pas de librairie de
// graphes pour un unique arc de cercle. Le dépassement n'est PAS traité comme
// une faute : on continue de remplir et on affiche l'écart, sans rouge alarmiste.

const MACROS = [
  { key: 'proteins', label: 'Protéines', barClass: 'bg-sky-500' },
  { key: 'carbs', label: 'Glucides', barClass: 'bg-amber-500' },
  { key: 'fat', label: 'Lipides', barClass: 'bg-rose-500' },
]

const R = 34
const C = 2 * Math.PI * R

export default function GoalRings({ totals, goals }) {
  const target = goals?.kcal || null
  const ratio = target ? Math.min(totals.kcal / target, 1) : 0
  const left = target ? Math.round(target - totals.kcal) : null

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
            <circle cx="42" cy="42" r={R} fill="none" strokeWidth="7" className="stroke-surface-2" />
            {target > 0 && (
              <circle
                cx="42" cy="42" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
                className="stroke-accent transition-[stroke-dasharray] duration-500"
                strokeDasharray={`${ratio * C} ${C}`}
              />
            )}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-fg tabular leading-none">{Math.round(totals.kcal)}</span>
            <span className="text-[10px] text-faint">kcal</span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {target ? (
            <p className="text-sm text-fg">
              {left >= 0
                ? <>Encore <strong className="tabular">{left}</strong> kcal</>
                : <><strong className="tabular">{Math.abs(left)}</strong> kcal au-dessus</>}
              <span className="text-muted"> sur {target}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">Aucun objectif défini.</p>
          )}

          <div className="mt-2 space-y-1.5">
            {MACROS.map((m) => {
              const v = totals[m.key] || 0
              const g = goals?.[m.key] || null
              const pct = g ? Math.min((v / g) * 100, 100) : 0
              return (
                <div key={m.key}>
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-faint">{m.label}</span>
                    <span className="text-muted tabular">
                      {formatGrams(v)}{g ? <span className="text-faint"> / {g} g</span> : null}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-[width] duration-500', m.barClass)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
