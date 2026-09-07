// node --test src/apps/cookit/utils/
//
// Deux invariants tiennent tout l'écran d'objectifs : les macros se rebouclent
// sur les calories affichées juste au-dessus d'elles, et la cible protéique
// reste dans une fourchette qu'on peut réellement manger.
//
// Le second n'était pas tenu : les protéines valaient 30 % des calories, donc
// elles suivaient la DÉPENSE et non le POIDS. Une personne de 60 kg en activité
// intense se voyait proposer 202 g, soit 3,4 g/kg. C'est ce cas qui est
// verrouillé ici.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeGoals, ACTIVITY_LEVELS, AIMS } from './mifflin.js'

const BIRTH_YEAR = new Date().getFullYear() - 28

// Tout le domaine plausible : des plus légers aux plus lourds, les deux sexes,
// les quatre niveaux d'activité et les trois objectifs.
function everyProfile(weights = [45, 60, 75, 95, 130]) {
  const out = []
  for (const weightKg of weights) {
    for (const [sex, heightCm] of [['h', 178], ['f', 163]]) {
      for (const { value: activity } of ACTIVITY_LEVELS) {
        for (const { id: aim } of AIMS) {
          out.push({ weightKg, heightCm, birthYear: BIRTH_YEAR, sex, activity, aim })
        }
      }
    }
  }
  return out
}

const label = (p) => `${p.weightKg} kg ${p.sex} · activité ${p.activity} · ${p.aim}`

test('les macros se rebouclent sur les calories', () => {
  for (const p of everyProfile()) {
    const g = computeGoals(p)
    const sum = g.proteins * 4 + g.carbs * 4 + g.fat * 9
    // Seul l'arrondi des glucides peut faire dériver, d'au plus 2 kcal.
    assert.ok(Math.abs(sum - g.kcal) <= 2, `${label(p)} → ${sum} kcal pour ${g.kcal} annoncées`)
  }
})

test('la cible protéique reste mangeable, quel que soit le profil', () => {
  for (const p of everyProfile()) {
    const perKg = computeGoals(p).proteins / p.weightKg
    // Borne haute : celle de la méta-analyse Morton. Borne basse : ce que
    // laisse le garde-fou à 40 % des calories sur LES PROFILS BALAYÉS ICI — il
    // mord dès qu'un métabolisme est bas rapporté à la masse, pas seulement sur
    // un gros poids en déficit, et descend plus bas hors de cette grille.
    assert.ok(perKg >= 1.3 && perKg <= 2.2, `${label(p)} → ${perKg.toFixed(2)} g/kg`)
  }
})

test('sur un gabarit courant, la cible suit le poids et non la dépense', () => {
  for (const p of everyProfile([50, 60, 70])) {
    const g = computeGoals(p)
    const attendu = p.weightKg * (p.aim === 'perte' ? 2 : 1.8)
    assert.equal(g.proteins, Math.round(attendu), label(p))
    assert.equal(g.proteinPerKg, p.aim === 'perte' ? 2 : 1.8, label(p))
  }
})

test('le garde-fou ne rogne que le gros poids en franc déficit', () => {
  const gabarit = { weightKg: 110, heightCm: 163, birthYear: BIRTH_YEAR, sex: 'f' }

  // Métabolisme bas rapporté à la masse : 2 g/kg ne tiendraient pas dans les
  // calories restantes. On rogne, mais les glucides restent positifs.
  const rogne = computeGoals({ ...gabarit, activity: 1.2, aim: 'perte' })
  assert.ok(rogne.proteins < 220, `${rogne.proteins} g pour 220 visés`)
  assert.ok(rogne.carbs > 0, `glucides ${rogne.carbs} g`)

  // Même personne, entraînée : la dépense laisse la marge, la cible au poids
  // passe entière. Le garde-fou n'est pas un plafond déguisé.
  const libre = computeGoals({ ...gabarit, activity: 1.725, aim: 'perte' })
  assert.equal(libre.proteins, 220)
})

test('60 kg entraîné : 108 g et non plus 202', () => {
  const g = computeGoals({
    weightKg: 60, heightCm: 175, birthYear: BIRTH_YEAR, sex: 'h', activity: 1.725, aim: 'maintien',
  })
  assert.equal(g.proteins, 108)
  // L'énergie supplémentaire de l'entraînement part dans les glucides.
  assert.ok(g.carbs > 300, `glucides ${g.carbs} g`)
})

test('les lipides ne descendent jamais sous 0,8 g/kg', () => {
  for (const p of everyProfile()) {
    const g = computeGoals(p)
    assert.ok(g.fat >= Math.round(p.weightKg * 0.8), `${label(p)} → ${g.fat} g`)
  }
})

test('un objectif inconnu retombe sur maintien, jamais sur NaN', () => {
  // `aim` traversait un lookup par crochets : n'importe quelle clé de
  // Object.prototype rendait un nombre invalide au lieu de la valeur par défaut.
  const base = { weightKg: 70, heightCm: 175, birthYear: BIRTH_YEAR, sex: 'h', activity: 1.55 }
  const attendu = computeGoals({ ...base, aim: 'maintien' })
  for (const aim of ['constructor', 'toString', 'inconnu', undefined]) {
    assert.deepEqual(computeGoals({ ...base, aim }), attendu, `aim: ${aim}`)
  }
})

test('données incomplètes : aucune estimation plutôt qu’une fausse', () => {
  assert.equal(computeGoals({ heightCm: 175, birthYear: 1996 }), null)
  assert.equal(computeGoals({ weightKg: 60, birthYear: 1996 }), null)
  assert.equal(computeGoals({ weightKg: 60, heightCm: 175 }), null)
})
