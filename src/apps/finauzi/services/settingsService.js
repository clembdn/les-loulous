import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { JOINT_ACCOUNT_ID } from '../config/accounts.js'
import { DEFAULT_EUR_TO_AUD, convert } from '../utils/money.js'

const SETTINGS_DOC = doc(db, 'couples/main/settings/main')

export const DEFAULT_SETTINGS = {
  // Solde de départ de chaque compte, DANS SA PROPRE DEVISE.
  // Le joint est en A$, les persos en €.
  openingBalances: { joint: 0, clement: 0, lise: 0 },
  // Seuil de sécurité par compte, dans la devise du compte. C'est lui qui
  // déclenche l'alerte de réappro du compte joint.
  safetyBuffers: { joint: 2000 },
  // Ce que chacun s'est engagé à verser au pot, par mois, en €.
  contributionTargetEUR: 2000,
  budgets: {},
  userColors: {},
  // Catégorisation apprise à l'import d'un relevé : { « carrefour »:
  // « groceries » }. Corriger une catégorie une fois suffit à ce que les
  // imports suivants tombent juste, sur les deux téléphones.
  importRules: {},
  // Devise d'affichage des montants consolidés.
  currency: 'AUD',
  eurToAud: DEFAULT_EUR_TO_AUD,
}

// Les réglages d'avant la refonte portaient un capital global en euros et un
// sous-total « commun ». On les redistribue sur les trois comptes : le commun
// part sur le joint (converti en A$), le reste se partage 50/50 entre les
// deux persos — le moins faux des défauts, ajustable dans les réglages.
function migrate(raw) {
  if (raw?.openingBalances) return raw

  const rate = Number(raw?.eurToAud) || DEFAULT_EUR_TO_AUD
  const totalEUR = Number(raw?.initialCapitalEUR) || 0
  const commonEUR = Number(raw?.commonInitialCapitalEUR) || 0
  const personalEUR = Math.max(totalEUR - commonEUR, 0)

  return {
    ...raw,
    openingBalances: {
      joint: Math.round(convert(commonEUR, 'EUR', 'AUD', rate)),
      clement: Math.round(personalEUR / 2),
      lise: Math.round(personalEUR / 2),
    },
    safetyBuffers: {
      [JOINT_ACCOUNT_ID]: Math.round(convert(Number(raw?.safetyBufferEUR) || 1500, 'EUR', 'AUD', rate)),
    },
  }
}

function hydrate(data) {
  const migrated = migrate(data || {})
  return {
    ...DEFAULT_SETTINGS,
    ...migrated,
    openingBalances: { ...DEFAULT_SETTINGS.openingBalances, ...migrated.openingBalances },
    safetyBuffers: { ...DEFAULT_SETTINGS.safetyBuffers, ...migrated.safetyBuffers },
    budgets: { ...migrated.budgets },
    userColors: { ...migrated.userColors },
    importRules: { ...migrated.importRules },
  }
}

export function subscribeToSettings(callback, onError) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    callback(hydrate(snap.exists() ? snap.data() : null))
  }, (error) => {
    console.error('[FinAuzi] settings error:', error)
    onError?.(error)
    callback({ ...DEFAULT_SETTINGS })
  })
}

export async function updateSettings(updates, currentUid) {
  await setDoc(SETTINGS_DOC, {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}

export function getOpeningBalance(settings, accountId) {
  return Number(settings?.openingBalances?.[accountId]) || 0
}

export function getSafetyBuffer(settings, accountId) {
  return Number(settings?.safetyBuffers?.[accountId]) || 0
}
