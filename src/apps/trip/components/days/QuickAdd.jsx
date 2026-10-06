import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ClipboardPaste, Clock, Loader2, MapPin, MapPinOff, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { getCategory } from '../../config/categories.js'
import { useAddStop } from '../../hooks/useAddStop.js'
import { usePlaceSearch } from '../../hooks/usePlaceSearch.js'
import { resolveMapsLink } from '../../services/placesService.js'
import { guessCategory } from '../../utils/categoryGuess.js'
import { isMapsUrl } from '../../utils/mapsUrl.js'
import { parseQuickAdd } from '../../utils/quickAdd.js'

const MAX_SUGGESTIONS = 5

/**
 * La saisie rapide, en bas de la frise : on tape un lieu, on choisit une
 * suggestion, c'est ajouté — et le champ est prêt pour le suivant. Pas de
 * formulaire pour 80 % des étapes.
 *
 *  · « 10h30 Tour de Belém » : l'heure est lue dans la saisie ;
 *  · un lien Google Maps collé (ou « Coller ») est lu et ajouté aussitôt ;
 *  · Entrée prend la suggestion en surbrillance (la première par défaut),
 *    ↑ ↓ pour en changer, Échap pour vider ;
 *  · sans réseau, ou sans trouver, on ajoute le nom tel quel : il se
 *    localisera plus tard.
 *
 * `near` oriente la recherche vers les lieux du jour. Le parent peut donner
 * le focus (`ref.focus()`, raccourci N sur ordinateur).
 */
const QuickAdd = forwardRef(function QuickAdd({ date, near = null, disabled = false, className }, ref) {
  const addStop = useAddStop()
  const inputRef = useRef(null)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [reading, setReading] = useState(false)
  // Entrée tapée avant l'arrivée des suggestions : on attend la réponse
  // plutôt que d'ajouter le nom sans position.
  const [pendingEnter, setPendingEnter] = useState(false)
  const blurTimer = useRef(null)

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), [])

  const { time, query } = parseQuickAdd(text)
  const search = usePlaceSearch(query, { near, enabled: focused && !reading })
  const results = search.results.slice(0, MAX_SUGGESTIONS)
  const canAddRaw = query.length >= 2
  // Les suggestions, puis « tel quel » en dernier recours.
  const options = [...results, ...(canAddRaw ? [{ raw: true, name: query }] : [])]
  const open = focused && !reading && canAddRaw

  useEffect(() => {
    if (!pendingEnter || search.loading) return
    setPendingEnter(false)
    if (canAddRaw) add(options[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEnter, search.loading])

  function reset() {
    setText('')
    setHighlight(0)
  }

  function add(option) {
    if (!option) return
    const place = option.raw ? { name: option.name } : option
    if (addStop(date, place, { time })) reset()
    inputRef.current?.focus()
  }

  async function readLink(link) {
    setReading(true)
    setText(link)
    const read = await resolveMapsLink(link).catch(() => null)
    setReading(false)
    if (!read?.place?.name) {
      toast.error(read?.message || 'Ce lien n’a pas pu être lu : tapez le nom du lieu.')
      setText('')
      return
    }
    if (addStop(date, { ...read.place, category: guessCategory({ name: read.place.name }) })) reset()
    // Pas localisé, ou seulement à peu près : le dire.
    if (read.message) toast(read.message)
  }

  function change(value) {
    if (isMapsUrl(value.trim())) {
      readLink(value.trim())
      return
    }
    setText(value)
    setHighlight(0)
  }

  async function paste() {
    try {
      const value = (await navigator.clipboard.readText()).trim()
      if (!value) throw new Error('vide')
      if (isMapsUrl(value)) readLink(value)
      else {
        setText(value)
        inputRef.current?.focus()
      }
    } catch {
      inputRef.current?.focus()
      toast('Collez le lien dans le champ : appui long, puis « Coller ».')
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      setHighlight((h) => Math.min(options.length - 1, h + 1))
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!open) return
      if (search.loading) setPendingEnter(true)
      else add(options[Math.min(highlight, options.length - 1)])
    } else if (e.key === 'Escape') {
      if (text) reset()
      else inputRef.current?.blur()
    }
  }

  function onFocus() {
    clearTimeout(blurTimer.current)
    setFocused(true)
    // Sur téléphone, le clavier couvre le bas de l'écran : on remonte le
    // champ en haut pour laisser la place aux suggestions.
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 280)
    }
  }

  function onBlur() {
    // Un clic sur une suggestion fait d'abord perdre le focus : on laisse
    // le temps au clic d'arriver.
    blurTimer.current = setTimeout(() => setFocused(false), 150)
  }

  const listId = `quick-add-${date}`

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label className="relative flex-1 min-w-0 h-12 flex items-center gap-2.5 rounded-xl bg-surface-2 pl-3 pr-3 focus-within:ring-2 focus-within:ring-accent transition scroll-mt-16">
          {reading || search.loading
            ? <Loader2 size={18} className="shrink-0 text-muted animate-spin" aria-hidden="true" />
            : <Plus size={18} className="shrink-0 text-accent" aria-hidden="true" />}
          <span className="sr-only">Ajouter un lieu à cette journée</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={disabled || reading}
            placeholder={disabled ? 'Journée complète' : 'Ajouter un lieu… (ex. 10h30 Tour de Belém)'}
            enterKeyHint="done"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-fg placeholder:text-muted focus:outline-none disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={paste}
          disabled={disabled || reading}
          className="shrink-0 h-12 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-surface-2 text-[14px] font-medium text-accent transition hover:bg-border disabled:opacity-50"
          title="Coller un lien Google Maps"
        >
          <ClipboardPaste size={16} /> Coller
        </button>
      </div>

      {reading && <p className="mt-1.5 px-1 text-[13px] text-muted">Lecture du lien Google Maps…</p>}
      {!reading && time && query && (
        <p className="mt-1.5 px-1 inline-flex items-center gap-1.5 text-[13px] text-muted">
          <Clock size={13} aria-hidden="true" /> À <span className="font-mono font-semibold text-fg">{time}</span>
        </p>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="mt-2 rounded-2xl bg-surface shadow-[0_6px_24px_rgb(17_20_27/0.12)] ring-1 ring-border overflow-hidden"
        >
          {options.map((option, i) => {
            const category = option.raw ? null : getCategory(option.category)
            const Icon = option.raw ? MapPinOff : category.icon
            return (
              <li key={option.raw ? 'raw' : `${option.lat},${option.lng},${option.name}`} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(option)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'w-full min-h-12 flex items-start gap-3 px-3.5 py-2.5 text-left transition',
                    i === highlight ? 'bg-surface-2' : 'bg-surface',
                    i > 0 && 'border-t border-border',
                  )}
                >
                  <span
                    className={cn('mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center', option.raw ? 'bg-surface-2 text-muted' : 'text-white')}
                    style={option.raw ? undefined : { backgroundColor: category.color }}
                  >
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-fg truncate">
                      {option.raw ? `Ajouter « ${option.name} »` : option.name}
                    </span>
                    <span className="block text-[13px] text-muted truncate">
                      {option.raw
                        ? (search.online ? 'Sans position pour l’instant' : 'Hors-ligne : à localiser plus tard')
                        : [category.id !== 'other' && category.label, option.address].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {!option.raw && <MapPin size={14} className="ml-auto mt-1.5 shrink-0 text-muted" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open && search.failed && (
        <p className="mt-1.5 px-1 text-[13px] text-amber-800">Recherche indisponible pour l’instant.</p>
      )}
    </div>
  )
})

export default QuickAdd
