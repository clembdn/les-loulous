import { Users, User } from 'lucide-react'
import { CLEMENT_UID, LISE_UID, AUTHORIZED_UIDS, getPersonLabel } from '@/shared/config/people.js'

// FinAuzi — les trois comptes réels du foyer.
//
//   • joint    — banque australienne, en A$. Paie le loyer, l'élec, la box.
//                Alimenté par un virement égal de chacun.
//   • clement  — compte perso français, en €.
//   • lise     — compte perso français, en €.
//
// La devise est portée par le COMPTE, pas par l'app : le solde du joint est
// un vrai solde en A$, pas une conversion d'affichage.
//
// Chaque compte porte aussi son RÉSEAU de virement : deux comptes du même
// réseau se virent de l'argent gratuitement (SEPA en France, virement
// domestique en Australie), traverser deux réseaux coûte des frais. C'est ce
// qui rend le rééquilibrage France→France préférable à un virement au pot.
// Au retour en France, il suffira de basculer les comptes sur le réseau FR.

// ─── Réseaux de virement ──────────────────────────────────────────────────
// Un virement à l'intérieur d'un réseau est gratuit et quasi instantané ;
// entre deux réseaux, il passe par un change et des frais.
export const NETWORKS = {
  FR: { id: 'FR', label: 'France', short: 'FR', transferLabel: 'virement SEPA gratuit' },
  AU: { id: 'AU', label: 'Australie', short: 'AU', transferLabel: 'virement domestique gratuit' },
}

export const JOINT_ACCOUNT_ID = 'joint'

export const PERSONAL_ACCOUNT_ID = {
  [CLEMENT_UID]: 'clement',
  [LISE_UID]: 'lise',
}

export const ACCOUNTS = [
  {
    id: JOINT_ACCOUNT_ID,
    kind: 'joint',
    ownerUid: null,
    currency: 'AUD',
    network: 'AU',
    label: 'Compte joint',
    short: 'Joint',
    sublabel: 'Australie',
    icon: Users,
    hex: '#0EA5E9',
    bgClass: 'bg-sky-500/15',
    textClass: 'text-sky-400',
    dotClass: 'bg-sky-400',
    borderClass: 'border-sky-500/30',
  },
  {
    id: 'clement',
    kind: 'personal',
    ownerUid: CLEMENT_UID,
    currency: 'EUR',
    network: 'FR',
    label: `Perso ${getPersonLabel(CLEMENT_UID)}`,
    short: getPersonLabel(CLEMENT_UID),
    sublabel: 'France',
    icon: User,
    hex: '#F59E0B',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400',
    borderClass: 'border-amber-500/30',
  },
  {
    id: 'lise',
    kind: 'personal',
    ownerUid: LISE_UID,
    currency: 'EUR',
    network: 'FR',
    label: `Perso ${getPersonLabel(LISE_UID)}`,
    short: getPersonLabel(LISE_UID),
    sublabel: 'France',
    icon: User,
    hex: '#A855F7',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
    dotClass: 'bg-purple-400',
    borderClass: 'border-purple-500/30',
  },
]

export const ACCOUNTS_BY_ID = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]))
export const PERSONAL_ACCOUNTS = ACCOUNTS.filter((a) => a.kind === 'personal')

const FALLBACK_ACCOUNT = {
  id: 'unknown',
  kind: 'personal',
  ownerUid: null,
  currency: 'EUR',
  network: 'FR',
  label: 'Compte inconnu',
  short: '—',
  sublabel: '',
  icon: User,
  hex: '#64748B',
  bgClass: 'bg-white/5',
  textClass: 'text-white/50',
  dotClass: 'bg-white/30',
  borderClass: 'border-white/10',
}

export function getAccount(id) {
  return ACCOUNTS_BY_ID[id] || FALLBACK_ACCOUNT
}

export function isValidAccountId(id) {
  return !!ACCOUNTS_BY_ID[id]
}

// Le compte perso d'une personne — c'est là que tombent ses dépenses perso.
export function getPersonalAccountId(uid) {
  return PERSONAL_ACCOUNT_ID[uid] || null
}

export function getAccountCurrency(id) {
  return getAccount(id).currency
}

export function getAccountNetwork(id) {
  return NETWORKS[getAccount(id).network] || NETWORKS.FR
}

// Deux comptes du même réseau — le virement entre eux est gratuit.
export function isSameNetwork(fromId, toId) {
  return getAccount(fromId).network === getAccount(toId).network
}

// Ordre d'affichage : joint d'abord, puis mon perso, puis celui de l'autre.
export function getOrderedAccounts(currentUid) {
  const mine = getPersonalAccountId(currentUid)
  if (!mine) return ACCOUNTS
  return [
    ACCOUNTS_BY_ID[JOINT_ACCOUNT_ID],
    ACCOUNTS_BY_ID[mine],
    ...PERSONAL_ACCOUNTS.filter((a) => a.id !== mine),
  ]
}

// ─── Répartition (`split`) ────────────────────────────────────────────────
// Qui supporte économiquement le mouvement. Toujours 50/50 quand c'est commun.

export const SPLIT_COMMON = 'common'

export function isValidSplit(value) {
  return value === SPLIT_COMMON || AUTHORIZED_UIDS.includes(value)
}

// Défaut sensé : ce qui sort du joint est commun, ce qui sort d'un perso
// est perso à son propriétaire.
export function getDefaultSplit(accountId) {
  const account = getAccount(accountId)
  if (account.kind === 'joint') return SPLIT_COMMON
  return account.ownerUid || SPLIT_COMMON
}

export function getSplitLabel(split) {
  if (split === SPLIT_COMMON) return 'Commun'
  return getPersonLabel(split)
}
