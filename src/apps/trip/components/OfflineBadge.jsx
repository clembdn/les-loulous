import { CircleCheck, CloudOff } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useOnline } from '@/shared/lib/useOnline.js'
import { useToday } from '@/shared/lib/useToday.js'
import { useSyncedAt } from '../hooks/useSyncedAt.js'
import { formatSyncTime } from '../utils/format.js'

/**
 * « Disponible hors-ligne · synchro 14:32 » : le voyage a été lu en entier
 * depuis le serveur à cette heure-là, captures comprises — on peut couper le
 * réseau. Sans réseau : « Hors-ligne · synchro 14:32 », l'âge de ce qu'on lit.
 */
export default function OfflineBadge({ tripId, className }) {
  const syncedAt = useSyncedAt(tripId)
  const online = useOnline()
  // « hier 14:32 » doit basculer à minuit, même écran ouvert.
  useToday()

  if (!syncedAt && online) return null
  return (
    <p className={cn('inline-flex items-center gap-1.5 text-xs', online ? 'text-muted' : 'text-amber-700', className)}>
      {online
        ? <CircleCheck size={13} className="shrink-0 text-emerald-600" aria-hidden="true" />
        : <CloudOff size={13} className="shrink-0" aria-hidden="true" />}
      <span>
        {online ? 'Disponible hors-ligne' : 'Hors-ligne'}
        {syncedAt && <span className="tabular"> · synchro {formatSyncTime(syncedAt)}</span>}
      </span>
    </p>
  )
}
