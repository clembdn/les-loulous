import { onSnapshot } from 'firebase/firestore'

/**
 * Une écoute Firestore qui dit AUSSI si ce qu'elle montre est confirmé par le
 * serveur — de quoi afficher « disponible hors-ligne · synchro 14:32 ».
 *
 * `includeMetadataChanges` réveille l'écoute quand seule la provenance change
 * (cache → serveur à l'ouverture, écriture acquittée, réseau perdu). Ces
 * réveils ne touchent pas aux données et ne doivent rien re-rendre : `onData`
 * ne part qu'au premier instantané et quand un document a vraiment changé,
 * `onSync(fromServer)` à chaque fois.
 *
 * « Confirmé » = venu du serveur ET sans écriture locale en attente : une
 * étape ajoutée hors-ligne n'est pas encore synchronisée.
 */
export function listen(ref, { onData, onSync, onError, label }) {
  let first = true
  return onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    if (first || snap.docChanges().length > 0) {
      first = false
      onData(snap)
    }
    onSync?.(!snap.metadata.fromCache && !snap.metadata.hasPendingWrites)
  }, (err) => {
    console.error(`[Trip] ${label} error:`, err)
    onError?.(err)
  })
}
