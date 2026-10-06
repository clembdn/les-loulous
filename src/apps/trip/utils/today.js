// L'écran Aujourd'hui : ce qui vient maintenant, et où aller.
//
// Il lit la frise du jour (utils/timeline.js) à l'heure murale du téléphone —
// pendant le voyage, le téléphone est dans le fuseau du lieu, et les heures
// saisies sont celles du billet (cf. utils/fields.js).
//
// Module pur, testé sous `node --test`.

import { dayStatus, endMinutes, lastStartedIndex, toMinutes } from './timeline.js'
import { goUrl } from './mapsUrl.js'

/** 570 → « 09:30 ». Au-delà de minuit, on reste dans la journée (23:59 au plus). */
export function fromMinutes(minutes) {
  const m = Math.max(0, Math.min(Math.round(minutes), 24 * 60 - 1))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Ce qu'on met en grand en haut de l'écran, à l'heure `now` :
 *  · `free`    — rien de prévu de la journée ;
 *  · `current` — commencé et pas fini (heure ET durée connues), `until` = l'heure de fin ;
 *  · `next`    — le prochain élément daté, `minutes` avant qu'il commence ;
 *  · `then`    — plus rien de daté, mais un élément sans heure plus loin dans
 *                la frise que le dernier élément commencé : la suite du plan ;
 *  · `done`    — tout est derrière nous (l'écran propose alors de rentrer).
 *
 * Un élément daté passe avant un élément sans heure : lui seul permet de
 * dire « dans 1 h 20 », et c'est l'horaire qu'on ne doit pas rater. Une
 * journée sans aucune heure se lit dans l'ordre de la frise.
 */
export function focusOf(items, now) {
  if (!items.length) return { kind: 'free', item: null }
  const { current, next } = dayStatus(items, now)
  if (current) return { kind: 'current', item: current, until: fromMinutes(endMinutes(current)) }
  if (next) return { kind: 'next', item: next, minutes: toMinutes(next.time) - toMinutes(now) }

  // Plus rien de daté devant nous : la suite est ce qui vient après le
  // dernier élément déjà commencé, dans l'ordre choisi à la main.
  const then = items.slice(lastStartedIndex(items, now) + 1).find((item) => !item.time)
  return then ? { kind: 'then', item: then } : { kind: 'done', item: null }
}

/**
 * Le lieu à rejoindre pour un élément de la frise — ce que vise « Y aller » —
 * ou `null` quand il n'y a nulle part où aller :
 *  · une étape, une arrivée à l'hébergement → ce lieu ;
 *  · un trajet qui part → sa gare, son aéroport, son agence ;
 *  · l'arrivée d'un trajet → rien, on est dedans… sauf une voiture de
 *    location qu'on RAMÈNE à l'agence ;
 *  · un départ d'hébergement → rien, on y a dormi.
 * `underway` : le trajet est en cours (`focusOf` → `current`). On est dans le
 * train, plus rien à rejoindre ; au volant d'une location, l'agence de retour.
 * Il faut aussi de quoi tracer l'itinéraire (cf. `goUrl`).
 */
export function destinationOf(item, { underway = false } = {}) {
  if (!item) return null
  let place = null
  if (item.type === 'stop') place = item.stop
  else if (item.type === 'checkin') place = item.stay
  else if (item.type === 'transport') {
    const t = item.transport
    if (t.mode === 'car' && (underway || item.phase === 'arrival')) place = t.to
    else if (!underway && item.phase !== 'arrival') place = t.from
  }
  return place && goUrl(place) ? place : null
}

/**
 * Les points à revoir avant de partir, nuit par nuit (cf. `nightsOf`) :
 * les nuits sans hébergement (sauf la dernière) et celles qui en ont deux,
 * et les étapes sans position — absentes des cartes et de la météo, et
 * impossibles à localiser une fois sans réseau.
 */
export function tripChecks(nights, stopsByDate, dayKeys) {
  const unlocated = []
  for (const date of dayKeys) {
    for (const stop of stopsByDate[date] || []) {
      if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) unlocated.push({ date, stop })
    }
  }
  return {
    gaps: nights.filter((n) => n.gap).map((n) => n.date),
    overlaps: nights.filter((n) => n.overlap).map((n) => ({ date: n.date, stays: n.stays })),
    unlocated,
  }
}
