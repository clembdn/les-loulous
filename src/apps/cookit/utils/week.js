// Import relatif et non `@/` : cette couche utils est couverte par des tests
// `node --test`, qui ne connaît pas l'alias de Vite.
import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval } from 'date-fns'
import { toLocalDateKey, DAY_LABELS, MONTHS } from '../../../shared/lib/dates.js'

export { toLocalDateKey }

function formatRange(start, end) {
  const sd = start.getDate()
  const ed = end.getDate()
  const sm = MONTHS[start.getMonth()]
  const em = MONTHS[end.getMonth()]
  return sm === em ? `${sd}–${ed} ${sm}` : `${sd} ${sm} – ${ed} ${em}`
}

// Semaine (lundi→dimanche) décalée de `offset` semaines par rapport à aujourd'hui.
export function getWeek(offset = 0) {
  const base = addWeeks(new Date(), offset)
  const start = startOfWeek(base, { weekStartsOn: 1 })
  const end = endOfWeek(base, { weekStartsOn: 1 })
  const todayId = toLocalDateKey(new Date())
  const days = eachDayOfInterval({ start, end }).map((d) => ({
    date: d,
    id: toLocalDateKey(d),
    dayLabel: DAY_LABELS[d.getDay()],
    dayNum: d.getDate(),
    isToday: toLocalDateKey(d) === todayId,
  }))
  return { startId: toLocalDateKey(start), endId: toLocalDateKey(end), days, label: formatRange(start, end) }
}
