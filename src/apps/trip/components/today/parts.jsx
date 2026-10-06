import { cn } from '@/shared/lib/utils.js'

// Les morceaux communs aux cartes de l'écran Aujourd'hui : la grande carte en
// tête (prochaine étape, compte à rebours, voyage terminé), son sur-titre, et
// les chiffres du voyage.

export const HERO_CARD = 'relative overflow-hidden rounded-3xl bg-surface shadow-[0_1px_2px_rgb(17_20_27/0.06),0_8px_24px_rgb(17_20_27/0.06)]'

/** Les cartes blanches de l'app, posées sur le fond gris perle : pas de bordure. */
export const CARD = 'rounded-2xl bg-surface shadow-sm'

export function Eyebrow({ children, live = false, className }) {
  return (
    <p className={cn('inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent', className)}>
      {live && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
      {children}
    </p>
  )
}

/** Un titre de section sur le fond de page : « La journée », « Ce soir », « Demain ». */
export function SectionTitle({ children, className }) {
  return <h2 className={cn('px-1 mb-2 text-[15px] font-semibold text-fg', className)}>{children}</h2>
}

/** Un chiffre du voyage : « 3 hébergements ». `value` nul = encore en chargement. */
export function Stat({ value, singular, pluralForm = `${singular}s`, className }) {
  return (
    // Le libellé d'abord dans le document (une liste de définitions se lit
    // terme puis valeur), le chiffre d'abord à l'écran.
    <div className={cn('min-w-0 flex flex-col-reverse', className)}>
      <dt className="text-[13px] text-muted truncate">{value > 1 ? pluralForm : singular}</dt>
      <dd className="text-2xl font-semibold tracking-[-0.02em] text-fg tabular">{value ?? '—'}</dd>
    </div>
  )
}
