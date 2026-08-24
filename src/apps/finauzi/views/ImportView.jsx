import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Upload, FileText, AlertTriangle, Loader2, X,
  CalendarClock, CheckCheck, HelpCircle,
} from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getOrderedAccounts, getAccount } from '../config/accounts.js'
import { getDefaultCategoryId } from '../config/categories.js'
import { decodeBankFile, parseBankFile } from '../utils/bankFile.js'
import { reconcileStatement, suggestCategories, summarize, IMPORT_STATUS } from '../utils/importMatch.js'
import { learnRule } from '../utils/importRules.js'
import ImportRow from '../components/import/ImportRow.jsx'
import { createTransactionsBatch } from '../services/transactionService.js'
import { updateSettings } from '../services/settingsService.js'
import { toast } from '@/shared/ui/sonner.jsx'

// FinAuzi — importer un relevé plutôt que ressaisir.
//
// Ni la Caisse d'Épargne ni CommBank ne se branchent gratuitement : leurs API
// (DSP2 en France, CDR en Australie) ne s'ouvrent qu'à un prestataire agréé,
// et l'agrément coûte bien plus qu'une app de couple. Les deux banques, en
// revanche, laissent télécharger le relevé pour rien.
//
// Un fichier par mois et par compte remplace donc la saisie ligne à ligne.
// Tout est lu dans le navigateur : le relevé ne part sur aucun serveur.

export default function ImportView() {
  const { transactions, settings, isLoading } = useAppData()
  const { currentUser } = useAuth()
  const { formatNative } = useCurrency()

  const orderedAccounts = useMemo(() => getOrderedAccounts(currentUser?.uid), [currentUser?.uid])
  const [accountId, setAccountId] = useState(() => orderedAccounts[1]?.id || orderedAccounts[0].id)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState(null)
  const [warning, setWarning] = useState(null)
  const [error, setError] = useState(null)
  const [isReading, setIsReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const inputRef = useRef(null)

  const account = getAccount(accountId)
  const currency = account.currency
  const money = (value) => formatNative(value, currency)

  const reset = useCallback(() => {
    setFile(null)
    setRows(null)
    setWarning(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const readFile = useCallback(async (picked, targetId = accountId) => {
    if (!picked) return
    const target = getAccount(targetId)
    setIsReading(true)
    setError(null)
    setWarning(null)
    try {
      const text = decodeBankFile(await picked.arrayBuffer())
      const parsed = parseBankFile(text)

      if (parsed.lines.length === 0) {
        setRows(null)
        setFile(picked)
        setError(
          parsed.error === 'no-date-column'
            ? "Aucune colonne de date reconnue. Réessaie en exportant en OFX, c'est le format le plus fiable."
            : 'Aucune opération lue dans ce fichier.',
        )
        return
      }

      // Le fichier est censé être celui du compte choisi. Si l'OFX annonce
      // une autre devise, c'est presque sûrement le mauvais compte — mieux
      // vaut le dire que d'écrire des dollars dans un compte en euros.
      if (parsed.currency && parsed.currency !== target.currency) {
        setWarning(`Ce relevé est en ${parsed.currency}, alors que ${target.label} est en ${target.currency}. Vérifie le compte sélectionné.`)
      } else if (parsed.format === 'csv') {
        setWarning("Fichier CSV : le dédoublonnage repose sur la date, le montant et le libellé. L'OFX porte un identifiant bancaire et le rend exact.")
      }

      const reconciled = reconcileStatement(parsed.lines, {
        transactions,
        accountId: targetId,
        rate: settings.eurToAud,
      })
      const withCategories = suggestCategories(reconciled, settings.importRules).map((row) => ({
        ...row,
        format: parsed.format,
        category: row.category || getDefaultCategoryId(row.kind),
        categoryTouched: false,
      }))

      setFile(picked)
      setRows(withCategories)
    } catch (err) {
      console.error('[FinAuzi] import:', err)
      setError("Fichier illisible. Exporte à nouveau depuis ta banque, en OFX de préférence.")
    } finally {
      setIsReading(false)
    }
  }, [transactions, accountId, settings.eurToAud, settings.importRules])

  // Changer de compte relit le fichier déjà déposé : le rapprochement dépend
  // du compte, mais le relevé, lui, n'a pas bougé.
  function switchAccount(id) {
    setAccountId(id)
    if (file && rows) readFile(file, id)
    else reset()
  }

  function patchRow(index, patch) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function setAllSelected(value) {
    setRows((current) => current.map((row) => (
      // Les lignes déjà connues restent hors du lot : les cocher recréerait
      // exactement ce que l'import est censé éviter.
      row.status === IMPORT_STATUS.NEW ? { ...row, selected: value } : row
    )))
  }

  function handleImport() {
    const selected = rows.filter((row) => row.selected)
    if (selected.length === 0) return

    const inputs = selected.map((row) => ({
      kind: row.kind,
      title: row.title,
      amount: row.amount,
      currency,
      fromAccount: row.kind === 'expense' ? accountId : null,
      toAccount: row.kind === 'income' ? accountId : null,
      split: row.split,
      recurrence: 'one-off',
      date: row.line.date,
      category: row.category,
      // Le libellé brut de la banque, gardé tel quel : c'est la seule preuve
      // de ce qui a vraiment été débité.
      notes: row.line.label,
      externalId: row.externalId,
      source: row.format,
    }))

    // Aucune attente ici : le cache Firestore est déjà à jour, et l'écriture
    // partira toute seule au retour du réseau.
    createTransactionsBatch(inputs, currentUser?.uid)
      .catch((err) => { console.error(err); toast.error(err.message || 'Erreur de synchronisation') })

    // Ce que l'utilisateur a corrigé à la main devient une règle : le même
    // commerçant tombera dans la bonne catégorie au prochain import.
    const learned = selected.reduce(
      (rules, row) => (row.categoryTouched ? learnRule(rules, row.line.label, row.category) : rules),
      settings.importRules || {},
    )
    if (learned !== (settings.importRules || {})) {
      updateSettings({ importRules: learned }, currentUser?.uid)
        .catch((err) => console.error('[FinAuzi] règles d\'import:', err))
    }

    toast.success(`${selected.length} transaction${selected.length > 1 ? 's' : ''} importée${selected.length > 1 ? 's' : ''}`)
    reset()
  }

  const stats = rows ? summarize(rows) : null

  // Rapprocher avant que les transactions ne soient chargées ferait passer
  // TOUT le relevé pour du nouveau — et créerait le doublon que cet écran
  // existe pour éviter.
  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Importer un relevé</h1>
            <p className="text-sm text-white/40 mt-1">
              Le fichier est lu sur cet appareil, rien n'est envoyé ailleurs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/10 text-white/60 hover:text-white transition"
          >
            <HelpCircle size={14} />
            Où le trouver ?
          </button>
        </div>

        {helpOpen && <HelpPanel />}

        {/* Le compte que le relevé concerne — c'est lui qui donne la devise. */}
        <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">Compte concerné</p>
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl overflow-x-auto">
          {orderedAccounts.map((item) => {
            const Icon = item.icon
            const active = item.id === accountId
            return (
              <button
                key={item.id}
                onClick={() => switchAccount(item.id)}
                className={`flex-1 min-w-fit inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  active ? `${item.bgClass} ${item.textClass}` : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Icon size={12} strokeWidth={2.4} />
                {item.short}
                <span className="text-[10px] opacity-60">{item.currency}</span>
              </button>
            )
          })}
        </div>

        {!rows && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              readFile(e.dataTransfer.files?.[0])
            }}
            className={`mt-5 rounded-2xl border border-dashed transition ${
              dragging ? 'border-white/40 bg-white/[0.06]' : 'border-white/15 bg-white/[0.02]'
            }`}
          >
            <label className="flex flex-col items-center justify-center gap-3 py-12 px-6 cursor-pointer text-center">
              <input
                ref={inputRef}
                type="file"
                accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx"
                className="sr-only"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
              {isReading ? (
                <Loader2 size={22} className="text-white/50 animate-spin" />
              ) : (
                <Upload size={22} className="text-white/40" />
              )}
              <span className="text-sm text-white font-medium">
                {isReading ? 'Lecture…' : 'Dépose ton relevé, ou choisis un fichier'}
              </span>
              <span className="text-xs text-white/35 max-w-sm">
                OFX de préférence — il porte un identifiant par opération, donc aucun doublon
                possible. CSV et QFX acceptés aussi.
              </span>
            </label>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2.5 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-sm text-red-200">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {rows && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-white/70 min-w-0">
                <FileText size={15} className="text-white/40 flex-shrink-0" />
                <span className="truncate max-w-[14rem]">{file?.name}</span>
              </span>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white transition"
              >
                <X size={13} /> Changer de fichier
              </button>
            </div>

            {warning && (
              <div className="mt-3 flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <StatTile label="À importer" value={stats.fresh} icon={Upload} className="text-white" />
              <StatTile label="Déjà prévues" value={stats.expected} icon={CalendarClock} className="text-sky-400" />
              <StatTile label="Déjà importées" value={stats.imported} icon={CheckCheck} className="text-white/40" />
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                {stats.total} opération{stats.total > 1 ? 's' : ''} lue{stats.total > 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-3 text-xs">
                <button onClick={() => setAllSelected(true)} className="text-white/50 hover:text-white transition">
                  Tout cocher
                </button>
                <button onClick={() => setAllSelected(false)} className="text-white/50 hover:text-white transition">
                  Rien
                </button>
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              {rows.map((row, index) => (
                <ImportRow
                  key={`${row.externalId}-${index}`}
                  row={row}
                  money={money}
                  userColors={settings.userColors}
                  onChange={(patch) => patchRow(index, patch)}
                />
              ))}
            </ul>

            {/* Barre d'action collante : la liste est longue, le bouton doit
                rester sous le pouce sans avoir à remonter. */}
            <div className="sticky bottom-20 lg:bottom-6 mt-6 z-20">
              <button
                onClick={handleImport}
                disabled={stats.selected === 0}
                className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-semibold shadow-lg shadow-black/40 disabled:opacity-30 disabled:shadow-none hover:scale-[1.01] active:scale-[0.99] transition"
              >
                {stats.selected === 0
                  ? 'Aucune ligne sélectionnée'
                  : `Importer ${stats.selected} transaction${stats.selected > 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, icon: Icon, className }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5">
      <div className="flex items-center gap-2 mb-1.5 text-white/40">
        <Icon size={13} />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-semibold tabular ${className}`}>{value}</p>
    </div>
  )
}

function HelpPanel() {
  return (
    <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/5 p-4 sm:p-5 space-y-4 text-sm">
      <Step
        bank="Caisse d'Épargne"
        className="text-amber-400"
        steps={[
          'Banque en ligne → compte → bouton Gérer',
          'Télécharger les opérations',
          'Format Money (.ofx) — ou Excel (.csv) à défaut',
        ]}
      />
      <Step
        bank="CommBank"
        className="text-sky-400"
        steps={[
          'NetBank sur ordinateur (l\'app mobile ne propose pas l\'export)',
          'Ouvrir le compte → Export transactions',
          'Format OFX — 600 opérations et 2 ans maximum par fichier',
        ]}
      />
    </div>
  )
}

function Step({ bank, className, steps }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider ${className}`}>{bank}</p>
      <ol className="mt-1.5 space-y-1 text-xs text-white/50">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-2">
            <span className="text-white/25 tabular flex-shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
