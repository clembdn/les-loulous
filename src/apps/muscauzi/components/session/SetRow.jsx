import { Check, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

// Une ligne de série. Les valeurs peuvent être pré-remplies depuis la dernière
// fois, mais elles ne comptent QUE si la série est explicitement validée :
// une ligne pré-remplie et jamais cochée n'entre dans aucune métrique.
export default function SetRow({ row, label, previous, onChange, onCommit, onToggleComplete, onRemove }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px] font-medium text-faint shrink-0">{label}</span>
        {previous && (
          <span className="text-[11px] text-faint tabular truncate">
            Dernière fois : {previous.weightKg} kg × {previous.reps}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NumField
          value={row.weightKg}
          onChange={(v) => onChange('weightKg', v)}
          onCommit={onCommit}
          suffix="kg"
          ariaLabel={`Charge — ${label}`}
        />
        <span className="text-faint text-sm shrink-0">×</span>
        <NumField
          value={row.reps}
          onChange={(v) => onChange('reps', v)}
          onCommit={onCommit}
          suffix="reps"
          integer
          ariaLabel={`Répétitions — ${label}`}
        />
        <button
          onClick={onToggleComplete}
          aria-pressed={row.completed}
          aria-label={row.completed ? `Annuler ${label}` : `Valider ${label}`}
          className={cn(
            'h-14 w-14 shrink-0 rounded-xl border flex items-center justify-center transition active:scale-95',
            row.completed
              ? 'bg-accent border-accent text-accent-fg'
              : 'bg-surface-2 border-border text-faint hover:text-fg',
          )}
        >
          <Check size={20} strokeWidth={row.completed ? 3 : 2} />
        </button>
        {/* Seules les séries ajoutées à la main se suppriment : une série
            prescrite peut rester vide, mais elle reste. La gouttière est
            réservée sur toutes les lignes pour que les champs restent alignés. */}
        {onRemove ? (
          <button
            onClick={onRemove}
            aria-label={`Supprimer ${label}`}
            className="h-14 w-8 shrink-0 rounded-lg text-faint hover:text-danger transition flex items-center justify-center"
          >
            <Minus size={16} />
          </button>
        ) : (
          <span className="h-14 w-8 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}

function NumField({ value, onChange, onCommit, suffix, integer = false, ariaLabel }) {
  return (
    <label className="flex-1 min-w-0 relative">
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        pattern={integer ? '[0-9]*' : '[0-9.,]*'}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onFocus={(e) => e.target.select()}
        className="w-full h-14 pl-3 pr-11 rounded-xl bg-surface-2 border border-border text-lg font-semibold text-fg tabular
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint pointer-events-none">{suffix}</span>
    </label>
  )
}
