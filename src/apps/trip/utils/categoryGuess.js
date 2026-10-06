// La catégorie d'une étape, devinée pour ne pas avoir à la choisir : d'après
// ce qu'OpenStreetMap dit du lieu (Photon renvoie `osm_key` / `osm_value`, la
// carte OpenFreeMap `class` / `subclass`), sinon d'après son nom (« Praia… »,
// « Museu… »). Elle reste modifiable ; dans le doute, rien (« Autre »).
//
// Module pur, testé sous `node --test`.

// Valeurs OSM (ou classes OpenMapTiles), quelle que soit la clé.
const BY_VALUE = {
  food: ['restaurant', 'fast_food', 'food_court', 'biergarten', 'bbq'],
  coffee: ['cafe', 'ice_cream', 'bakery', 'pastry', 'confectionery', 'coffee', 'tea'],
  night: ['bar', 'pub', 'nightclub', 'casino', 'beer', 'wine_bar', 'music_venue'],
  visit: [
    'museum', 'gallery', 'attraction', 'viewpoint', 'artwork', 'monument', 'memorial', 'castle',
    'ruins', 'archaeological_site', 'place_of_worship', 'cathedral', 'church', 'chapel', 'monastery',
    'palace', 'fort', 'tower', 'city_gate', 'lighthouse', 'historic', 'town_hall', 'library',
  ],
  nature: [
    'park', 'garden', 'nature_reserve', 'national_park', 'peak', 'cliff', 'cape', 'waterfall',
    'wood', 'forest', 'cave_entrance', 'volcano', 'valley', 'lake', 'picnic_site', 'hot_spring', 'island',
  ],
  beach: ['beach', 'beach_resort', 'bay', 'coastline'],
  activity: [
    'theme_park', 'zoo', 'aquarium', 'water_park', 'cinema', 'theatre', 'stadium', 'sports_centre',
    'swimming_pool', 'golf_course', 'escape_game', 'amusement_arcade', 'dive_centre', 'ice_rink',
  ],
  shopping: ['marketplace', 'mall', 'department_store', 'supermarket', 'shop', 'boutique', 'souvenir', 'gift'],
}

const BY_KEY = { shop: 'shopping', historic: 'visit', natural: 'nature' }

const VALUE_INDEX = Object.fromEntries(
  Object.entries(BY_VALUE).flatMap(([category, values]) => values.map((v) => [v, category])),
)

// Mots du nom, en plusieurs langues, sans accents. L'ordre compte : « Time
// Out Market » est un repas avant d'être un marché.
const BY_WORD = [
  ['beach', /\b(praia|plage|playa|spiaggia|strand|beach)\b/],
  ['coffee', /\b(cafe|caffe|coffee|pasteis|pastelaria|patisserie|boulangerie|padaria|gelato|glacier)\b/],
  ['food', /\b(restaurant|restaurante|ristorante|taberna|tasca|trattoria|bistro|brasserie|marisqueira|churrasqueira|cantina|food|market|mercado)\b/],
  ['night', /\b(bar|pub|club|fado|tapas|rooftop|cocktail)\b/],
  ['visit', /\b(museu|musee|museum|museo|castelo|chateau|castle|castillo|palacio|palais|palace|palazzo|igreja|eglise|church|iglesia|chiesa|catedral|cathedrale|cathedral|duomo|mosteiro|monastere|monastery|torre|tour|tower|miradouro|mirador|belvedere|viewpoint|basilica|basilique|abbaye|ruines|fort|forte)\b/],
  ['nature', /\b(parc|parque|park|jardin|jardim|garden|cabo|cap|falaise|cascade|cascata|waterfall|lagoa|lac|lake|serra|montagne|mount|national|reserve|foret|floresta)\b/],
  ['activity', /\b(kayak|surf|plongee|diving|zoo|aquarium|aquario|parc d'attractions|excursion|balade en bateau|croisiere|cinema|theatre|teatro|stade|stadium)\b/],
  ['shopping', /\b(shopping|mall|centro comercial|boutique|outlet|souk|bazar)\b/],
]

function normalize(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** L'identifiant de catégorie (cf. config/categories.js), ou `null` si on ne sait pas. */
export function guessCategory({ osmKey = null, osmValue = null, name = '' } = {}) {
  if (osmValue && VALUE_INDEX[osmValue]) return VALUE_INDEX[osmValue]
  if (osmKey && BY_KEY[osmKey]) return BY_KEY[osmKey]
  if (osmKey && VALUE_INDEX[osmKey]) return VALUE_INDEX[osmKey]
  const words = normalize(name)
  for (const [category, re] of BY_WORD) if (re.test(words)) return category
  return null
}
