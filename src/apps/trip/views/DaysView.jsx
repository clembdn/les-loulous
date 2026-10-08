import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { useToday } from '@/shared/lib/useToday.js'
import { useTripData } from '../context/TripDataContext.jsx'
import { defaultDay } from '../utils/tripDates.js'
import DayViewMobile from '../components/days/DayViewMobile.jsx'
import DayEditorDesktop from '../components/days/DayEditorDesktop.jsx'

/**
 * Les jours d'un voyage. Le jour affiché vient de l'URL (/trip/<id>/jours/<date>) ;
 * sans date — ou hors du voyage — aujourd'hui s'il en fait partie, sinon le
 * premier jour.
 *
 * Deux arbres distincts plutôt qu'un habillage : on planifie sur ordinateur
 * (éditeur en colonnes, glisser-déposer), on consulte sur téléphone (carnet
 * qu'on lit d'un pouce).
 */
export default function DaysView({ selectedDate }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const today = useToday()
  const { trip, dayKeys } = useTripData()
  const date = dayKeys.includes(selectedDate) ? selectedDate : defaultDay(trip, today)
  if (!date) return null
  return isDesktop ? <DayEditorDesktop date={date} /> : <DayViewMobile date={date} />
}
