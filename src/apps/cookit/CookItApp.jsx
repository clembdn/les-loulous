import { useMemo, useState } from 'react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useCookItData } from './hooks/useCookItData.js'
import { useRecipes } from './hooks/useRecipes.js'
import { usePantry } from './hooks/usePantry.js'
import { useFoods } from './hooks/useFoods.js'
import { useNutritionGoals } from './hooks/useNutritionGoals.js'
import { useShoppingLists, itemBelongsToList } from './hooks/useShoppingLists.js'
import Shell from './components/layout/Shell.jsx'
import { DEFAULT_TAB, NUTRITION_IDS } from './config/navigation.js'
import ListView from './views/ListView.jsx'
import RecipesView from './views/RecipesView.jsx'
import PlanningView from './views/PlanningView.jsx'
import FrigoView from './views/FrigoView.jsx'
import FoodsView from './views/FoodsView.jsx'
import JournalView from './views/JournalView.jsx'
import GoalsView from './views/GoalsView.jsx'
import NutritionTabs from './components/NutritionTabs.jsx'
import ManageListsSheet from './components/ManageListsSheet.jsx'

export default function CookItApp() {
  useAppTheme('light', 'emerald')
  const [tab, setTab] = useState(DEFAULT_TAB)
  const [manageOpen, setManageOpen] = useState(false)
  const [logFood, setLogFood] = useState(null)
  const { items, catalog, isLoading } = useCookItData()
  const { recipes, isLoading: recipesLoading } = useRecipes()
  const { pantry, isLoading: pantryLoading } = usePantry()
  const { foods, foodById, isLoading: foodsLoading } = useFoods()
  const { goals } = useNutritionGoals()
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
    <>
    <Shell active={tab} onChange={setTab} lists={lists} counts={counts} onManageLists={() => setManageOpen(true)}>
      {tab === 'liste' && (
        <ListView
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          foods={foods}
          isLoading={isLoading || lists.isLoading}
          listsApi={lists}
          counts={counts}
          onManageLists={() => setManageOpen(true)}
          onLogFood={(food) => { setLogFood(food); setTab('journal') }}
        />
      )}
      {tab === 'frigo' && (
        <FrigoView
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          pantryLoading={pantryLoading}
          foods={foods}
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
          foods={foods}
          foodById={foodById}
          activeListId={activeListId}
          onGoToList={goToList}
        />
      )}
      {NUTRITION_IDS.includes(tab) && (
        <>
          {/* Sur mobile le groupe Nutrition se replie en un seul onglet : sans ce
              sélecteur, Journal et Objectifs seraient inatteignables au doigt. */}
          <NutritionTabs active={tab} onChange={setTab} />
          {tab === 'journal' && (
            <JournalView
              foods={foods}
              recipes={recipes}
              foodById={foodById}
              goals={goals}
              incomingFood={logFood}
              onIncomingConsumed={() => setLogFood(null)}
            />
          )}
          {tab === 'aliments' && (
            <FoodsView
              foods={foods}
              isLoading={foodsLoading}
              items={activeItems}
              catalog={catalog}
              activeListId={activeListId}
            />
          )}
          {tab === 'objectifs' && <GoalsView goals={goals} />}
        </>
      )}
      {tab === 'planning' && (
        <PlanningView
          recipes={recipes}
          items={activeItems}
          catalog={catalog}
          pantry={pantry}
          foods={foods}
          foodById={foodById}
          activeListId={activeListId}
          onGoToList={goToList}
        />
      )}
    </Shell>

    <ManageListsSheet
      open={manageOpen}
      onClose={() => setManageOpen(false)}
      activeLists={lists.activeLists}
      archivedLists={lists.archivedLists}
      counts={counts}
      onRename={lists.renameList}
      onArchive={lists.archiveList}
      onUnarchive={lists.unarchiveList}
      onDelete={lists.deleteList}
    />
    </>
  )
}
