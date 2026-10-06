// Les couleurs des repères, partout pareilles : frise, bande des nuits, cartes.
//
//  · une ÉTAPE a la couleur de sa catégorie (config/categories.js), pastille ronde ;
//  · un HÉBERGEMENT a sa propre couleur, tirée de la palette ci-dessous,
//    pastille carrée — on dort là plusieurs nuits, on le repère d'un coup d'œil ;
//  · un TRAJET RÉSERVÉ est bleu nuit, la couleur du billet ;
//  · ce qui est passé (écran Aujourd'hui) est grisé.
//
// L'ordre suit les arrivées (cf. `stayOrder`) : ajouter un hôtel en fin de
// voyage ne repeint pas les autres. Classes écrites en toutes lettres :
// Tailwind ne génère pas une classe construite dynamiquement.
export const STAY_COLORS = [
  { hex: '#0284C7', bar: 'bg-sky-200 text-sky-950 border-sky-300',             strip: 'bg-sky-500',     dot: 'bg-sky-500',     solid: 'bg-sky-600 text-white' },
  { hex: '#059669', bar: 'bg-emerald-200 text-emerald-950 border-emerald-300', strip: 'bg-emerald-500', dot: 'bg-emerald-500', solid: 'bg-emerald-600 text-white' },
  { hex: '#D97706', bar: 'bg-amber-200 text-amber-950 border-amber-300',       strip: 'bg-amber-500',   dot: 'bg-amber-500',   solid: 'bg-amber-600 text-white' },
  { hex: '#E11D48', bar: 'bg-rose-200 text-rose-950 border-rose-300',          strip: 'bg-rose-500',    dot: 'bg-rose-500',    solid: 'bg-rose-600 text-white' },
  { hex: '#0D9488', bar: 'bg-teal-200 text-teal-950 border-teal-300',          strip: 'bg-teal-500',    dot: 'bg-teal-500',    solid: 'bg-teal-600 text-white' },
  { hex: '#65A30D', bar: 'bg-lime-200 text-lime-950 border-lime-300',          strip: 'bg-lime-500',    dot: 'bg-lime-500',    solid: 'bg-lime-600 text-white' },
]

export function stayColor(index) {
  return STAY_COLORS[(index ?? 0) % STAY_COLORS.length]
}

/** Trajets réservés (train, vol, voiture…) : bleu nuit. */
export const TRANSPORT_COLOR = { hex: '#1E3A5F', solid: 'bg-[#1E3A5F] text-white' }

/** Ce qui est derrière nous. */
export const PAST_COLOR = '#9AA1AC'

/** Le tracé du jour sur les cartes : le lagon clair, plus lumineux que l'accent des boutons. */
export const ROUTE_COLOR = '#0891B2'
