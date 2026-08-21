import { Minus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

/**
 * Une ligne de série : charge, répétitions.
 *
 * Les champs restent VIDES tant qu'on n'a rien tapé — la dernière fois s'y lit
 * en placeholder. Rien n'est pré-rempli pour de vrai : on voit l'écart du jour
 * sans se demander si le chiffre affiché est celui qu'on vient de faire, et
 * une série qu'on n'a pas faite ne peut pas se retrouver enregistrée toute
 * seule.
 *
 * Il n'y a pas de bouton « valider » : une série compte dès qu'elle porte des
 * répétitions. Le point devant le libellé le confirme.
 */
export default function SetRow({ row, label, previous, onChange, onCommit, onRemove }) {
  const done = Number(String(row.reps).replace(',', '.')) > 0

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span
            aria-hidden="true"
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors',
              done ? 'bg-accent' : 'bg-border-strong',
            )}
          />
          <span className={cn('text-[11px] font-medium', done ? 'text-muted' : 'text-faint')}>
            {label}
          </span>
        </span>
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
          placeholder={previous ? String(previous.weightKg) : '0'}
          suffix="kg"
          ariaLabel={`Charge — ${label}`}
        />
        <span className="text-faint text-sm shrink-0">×</span>
        <NumField
          value={row.reps}
          onChange={(v) => onChange('reps', v)}
          onCommit={onCommit}
          placeholder={previous ? String(previous.reps) : '—'}
          suffix="reps"
          integer
          ariaLabel={`Répétitions — ${label}`}
        />
        {/* Seules les séries ajoutées à la main se suppriment : une série
            prescrite peut rester vide, mais elle reste. La gouttière est
            réservée sur toutes les lignes pour que les champs restent alignés. */}
        {onRemove ? (
          <button
            onClick={onRemove}
            aria-label={`Supprimer ${label}`}
            className="h-14 w-9 shrink-0 rounded-lg text-faint hover:text-danger transition flex items-center justify-center"
          >
            <Minus size={16} />
          </button>
        ) : (
          <span className="h-14 w-9 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}

/**
 * Champ numérique.
 *
 * `type="text"` + `inputMode` : un `type="number"` refuse silencieusement les
 * saisies intermédiaires et remonte une chaîne vide au moindre caractère qu'il
 * n'aime pas. On filtre nous-mêmes, le champ n'accepte que des chiffres (et une
 * virgule pour les demi-plaques).
 */
function NumField({ value, onChange, onCommit, placeholder, suffix, integer = false, ariaLabel }) {
  const sanitize = (raw) => {
    const cleaned = raw.replace(integer ? /[^\d]/g : /[^\d.,]/g, '')
    if (integer) return cleaned.slice(0, 3)
    // Une seule virgule, et jamais plus d'une décimale : 62,5 — pas 62,5,5.
    const [head, ...rest] = cleaned.replace(/\./g, ',').split(',')
    return rest.length > 0 ? `${head.slice(0, 4)},${rest.join('').slice(0, 1)}` : head.slice(0, 4)
  }

  return (
    <label className="flex-1 min-w-0 relative">
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        enterKeyHint="done"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(sanitize(e.target.value))}
        onBlur={onCommit}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-full h-14 pl-3 pr-11 rounded-xl bg-surface-2 border border-border text-lg font-semibold text-fg tabular
                   placeholder:text-faint placeholder:font-normal
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint pointer-events-none">{suffix}</span>
    </label>
  )
}
