import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { searchFoodPhotos, hasPexelsKey } from '../services/pexelsService.js'

// Sélecteur de photo (Pexels) : recherche par titre de recette, l'utilisateur choisit une vignette.
export default function ImagePickerSheet({ open, initialQuery = '', onClose, onPick }) {
  const [q, setQ] = useState('')
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error | nokey

  async function run(query) {
    const term = String(query || '').trim()
    if (!term) return
    if (!hasPexelsKey()) { setStatus('nokey'); return }
    setStatus('loading')
    try {
      setPhotos(await searchFoodPhotos(term))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (!open) return
    setQ(initialQuery)
    setPhotos([])
    if (!hasPexelsKey()) setStatus('nokey')
    else if (initialQuery.trim()) run(initialQuery)
    else setStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Choisir une photo">
      {status === 'nokey' ? (
        <p className="text-sm text-muted py-6 text-center">
          Clé Pexels manquante. Ajoute <code className="text-fg">VITE_PEXELS_API_KEY</code> dans{' '}
          <code className="text-fg">.env</code> puis relance le serveur.
        </p>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); run(q) }} className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une photo…"
              aria-label="Rechercher une photo"
            />
            <Button type="submit" aria-label="Rechercher"><Search size={16} /></Button>
          </form>

          <div className="mt-4 min-h-[8rem]">
            {status === 'loading' ? (
              <p className="text-center text-muted py-10">Recherche…</p>
            ) : status === 'error' ? (
              <p className="text-center text-danger py-10">Erreur de recherche. Réessaie.</p>
            ) : status === 'done' && photos.length === 0 ? (
              <p className="text-center text-muted py-10">Aucune photo trouvée.</p>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPick(p.url)}
                    className="overflow-hidden rounded-lg border border-border hover:border-accent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    title={p.alt}
                  >
                    <img src={p.thumb} alt={p.alt} loading="lazy" className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-faint py-10 text-sm">Tape un mot-clé pour chercher une photo.</p>
            )}
          </div>

          <p className="mt-4 text-[11px] text-faint text-center">Photos fournies par Pexels</p>
        </>
      )}
    </Sheet>
  )
}
