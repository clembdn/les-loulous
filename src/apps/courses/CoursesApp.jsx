import { useMemo, useState } from 'react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useCoursesData } from './hooks/useCoursesData.js'
import { useRecipes } from './hooks/useRecipes.js'
import { usePantry } from './hooks/usePantry.js'
import { useShoppingLists, itemBelongsToList } from './hooks/useShoppingLists.js'
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
  const lists = useShoppingLists()
  const { activeListId, defaultListId } = lists
  const goToList = () => setTab('liste')

  // Articles de la liste active uniquement : toutes les vues raisonnent sur la
  // liste en cours (les articles legacy sans listId suivent la liste « défaut »).
  const activeItems = useMemo(
    () => items.filter((it) => itemBelongsToList(it, activeListId, defaultListId)),
    [items, activeListId, defaultListId],
  )

  // Compteur d'articles actifs (non cochés) par liste → affiché dans le sélecteur.
  const counts = useMemo(() => {
    const m = {}
    for (const it of items) {
      if (it.checked) continue
      const lid = it.listId || defaultListId
      if (lid) m[lid] = (m[lid] || 0) + 1
    }
    return m
  }, [items, defaultListId])

  return (
    <Shell active={tab} onChange={setTab}>
      {tab === 'liste' && (
        <ListView
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          isLoading={isLoading || lists.isLoading}
          listsApi={lists}
          counts={counts}
        />
      )}
      {tab === 'frigo' && (
        <FrigoView
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          pantryLoading={pantryLoading}
          activeListId={activeListId}
          onGoToList={goToList}
        />
      )}
      {tab === 'recettes' && (
        <RecipesView
          recipes={recipes}
          recipesLoading={recipesLoading}
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          activeListId={activeListId}
          onGoToList={goToList}
        />
      )}
      {tab === 'planning' && (
        <PlanningView
          recipes={recipes}
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          activeListId={activeListId}
          onGoToList={goToList}
        />
      )}
    </Shell>
  )
}
