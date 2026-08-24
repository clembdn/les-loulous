import { dayLabel } from '@/shared/lib/dates.js'
import { hasCompletedWork } from '../services/sessionsService.js'
import { sessionTotals } from './metrics.js'

/**
 * Regrouper les séances comparables entre elles.
 *
 * Deux séances se comparent si elles sont LA MÊME séance revenue une semaine
 * plus tard — pas si elles se suivent dans le calendrier. Un jour de jambes
 * pèse trois fois le volume d'un jour de bras : mises côte à côte sans
 * distinction, elles ne mesureraient que l'alternance du programme.
 *
 * L'identité vient du NOM quand il y en a un — c'est la seule qui survive à un
 * déplacement dans la semaine. À défaut, la case du programme (parité + jour)
 * fait un repère acceptable : en alternance paire/impaire, c'est bien la même
 * séance qui revient toutes les deux semaines.
 */
const PARITY_LABEL = { even: 'paire', odd: 'impaire' }

export function sessionGroupKey(session) {
  if (session?.name) return `n:${session.name}`
  if (session?.parity && session?.dayOfWeek) return `s:${session.parity}:${session.dayOfWeek}`
  return 's:libre'
}

export function sessionGroupLabel(session) {
  if (session?.name) return session.name
  if (session?.parity && session?.dayOfWeek) {
    return `${dayLabel(session.dayOfWeek).toLowerCase()} · semaine ${PARITY_LABEL[session.parity]}`
  }
  return 'Séances hors programme'
}

/**
 * `sessions` est attendu trié par date croissante — chaque groupe garde donc
 * ses occurrences dans l'ordre où elles ont été faites, ce dont la courbe a
 * besoin.
 *
 * Les séances ouvertes sans rien y faire sont écartées : elles produiraient un
 * point à zéro qui ressemble à un effondrement.
 */
export function groupSessions(sessions) {
  const groups = new Map()
  for (const session of sessions) {
    if (!hasCompletedWork(session)) continue
    const key = sessionGroupKey(session)
    let group = groups.get(key)
    if (!group) {
      group = { key, label: sessionGroupLabel(session), occurrences: [] }
      groups.set(key, group)
    }
    group.occurrences.push({ date: session.date, session, totals: sessionTotals(session) })
  }
  // La séance faite le plus récemment se présente en premier : c'est celle
  // dont on vient de sortir, donc celle qu'on ouvre.
  return [...groups.values()].sort((a, b) => lastDate(b).localeCompare(lastDate(a)))
}

function lastDate(group) {
  return group.occurrences[group.occurrences.length - 1].date
}

// Les trois façons de peser une séance. Le volume ne dit rien d'une séance au
// poids du corps ; les séries et les reps, si — d'où le choix laissé ouvert.
export const SESSION_METRICS = [
  { id: 'volume', label: 'Volume', short: 'Volume', unit: 'kg', of: (t) => t.volume },
  { id: 'sets', label: 'Séries', short: 'Séries', unit: '', of: (t) => t.sets },
  { id: 'reps', label: 'Reps', short: 'Reps', unit: '', of: (t) => t.reps },
]

export function sessionMetric(id) {
  return SESSION_METRICS.find((m) => m.id === id) || SESSION_METRICS[0]
}

export function formatSessionMetric(value, metric) {
  const rounded = Math.round(value)
  const shown = rounded.toLocaleString('fr-FR')
  return metric.unit ? `${shown} ${metric.unit}` : shown
}
