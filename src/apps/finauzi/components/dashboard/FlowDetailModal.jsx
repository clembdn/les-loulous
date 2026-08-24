import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogBody } from '@/shared/ui/dialog.jsx'
import { getCategory } from '../../config/categories.js'
import { getAccountCurrency } from '../../config/accounts.js'
import { TRANSFER_KINDS, getFlowEntries, groupEntriesByCategory } from '../../utils/ledger.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { useUI } from '../../context/UIContext.jsx'
import DonutChart, { collapseSlices } from '../chart/DonutChart.jsx'
import TransactionRow from '../transactions/TransactionRow.jsx'

// Le détail derrière « Revenus » et « Dépenses ». Un total sans son détail
// n'apprend rien : la question suivante est toujours « à cause de quoi ? ».
//
// Trois niveaux, du plus gros au plus fin : le camembert donne les
// proportions, la légende les montants par catégorie, et déplier une
// catégorie sort les échéances qui la composent — la même ligne que dans
// l'historique, cliquable pour corriger la transaction sur place.
export default function FlowDetailModal({ open, onClose, flow, periodLabel, accountId = null, from, to }) {
  const { transactions, settings } = useAppData()
  const { format, formatNative } = useCurrency()
  const { openForm } = useUI()
  const [activeKey, setActiveKey] = useState(null)
  const [expandedKey, setExpandedKey] = useState(null)

  const isIn = flow === 'in'
  const currency = accountId ? getAccountCurrency(accountId) : 'EUR'
  const money = accountId ? (v) => formatNative(v, currency) : format

  const groups = useMemo(() => {
    if (!open) return []
    const entries = getFlowEntries(transactions, {
      accountId,
      from,
      to,
      rate: settings.eurToAud,
      currency,
      flow,
    })
    return groupEntriesByCategory(entries)
  }, [open, transactions, accountId, from, to, settings.eurToAud, currency, flow])

  const total = groups.reduce((sum, g) => sum + g.amount, 0)

  const slices = useMemo(
    () => collapseSlices(groups.map((group) => {
      const { label, hex } = describeGroup(group)
      return { key: group.key, label, value: group.amount, hex }
    })),
    [groups],
  )

  const editTransaction = (tx) => {
    onClose()
    openForm(tx)
  }

  const now = new Date()

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        title={`${isIn ? 'Revenus' : 'Dépenses'} · ${periodLabel.toLowerCase()}`}
        className="sm:max-w-lg"
      >
        <DialogBody className="pb-6">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">
              Rien sur cette période.
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                <DonutChart
                  slices={slices}
                  total={total}
                  formatValue={money}
                  activeKey={activeKey}
                  onActiveKeyChange={setActiveKey}
                  centerLabel={isIn ? 'Encaissé' : 'Dépensé'}
                  className="w-40 h-40 sm:w-44 sm:h-44 mx-auto flex-shrink-0"
                />
                <ul className="flex-1 min-w-0 space-y-1.5">
                  {slices.map((slice) => (
                    <li key={slice.key}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveKey(slice.key)}
                        onMouseLeave={() => setActiveKey(null)}
                        onClick={() => setActiveKey(activeKey === slice.key ? null : slice.key)}
                        className={`w-full flex items-center gap-2 text-left rounded-lg px-2 py-1 transition ${
                          activeKey === slice.key ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ background: slice.hex }}
                        />
                        <span className="text-xs text-white/70 truncate flex-1">{slice.label}</span>
                        <span className="text-xs text-white/35 tabular flex-shrink-0">
                          {Math.round((slice.value / total) * 100)}%
                        </span>
                        <span className="text-xs font-semibold text-white tabular flex-shrink-0 w-20 text-right">
                          {money(slice.value)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-1">
                {groups.map((group) => {
                  const { label, icon: Icon, bgClass, textClass } = describeGroup(group)
                  const expanded = expandedKey === group.key
                  return (
                    <div key={group.key} className="rounded-2xl bg-white/[0.02] border border-white/5">
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expanded ? null : group.key)}
                        className="w-full flex items-center gap-3 px-3 py-3 text-left"
                        aria-expanded={expanded}
                      >
                        <span className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${bgClass} ${textClass}`}>
                          <Icon size={14} strokeWidth={2.2} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-white truncate">{label}</span>
                          <span className="block text-[11px] text-white/35">
                            {group.entries.length} {group.entries.length > 1 ? 'mouvements' : 'mouvement'}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-white tabular flex-shrink-0">
                          {money(group.amount)}
                        </span>
                        <ChevronDown
                          size={15}
                          className={`text-white/30 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {expanded && (
                        <div className="px-1 pb-1">
                          {group.entries.map((entry, i) => (
                            <TransactionRow
                              key={`${entry.tx.id}-${i}`}
                              tx={entry.tx}
                              date={entry.date}
                              isForecast={entry.date > now}
                              onClick={() => editTransaction(entry.tx)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

// Un groupe se présente comme sa catégorie, sauf les virements : leur nature
// (apport / retrait / règlement) dit bien plus que le mot « virement ».
function describeGroup(group) {
  const category = getCategory(group.categoryId)
  if (group.kind === 'transfer') {
    const kind = TRANSFER_KINDS[group.key]
    return { ...category, label: kind ? kind.label : category.label }
  }
  return category
}
