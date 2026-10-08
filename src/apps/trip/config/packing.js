import { Cable, FileText, HeartPulse, Package, Shirt, SprayCan } from 'lucide-react'

// Catégories de la valise : peu nombreuses, dans l'ordre où l'on vérifie
// avant de fermer la porte — les papiers d'abord, sans eux on ne part pas.
// Teintes franches, assez sombres pour une icône blanche (cf. categories.js).
export const PACKING_CATEGORIES = [
  { id: 'papers',      label: 'Papiers',      icon: FileText,   color: '#B91C1C' }, // rouge 700
  { id: 'electronics', label: 'Électronique', icon: Cable,      color: '#1D4ED8' }, // bleu 700
  { id: 'toiletries',  label: 'Toilette',     icon: SprayCan,   color: '#0E7490' }, // lagon
  { id: 'health',      label: 'Santé',        icon: HeartPulse, color: '#BE185D' }, // rose 700
  { id: 'clothes',     label: 'Vêtements',    icon: Shirt,      color: '#7C3AED' }, // violet 600
  { id: 'misc',        label: 'Divers',       icon: Package,    color: '#57534E' }, // pierre 600
]

export const PACKING_CATEGORY_IDS = PACKING_CATEGORIES.map((c) => c.id)
export const DEFAULT_PACKING_CATEGORY = 'misc'

const BY_ID = Object.fromEntries(PACKING_CATEGORIES.map((c) => [c.id, c]))

export function getPackingCategory(id) {
  return BY_ID[id] || BY_ID[DEFAULT_PACKING_CATEGORY]
}

// Mots qui désignent une catégorie (comparés en mots entiers, sans accents ni
// pluriel, cf. utils/packing.js). Un mot de plusieurs mots se cherche entier.
export const PACKING_KEYWORDS = {
  papers: [
    'passeport', 'carte d identite', 'identite', 'visa', 'permis', 'carte bancaire', 'cb', 'carte vitale',
    'assurance', 'billet', 'reservation', 'esta', 'eta', 'argent', 'liquide', 'especes', 'dollar', 'euro',
    'carnet de vaccination', 'photocopie',
  ],
  electronics: [
    'chargeur', 'cable', 'adaptateur', 'prise', 'batterie', 'ecouteur', 'casque', 'telephone', 'ordinateur',
    'portable', 'tablette', 'liseuse', 'kindle', 'appareil photo', 'gopro', 'carte sd', 'montre', 'airpods',
  ],
  toiletries: [
    'brosse a dent', 'dentifrice', 'deodorant', 'shampoing', 'shampooing', 'gel douche', 'savon', 'rasoir',
    'creme', 'solaire', 'maquillage', 'peigne', 'brosse', 'coton', 'parfum', 'trousse de toilette', 'serviette',
    'lingette', 'baume', 'apres soleil', 'anti moustique', 'repulsif',
  ],
  health: [
    'medicament', 'pharmacie', 'doliprane', 'paracetamol', 'ibuprofene', 'pansement', 'lentille', 'lunettes de vue',
    'ordonnance', 'masque', 'thermometre', 'desinfectant', 'pilule', 'bouchon d oreille', 'vitamine',
  ],
  clothes: [
    'tee shirt', 't shirt', 'teeshirt', 'chemise', 'pantalon', 'jean', 'short', 'jupe', 'robe', 'pull', 'sweat',
    'veste', 'manteau', 'doudoune', 'k way', 'impermeable', 'pyjama', 'chaussette', 'culotte', 'calecon', 'slip',
    'sous vetement', 'soutien gorge', 'maillot', 'chaussure', 'basket', 'tong', 'sandale', 'casquette', 'chapeau',
    'bonnet', 'echarpe', 'gant', 'ceinture', 'legging', 'polaire',
  ],
}

/**
 * La liste type : l'essentiel d'un voyage, à cocher ou à supprimer. Pas un
 * inventaire exhaustif — de quoi ne rien oublier d'important, et des
 * suggestions pendant la saisie.
 */
export const PACKING_TEMPLATE = [
  { name: 'Passeport', category: 'papers' },
  { name: 'Carte d’identité', category: 'papers' },
  { name: 'Permis de conduire', category: 'papers' },
  { name: 'Carte bancaire', category: 'papers' },
  { name: 'Assurance voyage', category: 'papers' },
  { name: 'Billets et réservations', category: 'papers' },
  { name: 'Chargeur de téléphone', category: 'electronics' },
  { name: 'Adaptateur secteur', category: 'electronics' },
  { name: 'Batterie externe', category: 'electronics' },
  { name: 'Écouteurs', category: 'electronics' },
  { name: 'Brosse à dents', category: 'toiletries' },
  { name: 'Dentifrice', category: 'toiletries' },
  { name: 'Déodorant', category: 'toiletries' },
  { name: 'Crème solaire', category: 'toiletries' },
  { name: 'Shampooing', category: 'toiletries' },
  { name: 'Trousse à pharmacie', category: 'health' },
  { name: 'Médicaments habituels', category: 'health' },
  { name: 'Sous-vêtements', category: 'clothes' },
  { name: 'Chaussettes', category: 'clothes' },
  { name: 'T-shirts', category: 'clothes' },
  { name: 'Pantalons', category: 'clothes' },
  { name: 'Pull', category: 'clothes' },
  { name: 'Veste de pluie', category: 'clothes' },
  { name: 'Pyjama', category: 'clothes' },
  { name: 'Maillot de bain', category: 'clothes' },
  { name: 'Chaussures de marche', category: 'clothes' },
  { name: 'Lunettes de soleil', category: 'misc' },
  { name: 'Gourde', category: 'misc' },
  { name: 'Sac à dos de jour', category: 'misc' },
]
