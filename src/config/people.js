export const CLEMENT_UID = 'o8wLosYoh7b989P9gQyZCk8tt3l1'
export const LISE_UID = 'J8xOqDWZv5gEss5CBbQ7kQOsTwV2'

export const AUTHORIZED_UIDS = [CLEMENT_UID, LISE_UID]

export const PEOPLE = {
  [CLEMENT_UID]: {
    uid: CLEMENT_UID,
    label: 'Clément',
    initial: 'C',
    color: '#F59E0B',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
  },
  [LISE_UID]: {
    uid: LISE_UID,
    label: 'Lise',
    initial: 'L',
    color: '#A855F7',
    dotClass: 'bg-purple-400',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
  },
}

export function isAuthorizedUid(uid) {
  return AUTHORIZED_UIDS.includes(uid)
}

export function getPerson(uid) {
  return PEOPLE[uid] || null
}

export function getPersonLabel(uid) {
  return PEOPLE[uid]?.label || 'Inconnu'
}

export function getOtherUid(uid) {
  return AUTHORIZED_UIDS.find((u) => u !== uid) || null
}
