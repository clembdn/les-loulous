import { Check, CalendarClock, ChevronDown } from 'lucide-react'
import { getPerson, AUTHORIZED_UIDS } from '@/shared/config/people.js'
import { SPLIT_COMMON } from '../../config/accounts.js'
import { getCategoriesByType, getCategory } from '../../config/categories.js'
import { formatDateShort } from '../../utils/cashflow.js'
import { IMPORT_STATUS } from '../../utils/importMatch.js'

// Une ligne du relevé, relue avant d'être écrite.
//
// Seules les lignes vraiment nouvelles sont modifiables : celles que l'app
// connaît déjà s'affichent estompées, cochage impossible. C'est volontaire —
// pouvoir importer « quand même » une échéance déjà prévue serait exactement
// la façon de compter le loyer deux fois.

const STATUS_META = {
  [IMPORT_STATUS.NEW]: null,
  [IMPORT_STATUS.EXPECTED]: { label: 'Déjà prévue', className: 'text-sky-400 bg-sky-500/10 border-sky-500/25' },
  [IMPORT_STATUS.IMPORTED]: { label: 'Déjà importée', className: 'text-white/40 bg-white/5 border-white/10' },
}

export default function ImportRow({ row, money, userColors, onChange }) {
  const isNew = row.status === IMPORT_STATUS.NEW
  const status = STATUS_META[row.status]
  const category = getCategory(row.category)
  const Icon = category.icon

  return (
    <li
      className={`rounded-2xl border p-3 transition ${
        row.selected
          ? 'bg-white/[0.05] border-white/15'
          : 'bg-white/[0.02] border-white/5'
      } ${isNew ? '' : 'opacity-70'}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onChange({ selected: !row.selected })}
          disabled={!isNew}
          aria-label={row.selected ? 'Ne pas importer' : 'Importer'}
          className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border flex items-center justify-center transition ${
            row.selected
              ? 'bg-white border-white text-black'
              : 'border-white/20 text-transparent hover:border-white/40'
          } ${isNew ? '' : 'cursor-not-allowed'}`}
        >
          <Check size={13} strokeWidth={3} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <input
              value={row.title}
              onChange={(e) => onChange({ title: e.target.value })}
              disabled={!isNew}
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white truncate focus:outline-none focus:text-white disabled:text-white/60"
            />
            <span className={`text-sm font-semibold tabular flex-shrink-0 ${
              row.kind === 'income' ? 'text-emerald-400' : 'text-white'
            }`}>
              {row.kind === 'income' ? '+' : '−'}{money(row.amount)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/35 min-w-0">
            <span className="flex-shrink-0">{formatDateShort(row.line.date)}</span>
            <span>·</span>
            <span className="truncate">{row.line.label}</span>
          </div>

          {status && (
            <p className={`mt-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border ${status.className}`}>
              <CalendarClock size={11} />
              {status.label}
              {row.match && <span className="opacity-70">· {row.match.tx.title}</span>}
            </p>
          )}

          {isNew && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={`h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center ${category.bgClass} ${category.textClass}`}>
                <Icon size={12} strokeWidth={2.2} />
              </span>
              <Picker
                value={row.category}
                onChange={(value) => onChange({ category: value, categoryTouched: true })}
                options={getCategoriesByType(row.kind).map((c) => ({ value: c.id, label: c.label }))}
              />
              {row.kind === 'expense' && (
                <Picker
                  value={row.split}
                  onChange={(value) => onChange({ split: value })}
                  options={[
                    { value: SPLIT_COMMON, label: 'Commun' },
                    ...AUTHORIZED_UIDS.map((uid) => ({ value: uid, label: getPerson(uid, userColors).label })),
                  ]}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// Un `select` natif plutôt qu'un menu maison : c'est la roue du système sur
// mobile, donc utilisable d'une main sur une liste de quarante lignes.
function Picker({ value, onChange, options }) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 transition"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#11151C]">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 pointer-events-none text-white/40" />
    </span>
  )
}
