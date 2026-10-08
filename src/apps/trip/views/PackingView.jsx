import { useMemo, useState } from 'react'
import { Backpack, ChevronRight, CircleCheck, Copy, ListChecks, MoreVertical, Plus } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { ThemedConfirm } from '@/shared/ui/ThemedSheet.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { PACKING_TEMPLATE } from '../config/packing.js'
import { usePackingActions } from '../hooks/usePacking.js'
import {
  filterPacking, groupPacking, guessPackingCategory, itemsToAdd, packingProgress, packingSuggestions,
} from '../utils/packing.js'
import PackingRow from '../components/packing/PackingRow.jsx'
import PackingItemSheet from '../components/packing/PackingItemSheet.jsx'
import CopyPackingSheet from '../components/packing/CopyPackingSheet.jsx'

const MENU_ROW = 'w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-[14px] text-fg hover:bg-surface-2 transition disabled:opacity-40 disabled:pointer-events-none'

/**
 * La valise, faite à deux (sur le modèle des courses de Cook'It) : les
 * affaires par catégorie, cochées d'un doigt, et ce qui est déjà rangé replié
 * en bas. Le filtre montre la valise d'une personne (ses affaires et les
 * communes) ; ce qu'on y ajoute est pour elle.
 *
 * Pour démarrer : la liste type, ou la valise d'un autre voyage. Pour le
 * retour : « Tout décocher », et on refait la valise.
 */
export default function PackingView() {
  const { currentUid } = useAuth()
  const { trip, packing, isLoading } = useTripData()
  const actions = usePackingActions()
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState({ item: null, nonce: 0, open: false })
  const [copyOpen, setCopyOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [packedOpen, setPackedOpen] = useState(false)

  const shown = useMemo(() => filterPacking(packing, filter), [packing, filter])
  const todo = useMemo(() => groupPacking(shown.filter((it) => !it.checked)), [shown])
  const packed = useMemo(() => shown.filter((it) => it.checked).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [shown])
  const progress = packingProgress(shown)
  const owner = filter === 'all' || filter === 'shared' ? null : filter

  const edit = (item) => setEditing((e) => ({ item, nonce: e.nonce + 1, open: true }))
  const addTemplate = () => actions.addMany(itemsToAdd(PACKING_TEMPLATE, packing), 'liste type')

  const filters = [
    { id: 'all', label: 'Tout' },
    { id: 'shared', label: 'Commun' },
    // La sienne d'abord.
    ...[...AUTHORIZED_UIDS].sort((a, b) => (b === currentUid) - (a === currentUid)).map((uid) => {
      const person = getPerson(uid)
      return { id: uid, label: person.label, color: person.color }
    }),
  ]

  const empty = !isLoading && packing.length === 0

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto px-3 lg:px-8 pt-4 lg:pt-7 pb-28 lg:pb-12">
      <header className="px-1 lg:px-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hidden lg:block text-[13px] font-semibold text-muted truncate">{trip.title}</p>
          <h1 className="text-[30px] leading-9 lg:text-[28px] font-bold lg:font-semibold tracking-[-0.02em] text-fg lg:mt-0.5">Valise</h1>
        </div>
        {!empty && (
          <div className="relative shrink-0 mt-1">
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="Plus d’actions" className="h-10 w-10 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition">
              <MoreVertical size={19} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 w-64 rounded-xl border border-border bg-surface shadow-lift py-1">
                  <button type="button" className={MENU_ROW} onClick={() => { setMenuOpen(false); actions.uncheckAll(packing) }} disabled={!packing.some((it) => it.checked)}>
                    <ListChecks size={16} className="text-muted" /> Tout décocher (refaire la valise)
                  </button>
                  <button type="button" className={MENU_ROW} onClick={() => { setMenuOpen(false); addTemplate() }}>
                    <Plus size={16} className="text-muted" /> Ajouter la liste type
                  </button>
                  <button type="button" className={MENU_ROW} onClick={() => { setMenuOpen(false); setCopyOpen(true) }}>
                    <Copy size={16} className="text-muted" /> Reprendre une autre valise
                  </button>
                  <button type="button" className={cn(MENU_ROW, 'text-danger')} onClick={() => { setMenuOpen(false); setConfirmClear(true) }}>
                    Tout supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="mt-4 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : empty ? (
        <div className="mt-6 rounded-2xl bg-surface px-6 py-10 text-center">
          <span className="mx-auto h-12 w-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
            <Backpack size={22} />
          </span>
          <p className="mt-3 text-[16px] font-semibold text-fg">La valise est vide</p>
          <p className="mt-1 text-[14px] text-muted">Partez de l’essentiel, ou de la valise d’un voyage passé.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={addTemplate}><ListChecks size={16} /> Partir de la liste type</Button>
            <Button variant="secondary" onClick={() => setCopyOpen(true)}><Copy size={16} /> Reprendre une autre valise</Button>
          </div>
          <div className="mt-6 text-left">
            <PackingAdd packing={packing} owner={null} onAdd={actions.add} />
          </div>
        </div>
      ) : (
        <>
          <Progress progress={progress} />

          <div className="mt-3 -mx-3 px-3 lg:mx-0 lg:px-0 flex gap-1.5 overflow-x-auto no-scrollbar">
            {filters.map((f) => {
              const p = packingProgress(filterPacking(packing, f.id))
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={cn(
                    'shrink-0 h-9 px-3.5 rounded-full border text-[14px] inline-flex items-center gap-1.5 transition',
                    active ? 'bg-fg border-fg text-bg font-medium' : 'bg-surface border-border text-fg',
                  )}
                >
                  {f.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color }} />}
                  {f.label}
                  <span className={cn('tabular text-[12px]', active ? 'text-bg/70' : 'text-muted')}>{p.done}/{p.total}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-3 lg:max-w-xl">
            <PackingAdd packing={packing} owner={owner} onAdd={actions.add} />
          </div>

          {todo.length === 0 ? (
            <p className="mt-6 flex items-center justify-center gap-2 text-[15px] font-medium text-emerald-700">
              <CircleCheck size={18} /> Tout est dans la valise
            </p>
          ) : (
            <div className="mt-4 lg:columns-2 lg:gap-x-6">
              {todo.map(({ category, items }) => (
                <section key={category.id} className="mb-3 break-inside-avoid rounded-2xl bg-surface px-1.5 py-2">
                  <h2 className="px-2 pb-1 flex items-center gap-2 text-[13px] font-semibold text-muted">
                    <category.icon size={15} style={{ color: category.color }} /> {category.label}
                    <span className="font-normal tabular">{items.length}</span>
                  </h2>
                  <ul>
                    {items.map((it) => <PackingRow key={it.id} item={it} onToggle={actions.toggle} onEdit={edit} />)}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {packed.length > 0 && (
            <section className="mt-3 lg:max-w-xl rounded-2xl bg-surface px-1.5 py-1.5">
              <button
                type="button"
                onClick={() => setPackedOpen((o) => !o)}
                aria-expanded={packedOpen}
                className="w-full h-10 px-2 flex items-center gap-1.5 text-[14px] text-muted hover:text-fg transition"
              >
                <ChevronRight size={16} className={cn('transition-transform', packedOpen && 'rotate-90')} />
                Dans la valise ({packed.length})
              </button>
              {packedOpen && (
                <ul>
                  {packed.map((it) => <PackingRow key={it.id} item={it} onToggle={actions.toggle} onEdit={edit} />)}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <PackingItemSheet
        key={`packing-${editing.nonce}`}
        open={editing.open}
        item={editing.item}
        onClose={() => setEditing((e) => ({ ...e, open: false }))}
      />
      <CopyPackingSheet open={copyOpen} onClose={() => setCopyOpen(false)} />
      <ThemedConfirm
        open={confirmClear}
        title="Vider la valise ?"
        message={`Les ${packing.length} affaires de la liste seront supprimées.`}
        confirmLabel="Tout supprimer"
        onConfirm={() => actions.removeAll(packing)}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  )
}

function Progress({ progress }) {
  const ratio = progress.total ? progress.done / progress.total : 0
  return (
    <div className="mt-3 px-1 lg:px-0 lg:max-w-xl">
      <p className="text-[15px] text-muted tabular">
        <span className="font-semibold text-fg">{progress.done}</span> sur {progress.total} dans la valise
      </p>
      <div className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

/**
 * Ajouter une affaire : le nom, Entrée, c'est rangé dans sa catégorie
 * (devinée). Les suggestions viennent de la liste type, moins ce qui est là.
 */
function PackingAdd({ packing, owner, onAdd }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(() => packingSuggestions(text, packing), [text, packing])

  function add(name, category = null) {
    const clean = name.trim()
    if (!clean) return
    onAdd(clean, owner, category || guessPackingCategory(clean))
    setText('')
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(text) }} className="flex items-center gap-2">
        <label className="relative flex-1 min-w-0 h-12 flex items-center gap-2.5 rounded-xl bg-surface-2 lg:bg-surface pl-3 pr-3 focus-within:ring-2 focus-within:ring-accent transition">
          <Plus size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="sr-only">Ajouter une affaire</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={owner ? `Ajouter pour ${getPerson(owner).label}…` : 'Ajouter une affaire…'}
            maxLength={120}
            enterKeyHint="done"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-fg placeholder:text-muted focus:outline-none"
          />
        </label>
      </form>
      {(focused || text) && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s.name, s.category)}
              className="h-9 px-3 rounded-full border border-border bg-surface text-[14px] text-fg inline-flex items-center gap-1 hover:border-border-strong transition"
            >
              <Plus size={13} className="text-accent" /> {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
