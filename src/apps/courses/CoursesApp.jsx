import { useState } from 'react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useCoursesData } from './hooks/useCoursesData.js'
import { useRecipes } from './hooks/useRecipes.js'
import ListView from './views/ListView.jsx'
import RecipesView from './views/RecipesView.jsx'
import PlanningView from './views/PlanningView.jsx'

export default function CoursesApp() {
  useAppTheme('light', 'emerald')
  const [tab, setTab] = useState('liste')
  const { items, catalog, isLoading } = useCoursesData()
  const { recipes, isLoading: recipesLoading } = useRecipes()

  if (tab === 'recettes') {
    return (
      <RecipesView
        tab={tab}
        onTab={setTab}
        recipes={recipes}
        recipesLoading={recipesLoading}
        items={items}
        catalog={catalog}
        onGoToList={() => setTab('liste')}
      />
    )
  }

  if (tab === 'planning') {
    return (
      <PlanningView
        tab={tab}
        onTab={setTab}
        recipes={recipes}
        items={items}
        catalog={catalog}
        onGoToList={() => setTab('liste')}
      />
    )
  }

  return <ListView tab={tab} onTab={setTab} items={items} catalog={catalog} isLoading={isLoading} />
}
