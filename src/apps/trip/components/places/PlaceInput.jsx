import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, MapPin, Search, X } from 'lucide-react'
import { useOnline } from '@/shared/lib/useOnline.js'
import { cn } from '@/shared/lib/utils.js'
import { Input } from '@/shared/ui/Input.jsx'
import { resolveMapsLink, searchPlaces } from '../../services/placesService.js'
import { isMapsUrl, looksLikeUrl } from '../../utils/mapsUrl.js'
import { hasCoords } from '../../utils/geo.js'

const EMPTY_PLACE = { name: '', address: null, lat: null, lng: null, mapsUrl: null }

/**
 * UN champ pour un lieu : son nom, et de quoi le localiser.
 *
 *  · on COLLE un lien Google Maps → nom et position remplis tout seuls ;
 *  · on TAPE un nom → c'est le nom ; « Chercher » le localise (OpenStreetMap) ;
 *  · renommer un lieu déjà localisé garde sa position.
 * Sans réseau rien ne bloque : le nom (et le lien) sont gardés, la position
 * viendra plus tard.
 *
 * `value` : `{ name, address, lat, lng, mapsUrl }`. `near` biaise la
 * recherche vers le voyage. Remonter le composant (`key`) pour l'ouvrir sur
 * un autre lieu.
 */
export default function PlaceInput({ value, onChange, placeholder = 'Lien Google Maps ou nom du lieu', near = null, autoFocus = false }) {
  const place = value || EMPTY_PLACE
  const online = useOnline()
  const [draft, setDraft] = useState(place.name || '')
  const [busy, setBusy] = useState(null) // 'link' | 'search' | null
  const [results, setResults] = useState(null)
  const [message, setMessage] = useState(null)
  const lastLink = useRef(null)

  const located = hasCoords(place)

  // Le nom peut changer de l'extérieur (formulaire réinitialisé, lieu choisi
  // ailleurs) : le champ le suit — sauf s'il contient un lien en cours de
  // lecture, qu'on ne remplace pas par l'ancien nom.
  useEffect(() => {
    setDraft((current) => (looksLikeUrl(current) ? current : place.name || ''))
  }, [place.name])

  async function readLink(text) {
    lastLink.current = text
    setBusy('link')
    setResults(null)
    setMessage(null)
    const read = await resolveMapsLink(text)
    // Un autre collage est arrivé entre-temps : sa réponse prime.
    if (lastLink.current !== text) return
    setBusy(null)
    if (!read) {
      setDraft(place.name || '')
      setMessage('Ce lien n’est pas un lien Google Maps.')
      return
    }
    const name = read.place.name || place.name || ''
    onChange({ ...read.place, name })
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
    onChange({ ...place, name: text })
  }

  async function search() {
    const query = draft.trim()
    if (!query || looksLikeUrl(query)) return
    setBusy('search')
    setMessage(null)
    try {
      const found = await searchPlaces(query, { near })
      setResults(found)
      if (!found.length) setMessage('Aucun lieu trouvé : essayez un nom plus précis, ou collez un lien Google Maps.')
    } catch {
      setMessage('Recherche impossible pour l’instant.')
    } finally {
      setBusy(null)
    }
  }

  function pick(found) {
    onChange({ name: found.name, address: found.address, lat: found.lat, lng: found.lng, mapsUrl: null })
    setDraft(found.name)
    setResults(null)
    setMessage(null)
  }

  function clearLocation() {
    onChange({ ...place, address: null, lat: null, lng: null, mapsUrl: null })
    setMessage(null)
  }

  const canSearch = draft.trim().length > 1 && !looksLikeUrl(draft) && online && busy === null

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Input
            value={draft}
            onChange={(e) => changeText(e.target.value)}
            onKeyDown={(e) => {
              // Entrée cherche au lieu d'envoyer le formulaire entier.
              if (e.key === 'Enter') {
                e.preventDefault()
                if (canSearch) search()
              }
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="pr-10"
            maxLength={2000}
          />
          {busy && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={search}
          disabled={!canSearch}
          title={online ? 'Chercher ce lieu sur la carte' : 'Recherche indisponible hors-ligne'}
          className="h-11 px-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface text-sm text-muted hover:text-fg hover:border-border-strong transition disabled:opacity-40 disabled:pointer-events-none"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Chercher</span>
        </button>
      </div>

      {results && results.length > 0 && (
        <ul className="mt-2 rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.name}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition flex items-start gap-2.5"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-faint" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg truncate">{r.name}</span>
                  {r.address && <span className="block text-xs text-muted truncate">{r.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1.5 min-h-[1.25rem] flex items-start gap-1.5 text-xs">
        {busy === 'link' && <span className="text-faint">Lecture du lien…</span>}
        {!busy && located && (
          <>
            <Check size={13} className="mt-px shrink-0 text-accent" />
            <span className="min-w-0 flex-1 text-muted truncate">
              {place.address || `Localisé · ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}
            </span>
            <button
              type="button"
              onClick={clearLocation}
              className="shrink-0 inline-flex items-center gap-0.5 text-faint hover:text-fg transition"
              title="Oublier la position"
            >
              <X size={12} /> Retirer
            </button>
          </>
        )}
        {!busy && !located && place.mapsUrl && online && (
          // Lien collé hors-ligne : on le relit maintenant qu'il y a du réseau.
          <button type="button" onClick={() => readLink(place.mapsUrl)} className="text-accent hover:underline">
            Relire le lien Google Maps pour localiser le lieu
          </button>
        )}
        {!busy && !located && !place.mapsUrl && place.name && !message && !results?.length && (
          <span className="text-faint">Pas encore localisé : collez un lien Google Maps ou cherchez le nom.</span>
        )}
      </div>
      {message && <p className={cn('text-xs', located ? 'text-muted' : 'text-amber-700')}>{message}</p>}
    </div>
  )
}
