import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { NUTRITION_TABS } from '../config/navigation.js'

// Sous-navigation du bloc Nutrition. SegmentedTabs se masque déjà tout seul en
// `lg` : sur desktop les trois écrans ont leur entrée dans la sidebar, un second
// sélecteur ferait doublon.
export default function NutritionTabs({ active, onChange }) {
  return (
    <div className="max-w-xl mx-auto px-4 pt-1 pb-3 lg:hidden">
      <SegmentedTabs items={NUTRITION_TABS} active={active} onChange={onChange} />
    </div>
  )
}
