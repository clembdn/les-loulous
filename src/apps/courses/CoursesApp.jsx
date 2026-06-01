import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import ListView from './views/ListView.jsx'

export default function CoursesApp() {
  useAppTheme('light', 'emerald')
  return <ListView />
}
