// Retour haptique — no-op partout où l'API n'existe pas (iOS Safari, desktop).
//
// Centralisé pour que le vocabulaire reste cohérent d'une app à l'autre : un
// cran de molette ne doit pas vibrer comme une validation.
const CAN_VIBRATE = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function buzz(pattern) {
  if (!CAN_VIBRATE) return
  try { navigator.vibrate(pattern) } catch { /* certains navigateurs refusent hors geste utilisateur */ }
}

/** Cran de molette, franchissement de seuil — le plus discret possible. */
export function tick() { buzz(4) }

/** Une action a été enregistrée (série validée, article coché). */
export function confirm() { buzz(12) }

/** Fin de minuteur : deux impulsions, reconnaissables poche fermée. */
export function alarm() { buzz([28, 90, 28]) }
