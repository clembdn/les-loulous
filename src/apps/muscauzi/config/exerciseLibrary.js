/**
 * Bibliothèque d'exercices prête à l'emploi.
 *
 * ── Pourquoi pas une API ────────────────────────────────────────────────────
 *
 * Les deux bases publiques gratuites ont été essayées :
 *
 *  · `free-exercise-db` (≈870 exercices, domaine public) est propre et bien
 *    structurée, mais entièrement EN ANGLAIS — « 3/4 Sit-Up », « Barbell Bench
 *    Press ». Dans une appli en français, on aurait ajouté une traduction à
 *    faire à la main pour chaque exercice retenu.
 *  · `wger` annonce 3 323 traductions françaises, mais son filtre de langue ne
 *    filtre pas : la réponse mélange allemand, espagnol et arabe, avec des
 *    doublons (« Abdominales » deux fois de suite) et des casses incohérentes.
 *
 * Et surtout : on ajoute un exercice DEBOUT DANS LA SALLE, là où le réseau ne
 * passe pas — c'est le pire moment pour dépendre d'un serveur tiers. Une liste
 * embarquée coûte quelques kilo-octets, marche hors ligne, n'a ni clé, ni
 * quota, ni panne, et n'envoie rien à personne.
 *
 * Elle est volontairement COURTE. Une base de 870 mouvements est plus pénible
 * à parcourir qu'utile : on y cherche autant qu'on tape. Ceux-ci couvrent ce
 * qu'on croise réellement dans une salle.
 *
 * Le `type` est celui de `config/exercises.js` : c'est lui qui décide comment
 * la charge se saisit et se compte.
 */
export const EXERCISE_LIBRARY = [
  {
    group: 'Pectoraux',
    items: [
      { name: 'Développé couché', type: 'barbell' },
      { name: 'Développé incliné barre', type: 'barbell' },
      { name: 'Développé décliné barre', type: 'barbell' },
      { name: 'Développé couché haltères', type: 'dumbbell' },
      { name: 'Développé incliné haltères', type: 'dumbbell' },
      { name: 'Écarté couché haltères', type: 'dumbbell' },
      { name: 'Écarté à la poulie', type: 'machine' },
      { name: 'Pec-deck', type: 'machine' },
      { name: 'Développé machine convergente', type: 'machine' },
      { name: 'Pull-over haltère', type: 'dumbbell' },
      { name: 'Pompes', type: 'bodyweight' },
      { name: 'Dips pectoraux', type: 'bodyweight' },
    ],
  },
  {
    group: 'Dos',
    items: [
      { name: 'Tractions pronation', type: 'bodyweight' },
      { name: 'Tractions supination', type: 'bodyweight' },
      { name: 'Tirage vertical poitrine', type: 'machine' },
      { name: 'Tirage vertical nuque', type: 'machine' },
      { name: 'Tirage horizontal poulie', type: 'machine' },
      { name: 'Rowing barre', type: 'barbell' },
      { name: 'Rowing haltère unilatéral', type: 'dumbbell' },
      { name: 'Rowing T-bar', type: 'barbell' },
      { name: 'Rowing machine assis', type: 'machine' },
      { name: 'Soulevé de terre', type: 'barbell' },
      { name: 'Soulevé de terre roumain', type: 'barbell' },
      { name: 'Pull-over poulie', type: 'machine' },
      { name: 'Shrugs barre', type: 'barbell' },
      { name: 'Shrugs haltères', type: 'dumbbell' },
      { name: 'Extension lombaire', type: 'bodyweight' },
    ],
  },
  {
    group: 'Épaules',
    items: [
      { name: 'Développé militaire barre', type: 'barbell' },
      { name: 'Développé militaire haltères', type: 'dumbbell' },
      { name: 'Développé Arnold', type: 'dumbbell' },
      { name: 'Développé épaules machine', type: 'machine' },
      { name: 'Élévations latérales', type: 'dumbbell' },
      { name: 'Élévations latérales poulie', type: 'machine' },
      { name: 'Élévations frontales', type: 'dumbbell' },
      { name: 'Oiseau haltères', type: 'dumbbell' },
      { name: 'Oiseau machine', type: 'machine' },
      { name: 'Rowing menton barre', type: 'barbell' },
      { name: 'Face pull poulie', type: 'machine' },
    ],
  },
  {
    group: 'Biceps',
    items: [
      { name: 'Curl barre', type: 'barbell' },
      { name: 'Curl barre EZ', type: 'barbell' },
      { name: 'Curl haltères', type: 'dumbbell' },
      { name: 'Curl marteau', type: 'dumbbell' },
      { name: 'Curl incliné haltères', type: 'dumbbell' },
      { name: 'Curl pupitre', type: 'barbell' },
      { name: 'Curl poulie basse', type: 'machine' },
      { name: 'Curl concentré', type: 'dumbbell' },
    ],
  },
  {
    group: 'Triceps',
    items: [
      { name: 'Barre au front', type: 'barbell' },
      { name: 'Développé couché prise serrée', type: 'barbell' },
      { name: 'Extension poulie haute', type: 'machine' },
      { name: 'Extension à la corde', type: 'machine' },
      { name: 'Extension haltère nuque', type: 'dumbbell' },
      { name: 'Kickback haltère', type: 'dumbbell' },
      { name: 'Dips triceps', type: 'bodyweight' },
      { name: 'Pompes diamant', type: 'bodyweight' },
    ],
  },
  {
    group: 'Quadriceps',
    items: [
      { name: 'Squat barre', type: 'barbell' },
      { name: 'Squat avant', type: 'barbell' },
      { name: 'Hack squat', type: 'machine' },
      { name: 'Presse à cuisses', type: 'machine' },
      { name: 'Leg extension', type: 'machine' },
      { name: 'Squat gobelet', type: 'dumbbell' },
      { name: 'Fentes haltères', type: 'dumbbell' },
      { name: 'Fentes bulgares', type: 'dumbbell' },
      { name: 'Step-up', type: 'dumbbell' },
      { name: 'Squat au poids du corps', type: 'bodyweight' },
    ],
  },
  {
    group: 'Ischios et fessiers',
    items: [
      { name: 'Leg curl allongé', type: 'machine' },
      { name: 'Leg curl assis', type: 'machine' },
      { name: 'Soulevé de terre jambes tendues', type: 'barbell' },
      { name: 'Hip thrust', type: 'barbell' },
      { name: 'Good morning', type: 'barbell' },
      { name: 'Fentes marchées', type: 'dumbbell' },
      { name: 'Abduction machine', type: 'machine' },
      { name: 'Adduction machine', type: 'machine' },
      { name: 'Pont fessier', type: 'bodyweight' },
    ],
  },
  {
    group: 'Mollets',
    items: [
      { name: 'Mollets debout machine', type: 'machine' },
      { name: 'Mollets assis machine', type: 'machine' },
      { name: 'Mollets à la presse', type: 'machine' },
      { name: 'Mollets haltères', type: 'dumbbell' },
    ],
  },
  {
    group: 'Abdominaux',
    items: [
      { name: 'Crunch au sol', type: 'bodyweight' },
      { name: 'Crunch à la poulie', type: 'machine' },
      { name: 'Crunch machine', type: 'machine' },
      { name: 'Relevé de jambes suspendu', type: 'bodyweight' },
      { name: 'Relevé de jambes au sol', type: 'bodyweight' },
      { name: 'Gainage planche', type: 'bodyweight' },
      { name: 'Planche latérale', type: 'bodyweight' },
      { name: 'Roue abdominale', type: 'bodyweight' },
      { name: 'Russian twist', type: 'bodyweight' },
      { name: 'Mountain climbers', type: 'bodyweight' },
    ],
  },
  {
    group: 'Avant-bras',
    items: [
      { name: 'Curl poignets barre', type: 'barbell' },
      { name: 'Extension poignets barre', type: 'barbell' },
      { name: 'Marche du fermier', type: 'dumbbell' },
    ],
  },
]

/**
 * Clé de comparaison d'un nom d'exercice.
 *
 * Sans accents ni casse : « Développé couché » et « developpe couche » sont le
 * même mouvement, et proposer d'ajouter un doublon qui ne diffère que par un
 * accent serait un piège — deux entrées au catalogue, deux courbes coupées en
 * deux, et rien à l'écran pour expliquer pourquoi.
 */
export function exerciseKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export const LIBRARY_COUNT = EXERCISE_LIBRARY.reduce((n, g) => n + g.items.length, 0)
