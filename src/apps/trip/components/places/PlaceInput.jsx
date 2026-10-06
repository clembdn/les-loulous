import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, MapPin, Search, X } from 'lucide-react'
import { useOnline } from '@/shared/lib/useOnline.js'
import { cn } from '@/shared/lib/utils.js'
import { Input } from '@/shared/ui/Input.jsx'
import { getCategory } from '../../config/categories.js'
import { usePlaceSearch } from '../../hooks/usePlaceSearch.js'
import { resolveMapsLink } from '../../services/placesService.js'
import { isMapsUrl, looksLikeUrl } from '../../utils/mapsUrl.js'
import { hasCoords } from '../../utils/geo.js'

const EMPTY_PLACE = { name: '', address: null, lat: null, lng: null, mapsUrl: null }
const MAX_SUGGESTIONS = 5

/**
 * UN champ pour un lieu : son nom, et de quoi le localiser.
 *
 *  · on COLLE un lien Google Maps → nom et position remplis tout seuls ;
 *  · on TAPE → des suggestions arrivent pendant la frappe (OpenStreetMap),
 *    on en touche une ; sinon le texte reste le nom ;
 *  · renommer un lieu déjà localisé garde sa position ;
 *  · un lieu sans position : « Localiser » le cherche par son nom.
 * Sans réseau rien ne bloque : le nom (et le lien) sont gardés, la position
 * viendra plus tard.
 *
 * `value` : `{ name, address, lat, lng, mapsUrl }`. `onPick(found)` reçoit
 * en plus la suggestion choisie, catégorie devinée comprise (la fiche d'une
 * étape s'en sert). `near` biaise la recherche. Remonter le composant
 * (`key`) pour l'ouvrir sur un autre lieu.
 */
export default function PlaceInput({ value, onChange, onPick, placeholder = 'Lien Google Maps ou nom du lieu', near = null, autoFocus = false }) {
  const place = value || EMPTY_PLACE
  const online = useOnline()
  const inputRef = useRef(null)
  const [draft, setDraft] = useState(place.name || '')
  // Des suggestions seulement pour ce qu'on vient de taper, pas pour le nom
  // d'un lieu qu'on ouvre déjà localisé.
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const lastLink = useRef(null)
  const blurTimer = useRef(null)

  const located = hasCoords(place)
  const search = usePlaceSearch(draft, { near, enabled: searching && focused && !busy })
  const results = search.results.slice(0, MAX_SUGGESTIONS)

  // Le nom peut changer de l'extérieur (formulaire réinitialisé, lieu choisi
  // ailleurs) : le champ le suit — sauf s'il contient un lien en cours de
  // lecture, qu'on ne remplace pas par l'ancien nom.
  useEffect(() => {
    setDraft((current) => (looksLikeUrl(current) ? current : place.name || ''))
  }, [place.name])

  async function readLink(text) {
    lastLink.current = text
    setBusy(true)
    setSearching(false)
    setMessage(null)
    const read = await resolveMapsLink(text)
    // Un autre collage est arrivé entre-temps : sa réponse prime.
    if (lastLink.current !== text) return
    setBusy(false)
    if (!read) {
      setDraft(place.name || '')
      setMessage('Ce lien n’est pas un lien Google Maps.')
      return
    }
    const name = read.place.name || place.name || ''
    onChange({ ...read.place, name })
    onPick?.({ ...read.place, name })
    setDraft(name)
    setMessage(read.message)
  }

  function changeText(text) {
    if (looksLikeUrl(text)) {
      setDraft(text)
      if (isMapsUrl(text)) readLink(text.trim())
      return
    }
    setDraft(text)
    setMessage(null)
    setSearching(true)
    onChange({ ...place, name: text })
  }

  function pick(found) {
    const next = { name: found.name, address: found.address, lat: found.lat, lng: found.lng, mapsUrl: null }
    onChange(next)
    onPick?.(found)
    setDraft(found.name)
    setSearching(false)
    setMessage(null)
  }

  function clearLocation() {
    onChange({ ...place, address: null, lat: null, lng: null, mapsUrl: null })
    setMessage(null)
  }

  // « Localiser » : chercher le nom déjà saisi.
  function localize() {
    setSearching(true)
    inputRef.current?.focus()
  }

  const showResults = searching && focused && results.length > 0

  return (
    <div>
      <div className="relative">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => changeText(e.target.value)}
          onFocus={() => { clearTimeout(blurTimer.current); setFocused(true) }}
          onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 150) }}
          onKeyDown={(e) => {
            // Entrée prend la première suggestion au lieu d'envoyer le formulaire.
            if (e.key === 'Enter') {
              e.preventDefault()
              if (results[0]) pick(results[0])
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className="pr-10"
          maxLength={2000}
        />
        {(busy || search.loading) && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
        )}
      </div>

      {showResults && (
        <ul className="mt-2 rounded-xl bg-surface ring-1 ring-border shadow-[0_6px_24px_rgb(17_20_27/0.12)] divide-y divide-border overflow-hidden">
          {results.map((r) => {
            const category = getCategory(r.category)
            const Icon = r.category ? category.icon : MapPin
            return (
              <li key={`${r.lat},${r.lng},${r.name}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  className="w-full min-h-12 text-left px-3 py-2.5 hover:bg-surface-2 transition flex items-start gap-2.5"
                >
                  <span
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: r.category ? category.color : '#5A6270' }}
                  >
                    <Icon size={13} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-fg truncate">{r.name}</span>
                    {r.address && <span className="block text-[13px] text-muted truncate">{r.address}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-1.5 min-h-[1.25rem] flex items-start gap-1.5 text-[13px]">
        {busy && <span className="text-muted">Lecture du lien…</span>}
        {!busy && located && (
          <>
            <Check size={14} className="mt-px shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 text-muted truncate">
              {place.address || `Localisé · ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}
            </span>
            <button
              type="button"
              onClick={clearLocation}
              className="shrink-0 inline-flex items-center gap-0.5 text-muted hover:text-fg transition"
              title="Oublier la position"
            >
              <X size={13} /> Retirer
            </button>
          </>
        )}
        {!busy && !located && place.mapsUrl && online && (
          // Lien collé hors-ligne : on le relit maintenant qu'il y a du réseau.
          <button type="button" onClick={() => readLink(place.mapsUrl)} className="text-accent font-medium">
            Relire le lien Google Maps pour localiser le lieu
          </button>
        )}
        {!busy && !located && !place.mapsUrl && place.name && !message && !showResults && (
          online ? (
            <button type="button" onClick={localize} className="inline-flex items-center gap-1 text-accent font-medium">
              <Search size={13} /> Localiser « {place.name.length > 32 ? `${place.name.slice(0, 31)}…` : place.name} »
            </button>
          ) : (
            <span className="text-muted">Pas encore localisé : il le sera avec du réseau.</span>
          )
        )}
        {!busy && searching && focused && !search.loading && !results.length && draft.trim().length > 1 && online && !search.failed && (
          <span className="text-muted">Aucun lieu trouvé : essayez un nom plus précis, ou collez un lien Google Maps.</span>
        )}
        {!busy && search.failed && <span className="text-amber-800">Recherche impossible pour l’instant.</span>}
      </div>
      {message && <p className={cn('text-[13px]', located ? 'text-muted' : 'text-amber-800')}>{message}</p>}
    </div>
  )
}
