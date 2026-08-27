import {
  Apple, Beef, Milk, Wheat, Cookie, Snowflake, CupSoda, Sparkles, Home, ShoppingBasket,
} from 'lucide-react'

// Rayons, ordonnés « comme on traverse le magasin ». Classes de couleur pré-bakées
// (littéraux scannés par Tailwind) pour les en-têtes de section.
export const AISLES = [
  { id: 'fruits-legumes', label: 'Fruits & légumes',           icon: Apple,          colorClass: 'text-green-600',  order: 1 },
  { id: 'boucherie',      label: 'Boucherie / poissonnerie',   icon: Beef,           colorClass: 'text-rose-600',   order: 2 },
  { id: 'cremerie',       label: 'Crémerie / frais',           icon: Milk,           colorClass: 'text-sky-600',    order: 3 },
  { id: 'epicerie-salee', label: 'Épicerie salée',             icon: Wheat,          colorClass: 'text-amber-600',  order: 4 },
  { id: 'epicerie-sucree',label: 'Épicerie sucrée / petit-déj',icon: Cookie,         colorClass: 'text-orange-600', order: 5 },
  { id: 'surgeles',       label: 'Surgelés',                   icon: Snowflake,      colorClass: 'text-cyan-600',   order: 6 },
  { id: 'boissons',       label: 'Boissons',                   icon: CupSoda,        colorClass: 'text-indigo-600', order: 7 },
  { id: 'hygiene',        label: 'Hygiène & beauté',           icon: Sparkles,       colorClass: 'text-pink-600',   order: 8 },
  { id: 'maison',         label: 'Maison & entretien',         icon: Home,           colorClass: 'text-teal-600',   order: 9 },
  { id: 'autres',         label: 'Autres',                     icon: ShoppingBasket, colorClass: 'text-slate-500',  order: 99 },
]

export const AISLE_BY_ID = Object.fromEntries(AISLES.map((a) => [a.id, a]))
export const DEFAULT_AISLE = 'autres'

export function getAisle(id) {
  return AISLE_BY_ID[id] || AISLE_BY_ID[DEFAULT_AISLE]
}

// Dictionnaire mots-clés → rayon. Les mots sont normalisés à l'exécution et
// rapprochés sur des MOTS ENTIERS (cf. guessAisle).
//
// L'anglais est là au même titre que le français : ils font leurs courses en
// Australie, la plupart des produits scannés portent un nom anglais.
// L'ordre compte : « boissons » vient en premier pour que « jus d'orange »
// soit rangé en boissons plutôt qu'en fruits & légumes.
export const AISLE_KEYWORDS = [
  { aisle: 'boissons',       words: ['eau', 'jus', 'soda', 'biere', 'vin', 'coca', 'limonade', 'sirop', 'boisson', 'water', 'juice', 'soft drink', 'soda', 'beer', 'wine', 'cordial', 'drink', 'lemonade', 'kombucha'] },
  { aisle: 'fruits-legumes', words: ['pomme', 'banane', 'tomate', 'salade', 'carotte', 'courgette', 'oignon', 'ail', 'citron', 'fraise', 'poire', 'patate', 'pomme de terre', 'legume', 'fruit', 'avocat', 'concombre', 'poivron', 'champignon', 'epinard', 'brocoli', 'raisin', 'clementine', 'apple', 'banana', 'tomato', 'potato', 'carrot', 'onion', 'garlic', 'lemon', 'lime', 'strawberry', 'berry', 'berries', 'lettuce', 'spinach', 'broccoli', 'mushroom', 'avocado', 'cucumber', 'capsicum', 'pumpkin', 'grape', 'orange', 'mandarin', 'salad', 'vegetable', 'veggie', 'fruit'] },
  { aisle: 'boucherie',      words: ['poulet', 'boeuf', 'steak', 'poisson', 'saumon', 'jambon', 'viande', 'dinde', 'porc', 'lardon', 'saucisse', 'escalope', 'thon', 'crevette', 'merguez', 'hache', 'chicken', 'beef', 'steak', 'mince', 'pork', 'bacon', 'ham', 'lamb', 'turkey', 'sausage', 'fish', 'salmon', 'tuna', 'prawn', 'meat', 'schnitzel'] },
  { aisle: 'cremerie',       words: ['lait', 'beurre', 'oeuf', 'yaourt', 'fromage', 'creme', 'parmesan', 'mozzarella', 'emmental', 'comte', 'skyr', 'feta', 'milk', 'cheese', 'cheddar', 'yoghurt', 'yogurt', 'butter', 'cream', 'egg', 'dairy', 'haloumi', 'halloumi', 'ricotta'] },
  { aisle: 'epicerie-salee', words: ['pates', 'riz', 'conserve', 'huile', 'sel', 'poivre', 'farine', 'sauce', 'lentille', 'haricot', 'pois chiche', 'semoule', 'quinoa', 'vinaigre', 'moutarde', 'bouillon', 'epice', 'pasta', 'spaghetti', 'noodle', 'rice', 'oil', 'olive oil', 'salt', 'pepper', 'flour', 'sauce', 'bean', 'lentil', 'chickpea', 'vinegar', 'mustard', 'stock', 'spice', 'tin', 'canned', 'bread', 'wrap', 'tortilla', 'crackers', 'chips', 'peanut butter', 'vegemite'] },
  { aisle: 'epicerie-sucree',words: ['cafe', 'the', 'cereale', 'biscuit', 'chocolat', 'sucre', 'confiture', 'miel', 'nutella', 'gateau', 'madeleine', 'compote', 'coffee', 'tea', 'cereal', 'biscuit', 'cookie', 'chocolate', 'sugar', 'jam', 'honey', 'cake', 'muesli', 'weet-bix', 'oats', 'syrup', 'candy', 'lolly', 'lollies'] },
  { aisle: 'surgeles',       words: ['surgele', 'glace', 'frites', 'poelee', 'pizza', 'frozen', 'ice cream', 'icecream'] },
  { aisle: 'hygiene',        words: ['savon', 'shampoing', 'dentifrice', 'gel douche', 'deodorant', 'coton', 'rasoir', 'brosse', 'papier toilette', 'mouchoir', 'tampon', 'soap', 'shampoo', 'toothpaste', 'body wash', 'deodorant', 'razor', 'toilet paper', 'tissue', 'sunscreen'] },
  { aisle: 'maison',         words: ['lessive', 'eponge', 'sac poubelle', 'liquide vaisselle', 'nettoyant', 'essuie-tout', 'sopalin', 'ampoule', 'pile', 'detergent', 'sponge', 'bin bag', 'dishwashing', 'cleaner', 'paper towel', 'battery', 'bulb', 'wrap foil'] },
]
