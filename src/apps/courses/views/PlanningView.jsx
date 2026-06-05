import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ListPlus } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import MealSlot from '../components/MealSlot.jsx'
import MealPickerSheet from '../components/MealPickerSheet.jsx'
import AddIngredientsSheet from '../components/AddIngredientsSheet.jsx'
import { useWeekPlan } from '../hooks/useWeekPlan.js'
import { getWeek } from '../utils/week.js'
import { addMeal, removeMeal } from '../services/mealPlanService.js'
import { normalizeName } from '../utils/aisleGuess.js'

export default function PlanningView({ recipes, items, catalog, onGoToList }) {
  const { currentUid } = useAuth()
  const [offset, setOffset] = useState(0)
  const week = useMemo(() => getWeek(offset), [offset])
  const { dayMap, isLoading } = useWeekPlan(week.startId, week.endId)

  const [picker, setPicker] = useState(null) // { date, slot }
  const [addState, setAddState] = useState({ open: false, ingredients: [], title: '' })

  const recipeById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes])

  // Agrège les ingrédients de toutes les recettes planifiées de la semaine (dédoublonnés par nom).
  const weekIngredients = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const day of week.days) {
      const d = dayMap[day.id]
      if (!d) continue
      for (const slot of ['midi', 'soir']) {
        for (const meal of d[slot] || []) {
          const r = meal.recipeId ? recipeById[meal.recipeId] : null
          if (!r) continue
          for (const ing of r.ingredients) {
            const key = normalizeName(ing.name)
            if (!key || seen.has(key)) continue
            seen.add(key)
            out.push(ing)
          }
        }
      }
    }
    return out
  }, [week.days, dayMap, recipeById])

  function submitMeal(meal) {
    if (picker) addMeal(picker.date, picker.slot, meal, currentUid)
  }
  function handleRemove(date, slot, mealId) {
    removeMeal(date, slot, mealId, currentUid)
  }
  function openRecipeAdd(recipe) {
    setAddState({ open: true, ingredients: recipe.ingredients, title: recipe.title })
  }
  function openWeekAdd() {
    setAddState({ open: true, ingredients: weekIngredients, title: 'Ingrédients de la semaine' })
  }
  function closeAdd() {
    setAddState((s) => ({ ...s, open: false }))
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-44 lg:pb-28 pt-4">
      <h1 className="text-xl font-semibold tracking-tight text-fg mb-3">Planning</h1>
      <div className="flex items-center justify-between mb-5 rounded-xl border border-border bg-surface px-2 py-1.5">
        <button onClick={() => setOffset((o) => o - 1)} className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Semaine précédente">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-fg">{week.label}</p>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="text-xs text-accent hover:opacity-80 transition">
              Revenir à cette semaine
            </button>
          )}
        </div>
        <button onClick={() => setOffset((o) => o + 1)} className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Semaine suivante">
          <ChevronRight size={18} />
        </button>
      </div>

      <div>
        {isLoading ? (
          <p className="text-center text-muted py-16">Chargement…</p>
        ) : (
          <div className="space-y-5">
            {week.days.map((day) => {
              const d = dayMap[day.id]
              return (
                <section key={day.id}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className={cn('text-sm font-semibold', day.isToday ? 'text-accent' : 'text-fg')}>
                      {day.dayLabel} {day.dayNum}
                    </h3>
                    {day.isToday && <span className="text-[11px] font-medium text-accent">aujourd'hui</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MealSlot
                      label="Midi" slot="midi" meals={d?.midi || []} recipes={recipes}
                      onAdd={(slot) => setPicker({ date: day.id, slot })}
                      onRemove={(slot, mealId) => handleRemove(day.id, slot, mealId)}
                      onSendToList={openRecipeAdd}
                    />
                    <MealSlot
                      label="Soir" slot="soir" meals={d?.soir || []} recipes={recipes}
                      onAdd={(slot) => setPicker({ date: day.id, slot })}
                      onRemove={(slot, mealId) => handleRemove(day.id, slot, mealId)}
                      onSendToList={openRecipeAdd}
                    />
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 lg:left-60 z-20 p-4 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <Button className="w-full shadow-lift" size="lg" onClick={openWeekAdd} disabled={weekIngredients.length === 0}>
            <ListPlus size={18} /> Ingrédients de la semaine{weekIngredients.length > 0 ? ` (${weekIngredients.length})` : ''}
          </Button>
        </div>
      </div>

      <MealPickerSheet open={!!picker} onClose={() => setPicker(null)} recipes={recipes} onSubmit={submitMeal} />
      <AddIngredientsSheet
        open={addState.open}
        onClose={closeAdd}
        ingredients={addState.ingredients}
        items={items}
        catalog={catalog}
        onAdded={onGoToList}
        title={addState.title}
      />
    </div>
  )
}
