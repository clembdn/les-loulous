export const CLEMENT_UID = 'o8wLosYoh7b989P9gQyZCk8tt3l1'
export const LISE_UID = 'J8xOqDWZv5gEss5CBbQ7kQOsTwV2'

export const AUTHORIZED_UIDS = [CLEMENT_UID, LISE_UID]

// Email d'authentification par profil (login picker → écran mot de passe).
export const EMAIL_BY_UID = {
  [CLEMENT_UID]: 'clemboudon06@gmail.com',
  [LISE_UID]: 'liselabonne09@gmail.com',
}

export function getEmailForUid(uid) {
  return EMAIL_BY_UID[uid] || null
}

// 5-color palette users can pick from. One color per user, locked once chosen.
// All Tailwind classes are pre-baked so the bundler picks them up.
export const COLOR_PALETTE = [
  {
    id: 'amber',  label: 'Ambre',  hex: '#F59E0B',
    dotClass: 'bg-amber-400',   textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20',
    swatchClass: 'bg-amber-400',
  },
  {
    id: 'violet', label: 'Violet', hex: '#A855F7',
    dotClass: 'bg-purple-400',   textClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/20',
    swatchClass: 'bg-purple-400',
  },
  {
    id: 'sky',    label: 'Bleu',   hex: '#0EA5E9',
    dotClass: 'bg-sky-400',     textClass: 'text-sky-400',
    bgClass: 'bg-sky-500/10',   borderClass: 'border-sky-500/20',
    swatchClass: 'bg-sky-400',
  },
  {
    id: 'emerald', label: 'Vert',  hex: '#10B981',
    dotClass: 'bg-emerald-400', textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20',
    swatchClass: 'bg-emerald-400',
  },
  {
    id: 'pink',   label: 'Rose',   hex: '#EC4899',
    dotClass: 'bg-pink-400',    textClass: 'text-pink-400',
    bgClass: 'bg-pink-500/10',  borderClass: 'border-pink-500/20',
    swatchClass: 'bg-pink-400',
  },
]

export const COLOR_BY_ID = Object.fromEntries(COLOR_PALETTE.map((c) => [c.id, c]))

export const DEFAULT_USER_COLORS = {
  [CLEMENT_UID]: 'amber',
  [LISE_UID]: 'violet',
}

const BASE_PEOPLE = {
  [CLEMENT_UID]: { uid: CLEMENT_UID, label: 'Clément', initial: 'C' },
  [LISE_UID]:    { uid: LISE_UID,    label: 'Lise',    initial: 'L' },
}

export function isAuthorizedUid(uid) {
  return AUTHORIZED_UIDS.includes(uid)
}

function resolveColorId(uid, userColors) {
  const picked = userColors?.[uid]
  if (picked && COLOR_BY_ID[picked]) return picked
  return DEFAULT_USER_COLORS[uid] || 'amber'
}

// Returns a fully-resolved person (base info + chosen color classes).
// Pass `userColors` from settings to honor user choices; omit for defaults.
export function getPerson(uid, userColors) {
  const base = BASE_PEOPLE[uid]
  if (!base) return null
  const color = COLOR_BY_ID[resolveColorId(uid, userColors)]
  return {
    ...base,
    color: color.hex,
    dotClass: color.dotClass,
    textClass: color.textClass,
    bgClass: color.bgClass,
    borderClass: color.borderClass,
    colorId: color.id,
  }
}

export function getPersonLabel(uid) {
  return BASE_PEOPLE[uid]?.label || 'Inconnu'
}

export function getOtherUid(uid) {
  return AUTHORIZED_UIDS.find((u) => u !== uid) || null
}

// Returns the color id used by the OTHER user (locked for this user's picker).
export function getLockedColorId(uid, userColors) {
  const other = getOtherUid(uid)
  if (!other) return null
  return resolveColorId(other, userColors)
}
