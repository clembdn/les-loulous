import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, increment,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { slugify, normalizeName, cleanName } from '../utils/aisleGuess.js'
import { resolveFoodAisle } from '../utils/foodAisle.js'

// Bibliothèque d'aliments du couple : tout ce qui a été scanné, cherché ou saisi.
//
// Les valeurs nutritionnelles sont RECOPIÉES ici (snapshot), jamais référencées :
//   • hors ligne, tout reste consultable sans réseau ;
//   • si Open Food Facts corrige une fiche plus tard, l'historique déjà
//     enregistré ne bouge pas sous les pieds de l'utilisateur.
//
// L'id est déterministe (comme shoppingCatalog) pour qu'un même produit scanné
// deux fois retombe sur le même document : off-<ean> | ciqual-<code> | manual-<slug>.

const FOODS_PATH = 'couples/main/foods'
function foodsCol() { return collection(db, FOODS_PATH) }
function foodDoc(id) { return doc(db, FOODS_PATH, id) }

export function makeFoodId(food) {
  if (food?.id) return food.id
  if (food?.barcode) return `off-${String(food.barcode).replace(/\D/g, '')}`
  return `manual-${slugify(food?.name)}`
}

function num(v, decimals = 2) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10 ** decimals) / 10 ** decimals : null
}

function positive(v) {
  const n = num(v)
  return n != null && n > 0 ? n : null
}

function normalizePer100(raw) {
  return {
    kcal: num(raw?.kcal) ?? 0,
    proteins: num(raw?.proteins),
    carbs: num(raw?.carbs),
    fat: num(raw?.fat),
    sugars: num(raw?.sugars),
    satFat: num(raw?.satFat),
    fiber: num(raw?.fiber),
    // Le sel descend souvent sous 1 g : trois decimales pour ne pas le degrader.
    salt: num(raw?.salt, 3),
  }
}

function normalize(raw) {
  const name = cleanName(raw.name)
  return {
    id: raw.id,
    name,
    nameLower: raw.nameLower || normalizeName(name),
    brand: raw.brand || null,
    barcode: raw.barcode || null,
    source: ['off', 'ciqual', 'manual'].includes(raw.source) ? raw.source : 'manual',
    // Le rayon est TOUJOURS recalcule a la lecture, jamais repris tel quel.
    //
    // La version precedente gardait `raw.aisle` des qu'il etait un id valide —
    // et « autres » en est un. Un aliment range par defaut dans « Autres » y
    // restait donc a vie, meme apres l'amelioration du classement : c'est ce qui
    // laissait le pain scanne dans « Autres ». `resolveFoodAisle` sait deja
    // s'arreter sur un choix delibere (`aisleManual`), c'est lui l'autorite.
    //
    // Effet de bord voulu : tous les aliments deja enregistres se rangent au bon
    // rayon des le prochain chargement, sans migration.
    aisle: resolveFoodAisle(raw),
    aisleManual: raw.aisleManual === true,
    group: raw.group || null,
    per100: normalizePer100(raw.per100),
    gramsPerPiece: positive(raw.gramsPerPiece),
    densityGPerMl: positive(raw.densityGPerMl),
    servingGrams: positive(raw.servingGrams),
    imageUrl: raw.imageUrl || null,
    nutriscore: raw.nutriscore || null,
    novaGroup: Number.isFinite(Number(raw.novaGroup)) ? Number(raw.novaGroup) : null,
    useCount: Number(raw.useCount) || 0,
    lastUsedAt: raw.lastUsedAt || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

// Champs persistés (on ne renvoie ni id ni métadonnées : l'appelant les pose).
function toDoc(food) {
  const name = cleanName(food.name)
  return {
    name,
    nameLower: normalizeName(name),
    brand: food.brand || null,
    barcode: food.barcode || null,
    source: ['off', 'ciqual', 'manual'].includes(food.source) ? food.source : 'manual',
    // Le rayon est calcule ici et pas dans l'ecran : tout aliment enregistre en a
    // un, quelle que soit la porte d'entree (scan, CIQUAL, saisie manuelle).
    aisle: resolveFoodAisle(food),
    aisleManual: food.aisleManual === true,
    // `group` (groupe CIQUAL) n'existe que sur les resultats de recherche ; le
    // persister evite de le perdre et sert de source au rayon plus tard.
    group: food.group || null,
    per100: normalizePer100(food.per100),
    gramsPerPiece: positive(food.gramsPerPiece),
    densityGPerMl: positive(food.densityGPerMl),
    servingGrams: positive(food.servingGrams),
    imageUrl: food.imageUrl || null,
    nutriscore: food.nutriscore || null,
    novaGroup: Number.isFinite(Number(food.novaGroup)) ? Number(food.novaGroup) : null,
  }
}

export function subscribeToFoods(callback, onError) {
  return onSnapshot(foodsCol(), (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Cook’It] foods error:', err)
    onError?.(err)
  })
}

// Enregistre un aliment (scanné, CIQUAL ou saisi) dans la bibliothèque et rend son id.
// L'id est calculé côté client pour être rendu SYNCHRONEMENT : l'appelant peut lier
// l'aliment tout de suite, sans attendre le réseau (cf. createList dans useShoppingLists).
export function saveFood(food, currentUid) {
  const id = makeFoodId(food)
  const now = new Date().toISOString()
  // Fire-and-forget : hors ligne, la promesse Firestore ne se résout jamais.
  getDoc(foodDoc(id)).then((snap) => {
    if (snap.exists()) {
      updateDoc(foodDoc(id), { ...toDoc(food), updatedAt: now, updatedBy: currentUid })
    } else {
      setDoc(foodDoc(id), {
        ...toDoc(food),
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        createdBy: currentUid,
        updatedAt: now,
        updatedBy: currentUid,
      })
    }
  }).catch(() => {
    // Hors ligne : setDoc avec merge suffit, la synchro se fera au retour du réseau.
    setDoc(foodDoc(id), {
      ...toDoc(food),
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    }, { merge: true })
  })
  return id
}

export function updateFood(id, updates, currentUid) {
  return updateDoc(foodDoc(id), {
    ...toDoc(updates),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

// Compteur d'usage → tri des suggestions (les aliments habituels remontent).
// `increment` est resolu par le serveur : deux telephones qui ajoutent le meme
// aliment hors ligne ne s'ecrasent pas au moment de la synchro.
export function recordFoodUsage(id, currentUid) {
  const now = new Date().toISOString()
  return updateDoc(foodDoc(id), {
    useCount: increment(1),
    lastUsedAt: now,
    updatedAt: now,
    updatedBy: currentUid,
  }).catch(() => {})
}

export function deleteFood(id) {
  return deleteDoc(foodDoc(id))
}
