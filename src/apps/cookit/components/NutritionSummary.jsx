import { AlertCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatKcal, formatGrams } from '../utils/nutrition.js'

// Bandeau nutritionnel : calories en gros, macros en barres proportionnelles.
//
// Les barres sont dessinées en flex (pas de librairie de graphes) et
// représentent la répartition ÉNERGÉTIQUE des macros, pas leur masse :
// 1 g de lipide pèse autant qu'1 g de glucide mais apporte plus du double
// de calories, une barre en grammes donnerait une image fausse de l'assiette.

const KCAL_PER_G = { proteins: 4, carbs: 4, fat: 9 }

const MACROS = [
  { key: 'proteins', label: 'Protéines', short: 'P', barClass: 'bg-sky-500' },
  { key: 'carbs', label: 'Glucides', short: 'G', barClass: 'bg-amber-500' },
  { key: 'fat', label: 'Lipides', short: 'L', barClass: 'bg-rose-500' },
]

export default function NutritionSummary({ totals, unresolved = [], resolvedCount = null, label, onFix, className }) {
  // Aucun ingrédient estimable : les totaux valent 0, mais afficher « 0 kcal »
  // serait une affirmation fausse. Un tiret dit ce qu'il en est.
  const nothing = resolvedCount === 0
  const energies = MACROS.map((m) => (Number.isFinite(totals?.[m.key]) ? totals[m.key] * KCAL_PER_G[m.key] : 0))
  const sum = energies.reduce((a, b) => a + b, 0)

  return (
    <div className={cn('rounded-2xl border border-border bg-surface p-4', className)}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <span className="text-2xl font-semibold text-fg tabular">
          {nothing ? '—' : formatKcal(totals?.kcal)}
        </span>
        {label && <span className="text-xs text-muted">{label}</span>}
      </div>

      {sum > 0 && !nothing && (
        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-2 mb-3">
          {MACROS.map((m, i) => (
            energies[i] > 0 && (
              <div key={m.key} className={m.barClass} style={{ width: `${(energies[i] / sum) * 100}%` }} />
            )
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {MACROS.map((m) => (
          <div key={m.key} className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] text-faint">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', m.barClass)} />
              {m.label}
            </span>
            <span className="block text-sm text-fg tabular">
              {nothing ? '—' : formatGrams(totals?.[m.key])}
            </span>
          </div>
        ))}
      </div>

      {unresolved.length > 0 && (
        <button
          onClick={onFix}
          disabled={!onFix}
          className={cn(
            'mt-3 w-full flex items-center gap-2 text-left text-xs text-warning',
            onFix && 'hover:underline',
          )}
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>
            {unresolved.length} ingrédient{unresolved.length > 1 ? 's' : ''} non estimé{unresolved.length > 1 ? 's' : ''}
            {nothing ? ' — rien à calculer pour l’instant' : ' — le total est incomplet'}
          </span>
        </button>
      )}
    </div>
  )
}
