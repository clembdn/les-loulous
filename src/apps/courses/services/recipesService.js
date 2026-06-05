import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { formatQuantity } from '../utils/quantity.js'

const RECIPES_PATH = 'couples/main/recipes'
function recipesCol() { return collection(db, RECIPES_PATH) }
function recipeDoc(id) { return doc(db, RECIPES_PATH, id) }

function normalizeIngredient(raw) {
  const quantity = typeof raw?.quantity === 'number' ? raw.quantity : null
  const unit = raw?.unit || null
  const structured = quantity != null || unit != null
  const quantityLabel = structured
    ? (formatQuantity(quantity, unit) || null)
    : (raw?.quantityLabel ? String(raw.quantityLabel).trim() : null)
  return { name: String(raw?.name || '').trim(), quantity, unit, quantityLabel }
}

function normalize(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    note: raw.note || null,
    imageUrl: raw.imageUrl || null,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map(normalizeIngredient) : [],
    steps: Array.isArray(raw.steps) ? raw.steps.map((s) => String(s)) : [],
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

// Nettoie l'entrée du formulaire : titre/ingrédients/étapes vides retirés.
function sanitizeInput(input) {
  const ingredients = (Array.isArray(input.ingredients) ? input.ingredients : [])
    .map(normalizeIngredient)
    .filter((i) => i.name.length > 0)
  const steps = (Array.isArray(input.steps) ? input.steps : [])
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 0)
  return {
    title: String(input.title || '').trim(),
    note: input.note ? String(input.note).trim() : null,
    imageUrl: input.imageUrl ? String(input.imageUrl).trim() : null,
    ingredients,
    steps,
  }
}

export function subscribeToRecipes(callback, onError) {
  const q = query(recipesCol(), orderBy('title', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] recipes error:', err)
    onError?.(err)
  })
}

export async function addRecipe(input, currentUid) {
  const now = new Date().toISOString()
  const ref = await addDoc(recipesCol(), {
    ...sanitizeInput(input),
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  })
  return ref.id
}

export async function updateRecipe(id, input, currentUid) {
  await updateDoc(recipeDoc(id), {
    ...sanitizeInput(input),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function deleteRecipe(id) {
  await deleteDoc(recipeDoc(id))
}
