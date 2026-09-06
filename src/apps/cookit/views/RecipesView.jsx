import { useState, useMemo } from 'react'
import { Plus, ChefHat } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import RecipeCard from '../components/RecipeCard.jsx'
import RecipeDetail from '../components/RecipeDetail.jsx'
import RecipeEditor from '../components/RecipeEditor.jsx'
import RecipeFilterBar from '../components/RecipeFilterBar.jsx'
import { addRecipe, updateRecipe, deleteRecipe } from '../services/recipesService.js'
import { normalizeName } from '../utils/aisleGuess.js'
import { MEAL_TYPE_IDS, getMealType } from '../config/mealTypes.js'

// Densité choisie : une préférence d'appareil (l'écran du téléphone n'appelle
// pas la même que celui du portable), donc locale et non synchronisée.
const LAYOUT_KEY = 'cookit.recipes.layout'

function readLayout() {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export default function RecipesView({ recipes, recipesLoading, items, catalog, pantry, foods, foodById, activeListId, onGoToList }) {
  const { currentUid } = useAuth()
  const [mode, setMode] = useState('browse') // 'browse' | 'detail' | 'edit'
  const [selectedId, setSelectedId] = useState(null)
  const [q, setQ] = useState('')
  const [meal, setMeal] = useState('all') // 'all' | id de repas | 'none'
  const [layout, setLayout] = useState(readLayout)
  const selected = recipes.find((r) => r.id === selectedId) || null

  function changeLayout(next) {
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, next) } catch { /* navigation privée : la préférence ne tient que la session */ }
  }

  // Texte cherché une fois par recette, et non à chaque frappe : la recherche
  // couvre aussi les ingrédients (« qu'est-ce que je fais avec ce poulet ? »),
  // ce qui multiplie par dix le nombre de noms à normaliser.
  const haystack = useMemo(() => {
    const m = new Map()
    for (const r of recipes) {
      m.set(r.id, `${normalizeName(r.title)} ${r.ingredients.map((i) => normalizeName(i.name)).join(' ')}`)
    }
    return m
  }, [recipes])

  const counts = useMemo(() => {
    const c = { all: recipes.length, none: 0 }
    for (const id of MEAL_TYPE_IDS) c[id] = 0
    for (const r of recipes) {
      if (r.meals.length === 0) c.none += 1
      for (const id of r.meals) c[id] += 1
    }
    return c
  }, [recipes])

  const filtered = useMemo(() => {
    const n = normalizeName(q)
    return recipes.filter((r) => {
      if (meal === 'none' && r.meals.length > 0) return false
      if (meal !== 'none' && meal !== 'all' && !r.meals.includes(meal)) return false
      return !n || haystack.get(r.id).includes(n)
    })
  }, [recipes, haystack, q, meal])

  function openDetail(r) { setSelectedId(r.id); setMode('detail') }
  function openNew() { setSelectedId(null); setMode('edit') }
  function backToBrowse() { setSelectedId(null); setMode('browse') }
  function resetFilters() { setQ(''); setMeal('all') }

  // Écritures fire-and-forget : l'UI est mise à jour par le cache local (latency
  // compensation), et hors-ligne un `await` ne se résoudrait qu'au retour du réseau.
  function handleSave(input) {
    if (selectedId) {
      updateRecipe(selectedId, input, currentUid)
        .catch((err) => console.error('[Cook’It] updateRecipe error:', err))
      setMode('detail')
    } else {
      addRecipe(input, currentUid)
        .catch((err) => console.error('[Cook’It] addRecipe error:', err))
      backToBrowse()
    }
  }
  function handleDelete(id) {
    deleteRecipe(id)
      .catch((err) => console.error('[Cook’It] deleteRecipe error:', err))
    backToBrowse()
  }
  function handleDuplicate(recipe) {
    addRecipe(
      { title: `${recipe.title} (copie)`, note: recipe.note, imageUrl: recipe.imageUrl, servings: recipe.servings, prepMinutes: recipe.prepMinutes, meals: recipe.meals, ingredients: recipe.ingredients, steps: recipe.steps },
      currentUid,
    ).catch((err) => console.error('[Cook’It] duplicateRecipe error:', err))
    backToBrowse()
  }

  if (mode === 'edit') {
    return (
      <RecipeEditor
        recipe={selected}
        foods={foods}
        foodById={foodById}
        onCancel={() => (selected ? setMode('detail') : backToBrowse())}
        onSave={handleSave}
      />
    )
  }

  // Lie un ingredient a un aliment. On reecrit la liste complete (Firestore ne
  // sait pas modifier un element de tableau par index) sans rien perdre d'autre.
  function handleLinkIngredient(recipe, index, patch) {
    const ingredients = recipe.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
    updateRecipe(recipe.id, { ...recipe, ingredients }, currentUid)
      .catch((err) => console.error('[Cook’It] link ingredient error:', err))
  }

  if (mode === 'detail' && selected) {
    return (
      <RecipeDetail
        recipe={selected}
        items={items}
        catalog={catalog}
        pantry={pantry}
        foods={foods}
        foodById={foodById}
        activeListId={activeListId}
        onBack={backToBrowse}
        onLinkIngredient={handleLinkIngredient}
        onEdit={() => setMode('edit')}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onAdded={onGoToList}
      />
    )
  }

  if (recipesLoading) {
    return <p className="text-center text-muted py-16">Chargement…</p>
  }

  if (recipes.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-4 text-center py-16">
        <ChefHat size={32} className="mx-auto text-faint" />
        <p className="text-fg font-medium mt-3">Aucune recette</p>
        <p className="text-sm text-muted mt-1">Crée ta première recette pour ajouter ses ingrédients en un tap.</p>
        <Button className="mt-4" onClick={openNew}><Plus size={16} /> Nouvelle recette</Button>
      </div>
    )
  }

  return (
    <div className="max-w-xl lg:max-w-6xl mx-auto px-4 pb-32 lg:pb-12 pt-2 lg:pt-4">
      {/* Sur téléphone, la barre de navigation affiche déjà « Recettes » et le
          bouton d'ajout flotte en bas : ce titre ne servirait qu'à voler une
          ligne de défilement. */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Recettes <span className="font-normal text-faint tabular">{recipes.length}</span>
        </h1>
        <Button size="sm" onClick={openNew}><Plus size={16} /> Nouvelle</Button>
      </div>

      <RecipeFilterBar
        q={q}
        onQueryChange={setQ}
        meal={meal}
        onMealChange={setMeal}
        counts={counts}
        layout={layout}
        onLayoutChange={changeLayout}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-sm text-muted">
            {meal === 'all'
              ? <>Aucune recette ne correspond à « {q.trim()} ».</>
              : <>Aucune recette en « {meal === 'none' ? 'À classer' : getMealType(meal)?.label} »{q.trim() && ' pour cette recherche'}.</>}
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>Voir toutes les recettes</Button>
        </div>
      ) : (
        <div
          className={cn(
            'mt-3',
            layout === 'grid'
              ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              : 'lg:grid lg:grid-cols-2 lg:gap-x-8',
          )}
        >
          {filtered.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              variant={layout === 'grid' ? 'grid' : 'row'}
              onClick={() => openDetail(r)}
            />
          ))}
        </div>
      )}

      {/* Bouton d'ajout flottant (téléphone) : au-dessus de la barre d'onglets,
          atteignable au pouce quel que soit l'endroit du défilement. */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 p-4 pointer-events-none">
        <div className="max-w-xl mx-auto flex justify-end">
          <Button className="pointer-events-auto shadow-lift" onClick={openNew}>
            <Plus size={16} /> Nouvelle
          </Button>
        </div>
      </div>
    </div>
  )
}
