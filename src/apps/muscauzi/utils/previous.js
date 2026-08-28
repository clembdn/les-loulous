import { doneSets } from './sets.js'

/**
 * « La dernière fois » — le repère qu'on cherche des yeux entre deux séries.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 *
 * Le rappel venait d'un cache dénormalisé, `users/{uid}/meta/lastPerf`, que
 * l'appli réécrivait à CHAQUE série enregistrée — y compris celles du jour. Le
 * placeholder « 60 kg × 8 » se transformait donc en la série qu'on venait de
 * taper, dès qu'on la validait, et le badge « Mieux » comparait la séance à
 * elle-même. Le repère disparaissait exactement au moment où on en avait
 * besoin : sur la deuxième série.
 *
 * Trois règles le remettent d'aplomb.
 *
 * 1. STRICTEMENT ANTÉRIEUR à la date affichée. Ce qu'on fait aujourd'hui
 *    n'est jamais son propre repère — y compris en rattrapage : on compare
 *    alors à ce qui précédait CE jour-là, pas à ce qui a suivi.
 *
 * 2. Indexé par EXERCICE, plus par occurrence. L'ancien index reposait sur
 *    l'`instanceId` d'une ligne de programme : réordonner un jour, dupliquer
 *    une semaine vers l'autre parité ou remplacer une ligne fabriquait un
 *    identifiant neuf, et l'historique du mouvement s'arrêtait net sans que
 *    rien ne l'explique. C'est le mouvement qui porte la progression.
 *
 * 3. Les passages MULTIPLES d'un même mouvement dans une même séance sont mis
 *    bout à bout, dans l'ordre où ils ont été faits — comme le font déjà
 *    `exerciseHistoryIndex` et `workByExercise`. Un jour où l'on repasse sur le
 *    développé reste un jour, pas deux.
 *
 * Pur, sans Firestore : c'est une lecture de tableau, elle se teste.
 */

/**
 * @param {Array} sessions  séances normalisées, triées par date croissante
 * @param {string} dateKey  la date affichée — exclue, ainsi que tout ce qui suit
 * @returns {Object} { [exerciseId]: { date, sets: [{ weightKg, reps }] } }
 */
export function buildPreviousIndex(sessions, dateKey) {
  const out = {}
  for (const session of sessions || []) {
    // `sessions` est trié : on écrase au fur et à mesure, la dernière séance
    // retenue est donc la plus récente d'avant `dateKey`.
    if (!session?.date || session.date >= dateKey) continue

    const ofDay = {}
    for (const entry of Object.values(session.entries || {})) {
      if (!entry?.exerciseId) continue
      const done = doneSets(entry)
      if (done.length === 0) continue
      if (!ofDay[entry.exerciseId]) ofDay[entry.exerciseId] = []
      ofDay[entry.exerciseId].push({ order: entry.order ?? 0, done })
    }

    for (const [exerciseId, groups] of Object.entries(ofDay)) {
      const sets = groups
        .sort((a, b) => a.order - b.order)
        .flatMap((g) => g.done)
        .map((s) => ({ weightKg: s.weightKg, reps: s.reps }))
      out[exerciseId] = { date: session.date, sets }
    }
  }
  return out
}

/**
 * La série à afficher en repère sous le rang `rank`.
 *
 * Au-delà de ce qui avait été fait la dernière fois — une cinquième série
 * ajoutée à la main quand il n'y en avait que quatre — on reprend la DERNIÈRE
 * série connue plutôt que rien : c'est elle qui dit à quelle charge on en était
 * arrivé. Le repère reste indicatif ; il n'écrit jamais rien tout seul.
 */
export function previousSetAt(previous, rank) {
  const sets = previous?.sets
  if (!sets || sets.length === 0) return null
  return sets[rank] || sets[sets.length - 1]
}
