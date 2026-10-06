import { cn } from '@/shared/lib/utils.js'

// Les morceaux communs aux cartes de l'écran Aujourd'hui : la grande carte en
// tête (prochaine étape, compte à rebours, voyage terminé), son sur-titre, et
// les chiffres du voyage.

export const HERO_CARD = 'relative overflow-hidden rounded-3xl border border-accent/30 bg-surface'

/** La lueur de l'accent, comme la carte du voyage en cours dans la liste. */
export function Glow() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.09] via-accent/[0.02] to-transparent" />
}

export function Eyebrow({ children, live = false }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
      {live && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
      {children}
    </p>
  )
}

/** Un chiffre du voyage : « 3 hébergements ». `value` nul = encore en chargement. */
export function Stat({ value, singular, pluralForm = `${singular}s`, className }) {
  return (
    // Le libellé d'abord dans le document (une liste de définitions se lit
    // terme puis valeur), le chiffre d'abord à l'écran.
    <div className={cn('min-w-0 flex flex-col-reverse', className)}>
      <dt className="text-xs text-muted truncate">{value > 1 ? pluralForm : singular}</dt>
      <dd className="text-2xl font-semibold tracking-[-0.02em] text-fg tabular">{value ?? '—'}</dd>
    </div>
  )
}
