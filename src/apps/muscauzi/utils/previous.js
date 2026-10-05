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
 * Les PASSAGES de chaque mouvement : un par date, strictement avant `beforeDate`.
 *
 * Le regroupement que suivent « la dernière fois » et la barre d'XP — écrit
 * une seule fois, ici. Un mouvement fait deux fois dans la même séance donne un
 * seul passage : ses entrées dans l'ordre de la séance, et leurs séries mises
 * bout à bout dans le même ordre.
 *
 * @param {Array} sessions  séances normalisées, triées par date croissante
 * @param {string} beforeDate  exclue, ainsi que tout ce qui suit
 * @returns {Object} { [exerciseId]: [{ date, entries, sets }] }, du plus ancien
 *   au plus récent — `sets` ne contient que les séries qui comptent (`doneSets`)
 */
export function passagesByExercise(sessions, beforeDate) {
  const out = {}
  for (const session of sessions || []) {
    if (!session?.date || (beforeDate && session.date >= beforeDate)) continue

    const ofDay = {}
    for (const entry of Object.values(session.entries || {})) {
      if (!entry?.exerciseId) continue
      const done = doneSets(entry)
      if (done.length === 0) continue
      if (!ofDay[entry.exerciseId]) ofDay[entry.exerciseId] = []
      ofDay[entry.exerciseId].push({ entry, done })
    }

    for (const [exerciseId, groups] of Object.entries(ofDay)) {
      groups.sort((a, b) => (a.entry.order ?? 0) - (b.entry.order ?? 0))
      if (!out[exerciseId]) out[exerciseId] = []
      out[exerciseId].push({
        date: session.date,
        entries: groups.map((g) => g.entry),
        sets: groups.flatMap((g) => g.done),
      })
    }
  }
  return out
}

/**
 * @param {Array} sessions  séances normalisées, triées par date croissante
 * @param {string} dateKey  la date affichée — exclue, ainsi que tout ce qui suit
 * @returns {Object} { [exerciseId]: { date, sets: [{ weightKg, reps }] } }
 */
export function buildPreviousIndex(sessions, dateKey) {
  const out = {}
  for (const [exerciseId, passages] of Object.entries(passagesByExercise(sessions, dateKey))) {
    // Du plus ancien au plus récent : le dernier passage est « la dernière fois ».
    const last = passages[passages.length - 1]
    out[exerciseId] = { date: last.date, sets: last.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) }
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
