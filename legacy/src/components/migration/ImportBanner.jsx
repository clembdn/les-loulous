// ImportBanner — shown when legacy localStorage data is detected.
import { useState } from 'react'
import { Download, X, Database, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { FINAUZI_PEOPLE, getPersonByUid } from '../../config/people.js'
import {
  detectLegacyLocalStorageData,
  getFirestoreTransactionCount,
  importLegacyLocalStorageData,
  hasMigrationAlreadyRun,
} from '../../services/migrationService.js'

export default function ImportBanner() {
  const { currentUser } = useAuth()
  const [state, setState] = useState('idle') // idle | checking | found | importing | done | dismissed | error
  const [legacyData, setLegacyData] = useState(null)
  const [selectedPersonUid, setSelectedPersonUid] = useState(currentUser?.uid)
  const [importedCount, setImportedCount] = useState(0)

  // Check for legacy data on mount
  useState(() => {
    checkForLegacyData()
  })

  async function checkForLegacyData() {
    setState('checking')
    try {
      const alreadyRun = await hasMigrationAlreadyRun()
      if (alreadyRun) {
        setState('dismissed')
        return
      }

      const legacy = detectLegacyLocalStorageData()
      if (!legacy || legacy.transactions.length === 0) {
        setState('dismissed')
        return
      }

      const firestoreCount = await getFirestoreTransactionCount()
      if (firestoreCount >= legacy.transactions.length) {
        setState('dismissed')
        return
      }

      setLegacyData(legacy)
      setState('found')
    } catch (err) {
      console.warn('[FinAuzi] Migration check error:', err)
      setState('dismissed')
    }
  }

  async function handleImport() {
    if (!legacyData || !currentUser) return
    setState('importing')
    try {
      const count = await importLegacyLocalStorageData(legacyData, currentUser.uid, selectedPersonUid)
      setImportedCount(count)
      setState('done')
    } catch (err) {
      console.error('[FinAuzi] Import error:', err)
      setState('error')
    }
  }

  if (state === 'idle' || state === 'checking' || state === 'dismissed') return null

  if (state === 'done') {
    return (
      <div className="mx-4 sm:mx-0 mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-400">
              Import terminé — {importedCount} transaction{importedCount !== 1 ? 's' : ''} importée{importedCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Les données sont maintenant synchronisées avec Firebase.</p>
          </div>
          <button onClick={() => setState('dismissed')} className="p-1.5 text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="mx-4 sm:mx-0 mb-4 rounded-2xl border border-rose-500/25 bg-rose-500/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-sm font-medium text-rose-400 flex-1">
            Erreur lors de l'import. Réessayez plus tard.
          </p>
          <button onClick={() => setState('dismissed')} className="p-1.5 text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
        </div>
      </div>
    )
  }

  // state === 'found' || state === 'importing'
  return (
    <div className="mx-4 sm:mx-0 mb-4 rounded-2xl border border-brand/25 bg-brand/5 px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-brand-glow shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Des données locales ont été trouvées</p>
          <p className="text-xs text-text-muted mt-0.5">
            {legacyData?.transactions.length} transaction{legacyData?.transactions.length !== 1 ? 's' : ''} détectée{legacyData?.transactions.length !== 1 ? 's' : ''} dans le stockage local.
            Voulez-vous les importer dans votre espace FinAuzi partagé ?
          </p>
        </div>
        <button onClick={() => setState('dismissed')} className="p-1.5 text-text-muted hover:text-text-primary shrink-0"><X className="h-4 w-4" /></button>
      </div>

      {/* Person attribution selector */}
      <div>
        <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
          Attribuer les anciennes transactions à :
        </p>
        <div className="flex p-0.5 rounded-xl bg-bg-elevated border border-border-subtle">
          {FINAUZI_PEOPLE.map(person => (
            <button
              key={person.uid}
              onClick={() => setSelectedPersonUid(person.uid)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                selectedPersonUid === person.uid
                  ? `${person.bg} ${person.text} shadow-sm`
                  : 'text-text-muted'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              {person.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleImport}
          disabled={state === 'importing'}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 shadow-glow transition-all disabled:opacity-60"
        >
          {state === 'importing' ? (
            <span className="inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {state === 'importing' ? 'Import en cours…' : 'Importer'}
        </button>
        <button
          onClick={() => setState('dismissed')}
          className="px-3 h-9 rounded-xl text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
