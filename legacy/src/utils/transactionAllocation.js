import {
  CLEMENT_UID,
  LISE_UID,
  getDefaultPersonUid,
  getPersonLabel,
  isAuthorizedUid,
} from '../config/people.js'

export const ALLOCATION_TYPES = {
  SINGLE: 'single',
  SHARED: 'shared',
}

export const TRANSACTION_KINDS = {
  STANDARD: 'standard',
  TRANSFER: 'transfer',
  PERSONAL_BAILOUT: 'personal_bailout',
}

export const FUND_SOURCES = {
  COMMON: 'common',
  PERSO_CLEMENT: 'perso_clement',
  PERSO_LISE: 'perso_lise',
}

/**
 * Check if a transaction is a transfer between accounts.
 */
export function isTransfer(tx) {
  return tx?.transactionKind === TRANSACTION_KINDS.TRANSFER
}

/**
 * Check if a transaction is a personal bailout (perso card paying couple expense).
 */
export function isPersonalBailout(tx) {
  return tx?.transactionKind === TRANSACTION_KINDS.PERSONAL_BAILOUT
}

/**
 * Get the default transaction kind.
 */
export function getDefaultTransactionKind() {
  return TRANSACTION_KINDS.STANDARD
}

function getSafeFallbackUid(fallbackPersonUid) {
  return isAuthorizedUid(fallbackPersonUid) ? fallbackPersonUid : getDefaultPersonUid()
}

function getSafePersonUid(personUid, fallbackPersonUid) {
  return isAuthorizedUid(personUid) ? personUid : getSafeFallbackUid(fallbackPersonUid)
}

export function clampPercentage(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

export function createSingleAllocation(personUid, fallbackPersonUid) {
  const uid = getSafePersonUid(personUid, fallbackPersonUid)
  return {
    allocationType: ALLOCATION_TYPES.SINGLE,
    splits: [{ personUid: uid, percentage: 100 }],
  }
}

export function createSharedAllocation(clementPercentage = 50) {
  const clampedClement = clampPercentage(clementPercentage)
  return {
    allocationType: ALLOCATION_TYPES.SHARED,
    splits: [
      { personUid: CLEMENT_UID, percentage: clampedClement },
      { personUid: LISE_UID, percentage: 100 - clampedClement },
    ],
  }
}

function hasValidSplitShape(split) {
  return !!split
    && typeof split === 'object'
    && isAuthorizedUid(split.personUid)
    && Number.isFinite(Number(split.percentage))
}

function normalizeFromSplits(allocationType, splits, fallbackPersonUid) {
  const validSplits = Array.isArray(splits)
    ? splits.filter(hasValidSplitShape)
    : []

  if (validSplits.length === 0) return null

  if (validSplits.length === 1) {
    return createSingleAllocation(validSplits[0].personUid, fallbackPersonUid)
  }

  const clementRaw = validSplits
    .filter(split => split.personUid === CLEMENT_UID)
    .reduce((sum, split) => sum + clampPercentage(split.percentage), 0)
  const liseRaw = validSplits
    .filter(split => split.personUid === LISE_UID)
    .reduce((sum, split) => sum + clampPercentage(split.percentage), 0)

  if (clementRaw <= 0 && liseRaw <= 0) return null

  const total = clementRaw + liseRaw
  const normalizedClement = Math.round((clementRaw / total) * 100)
  const sharedAllocation = createSharedAllocation(normalizedClement)

  if (allocationType === ALLOCATION_TYPES.SHARED) {
    return sharedAllocation
  }

  if (allocationType === ALLOCATION_TYPES.SINGLE) {
    if (normalizedClement === 0) return createSingleAllocation(LISE_UID, fallbackPersonUid)
    if (normalizedClement === 100) return createSingleAllocation(CLEMENT_UID, fallbackPersonUid)
  }

  if (normalizedClement === 0) return createSingleAllocation(LISE_UID, fallbackPersonUid)
  if (normalizedClement === 100) return createSingleAllocation(CLEMENT_UID, fallbackPersonUid)
  return sharedAllocation
}

export function normalizeTransactionAllocation(transaction, fallbackPersonUid) {
  const fallbackUid = getSafeFallbackUid(fallbackPersonUid)
  const fromSplits = normalizeFromSplits(transaction?.allocationType, transaction?.splits, fallbackUid)
  if (fromSplits) return fromSplits

  if (isAuthorizedUid(transaction?.personUid)) {
    return createSingleAllocation(transaction.personUid, fallbackUid)
  }

  return createSingleAllocation(fallbackUid, fallbackUid)
}

function getSplitMap(splits) {
  const splitMap = {
    [CLEMENT_UID]: 0,
    [LISE_UID]: 0,
  }

  for (const split of splits) {
    if (!isAuthorizedUid(split.personUid)) continue
    splitMap[split.personUid] = clampPercentage(split.percentage)
  }

  return splitMap
}

export function isValidTransactionAllocation(allocationType, splits) {
  if (!Object.values(ALLOCATION_TYPES).includes(allocationType)) return false
  if (!Array.isArray(splits) || splits.length === 0) return false
  if (!splits.every(hasValidSplitShape)) return false

  const splitMap = getSplitMap(splits)
  const total = splitMap[CLEMENT_UID] + splitMap[LISE_UID]
  if (total !== 100) return false

  if (allocationType === ALLOCATION_TYPES.SINGLE) {
    if (splits.length !== 1) return false
    const hasSingle100 =
      (splitMap[CLEMENT_UID] === 100 && splitMap[LISE_UID] === 0)
      || (splitMap[LISE_UID] === 100 && splitMap[CLEMENT_UID] === 0)
    return hasSingle100
  }

  if (splits.length !== 2) return false
  const hasClement = splits.some(split => split.personUid === CLEMENT_UID)
  const hasLise = splits.some(split => split.personUid === LISE_UID)
  return hasClement && hasLise
}

export function getTransactionAllocationValidationError(allocationType, splits) {
  if (!allocationType) return 'La répartition est requise'
  if (!Array.isArray(splits) || splits.length === 0) return 'La répartition doit contenir au moins une personne'

  for (const split of splits) {
    if (!hasValidSplitShape(split)) return 'La répartition contient des données invalides'
    const percentage = Number(split.percentage)
    if (percentage < 0 || percentage > 100) return 'Chaque pourcentage doit être entre 0 et 100'
  }

  if (!isValidTransactionAllocation(allocationType, splits)) {
    return 'La répartition doit totaliser 100%'
  }

  return null
}

export function getSplitPercentageForPerson(transaction, personUid) {
  const allocation = normalizeTransactionAllocation(transaction, personUid)
  const split = allocation.splits.find(item => item.personUid === personUid)
  return split ? split.percentage : 0
}

export function getAllocationDisplay(transaction, fallbackPersonUid) {
  const allocation = normalizeTransactionAllocation(transaction, fallbackPersonUid)
  const splitMap = getSplitMap(allocation.splits)

  if (allocation.allocationType === ALLOCATION_TYPES.SHARED) {
    return {
      allocationType: ALLOCATION_TYPES.SHARED,
      label: `Partagé ${splitMap[CLEMENT_UID]}/${splitMap[LISE_UID]}`,
      clementPercentage: splitMap[CLEMENT_UID],
      lisePercentage: splitMap[LISE_UID],
    }
  }

  const singlePersonUid = allocation.splits[0]?.personUid || getSafeFallbackUid(fallbackPersonUid)
  return {
    allocationType: ALLOCATION_TYPES.SINGLE,
    label: getPersonLabel(singlePersonUid),
    singlePersonUid,
    clementPercentage: splitMap[CLEMENT_UID],
    lisePercentage: splitMap[LISE_UID],
  }
}
