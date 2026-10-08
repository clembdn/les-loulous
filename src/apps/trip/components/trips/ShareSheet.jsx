import { useState } from 'react'
import { Copy, Link2, Share2, Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useOnline } from '@/shared/lib/useOnline.js'
import { cn } from '@/shared/lib/utils.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripShares } from '../../context/TripSharesContext.jsx'
import { createShare, revokeShare } from '../../services/sharesService.js'
import { guestPath } from '../../utils/publicTrip.js'
import { formatSyncTime } from '../../utils/format.js'
import { copyValue } from '../CopyValue.jsx'

function linkOf(share) {
  return `${window.location.origin}${guestPath(share.id)}`
}

/**
 * Partager le voyage : un lien par personne (« Maman », « Les potes »), en
 * lecture seule, sans compte. Chacun se coupe sans toucher aux autres.
 *
 * L'invité voit TOUT, codes d'accès et prix compris : c'est dit ici, avant
 * de créer le lien, pas découvert après.
 */
export default function ShareSheet({ open, onClose }) {
  const { currentUid } = useAuth()
  const online = useOnline()
  const { tripId, trip } = useTripData()
  const { shares, isLoading } = useTripShares()
  const [label, setLabel] = useState('')
  const [created, setCreated] = useState(null)
  const [revoking, setRevoking] = useState(null)

  function create(e) {
    e.preventDefault()
    const name = label.trim()
    if (!name) return
    const { token, done } = createShare(tripId, name, currentUid)
    done.catch(() => toast.error('Création du lien impossible'))
    setCreated(token)
    setLabel('')
  }

  async function share(s) {
    const url = linkOf(s)
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.title, text: `${trip.title}, le voyage en lecture seule`, url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    copyValue('Lien', url)
  }

  function revoke() {
    revokeShare(tripId, revoking).catch(() => toast.error('Révocation impossible'))
    toast.success(`Lien de ${revoking.label} révoqué`)
    setRevoking(null)
  }

  function status(s) {
    if (s.publishedAt) return `Actif · mis à jour ${formatSyncTime(Date.parse(s.publishedAt))}`
    return online ? 'Publication en cours…' : 'Sera actif au retour du réseau'
  }

  return (
    <>
      <ThemedSheet
        open={open}
        onOpenChange={(o) => { if (!o) onClose() }}
        title="Partager le voyage"
        description="En lecture seule, sans compte"
      >
        <div className="space-y-5">
          <p className="text-[14px] text-muted">
            L’invité voit tout le voyage, <span className="text-fg font-medium">codes d’accès et prix compris</span>, et
            ses mises à jour en direct. Un lien par personne : vous pourrez couper l’un sans toucher aux autres.
          </p>

          <form onSubmit={create} className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Pour qui ? Maman, les potes…"
              maxLength={60}
              aria-label="Pour qui"
              className="flex-1"
            />
            <Button type="submit" disabled={!label.trim()} className="shrink-0">
              <Link2 size={15} /> Créer
            </Button>
          </form>

          {isLoading && <Skeleton className="h-16" />}

          {!isLoading && shares.length > 0 && (
            <ul className="rounded-2xl bg-surface-2 divide-y divide-border overflow-hidden">
              {shares.map((s) => (
                <li key={s.id} className={cn('px-3.5 py-3 flex items-center gap-3', s.id === created && 'bg-accent/10')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-fg truncate">{s.label}</p>
                    <p className={cn('text-[13px] tabular', s.publishedAt ? 'text-muted' : 'text-amber-700')}>{status(s)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => share(s)}
                    className="h-10 px-3 rounded-xl bg-accent text-accent-fg inline-flex items-center gap-1.5 text-[14px] font-semibold hover:opacity-90 transition"
                  >
                    {navigator.share ? <Share2 size={15} /> : <Copy size={15} />}
                    {navigator.share ? 'Envoyer' : 'Copier'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevoking(s)}
                    aria-label={`Révoquer le lien de ${s.label}`}
                    title="Révoquer"
                    className="h-10 w-10 rounded-xl inline-flex items-center justify-center text-muted hover:text-danger hover:bg-surface transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && shares.length === 0 && (
            <p className="text-[14px] text-muted text-center py-2">Aucun lien pour l’instant.</p>
          )}
        </div>
      </ThemedSheet>

      <ConfirmDialog
        open={!!revoking}
        title={revoking ? `Révoquer le lien de ${revoking.label} ?` : ''}
        message="Le lien affichera « Ce voyage n’est plus partagé ». Les autres liens continuent de marcher."
        confirmLabel="Révoquer"
        onConfirm={revoke}
        onClose={() => setRevoking(null)}
      />
    </>
  )
}
