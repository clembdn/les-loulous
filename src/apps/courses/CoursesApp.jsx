import { useState } from 'react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useCoursesData } from './hooks/useCoursesData.js'
import { useRecipes } from './hooks/useRecipes.js'
import { usePantry } from './hooks/usePantry.js'
import Shell from './components/layout/Shell.jsx'
import { DEFAULT_TAB } from './config/navigation.js'
import ListView from './views/ListView.jsx'
import RecipesView from './views/RecipesView.jsx'
import PlanningView from './views/PlanningView.jsx'
import FrigoView from './views/FrigoView.jsx'

export default function CoursesApp() {
  useAppTheme('light', 'emerald')
  const [tab, setTab] = useState(DEFAULT_TAB)
  const { items, catalog, isLoading } = useCoursesData()
  const { recipes, isLoading: recipesLoading } = useRecipes()
  const { pantry, isLoading: pantryLoading } = usePantry()
  const goToList = () => setTab('liste')

  return (
    <Shell active={tab} onChange={setTab}>
      {tab === 'liste' && <ListView items={items} catalog={catalog} pantry={pantry} isLoading={isLoading} />}
      {tab === 'frigo' && (
        <FrigoView
          items={items}
          catalog={catalog}
          pantry={pantry}
          pantryLoading={pantryLoading}
          onGoToList={goToList}
        />
      )}
      {tab === 'recettes' && (
        <RecipesView
          recipes={recipes}
          recipesLoading={recipesLoading}
          items={items}
          catalog={catalog}
          pantry={pantry}
          onGoToList={goToList}
        />
      )}
      {tab === 'planning' && (
        <PlanningView recipes={recipes} items={items} catalog={catalog} pantry={pantry} onGoToList={goToList} />
      )}
    </Shell>
  )
}
