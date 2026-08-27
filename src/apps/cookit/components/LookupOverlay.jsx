import { Loader2 } from 'lucide-react'

// Le scanner se ferme dès la détection, mais l'appel à Open Food Facts prend
// encore un instant. Sans ce voile, l'écran retombait sur la vue précédente
// sans rien dire — l'utilisateur ne savait pas si le scan avait marché.
export default function LookupOverlay({ open }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-bg/80 backdrop-blur-sm">
      <Loader2 size={26} className="animate-spin text-accent" />
      <p className="text-sm text-muted">Recherche du produit…</p>
    </div>
  )
}
