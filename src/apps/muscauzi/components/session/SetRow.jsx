import { Minus, Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import SwipeRow from '@/shared/ui/SwipeRow.jsx'
import { isBodyweight } from '../../config/exercises.js'
import { formatWeight } from '../../utils/metrics.js'

/**
 * Une ligne de série : charge, répétitions.
 *
 * Les champs restent VIDES tant qu'on n'a rien tapé — la dernière fois s'y lit
 * en placeholder. Rien n'est pré-rempli pour de vrai : on voit l'écart du jour
 * sans se demander si le chiffre affiché est celui qu'on vient de faire, et
 * une série qu'on n'a pas faite ne peut pas se retrouver enregistrée toute
 * seule.
 *
 * ── Glisser = « c'est fait » ────────────────────────────────────────────────
 *
 * DANS LES DEUX SENS, et TOUJOURS. Le geste a d'abord été conditionné à « il y
 * a une dernière fois à reprendre », ce qui le désactivait précisément dans les
 * deux cas les plus courants : la première fois qu'on fait un exercice, et
 * juste après avoir tapé ses répétitions. On glissait, il ne se passait rien,
 * et rien à l'écran n'expliquait pourquoi. Un geste qui marche une fois sur
 * trois ne s'apprend jamais.
 *
 * Ce qui est écrit se décide dans cet ordre : ce qui est tapé, sinon la
 * dernière fois, sinon la prescription du jour. Il y a donc toujours quelque
 * chose à valider.
 *
 * Le glissement double la pastille de gauche, qui reste atteignable à la souris
 * et au clavier : un raccourci ne doit jamais être le seul chemin.
 */
export default function SetRow({
  row, label, previous, exercise, prescribedReps,
  onChange, onCommit, onValidate, onReset, onRemove,
}) {
  const done = toNumber(row.reps) > 0
  const bodyweight = isBodyweight(exercise)

  const validate = () => {
    const reps = toNumber(row.reps) || previous?.reps || prescribedReps || 0
    if (reps <= 0) return
    const weightKg = toNumber(row.weightKg) || previous?.weightKg || 0
    onValidate({ weightKg, reps })
  }

  // Les deux côtés font la même chose : on ne demande pas de se souvenir d'un
  // sens. Seule la pastille distingue valider d'annuler.
  const action = { icon: Check, label: 'Validée', tone: 'accent', onAction: validate }

  return (
    <SwipeRow className="rounded-xl" rowClassName="bg-surface" left={action} right={action}>
      <div className={cn('py-0.5 transition-colors', done && 'bg-accent/[0.04]')}>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="inline-flex items-center gap-2 shrink-0">
            {/* La pastille EST le contrôle : cocher et « c'est fait » ne
                doivent pas être deux objets différents. */}
            <button
              type="button"
              onClick={done ? onReset : validate}
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
            <span className={cn('text-[11px] font-medium', done ? 'text-muted' : 'text-faint')}>
              {label}
            </span>
          </span>
          {previous && (
            <span className="text-[11px] text-faint tabular truncate">
              Dernière fois : {formatPrevious(previous, bodyweight)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <NumField
            value={row.weightKg}
            onChange={(v) => onChange('weightKg', v)}
            onCommit={onCommit}
            placeholder={previous ? formatWeight(previous.weightKg) : '0'}
            suffix={bodyweight ? 'lest' : 'kg'}
            ariaLabel={`${bodyweight ? 'Lest' : 'Charge'} — ${label}`}
          />
          <span className="text-faint text-sm shrink-0">×</span>
          <NumField
            value={row.reps}
            onChange={(v) => onChange('reps', v)}
            onCommit={onCommit}
            placeholder={previous ? String(previous.reps) : String(prescribedReps || '—')}
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
    </SwipeRow>
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
