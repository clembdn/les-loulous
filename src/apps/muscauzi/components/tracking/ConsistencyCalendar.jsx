import { useState, useMemo } from 'react'
import {
  toLocalDateKey, fromLocalDateKey, shiftDateKey, isoDayOfWeek, formatDayFr, DAY_SHORT,
} from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { useSessionRange } from '../../hooks/useMuscData.js'
import { hasCompletedWork } from '../../services/sessionsService.js'

const DAYS = 90

// Grille de régularité sur les trois derniers mois : une case par jour,
// colonnes = semaines, lignes = lundi → dimanche.
//
// Un jour n'est coloré QUE si la séance contient au moins une série validée.
// Une séance ouverte par curiosité, ou un brouillon vide, ne compte pas.
// Couleur uniforme : aucune intensité liée au volume, pas de streak.
function buildGrid(endKey) {
  const startRaw = shiftDateKey(endKey, -(DAYS - 1))
  // On recule jusqu'au lundi pour que chaque colonne soit une semaine pleine.
  const startKey = shiftDateKey(startRaw, -(isoDayOfWeek(startRaw) - 1))

  const weeks = []
  let cursor = startKey
  while (cursor <= endKey) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(cursor <= endKey ? cursor : null)
      cursor = shiftDateKey(cursor, 1)
    }
    weeks.push(week)
  }
  return { startKey, weeks }
}

export default function ConsistencyCalendar() {
  const endKey = toLocalDateKey(new Date())
  const { startKey, weeks } = useMemo(() => buildGrid(endKey), [endKey])
  // Une seule requête, bornée par id de document — possible grâce à la
  // convention stricte de clé de date locale.
  const { sessions, isLoading } = useSessionRange(startKey, endKey)
  const [selected, setSelected] = useState(null)

  const byDate = useMemo(() => {
    const m = {}
    for (const s of sessions) m[s.date] = s
    return m
  }, [sessions])

  const activeCount = useMemo(
    () => Object.values(byDate).filter(hasCompletedWork).length,
    [byDate],
  )

  const selectedSession = selected ? byDate[selected] : null

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-fg">Régularité</h2>
        <span className="text-xs text-muted tabular">
          {isLoading ? '…' : `${activeCount} séance${activeCount > 1 ? 's' : ''} sur 3 mois`}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 pt-0.5 shrink-0">
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
            <span key={dow} className="h-[13px] text-[9px] leading-[13px] text-faint">
              {dow % 2 === 1 ? DAY_SHORT[dow % 7] : ''}
            </span>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((key, di) => {
                  if (!key) return <span key={di} className="h-[13px] w-[13px]" />
                  const done = hasCompletedWork(byDate[key])
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(selected === key ? null : key)}
                      aria-label={formatDayFr(fromLocalDateKey(key))}
                      className={cn(
                        'h-[13px] w-[13px] rounded-[3px] transition',
                        done ? 'bg-accent' : 'bg-surface-2 border border-border',
                        selected === key && 'ring-2 ring-fg/40',
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-sm text-fg first-letter:uppercase">
            {formatDayFr(fromLocalDateKey(selected), { withYear: true })}
          </p>
          {/* Le libellé vient du programSnapshot de la séance : renommer un
              exercice plus tard ne réécrit pas le calendrier passé. */}
          <p className="text-xs text-muted mt-0.5">{describeSession(selectedSession)}</p>
        </div>
      )}
    </section>
  )
}

function describeSession(session) {
  if (!session) return 'Pas de séance'
  if (!hasCompletedWork(session)) return 'Séance ouverte, aucune série validée'
  const names = session.programSnapshot.map((l) => l.name).filter(Boolean)
  return names.length > 0 ? names.join(' · ') : 'Séance enregistrée'
}
