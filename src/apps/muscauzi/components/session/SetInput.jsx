import { Check, Minus, Trophy } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

/**
 * Une série, sur UNE ligne : numéro · charge × reps · pastille.
 *
 * ── Une ligne, comme les applis qu'on utilise vraiment ──────────────────────
 *
 * La série tenait sur deux étages — une étiquette au-dessus, les champs
 * dessous — soit une centaine de pixels chacune : à partir de quatre séries, il
 * fallait faire défiler pour voir la fin de l'exercice et la barre d'XP en même
 * temps. Une ligne, c'est toute la prescription sous les yeux, téléphone à bout
 * de bras. La pastille est à DROITE, sous le pouce.
 *
 * ── Le numéro est un bouton ─────────────────────────────────────────────────
 *
 * Le toucher bascule la série en échauffement (« É ») et retour. Un
 * échauffement n'entre dans aucun calcul — ni barre d'XP, ni record, ni
 * « dernière fois » — et ne compte pas dans les séries faites. Les séries de
 * travail restent numérotées 1..N, quel que soit le nombre d'échauffements.
 *
 * ── Ce qui reste retiré ─────────────────────────────────────────────────────
 *
 * Le glissement : un frôlement en scrollant enregistrait une série qu'on
 * n'avait pas faite. La pastille fait l'aller comme le retour.
 *
 * ── Les champs restent vides ────────────────────────────────────────────────
 *
 * Rien n'est pré-rempli. Le placeholder, en gris, dit ce que la pastille
 * enregistrera si on la touche sans rien taper : la dernière fois, ou la
 * charge conseillée quand la barre d'XP dit de monter ou de redescendre. On
 * voit l'écart du jour sans se demander si le chiffre affiché est celui qu'on
 * vient de faire.
 */
export default function SetInput({
  label,
  number,
  warmup = false,
  weightKg,
  reps,
  weightPlaceholder,
  repsPlaceholder,
  isRecord = false,
  bodyweight,
  onChange,
  onCommit,
  onToggle,
  onToggleWarmup,
  onRemove,
}) {
  const done = toNumber(reps) > 0

  return (
    <div
      className={cn(
        'relative flex items-center gap-1.5 p-1.5 rounded-xl border transition-colors duration-300 ease-ios',
        // Un échauffement fait reste discret : il ne doit pas se lire comme
        // une série de travail validée.
        warmup
          ? 'border-dashed border-border bg-transparent'
          : isRecord
            ? 'border-accent bg-accent/[0.12]'
            : done ? 'border-accent/35 bg-accent/[0.07]' : 'border-border bg-surface-2/40',
      )}
    >
      <button
        type="button"
        onClick={onToggleWarmup}
        aria-pressed={warmup}
        aria-label={warmup ? `${label} — repasser en série de travail` : `${label} — marquer en échauffement`}
        title={warmup ? 'Échauffement — toucher pour repasser en série de travail' : 'Toucher pour marquer en échauffement'}
        className={cn(
          'h-12 w-9 shrink-0 rounded-lg text-sm font-semibold tabular flex items-center justify-center',
          'transition active:scale-90',
          warmup ? 'text-warning bg-warning/10' : done ? 'text-accent' : 'text-muted hover:text-fg',
        )}
      >
        {warmup ? 'É' : number}
      </button>

      <NumField
        value={weightKg}
        onChange={(v) => onChange('weightKg', v)}
        onCommit={onCommit}
        placeholder={weightPlaceholder}
        suffix={bodyweight ? 'lest' : 'kg'}
        compact={warmup}
        ariaLabel={`${bodyweight ? 'Lest' : 'Charge'} — ${label}`}
      />
      <span className="text-faint text-sm shrink-0">×</span>
      <NumField
        value={reps}
        onChange={(v) => onChange('reps', v)}
        onCommit={onCommit}
        placeholder={repsPlaceholder}
        suffix="reps"
        integer
        compact={warmup}
        ariaLabel={`Répétitions — ${label}`}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Annuler ${label}` : `Valider ${label}`}
        className={cn(
          'h-12 w-12 shrink-0 rounded-xl border-2 flex items-center justify-center',
          'transition-all duration-200 ease-ios active:scale-90',
          done && warmup && 'bg-warning/15 border-warning/40 text-warning',
          done && !warmup && 'bg-accent border-accent text-accent-fg',
          !done && 'border-border-strong text-faint hover:border-accent hover:text-accent',
        )}
      >
        <Check size={18} strokeWidth={3} />
      </button>

      {/* Seuls les échauffements et les séries ajoutées à la main se
          suppriment : une série prescrite peut rester vide, mais elle reste. */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Supprimer ${label}`}
          className="h-12 w-7 shrink-0 -ml-0.5 rounded-lg text-faint hover:text-danger transition flex items-center justify-center"
        >
          <Minus size={16} />
        </button>
      )}

      {/* Le record se signale sur la LIGNE qui l'a battu : c'est elle qu'on
          regarde en reposant la barre. */}
      {isRecord && (
        <span
          className="absolute -top-2 left-11 inline-flex items-center gap-1 px-1.5 py-px rounded-full
                     bg-accent text-accent-fg text-[10px] font-semibold"
          title="Meilleure série de tous les temps sur ce mouvement"
        >
          <Trophy size={10} strokeWidth={2.8} /> Record
        </span>
      )}
    </div>
  )
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Champ numérique.
 *
 * `type="text"` + `inputMode` : un `type="number"` refuse silencieusement les
 * saisies intermédiaires et remonte une chaîne vide au moindre caractère qu'il
 * n'aime pas. On filtre nous-mêmes — le champ n'accepte que des chiffres, et
 * une virgule pour les demi-plaques.
 */
function NumField({
  value, onChange, onCommit, placeholder, suffix, integer = false, compact = false, ariaLabel,
}) {
  const sanitize = (raw) => {
    const cleaned = raw.replace(integer ? /[^\d]/g : /[^\d.,]/g, '')
    if (integer) return cleaned.slice(0, 3)
    // Une virgule au plus, et jamais plus de deux décimales : 62,5 · 1,25.
    const [head, ...rest] = cleaned.replace(/\./g, ',').split(',')
    return rest.length > 0 ? `${head.slice(0, 4)},${rest.join('').slice(0, 2)}` : head.slice(0, 4)
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
          'w-full h-12 pl-2.5 pr-9 rounded-lg border border-border bg-surface tabular transition',
          compact ? 'text-base' : 'text-lg',
          'font-semibold text-fg',
          'placeholder:text-faint placeholder:font-normal',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent',
        )}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">
        {suffix}
      </span>
    </label>
  )
}
