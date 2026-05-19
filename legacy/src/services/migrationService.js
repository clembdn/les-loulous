// FinAuzi — Migration Service
// Detects legacy localStorage data and imports it to Firestore.
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { createTransaction } from './transactionService.js'
import { updateSettings, DEFAULT_SETTINGS } from './settingsService.js'
import {
  ALLOCATION_TYPES,
  normalizeTransactionAllocation,
} from '../utils/transactionAllocation.js'

// All known localStorage keys from previous versions of the app
const LEGACY_TX_KEYS = [
  'atlas_finance_mission_australie_transactions',
  'atlas_finance_transactions',
  'mission_australie_transactions',
]

const LEGACY_SETTINGS_KEYS = [
  'atlas_finance_mission_australie_settings',
  'atlas_finance_settings',
  'mission_australie_settings',
]

const MIGRATION_DOC = doc(db, 'couples/main/migrations/localStorageImport')
const BACKUP_KEY = 'finauzi_legacy_backup_before_import'

/**
 * Check if migration has already been completed.
 */
export async function hasMigrationAlreadyRun() {
  try {
    const snap = await getDoc(MIGRATION_DOC)
    return snap.exists()
  } catch {
    return false
  }
}

/**
 * Detect if legacy localStorage data exists.
 * @returns {{ transactions: Array, settings: Object|null, sourceKeys: string[] } | null}
 */
export function detectLegacyLocalStorageData() {
  let transactions = null
  let settings = null
  const sourceKeys = []

  // Try transaction keys
  for (const key of LEGACY_TX_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!transactions || parsed.length > transactions.length) {
            transactions = parsed
          }
          sourceKeys.push(key)
        }
      }
    } catch {}
  }

  // Try settings keys
  for (const key of LEGACY_SETTINGS_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          settings = { ...settings, ...parsed }
          sourceKeys.push(key)
        }
      }
    } catch {}
  }

  if (!transactions && !settings) return null

  return {
    transactions: transactions || [],
    settings,
    sourceKeys,
  }
}

/**
 * Check how many transactions already exist in Firestore.
 */
export async function getFirestoreTransactionCount() {
  try {
    const snap = await getDocs(collection(db, 'couples/main/transactions'))
    return snap.size
  } catch {
    return 0
  }
}

/**
 * Import legacy localStorage data into Firestore.
 * @param {Object} legacyData — from detectLegacyLocalStorageData()
 * @param {string} currentUid — currently logged-in user UID
 * @param {string} defaultPersonUid — which person to attribute old transactions to
 */
export async function importLegacyLocalStorageData(legacyData, currentUid, defaultPersonUid) {
  const now = new Date().toISOString()

  // Backup localStorage before import
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      transactions: legacyData.transactions,
      settings: legacyData.settings,
      backedUpAt: now,
    }))
  } catch {}

  // Import transactions
  let importedCount = 0
  for (const tx of legacyData.transactions) {
    // Build a deterministic ID to avoid duplicates
    const legacyId = tx.id || `legacy-${tx.title}-${tx.amountEUR || tx.amount}-${tx.date}`

    const allocation = normalizeTransactionAllocation(tx, defaultPersonUid)
    const cleaned = {
      id: legacyId,
      title: tx.title || 'Transaction importée',
      amountEUR: Number(tx.amountEUR || tx.amount || 0),
      type: tx.type || 'expense',
      recurrence: tx.recurrence || 'one-off',
      category: tx.category || 'other',
      date: tx.date || now.slice(0, 10),
      endDate: tx.endDate || null,
      notes: tx.notes || null,
      isActive: tx.isActive ?? true,
      allocationType: allocation.allocationType,
      splits: allocation.splits,
      personUid: allocation.allocationType === ALLOCATION_TYPES.SINGLE
        ? allocation.splits[0].personUid
        : null,
      createdAt: tx.createdAt || now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    }

    try {
      await createTransaction(cleaned, currentUid)
      importedCount++
    } catch (err) {
      console.warn('[FinAuzi] Failed to import transaction:', cleaned.title, err)
    }
  }

  // Import settings
  if (legacyData.settings) {
    const settingsUpdate = {}
    if (legacyData.settings.initialCapital != null || legacyData.settings.initialCapitalEUR != null || legacyData.settings.initialAllocatedCapitalEUR != null) {
      settingsUpdate.initialCapitalEUR = Number(
        legacyData.settings.initialCapitalEUR
        || legacyData.settings.initialCapital
        || legacyData.settings.initialAllocatedCapitalEUR
        || DEFAULT_SETTINGS.initialCapitalEUR
      )
    }
    if (legacyData.settings.safetyBuffer != null || legacyData.settings.safetyBufferEUR != null) {
      settingsUpdate.safetyBufferEUR = Number(
        legacyData.settings.safetyBufferEUR
        || legacyData.settings.safetyBuffer
        || DEFAULT_SETTINGS.safetyBufferEUR
      )
    }
    if (legacyData.settings.selectedCurrency) {
      settingsUpdate.selectedCurrency = legacyData.settings.selectedCurrency
    }
    if (Object.keys(settingsUpdate).length > 0) {
      await updateSettings(settingsUpdate, currentUid)
    }
  }

  // Mark migration as complete
  await markMigrationComplete(currentUid, legacyData.sourceKeys, importedCount)

  return importedCount
}

/**
 * Record that migration was performed.
 */
export async function markMigrationComplete(currentUid, sourceKeys, transactionCount) {
  await setDoc(MIGRATION_DOC, {
    importedAt: new Date().toISOString(),
    importedBy: currentUid,
    sourceKeys: sourceKeys || [],
    transactionCount: transactionCount || 0,
  })
}
