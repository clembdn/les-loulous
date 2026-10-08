// La valise : la catégorie devinée d'après le nom, les regroupements, ce qui
// reste à faire, ce qu'on reprend d'une autre liste.
// Module pur, testé sous `node --test`.

import {
  DEFAULT_PACKING_CATEGORY, PACKING_CATEGORIES, PACKING_KEYWORDS, PACKING_TEMPLATE,
} from '../config/packing.js'

// Minuscules, sans accents ni ponctuation, mots au singulier (prudemment :
// 5 lettres au moins, pour ne pas abîmer « gaz » ou « bus »).
export function packingKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length >= 5 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
    .join(' ')
}

// Mots-clés réduits une fois pour toutes ; les plus longs d'abord (« lunettes
// de vue » avant « lunettes »).
const KEYWORDS = Object.entries(PACKING_KEYWORDS)
  .flatMap(([category, words]) => words.map((w) => ({ category, key: packingKey(w) })))
  .sort((a, b) => b.key.length - a.key.length)

/**
 * La catégorie d'une affaire d'après son nom, en MOTS ENTIERS (cf. la leçon
 * des rayons de Cook'It : « cable » ne doit pas se trouver dans « constable »).
 * `misc` faute de mieux.
 */
export function guessPackingCategory(name) {
  const padded = ` ${packingKey(name)} `
  const hit = KEYWORDS.find((k) => padded.includes(` ${k.key} `))
  return hit ? hit.category : DEFAULT_PACKING_CATEGORY
}

/** Les affaires par catégorie, dans l'ordre des catégories, par nom ; catégories vides omises. */
export function groupPacking(items) {
  return PACKING_CATEGORIES
    .map((category) => ({
      category,
      items: items
        .filter((it) => it.category === category.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    }))
    .filter((g) => g.items.length)
}

/**
 * Ce que montre un filtre : `all`, `shared` (commun), ou l'uid d'une personne
 * — ses affaires ET les affaires communes (sa valise à elle, c'est aussi la
 * crème solaire qu'on partage).
 */
export function filterPacking(items, filter) {
  if (filter === 'all') return items
  if (filter === 'shared') return items.filter((it) => !it.owner)
  return items.filter((it) => !it.owner || it.owner === filter)
}

/** `{ done, total }`. */
export function packingProgress(items) {
  return { done: items.filter((it) => it.checked).length, total: items.length }
}

/**
 * Ce qu'on reprend d'une autre liste (la liste type, un voyage passé) : sans
 * ce qui y est déjà, sans doublon, décoché. « Déjà là » : même nom (au
 * pluriel près) pour la même personne ; pour une affaire COMMUNE, le même
 * nom pour qui que ce soit — si Clément a son passeport, la liste type
 * n'ajoute pas un « Passeport » commun en plus.
 * Rend `[{ name, category, owner }]`.
 */
export function itemsToAdd(source, existing) {
  const seen = new Set(existing.map((it) => `${it.owner || ''}|${packingKey(it.name)}`))
  const anyone = new Set(existing.map((it) => packingKey(it.name)))
  const out = []
  for (const it of source) {
    const owner = it.owner || null
    const name = packingKey(it.name)
    const key = `${owner || ''}|${name}`
    if (!name || seen.has(key) || (!owner && anyone.has(name))) continue
    seen.add(key)
    anyone.add(name)
    out.push({ name: it.name, category: it.category || guessPackingCategory(it.name), owner })
  }
  return out
}

/** Les suggestions pendant la saisie : la liste type, moins ce qui est déjà là, filtrée par le texte. */
export function packingSuggestions(text, existing, max = 6) {
  const have = new Set(existing.map((it) => packingKey(it.name)))
  const q = packingKey(text)
  return PACKING_TEMPLATE
    .filter((t) => !have.has(packingKey(t.name)))
    .filter((t) => !q || ` ${packingKey(t.name)}`.includes(` ${q}`))
    .slice(0, max)
}
