import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format } from 'date-fns'

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

export function toDateId(date) {
  return format(date, 'yyyy-MM-dd')
}

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
  const todayId = toDateId(new Date())
  const days = eachDayOfInterval({ start, end }).map((d) => ({
    date: d,
    id: toDateId(d),
    dayLabel: DAY_LABELS[d.getDay()],
    dayNum: d.getDate(),
    isToday: toDateId(d) === todayId,
  }))
  return { startId: toDateId(start), endId: toDateId(end), days, label: formatRange(start, end) }
}
