import { Check, Minus, Trophy } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatWeight } from '../../utils/metrics.js'

/**
 * Une série : charge × répétitions, et une pastille pour dire « c'est fait ».
 *
 * ── Ce qui a été retiré ─────────────────────────────────────────────────────
 *
 * Le glissement. Il validait la série dans les deux sens, et remplissait les
 * champs vides depuis la dernière fois ou depuis la prescription : un
 * frôlement horizontal en scrollant enregistrait une série qu'on n'avait pas
 * faite, à une charge qu'on n'avait pas soulevée. Il fallait un bandeau
 * d'explication au-dessus de la séance pour qu'on découvre le geste — le signe
 * qu'il n'avait rien d'évident.
 *
 * Reste la pastille : visible, atteignable au doigt comme à la souris comme au
 * clavier, et qui fait l'aller comme le retour.
 *
 * ── Les champs restent vides ────────────────────────────────────────────────
 *
 * Rien n'est pré-rempli. La dernière fois se lit en PLACEHOLDER, en gris : on
 * voit l'écart du jour sans se demander si le chiffre affiché est celui qu'on
 * vient de faire, et une série non faite ne peut pas s'enregistrer toute seule.
 */
export default function SetInput({
  label,
  weightKg,
  reps,
  previous,
  isRecord = false,
  bodyweight,
  prescribedReps,
  onChange,
  onCommit,
  onToggle,
  onRemove,
}) {
  const done = toNumber(reps) > 0

  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-xl border transition-colors duration-300 ease-ios',
        isRecord
          ? 'border-accent bg-accent/[0.12]'
          : done ? 'border-accent/35 bg-accent/[0.07]' : 'border-border bg-surface-2/40',
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={done}
            aria-label={done ? `Annuler ${label}` : `Valider ${label}`}
            className={cn(
              'h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center',
              'transition-all duration-200 ease-ios active:scale-90',
              done
                ? 'bg-accent border-accent text-accent-fg'
                : 'border-border-strong text-transparent hover:border-accent',
            )}
          >
            <Check size={13} strokeWidth={3} />
          </button>
          <span className={cn('text-[11px] font-medium truncate', done ? 'text-accent' : 'text-faint')}>
            {label}
          </span>
          {/* Le record se signale sur la LIGNE qui l'a battu, pas en tête de
              l'exercice : c'est cette série-là qu'on vient de faire, et c'est
              elle qu'on regarde en reposant la barre. */}
          {isRecord && (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                         bg-accent text-accent-fg text-[10px] font-semibold"
              title="Meilleure série de tous les temps sur ce mouvement"
            >
              <Trophy size={10} strokeWidth={2.8} /> Record
            </span>
          )}
        </span>
        {previous && !isRecord && (
          <span className="text-[11px] text-faint tabular truncate shrink-0">
            {formatPrevious(previous, bodyweight)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NumField
          value={weightKg}
          onChange={(v) => onChange('weightKg', v)}
          onCommit={onCommit}
          placeholder={previous ? formatWeight(previous.weightKg) : '0'}
          suffix={bodyweight ? 'lest' : 'kg'}
          done={done}
          ariaLabel={`${bodyweight ? 'Lest' : 'Charge'} — ${label}`}
        />
        <span className="text-faint text-sm shrink-0">×</span>
        <NumField
          value={reps}
          onChange={(v) => onChange('reps', v)}
          onCommit={onCommit}
          placeholder={previous ? String(previous.reps) : String(prescribedReps || '—')}
          suffix="reps"
          integer
          done={done}
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

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Au poids du corps la charge vaut 0 : « 0 kg × 12 » se lit comme une faute de
// saisie. On ne dit alors que les répétitions, et le lest est signé.
function formatPrevious(previous, bodyweight) {
  if (bodyweight && !(previous.weightKg > 0)) return `${previous.reps} reps`
  const weight = bodyweight ? `+${formatWeight(previous.weightKg)}` : formatWeight(previous.weightKg)
  return `${weight} kg × ${previous.reps}`
}

/**
 * Champ numérique.
 *
 * `type="text"` + `inputMode` : un `type="number"` refuse silencieusement les
 * saisies intermédiaires et remonte une chaîne vide au moindre caractère qu'il
 * n'aime pas. On filtre nous-mêmes — le champ n'accepte que des chiffres, et
 * une virgule pour les demi-plaques.
 */
function NumField({ value, onChange, onCommit, placeholder, suffix, integer = false, done = false, ariaLabel }) {
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
        className={cn(
          'w-full h-14 pl-3 pr-11 rounded-xl border text-lg font-semibold text-fg tabular transition',
          'placeholder:text-faint placeholder:font-normal',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent',
          done ? 'bg-surface border-accent/35' : 'bg-surface border-border',
        )}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint pointer-events-none">{suffix}</span>
    </label>
  )
}
