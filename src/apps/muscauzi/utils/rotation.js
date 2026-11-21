import { hasCompletedWork, hasWork } from './sets.js'

/**
 * Les séances « en boucle » — la règle, sans Firestore ni React.
 *
 * En mode jours de la semaine, la date décide seule de la séance : le lundi,
 * c'est le programme du lundi. Ce mode ne tient plus dès qu'on va à la salle
 * quand on peut : on enchaîne Legs → Push → Pull → Rappel → Legs…, et le jour
 * de la semaine n'apprend plus rien. Ce qui décide, c'est la DERNIÈRE séance
 * faite : on propose celle qui la suit.
 *
 * Les « cases » de la boucle sont les jours non vides du programme pair, dans
 * leur ordre (1 → 7). On garde ainsi le même document et le même éditeur : une
 * case vide n'est simplement pas dans la boucle.
 *
 * Aucun import d'alias `@/` ici : ces fonctions se testent sous `node --test`,
 * qui ne les résout pas.
 */

/** Les cases de la boucle : `[{ slot, name, position, count }]`. */
export function rotationSlots(program) {
  const days = program?.days || {}
  const names = program?.names || {}
  const filled = []
  for (let dow = 1; dow <= 7; dow++) {
    const lines = days[dow] ?? days[String(dow)]
    if (Array.isArray(lines) && lines.length > 0) filled.push(dow)
  }
  return filled.map((slot, i) => ({
    slot,
    name: names[slot] || names[String(slot)] || '',
    position: i + 1,
    count: filled.length,
  }))
}

/**
 * La case d'une séance enregistrée.
 *
 * Par son NOM d'abord : c'est la seule identité qui survive à un programme
 * réorganisé, et c'est déjà elle qui rattache les séances entre elles (bilan,
 * groupes). À défaut, par la case qu'elle a enregistrée (`dayOfWeek`) — une
 * séance sans nom faite en boucle porte bien sa case. Sinon, aucune : une
 * séance qu'on ne sait pas placer ne fait pas avancer la boucle.
 */
export function slotOfSession(session, slots) {
  if (!session || !slots?.length) return null
  if (session.name) {
    const byName = slots.find((s) => s.name && s.name === session.name)
    if (byName) return byName.slot
  }
  const byDay = slots.find((s) => s.slot === session.dayOfWeek)
  return byDay ? byDay.slot : null
}

// Les séances qui comptent pour la boucle, strictement avant `dateKey`, une
// par date (la dernière lue l'emporte) et triées : l'historique arrive trié,
// mais la règle ne doit pas dépendre de l'appelant.
function pastWorked(sessions, slots, dateKey) {
  const byDate = new Map()
  for (const s of sessions || []) {
    if (!s?.date || s.date >= dateKey) continue
    if (!hasCompletedWork(s)) continue
    const slot = slotOfSession(s, slots)
    if (slot == null) continue
    byDate.set(s.date, { date: s.date, slot })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** La case qui suit la dernière séance faite avant `dateKey` (la première sinon). */
export function nextSlot(sessions, slots, dateKey) {
  if (!slots?.length) return null
  const past = pastWorked(sessions, slots, dateKey)
  const last = past[past.length - 1]
  if (!last) return slots[0].slot
  const i = slots.findIndex((s) => s.slot === last.slot)
  return slots[(i + 1) % slots.length].slot
}

/**
 * La case d'une date.
 *
 * Une séance déjà commencée garde SA case, même si une autre a été faite
 * après (un rattrapage) : relire mardi la séance de lundi doit montrer ce qui
 * a été fait lundi. Sinon le choix manuel (« Changer »), sinon la suivante.
 *
 * « Commencée » est ici plus large que pour faire avancer la boucle : une
 * série d'échauffement ou un exercice marqué « non fait » suffisent. Dès la
 * première saisie, `saveEntry` a écrit le nom de la case dans la séance ; le
 * choix manuel, lui, ne vit qu'en mémoire. Sans ça, rouvrir l'appli après un
 * échauffement sur une séance choisie à la main la ramènerait à la case
 * suivante — et la saisie d'après écraserait le nom.
 *
 * `source` dit d'où vient la case : l'écran ne propose de changer que tant que
 * rien n'est enregistré.
 */
export function slotForDate({ sessions, slots, dateKey, manual = null }) {
  if (!slots?.length) return { slot: null, source: 'none' }
  const own = (sessions || []).find((s) => s?.date === dateKey)
  if (own && Object.values(own.entries || {}).some(hasWork)) {
    const slot = slotOfSession(own, slots)
    if (slot != null) return { slot, source: 'session' }
  }
  if (manual != null && slots.some((s) => s.slot === manual)) {
    return { slot: manual, source: 'manual' }
  }
  return { slot: nextSlot(sessions, slots, dateKey), source: 'next' }
}

/** La date de la dernière fois que chaque case a été faite, avant `dateKey`. */
export function lastDoneBySlot(sessions, slots, dateKey) {
  const out = {}
  for (const { date, slot } of pastWorked(sessions, slots, dateKey)) out[slot] = date
  return out
}
