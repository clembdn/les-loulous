# Conception — MVP « Liste de courses » (projet 2)

**Date :** 2026-05-29
**Périmètre :** Projet 2 — l'app « Liste de courses » fonctionnelle, version **MVP « remplacer
Listenic »**. Les recettes, le planning de semaine, le frigo/stock et le moteur intelligent
(liste auto-calculée) feront chacun l'objet d'un projet ultérieur (spec → plan → dev).

## 1. Contexte & objectif

La plateforme « Clément & Lise » (Vite + React 18 + Tailwind + Firebase Auth/Firestore, déployée
sur Vercel) existe déjà : login picker, dashboard de cards, FinAuzi sous `/finauzi`. La card
« Liste de courses » est **déjà déclarée** dans `src/platform/apps.config.js` (statut `soon`,
accent `emerald`, thème `light`) et la route `/courses` affiche aujourd'hui le `ComingSoonView`.
La doc d'architecture réservait déjà l'emplacement des données : `couples/main/<app>` (ici
`shopping`).

Objectif : livrer une **liste de courses partagée, temps réel, sans friction**, qui remplace
Listenic au quotidien pour un couple (2 utilisateurs fixes). On s'appuie au maximum sur l'existant
plutôt que d'ajouter une stack concurrente.

**Déjà acquis gratuitement par la plateforme** (donc hors-développement ici) :

| Besoin | État |
|--------|------|
| Auth / comptes | ✅ Login plateforme |
| Foyer partagé (2 personnes) | ✅ `couples/main`, 2 UID fixes |
| Synchro temps réel | ✅ Pattern Firestore `onSnapshot` |
| Tables `households` / `household_members` | ❌ Inutiles (un seul couple) — YAGNI |

## 2. Périmètre

**Inclus (MVP) :**
- Une **liste partagée unique** et permanente (pas de listes multiples).
- **Ajout ultra-rapide** d'un article (nom + quantité en texte libre optionnelle).
- **Cases à cocher**, comportement « cochés en bas / repliables », actions *Vider les cochés* /
  *Tout vider*.
- **Regroupement par rayon** (preset ordonné « comme on traverse le magasin »), avec
  auto-classement à l'ajout (devinette par mots-clés, surchargeable).
- **Mode magasin** : état focalisé, grosses lignes, articles cochés masqués.
- **Catalogue intelligent léger** : historique/fréquents + favoris (produits de base) +
  mémorisation du rayon par produit. Alimente l'autocomplétion, les chips « fréquents » et
  l'auto-classement.
- **Attribution discrète** « qui a ajouté » (pastille Clément/Lise).
- **Temps réel** entre les deux comptes (`onSnapshot`).
- **PWA légère installable** (niveau plateforme, bénéficie aussi à FinAuzi).

**Exclus (projets suivants) :**
- Recettes (livre de recettes, génération de liste depuis une recette).
- Planning de semaine (14 cases midi/soir, portions).
- Frigo / stock / placards (inventaire, soustraction auto, seuils).
- Quantités **auto-calculées** et **unités structurées** (conversion masse/volume/unité).
- Scan code-barres / Open Food Facts, OCR ticket de caisse, IA, notifications.
- Offline complet (les données restent en ligne via Firestore).
- Tests automatisés (Vitest) — proposable plus tard, cohérent avec les specs précédentes.

## 3. Décisions validées

| Sujet | Décision |
|-------|----------|
| Périmètre projet 2 | MVP « liste partagée » seul ; recettes/planning/frigo/moteur = projets suivants. |
| Organisation des listes | **Une seule** liste partagée permanente (zéro navigation). |
| Quantités | **Texte libre** (« 500 g », « 2 », « 1 paquet ») ; pas d'unités structurées au MVP. |
| Rayons | Preset **en code**, ordonné magasin ; auto-classement par mots-clés, surchargeable. |
| Brique intelligente | On garde un **catalogue léger** (fréquents + favoris + rayon mémorisé). |
| Attribution | Pastille discrète « qui a ajouté » (Clément/Lise). |
| Mode magasin | **État focalisé**, pas une route séparée. |
| PWA | **Oui, légère installable** (manifest + icônes + SW minimal) ; offline complet plus tard. |
| Stack | Réutilise l'existant (Vite/React/Firebase) ; **pas** de Next.js/Supabase. |

## 4. Intégration plateforme

### 4.1 Structure des fichiers

Nouvelle app autonome sous `src/apps/courses/`, calquée sur `src/apps/finauzi/` :

```
src/apps/courses/
├─ CoursesApp.jsx              # useAppTheme('light','emerald') + shell + back « Nos apps »
├─ config/
│  └─ aisles.js                # preset des rayons (id, label, icône, couleur, ordre) + dico mots-clés
├─ services/
│  ├─ shoppingItemsService.js  # subscribe/add/update/delete + check + métadonnées
│  └─ catalogService.js        # upsert catalogue, toggle favori, fréquents
├─ hooks/
│  └─ useCoursesData.js        # hook central : abonnements items + catalogue
├─ utils/
│  └─ aisleGuess.js            # devine le rayon depuis le nom (dico) ; slug(name) pour le catalogue
├─ views/
│  └─ ListView.jsx             # écran principal (liste + ajout + mode magasin)
└─ components/
   ├─ QuickAddBar.jsx          # barre d'ajout + chips fréquents
   ├─ AisleSection.jsx         # en-tête de rayon + items
   ├─ ItemRow.jsx              # ligne article (checkbox, nom, quantité, pastille personne)
   ├─ ItemEditSheet.jsx        # édition d'un article (sheet)
   ├─ CheckedZone.jsx          # zone repliable « Cochés (n) »
   ├─ StoreModeView.jsx        # mode magasin (grosses lignes, cochés masqués)
   └─ FavoritesSheet.jsx       # gérer favoris / rayon par défaut d'un produit
```

Réutilise le **partagé** : `@/shared/lib/firebase`, `@/shared/config/people` (UIDs, couleurs,
`getPerson`), `@/shared/theme/useAppTheme`, kit `@/shared/ui/*` (`Button`, `Card`, `Input`,
`Badge`, `sheet`, `sonner`, `Modal`), `lucide-react`.

### 4.2 Câblage routing & registre

- `src/App.jsx` : remplacer la route `/courses` (qui rend `ComingSoonView`) par `CoursesApp`
  (lazy-loaded), toujours sous `ProtectedRoute`.
- `src/platform/apps.config.js` : passer la card `courses` de `status: 'soon'` → `'live'`.
- Retour vers le hub : bouton « ← Nos apps » (`<Link to="/">`), comme FinAuzi.

### 4.3 Thème

`CoursesApp` appelle `useAppTheme('light', 'emerald')` (déjà prévu par le design system). Les
composants écrits avec les tokens (`bg-bg`, `bg-surface`, `text-fg`, `bg-accent`, `text-accent`…)
s'adaptent automatiquement au mode clair / accent vert. Fondu de thème sombre→clair à l'entrée
(déjà géré par le design system).

## 5. Modèle de données (Firestore)

Deux sous-collections sous `couples/main` (vs ~10 tables dans l'analyse de départ : « un seul
couple » + « une seule liste » suppriment `households`, `household_members`, `shopping_lists`,
`ingredients`, `ingredient_aliases`, etc.).

### 5.1 `couples/main/shoppingItems/{itemId}`

```
name           string    requis, trim, 1..120
quantityLabel  string?   texte libre <=40 ("500 g", "2", "1 paquet") ; null si non précisé
aisle          string    id de rayon (cf. preset) ; défaut "autres"
checked        bool      défaut false
checkedBy      string?   uid autorisé ou null
checkedAt      string?   ISO ou null
note           string?   <=500
createdAt      string    ISO
createdBy      string    uid (== auth.uid à la création)
updatedAt      string    ISO
updatedBy      string    uid (== auth.uid à chaque écriture)
```

### 5.2 `couples/main/shoppingCatalog/{slug}`

La seule brique « intelligente » du MVP. `slug` = identifiant déterministe dérivé du nom
(minuscules, accents retirés, non-alphanumériques → `-`) ⇒ **upsert** et dédoublonnage naturels.

```
name        string    nom canonique affiché
nameLower   string    pour matching/autocomplétion
aisle       string    rayon mémorisé pour ce produit
favorite    bool      défaut false (produit de base épinglé)
useCount    number    incrémenté à chaque ajout
lastUsedAt  string    ISO
createdAt/By, updatedAt/By  (mêmes métadonnées)
```

Ce catalogue fournit **trois features de l'analyse à faible coût** : historique/fréquents
(`useCount`, `lastUsedAt`), favoris/produits de base (`favorite`), auto-classement
(`aisle` mémorisé).

### 5.3 Rayons (config en code, pas en base)

`config/aisles.js` — preset ordonné « parcours magasin ». Ids stables :

| id | label | défaut |
|----|-------|--------|
| `fruits-legumes` | Fruits & légumes | |
| `boucherie` | Boucherie / poissonnerie | |
| `cremerie` | Crémerie / frais | |
| `epicerie-salee` | Épicerie salée | |
| `epicerie-sucree` | Épicerie sucrée / petit-déj | |
| `surgeles` | Surgelés | |
| `boissons` | Boissons | |
| `hygiene` | Hygiène & beauté | |
| `maison` | Maison & entretien | |
| `autres` | Autres | ✅ défaut |

Chaque rayon : `{ id, label, icon (lucide), color, order }`. Le dictionnaire de mots-clés
(`name` minuscule contient un mot-clé → rayon) sert uniquement à **proposer** un rayon ; l'utilisateur
peut toujours le changer, et le catalogue prend le pas si le produit y est déjà connu.

## 6. Logique du catalogue & de l'ajout

À l'**ajout** d'un article (depuis la barre ou un chip) :
1. `slug = slugify(name)`.
2. Rayon : si `catalog[slug].aisle` existe → l'utiliser ; sinon devinette par mots-clés ; sinon
   `autres`.
3. Créer le doc `shoppingItems` (avec métadonnées).
4. **Upsert catalogue** : `useCount += 1`, `lastUsedAt = now`, `name`/`nameLower` (re)posés,
   `aisle` mis à jour si l'utilisateur a explicitement choisi un rayon.

**Cocher / décocher** : `checked`, `checkedBy`, `checkedAt` mis à jour (+ `updatedBy/At`).
**Vider les cochés** : suppression des articles `checked`. **Tout vider** : suppression de tous
les articles (le catalogue, lui, persiste → la mémoire des fréquents reste).
**Fréquents** (chips) : top `useCount` du catalogue (favoris épinglés en tête), en excluant ce qui
est déjà dans la liste. **Favoris** : toggle `favorite` dans `FavoritesSheet`.

## 7. Écrans / UX

Priorité produit n°1 (analyse) : **réduire la friction**. Ajouter un article en 2 s, cocher
facilement en magasin, ne pas imposer une compta parfaite.

### 7.1 Liste (écran principal — `ListView`)

```
┌──────────────────────────────┐
│ ← Nos apps      Courses 🛒  ⋮ │
│ Nos courses                   │
├──────────────────────────────┤
│ [ + Ajouter un article…   ⏎ ] │  barre d'ajout toujours visible
│ Fréquents: (Lait)(Œufs)(Pain) │  chips 1-tap (catalogue)
├──────────────────────────────┤
│ 🥬 Fruits & légumes           │
│  ☐ Tomates          500 g  ·C │  ·C/·L = pastille « qui a ajouté »
│  ☐ Bananes                 ·L │
│ 🥩 Boucherie                  │
│  ☐ Poulet           2      ·C │
│ 🧀 Crémerie / frais           │
│  ☐ Lait             1 L    ·L │
├──────────────────────────────┤
│ ▸ Cochés (3)                  │  zone repliable en bas
└──────────────────────────────┘
        [ 🛒 Mode magasin ]
```

- Seuls les rayons **non vides** sont affichés, dans l'ordre du preset.
- Tap sur une ligne → `ItemEditSheet` (nom, quantité libre, rayon, supprimer).
- Cocher → l'article grise/barre et bascule dans la zone « Cochés » repliable.
- Menu ⋮ : *Vider les cochés*, *Tout vider*, *Gérer les favoris*.
- Autocomplétion à la frappe depuis le catalogue (`nameLower`).
- État vide accueillant (« Ta liste est vide ») + chips de favoris pour démarrer.

### 7.2 Mode magasin (`StoreModeView`)

État focalisé basculé depuis l'en-tête (pas une autre URL). Grosses lignes tap-friendly, rayons
dans l'ordre magasin, **articles cochés masqués** au fur et à mesure, chrome minimal, bouton
« Fini » pour revenir.

```
┌──────────────────────────────┐
│  Mode magasin         Fini ✓  │
│  🥬 Fruits & légumes          │
│   ⬜  Tomates        500 g    │  grosses cases
│   ⬜  Bananes                 │
│  🥩 Boucherie                 │
│   ⬜  Poulet         2        │
│  (articles cochés masqués)    │
└──────────────────────────────┘
```

### 7.3 Favoris / fréquents (`FavoritesSheet`)

Secondaire. Épingler/désépingler des favoris, corriger le rayon par défaut d'un produit, retirer
une entrée du catalogue.

## 8. Règles Firestore

Deux nouveaux blocs `match` dans `firestore.rules`, calqués sur l'existant (`isAuthorizedUser()`,
validateurs de forme, `hasValidMetadata`, `updatedBy == request.auth.uid`, `createdBy == auth.uid`
à la création) :

- `match /couples/main/shoppingItems/{itemId}` avec `hasValidShoppingItemShape` :
  `name` string non vide ≤120 ; `aisle` string ; `checked` bool ; `quantityLabel` absent/null/≤40 ;
  `note` absent/null/≤500.
- `match /couples/main/shoppingCatalog/{slug}` avec `hasValidCatalogShape` :
  `name` string non vide ; `nameLower` string ; `aisle` string ; `favorite` bool ; `useCount`
  number ≥ 0.

Le bloc « deny everything else » final reste en place. (Publication des règles = étape manuelle
côté console Firebase, comme pour les collections existantes.)

## 9. PWA légère

- Dépendance `vite-plugin-pwa` (Workbox sous le capot) ajoutée à `vite.config.js`.
- **Manifest** : `name` « Clément & Lise », `short_name` « C&L », `display: standalone`,
  `start_url: '/'`, `theme_color`/`background_color` (cohérents avec le hub sombre signature),
  `icons` 192/512 + une variante `maskable` (dérivées de `public/favicon.svg`).
- **Service worker** : `registerType: 'autoUpdate'`, precache de l'app-shell ; runtime caching des
  polices Geist (Google Fonts) pour que l'install fonctionne. Firestore reste en réseau (son SDK
  gère son propre cache ; persistance offline complète = plus tard).
- Le `<meta name="theme-color">` reste piloté dynamiquement par `useAppTheme` selon l'app active ;
  le `theme_color` du manifest est statique (utilisé par l'OS pour le splash) — pas de conflit.
- Bénéfice **plateforme entière** : FinAuzi devient lui aussi installable.

## 10. Déploiement & points manuels

- `vercel.json` (rewrite SPA) déjà en place → refresh direct sur `/courses` fonctionne.
- **Étapes manuelles (Clément, hors code) :**
  1. Publier les nouvelles `firestore.rules` dans la console Firebase.
  2. Vérifier l'installabilité PWA sur un téléphone (« Ajouter à l'écran d'accueil »).

## 11. Vérification

Pas de tests automatisés (cohérent avec les specs précédentes). Vérification par :
- `npm run build` propre (aucune erreur d'import, PWA générée).
- **Smoke test manuel** (lancé par Clément avec `! npm run dev`) :
  - `/courses` charge en thème clair/vert, fondu d'entrée non agressif ;
  - ajout d'un article → apparaît **en temps réel** sur l'autre compte ;
  - auto-classement au rayon + override ; quantité texte libre ;
  - cocher/décocher, zone « Cochés », *Vider les cochés*, *Tout vider* ;
  - chips fréquents + favoris (épingler) ; autocomplétion ;
  - mode magasin (cochés masqués, grosses lignes) ;
  - retour « ← Nos apps » ; refresh sur `/courses` ;
  - PWA : installable, app-shell en cache.

## 12. Ordre de réalisation conseillé

1. **PWA + dépendances** : `vite-plugin-pwa`, manifest, icônes (livrable indépendant, vérifiable seul).
2. **Données** : `config/aisles.js` (+ dico), `utils/aisleGuess.js` (slug + devinette),
   `services/shoppingItemsService.js`, `services/catalogService.js`, `hooks/useCoursesData.js`.
3. **Règles Firestore** : blocs `shoppingItems` + `shoppingCatalog`.
4. **UI liste** : `ItemRow`, `AisleSection`, `CheckedZone`, `QuickAddBar`, `ListView`, `ItemEditSheet`.
5. **Mode magasin** : `StoreModeView` + bascule.
6. **Catalogue UI** : `FavoritesSheet` + chips fréquents + autocomplétion.
7. **Câblage** : `CoursesApp` (thème + shell + back), route `/courses` dans `App.jsx`,
   `apps.config.js` (`soon` → `live`).
8. **Vérif** : `npm run build` + smoke test manuel.

## 13. Risques & points d'attention

- **Friction** : garder l'ajout à 1 champ + Entrée ; le rayon est une suggestion, jamais un blocage ;
  quantité **optionnelle**. Ne pas transformer la liste en saisie pénible.
- **Collisions de slug catalogue** (deux produits → même slug) : acceptable pour une app à 2
  personnes ; le `name` canonique reste lisible.
- **Croissance du catalogue** : `Tout vider` ne purge pas le catalogue (volontaire — mémoire des
  fréquents) ; `FavoritesSheet` permet de retirer une entrée si besoin.
- **PWA niveau plateforme** : un changement transverse ; vérifier que FinAuzi reste OK (juste
  installable en plus). Pas d'offline complet (éviter les attentes erronées).
- **Règles Firestore** : à publier manuellement, sinon les écritures `shopping*` échouent.
- **Tokens de thème clair** : utiliser exclusivement les tokens (`bg-surface`, `text-fg`,
  `bg-accent`…) pour que l'app suive bien le mode clair/vert sans couleurs codées en dur.
