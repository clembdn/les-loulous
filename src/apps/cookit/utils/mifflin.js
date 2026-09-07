// Estimation des besoins caloriques — équation de Mifflin-St Jeor (1990),
// la plus fiable des formules simples sur population générale.
//
// C'est une ESTIMATION, à ±10 % près : elle sert de point de départ, pas de
// vérité. L'écran la présente comme telle et laisse toujours corriger à la main.

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sédentaire', hint: 'travail assis, peu de marche' },
  { value: 1.375, label: 'Léger', hint: '1 à 3 séances / semaine' },
  { value: 1.55, label: 'Modéré', hint: '3 à 5 séances / semaine' },
  { value: 1.725, label: 'Intense', hint: '6 séances / semaine ou plus' },
]

// `delta` corrige les calories, `proteinPerKg` la cible protéique. Les deux
// vivent ici ensemble : deux tables parallèles indexées par `id` finissaient
// toujours par diverger, et un `id` absent de la seconde résolvait à travers
// Object.prototype (`aim: 'constructor'` rendait des macros NaN).
export const AIMS = [
  { id: 'perte', label: 'Perte', delta: -0.15, proteinPerKg: 2 },
  { id: 'maintien', label: 'Maintien', delta: 0, proteinPerKg: 1.8 },
  { id: 'prise', label: 'Prise', delta: 0.1, proteinPerKg: 1.8 },
]

// Objectif inconnu : on retombe sur « maintien » plutôt que de rendre du NaN.
const DEFAULT_AIM = AIMS.find((a) => a.id === 'maintien')

const KCAL_PER_G = { proteins: 4, carbs: 4, fat: 9 }

// Répartition des macros.
//
// Les protéines se calent sur le POIDS DE CORPS, jamais sur un pourcentage des
// calories : c'est la masse à nourrir qui commande, pas l'énergie dépensée.
// La version précédente en prenait 30 % des calories, si bien qu'une personne
// légère qui s'entraîne beaucoup héritait de la cible la plus haute — 60 kg en
// activité intense donnaient 202 g, soit 3,4 g/kg. Personne ne mange ça, et
// rien ne le justifie : à poids égal, s'entraîner davantage demande surtout
// plus de GLUCIDES.
//
// Repères : la méta-analyse Morton (2018) place le plateau du gain musculaire
// vers 1,6 g/kg, la borne haute de son intervalle de confiance à 2,2. On monte
// en déficit, où les protéines protègent la masse maigre. Les valeurs sont
// portées par `AIMS.proteinPerKg`, plus haut.

// Lipides : 30 % des calories — milieu de la fourchette usuelle de 20 à 35 % —
// avec un plancher au poids de corps, sous lequel l'équilibre hormonal se
// dégrade.
//
// Le plancher mord souvent, et pas seulement en déficit : environ un profil sur
// trois, dont trois profils « perte » sur cinq, mais aussi un « maintien » sur
// trois et un « prise » sur cinq. Quand il mord, c'est LUI qui fixe les lipides,
// pas le pourcentage — et donc ce qui reste aux glucides. Comme il se calcule
// sur le poids TOTAL, il surestime le besoin des gabarits lourds, exactement
// comme le faisait la cible protéique avant le garde-fou ci-dessous.
const FAT_KCAL_RATIO = 0.3
const FAT_G_PER_KG_FLOOR = 0.8

// Garde-fou : au-delà de 40 % des calories, la cible protéique ne laisse plus
// de place aux glucides. Le seuil est haut à dessein — 35 % rognait déjà une
// coupe tout à fait ordinaire (60 kg, sédentaire, en perte), or un régime à
// forte teneur en protéines pendant un déficit est légitime. Il mord surtout en
// déficit — un profil « perte » sur trois — mais pas uniquement : un métabolisme
// bas rapporté à la masse suffit (86 kg, 150 cm, 70 ans, en maintien). C'est le
// signe que le calcul « par kilo de poids TOTAL » surestime le besoin réel : la
// graisse n'a pas à être nourrie en protéines.
const PROTEIN_MAX_KCAL_RATIO = 0.4

// weightKg + profil → { kcal, proteins, carbs, fat, proteinPerKg,
// fatKcalPercent } ; null si données incomplètes.
export function computeGoals({ weightKg, heightCm, birthYear, sex, activity, aim }) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  const year = Number(birthYear)
  if (!(w > 0) || !(h > 0) || !(year > 1900)) return null

  const age = new Date().getFullYear() - year
  // Métabolisme de base.
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'f' ? -161 : 5)
  const factor = Number(activity) || 1.375
  const goal = AIMS.find((a) => a.id === aim) ?? DEFAULT_AIM
  const kcal = Math.round(bmr * factor * (1 + goal.delta))

  const proteins = Math.round(Math.min(
    w * goal.proteinPerKg,
    (kcal * PROTEIN_MAX_KCAL_RATIO) / KCAL_PER_G.proteins,
  ))
  const fat = Math.round(Math.max(
    (kcal * FAT_KCAL_RATIO) / KCAL_PER_G.fat,
    w * FAT_G_PER_KG_FLOOR,
  ))
  // Les glucides prennent le RESTE. C'est le macro d'ajustement — celui qui
  // absorbe la dépense — et c'est ce qui garantit que les trois lignes se
  // rebouclent sur les calories affichées juste au-dessus.
  const carbs = Math.max(0, Math.round(
    (kcal - proteins * KCAL_PER_G.proteins - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs,
  ))

  // `proteinPerKg` et `fatKcalPercent` sont affichés tels quels : ce sont les
  // chiffres qui permettent de juger les cibles d'un coup d'œil, là où « 200 g »
  // ne dit rien sans le poids. Ils sont DÉRIVÉS du résultat, jamais recopiés
  // depuis les constantes ci-dessus : le plancher lipides et le garde-fou
  // protéines écartent l'un comme l'autre du réglage nominal.
  return {
    kcal,
    proteins,
    carbs,
    fat,
    proteinPerKg: Math.round((proteins / w) * 10) / 10,
    fatKcalPercent: Math.round((fat * KCAL_PER_G.fat * 100) / kcal),
  }
}
