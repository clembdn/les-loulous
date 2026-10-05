// Les nuits d'un voyage et qui les couvre.
//
// Un hébergement couvre des NUITS, pas des jours : la nuit du jour D va de D
// au lendemain, et un séjour du 12 au 14 couvre les nuits du 12 et du 13 — le
// 14 est le jour du départ. Le dernier jour du voyage n'a pas de nuit à
// trouver : on rentre (ou on prend le vol de nuit).
//
// Module pur, testé sous `node --test`.

/** Les hébergements où l'on dort la nuit du jour `date`. */
export function staysForNight(date, stays) {
  return stays.filter((s) => s.checkIn.date <= date && date < s.checkOut.date)
}

/** L'hébergement du soir, s'il y en a un (le premier en cas de doublon). */
export function tonightStay(date, stays) {
  return staysForNight(date, stays)[0] || null
}

/**
 * Une entrée par jour du voyage :
 *   { date, stays, isLast, gap, overlap }
 * `gap` : nuit sans hébergement (sauf la dernière). `overlap` : deux
 * réservations pour la même nuit — presque toujours une erreur qui coûte.
 */
export function nightsOf(dayKeys, stays) {
  return dayKeys.map((date, i) => {
    const covering = staysForNight(date, stays)
    const isLast = i === dayKeys.length - 1
    return {
      date,
      stays: covering,
      isLast,
      gap: covering.length === 0 && !isLast,
      overlap: covering.length > 1,
    }
  })
}

/**
 * Ordre stable des hébergements (arrivée, puis nom) : c'est lui qui donne sa
 * couleur à chacun. Ajouter un hôtel en fin de voyage ne repeint pas les
 * autres.
 */
export function stayOrder(stays) {
  return [...stays].sort((a, b) =>
    a.checkIn.date.localeCompare(b.checkIn.date)
    || (a.checkIn.time || '').localeCompare(b.checkIn.time || '')
    || a.name.localeCompare(b.name)
    || a.id.localeCompare(b.id))
}

/**
 * Les barres de la bande des nuits, une par hébergement, découpées aux bornes
 * du voyage : `{ stay, start, span, lane, colorIndex }` où `start` est l'index
 * du premier jour couvert et `span` le nombre de nuits visibles.
 *
 * `lane` sépare les réservations qui se chevauchent : deux barres l'une sous
 * l'autre se voient, deux barres superposées se cachent.
 */
export function staySegments(dayKeys, stays) {
  const ordered = stayOrder(stays)
  const lanesEnd = []
  const segments = []

  ordered.forEach((stay, colorIndex) => {
    let start = -1
    let span = 0
    dayKeys.forEach((date, i) => {
      if (stay.checkIn.date <= date && date < stay.checkOut.date) {
        if (start === -1) start = i
        span += 1
      }
    })
    if (span === 0) return

    let lane = lanesEnd.findIndex((end) => end <= start)
    if (lane === -1) lane = lanesEnd.length
    lanesEnd[lane] = start + span
    segments.push({ stay, start, span, lane, colorIndex })
  })

  return segments
}

/** Les nuits sans hébergement, pour les signaler avant le départ. */
export function nightGaps(dayKeys, stays) {
  return nightsOf(dayKeys, stays).filter((n) => n.gap).map((n) => n.date)
}
