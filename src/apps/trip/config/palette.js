// Une couleur douce par hébergement, dans la bande des nuits et sur la carte.
// L'ordre suit les arrivées (cf. `stayOrder`) : ajouter un hôtel en fin de
// voyage ne repeint pas les autres. Classes écrites en toutes lettres :
// Tailwind ne génère pas une classe construite dynamiquement.
export const STAY_COLORS = [
  { bar: 'bg-sky-100 text-sky-900 border-sky-200',             strip: 'bg-sky-300',     dot: 'bg-sky-400' },
  { bar: 'bg-emerald-100 text-emerald-900 border-emerald-200', strip: 'bg-emerald-300', dot: 'bg-emerald-400' },
  { bar: 'bg-amber-100 text-amber-900 border-amber-200',       strip: 'bg-amber-300',   dot: 'bg-amber-400' },
  { bar: 'bg-violet-100 text-violet-900 border-violet-200',    strip: 'bg-violet-300',  dot: 'bg-violet-400' },
  { bar: 'bg-rose-100 text-rose-900 border-rose-200',          strip: 'bg-rose-300',    dot: 'bg-rose-400' },
  { bar: 'bg-teal-100 text-teal-900 border-teal-200',          strip: 'bg-teal-300',    dot: 'bg-teal-400' },
]

export function stayColor(index) {
  return STAY_COLORS[(index ?? 0) % STAY_COLORS.length]
}
