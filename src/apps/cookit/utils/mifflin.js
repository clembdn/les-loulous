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

export const AIMS = [
  { id: 'perte', label: 'Perte', delta: -0.15 },
  { id: 'maintien', label: 'Maintien', delta: 0 },
  { id: 'prise', label: 'Prise', delta: 0.1 },
]

// Répartition des macros retenue : 30 % protéines / 40 % glucides / 30 % lipides.
// Protéines hautes car ils s'entraînent (MuscAuzi), et rassasiantes.
const SPLIT = { proteins: 0.3, carbs: 0.4, fat: 0.3 }
const KCAL_PER_G = { proteins: 4, carbs: 4, fat: 9 }

// weightKg + profil → { kcal, proteins, carbs, fat } ; null si données incomplètes.
export function computeGoals({ weightKg, heightCm, birthYear, sex, activity, aim }) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  const year = Number(birthYear)
  if (!(w > 0) || !(h > 0) || !(year > 1900)) return null

  const age = new Date().getFullYear() - year
  // Métabolisme de base.
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'f' ? -161 : 5)
  const factor = Number(activity) || 1.375
  const delta = AIMS.find((a) => a.id === aim)?.delta ?? 0
  const kcal = Math.round(bmr * factor * (1 + delta))

  return {
    kcal,
    proteins: Math.round((kcal * SPLIT.proteins) / KCAL_PER_G.proteins),
    carbs: Math.round((kcal * SPLIT.carbs) / KCAL_PER_G.carbs),
    fat: Math.round((kcal * SPLIT.fat) / KCAL_PER_G.fat),
  }
}
