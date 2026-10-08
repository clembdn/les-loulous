import { useEffect, useState } from 'react'
import { Globe2, Loader2, MapPin, Mountain, Search } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useDebounced } from '@/shared/lib/useDebounced.js'
import { useOnline } from '@/shared/lib/useOnline.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { addVisited } from '../../services/worldService.js'
import { photonAreas, photonUrl } from '../../utils/photon.js'

const KIND_ICON = { country: Globe2, island: Mountain, place: MapPin }

/**
 * « Ajouter un pays ou un lieu » déjà visité, hors de l'app : un pays entier
 * (« Japon »), ou juste une île ou une ville (« Ouvéa ») — seule elle
 * s'allumera. Recherche Photon (OpenStreetMap), noms en français.
 */
export default function AddVisitedSheet({ open, onClose, meta, onAdded }) {
  const { currentUid } = useAuth()
  const online = useOnline()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 300)
  const [state, setState] = useState({ status: 'idle', results: [] })

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (debounced.length < 2 || !online) {
      setState({ status: 'idle', results: [] })
      return undefined
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, status: 'loading' }))
    fetch(photonUrl(debounced, { limit: 10 }), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Photon ${res.status}`))))
      .then((body) => setState({ status: 'done', results: photonAreas(body).slice(0, 7) }))
      .catch((err) => { if (err.name !== 'AbortError') setState({ status: 'error', results: [] }) })
    return () => controller.abort()
  }, [debounced, online])

  function pick(area) {
    addVisited(area, meta, currentUid).catch(() => toast.error('Enregistrement impossible'))
    toast.success(`${area.name} ajouté${area.kind === 'island' ? 'e' : ''} à la carte`)
    onAdded?.(area)
    onClose()
  }

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Ajouter un pays ou un lieu"
      description="Déjà visité, avant l’app ou sans elle"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Japon, Ouvéa, Kyoto…"
            autoFocus
            className="pl-10"
            aria-label="Pays, île ou ville"
          />
          {state.status === 'loading' && (
            <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted animate-spin" />
          )}
        </div>

        {!online && <p className="text-[14px] text-amber-700">La recherche demande du réseau.</p>}
        {state.status === 'error' && <p className="text-[14px] text-danger">Recherche impossible pour l’instant.</p>}
        {state.status === 'done' && state.results.length === 0 && (
          <p className="text-[14px] text-muted">Aucun pays ni lieu à ce nom.</p>
        )}

        {state.results.length > 0 && (
          <ul className="-mx-2">
            {state.results.map((area) => {
              const Icon = KIND_ICON[area.kind]
              return (
                <li key={`${area.name}-${area.lat}-${area.lng}`}>
                  <button
                    type="button"
                    onClick={() => pick(area)}
                    className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 transition"
                  >
                    <span className="h-10 w-10 shrink-0 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <Icon size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-fg truncate">{area.name}</span>
                      <span className="block text-[13px] text-muted truncate">
                        {area.label}{area.detail ? ` · ${area.detail}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {state.status === 'idle' && online && (
          <p className="text-[13px] text-muted">
            Un pays entier s’allume en entier. Une île ou une ville : seulement elle — Ouvéa n’allume pas toute la France.
          </p>
        )}
      </div>
    </ThemedSheet>
  )
}
