import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, ChefHat, CalendarDays } from 'lucide-react'
import { Button } from '@/shared/ui/Button.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { toLocalDateKey, shiftDateKey, formatDayFr } from '@/shared/lib/dates.js'
import { useFoodLog } from '../hooks/useFoodLog.js'
import { addEntry, removeEntry, skipPlannedMeal, SLOTS } from '../services/foodLogService.js'
import { usePlannedDay } from '../hooks/usePlannedDay.js'
import { plannedEntriesFor } from '../utils/plannedMeals.js'
import { sumIngredients, formatKcal, formatGrams } from '../utils/nutrition.js'
import GoalRings from '../components/GoalRings.jsx'
import FoodPickerSheet from '../components/FoodPickerSheet.jsx'
import FoodLogEntrySheet from '../components/FoodLogEntrySheet.jsx'
import RecipePortionSheet from '../components/RecipePortionSheet.jsx'

// Journal du jour : ce qui a été mangé, face aux objectifs.
// Les totaux se lisent depuis les entrées elles-mêmes — jamais recalculés
// depuis les recettes, qui ont pu changer depuis.

export default function JournalView({ foods, recipes, foodById, goals, incomingFood, onIncomingConsumed }) {
  const { currentUid } = useAuth()
  const today = toLocalDateKey()
  const [dateId, setDateId] = useState(today)
  const { entries, plannedOverrides, isLoading } = useFoodLog(dateId)
  const plannedDay = usePlannedDay(dateId)

  // Les repas du planning sont DÉRIVÉS, pas recopiés : rien n'est écrit dans le
  // journal, donc aucun doublon n'est possible et personne n'a besoin d'écrire
  // dans le journal de l'autre (ce que les règles Firestore interdisent).
  const planned = useMemo(
    () => plannedEntriesFor(plannedDay, currentUid, plannedOverrides),
    [plannedDay, currentUid, plannedOverrides],
  )

  const allEntries = useMemo(() => [...planned, ...entries], [planned, entries])

  const [pickerSlot, setPickerSlot] = useState(null)
  const [pending, setPending] = useState(null)
  const [recipeSheet, setRecipeSheet] = useState(false)

  // Créneau proposé par défaut d'après l'heure qu'il est — « Midi » en dur à
  // 20 h obligeait à corriger à chaque fois. Reste modifiable dans la feuille.
  const defaultSlot = useMemo(() => {
    const h = new Date().getHours()
    if (h < 11) return 'matin'
    if (h < 15) return 'midi'
    if (h < 18) return 'snack'
    return 'soir'
  }, [])

  // Un article coche dans la liste des courses peut arriver ici directement :
  // on ouvre la feuille de quantite sans faire rechercher l'aliment a nouveau.
  useEffect(() => {
    if (!incomingFood) return
    setPending(incomingFood)
    onIncomingConsumed?.()
  }, [incomingFood, onIncomingConsumed])

  // Un repas planifié sans valeurs (repas libre) ne compte pas comme zéro : il
  // est simplement absent du total, et affiché avec un tiret.
  const totals = useMemo(() => allEntries.reduce((acc, e) => ({
    kcal: acc.kcal + (e.kcal || 0),
    proteins: acc.proteins + (e.proteins || 0),
    carbs: acc.carbs + (e.carbs || 0),
    fat: acc.fat + (e.fat || 0),
  }), { kcal: 0, proteins: 0, carbs: 0, fat: 0 }), [allEntries])

  const bySlot = useMemo(() => {
    const m = Object.fromEntries(SLOTS.map((s) => [s.id, []]))
    allEntries.forEach((e) => { (m[e.slot] ||= []).push(e) })
    return m
  }, [allEntries])

  function add(entry) {
    addEntry(currentUid, dateId, entry)
  }

  function addRecipePortions(recipe, portions, slot) {
    // On fige les macros maintenant : modifier la recette demain ne doit pas
    // réécrire ce qui a été mangé aujourd'hui.
    const { totals: t } = sumIngredients(recipe.ingredients, foodById)
    const base = recipe.servings > 0 ? recipe.servings : 1
    const k = portions / base
    add({
      kind: 'recipe',
      refId: recipe.id,
      label: recipe.title,
      slot: slot || pickerSlot || defaultSlot,
      amount: portions,
      amountUnit: 'portion',
      kcal: t.kcal * k, proteins: t.proteins * k, carbs: t.carbs * k, fat: t.fat * k,
    })
  }

  const isToday = dateId === today

  return (
    <div className="max-w-xl mx-auto px-4 pb-28 pt-2">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setDateId(shiftDateKey(dateId, -1))} className="p-2 -ml-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Jour précédent">
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setDateId(today)}
          className="text-sm font-medium text-fg first-letter:uppercase"
        >
          {isToday ? "Aujourd'hui" : formatDayFr(dateId)}
        </button>
        <button
          onClick={() => setDateId(shiftDateKey(dateId, 1))}
          disabled={isToday}
          className="p-2 -mr-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Jour suivant"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <GoalRings totals={totals} goals={goals} />

      {isLoading && <p className="text-sm text-muted mt-4">Chargement…</p>}

      <div className="mt-5 space-y-5">
        {SLOTS.map((s) => (
          <section key={s.id}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</h2>
              <span className="text-xs text-faint tabular">
                {formatKcal(bySlot[s.id].reduce((a, e) => a + (e.kcal || 0), 0))}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {bySlot[s.id].map((e) => {
                // Un repas libre planifié n'a pas de valeurs : « — », jamais 0.
                const noValues = e.kcal == null
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2 group">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {e.planned && <CalendarDays size={12} className="text-accent shrink-0" title="Depuis le planning" />}
                        <span className="text-sm text-fg truncate">{e.label}</span>
                      </span>
                      <span className="block text-xs text-faint tabular">
                        {e.amountUnit === 'portion'
                          ? `${e.amount} portion${e.amount > 1 ? 's' : ''}`
                          : formatGrams(e.amount)}
                        {noValues
                          ? ' · valeurs inconnues'
                          : ` · P ${Math.round(e.proteins)} · G ${Math.round(e.carbs)} · L ${Math.round(e.fat)}`}
                      </span>
                    </span>
                    <span className="text-sm text-muted tabular shrink-0">
                      {noValues ? '—' : Math.round(e.kcal)}
                    </span>
                    <button
                      onClick={() => (e.planned
                        ? skipPlannedMeal(currentUid, dateId, e.mealId)
                        : removeEntry(currentUid, dateId, e.id))}
                      className="p-1 rounded text-faint hover:text-danger transition shrink-0 lg:opacity-0 lg:group-hover:opacity-100"
                      aria-label={e.planned ? 'Je n’ai pas mangé ce plat' : 'Retirer'}
                    >
                      <X size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-1 flex items-center gap-4">
              {/* Deux entrées explicites plutôt qu'un « Ajouter » qui ne
                  proposait que des aliments : un plat obligeait à redescendre
                  au bouton flottant, lequel forçait le créneau Midi. */}
              <button
                onClick={() => setPickerSlot(s.id)}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition"
              >
                <Plus size={13} /> Un aliment
              </button>
              <button
                onClick={() => { setPickerSlot(s.id); setRecipeSheet(true) }}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition"
              >
                <ChefHat size={13} /> Un plat
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 lg:left-60 z-20 p-4 pointer-events-none">
        <div className="max-w-xl mx-auto flex justify-end gap-2">
          <Button variant="secondary" className="pointer-events-auto shadow-lift" onClick={() => { setPickerSlot(defaultSlot); setRecipeSheet(true) }}>
            <ChefHat size={16} /> Un plat
          </Button>
          <Button className="pointer-events-auto shadow-lift" onClick={() => setPickerSlot(defaultSlot)}>
            <Plus size={16} /> Un aliment
          </Button>
        </div>
      </div>

      <FoodPickerSheet
        open={pickerSlot != null && !pending && !recipeSheet}
        foods={foods}
        title="Ajouter au journal"
        onClose={() => setPickerSlot(null)}
        onPick={(f) => setPending(f)}
      />

      <FoodLogEntrySheet
        food={pending}
        slot={pickerSlot}
        open={!!pending}
        onClose={() => { setPending(null); setPickerSlot(null) }}
        onAdd={add}
      />

      <RecipePortionSheet
        open={recipeSheet}
        recipes={recipes}
        foodById={foodById}
        slot={pickerSlot}
        onClose={() => { setRecipeSheet(false); setPickerSlot(null) }}
        onAdd={addRecipePortions}
      />
    </div>
  )
}
