# Conception — Trip Planner V1 « le carnet »

**Date :** 2026-10-05 (lots 1 à 3 livrés le 2026-10-06)
**Périmètre :** Trip Planner (`src/apps/trip`), 4ᵉ app des Loulous. Deux comptes (Clément, Lise),
mêmes droits, données sous `couples/main/trips`. Référence fonctionnelle :
`trip-planner-cahier-des-charges.md` à la racine (+ maquette artifact).

## 1. Contexte & objectif

On prépare un voyage jour par jour sur ordinateur, on le consulte sur téléphone pendant le
voyage, souvent **sans réseau**. La V1 répond aux deux premiers objectifs du cahier :

- savoir à tout moment ce qui est prévu aujourd'hui et demain : lieux, horaires, trajets,
  hébergement et sa réservation ;
- voir chaque journée d'un coup d'œil (mini-carte).

Le partage invité (objectif 3) est la V2. Contraintes : 0 €, free tier Firebase + Vercel,
**aucune dépendance npm**, écritures sans `await`, responsive mobile + vraie mise en page
desktop, sous-pages dans la sidebar.

## 2. Écarts assumés au cahier des charges

| Cahier | Choix V1 | Pourquoi |
|---|---|---|
| `status` stocké sur le voyage | **Dérivé** des dates (`tripStatus(trip, today)`) | S'archive tout seul, sans écriture ni tâche planifiée ; jamais périmé |
| `countries`, `country` | Non stockés | Déductibles des coordonnées en V2 (carte du monde) |
| `tz` par lieu + `tz-lookup` | **Non stocké.** Heures murales saisies et affichées telles quelles | « 08:12 reste 08:12 » ; le téléphone est dans le fuseau du lieu pendant le voyage. Évite ~30 Ko de lib ; le fuseau ne servira qu'aux durées inter-fuseaux et à l'.ics (V3) |
| `checkIn: '2027-05-12T15:00'` | `checkIn: { date, time }`, heure facultative ; idem `from`/`to` des trajets | Heure optionnelle sans ambiguïté, règles simples |
| `attachmentIds` sur la réservation | La capture porte `parentKind` + `parentId`, écrite dans le même lot que sa fiche | Une seule source de vérité, pas d'orphelin si on annule |
| Captures en WebP | WebP, **repli JPEG** si le navigateur n'encode pas le WebP (Safari) | Sinon Safari produit un PNG énorme en silence |
| Règles `allow read, write` | Validation de forme par collection, `create, update` / `delete` séparés | Convention de `firestore.rules` |
| `COLOR_BY_ID` + `data-accent` | Seulement `[data-accent="lagoon"]` | La palette utilisateur ne doit pas proposer lagoon |
| Lien Maps toujours via la fonction Vercel | Lien long **lu dans le navigateur** (hors-ligne) ; fonction pour les liens courts ; recherche **Photon** ; saisie libre | Gares et aéroports ont aussi besoin de coordonnées sans lien Google |
| Étapes « Check-in », « Vol » saisies à la main | La frise **fusionne** trajets réservés et arrivées/départs d'hébergement | Zéro double saisie |
| Trajets entre étapes (V2, ORS) | Distance à vol d'oiseau + lien « Itinéraire » Google Maps | Utile tout de suite, gratuit |
| Modes de transport | + `car` (prise / retour) et `other` ; hébergement + `phone` | Road trip ; appeler l'hôte en retard |
| Météo « mise en cache dans l'app » | Cache **localStorage par appareil** | Donnée dérivée, pas un état partagé : aucune écriture Firestore |
| Météo « sur chaque lieu de chaque jour » | Un ou deux lieux **par journée** (le premier, celui du soir) ; la prochaine étape a la sienne | Avec le regroupement à 0,1°, une icône par étape répéterait la même météo ; un jour de route affiche « ☀ 24° → ⛅ 19° » |
| Vitrine invité dans chaque lot (V2) | Rien en V1 | Services découplés du partage |

## 3. Modèle de données (`couples/main/trips`)

```
trips/{tripId}        { title, startDate, endDate, notes, createdAt/By, updatedAt/By }
  stays/{id}          { kind, name, address, lat, lng, mapsUrl, checkIn:{date,time}, checkOut:{date,time},
                        confirmation, price, currency, accessCode, phone, mailUrl, notes, …meta }
  transports/{id}     { mode, ref, from:{name,address,lat,lng,mapsUrl,date,time}, to:{…}, seat,
                        confirmation, price, currency, mailUrl, notes, …meta }
  days/{AAAA-MM-JJ}   { date, title, notes, stops:[{ id, name, address, lat, lng, mapsUrl, time,
                        durationMin, category, notes }], …meta }
  attachments/{id}    { parentKind, parentId, name, mime, data (base64 ≤ 900 000 car.), width, height, …meta }
```

- Jours affichés = `startDate…endDate` ; un doc `days/{date}` n'existe que s'il a du contenu.
  Raccourcir un voyage masque les jours hors plage, sans les supprimer.
- Écritures sans lecture préalable (`setDoc` en fusion, créateur reporté depuis l'état en
  mémoire). Déplacer une étape entre deux jours = un `writeBatch`. Dernier écrivain gagne sur
  `stops`.
- Supprimer une réservation emporte ses captures ; supprimer un voyage (en ligne seulement)
  balaie ses quatre sous-collections.
- **Rien de nouveau au lot 3** : la météo et l'heure de synchro sont en localStorage.
- `firestore.rules` : section « Trip Planner » (formes, enums, `stops ≤ 40`, captures
  immuables ≤ 1 Mo). **À publier dans la console Firebase** avant usage.

## 4. Écrans

Routes : `/trip` → voyage en cours ? `/trip/:id/aujourdhui` : `/trip/voyages`.
`/trip/:id/{aujourdhui | jours/:date? | resas/:stay-<id>|transport-<id>?}`. Mobile : barre du
bas Aujourd'hui · Jours · Résas · Voyages. Sidebar : « Mes voyages » + groupe au nom du voyage.

- **Mes voyages** : en cours / à venir / passés ; « ✓ hors-ligne » sur les voyages lus en entier
  sur l'appareil.
- **Jours** (lot 2) : téléphone = bande des nuits, pastilles, carte du jour (météo, mini-carte,
  frise), « Ce soir ». Desktop = jours | journée | carte + ce soir, glisser-déposer natif.
- **Résas** (lot 2) : liste chronologique, totaux par devise, fiche, captures plein écran.
- **Aujourd'hui** (lot 3), à l'horloge de la minute (`hooks/useNow.js`) :
  - *pendant* : la prochaine étape en grand (« dans 1 h 20 à 12:09 », météo, place, référence,
    code, capture, **Y aller**), la frise du jour avec le passé grisé, « Ce soir », « Demain » ;
    plus rien de prévu → « Rentrer : <hébergement> · Y aller ». Desktop : deux colonnes, la
    mini-carte en tête de la colonne droite ;
  - *avant* : compte à rebours, chiffres du voyage, aperçu du jour 1, « Avant de partir » (nuits
    sans hébergement, nuits réservées deux fois, étapes sans position) ;
  - *après* : voyage terminé, chiffres, retour aux jours et aux réservations.

### La prochaine étape (`utils/today.js`, `focusOf`)

Par priorité : **en cours** (heure + durée connues) › **prochain élément daté** (seul un horaire
permet « dans 1 h 20 », et c'est lui qu'on ne doit pas rater) › **à suivre** : le premier
élément sans heure après le dernier élément commencé › **journée libre / plus rien de prévu**.

La frise grise les éléments datés terminés **et** les éléments sans heure rangés avant le
dernier élément commencé (`pastKeys`) — même règle que « à suivre ».

« Y aller » (`destinationOf` + `goUrl`) : étape et arrivée à l'hébergement → le lieu ; trajet
qui part → sa gare ; trajet **en cours** → rien (on est dedans), sauf une location qu'on ramène
à l'agence ; départ d'hébergement → rien. Il faut des coordonnées ou une adresse, sinon le lien
d'origine ; un nom seul ne mène nulle part de sûr.

## 5. Météo (Open-Meteo, sans clé)

- **≤ 16 jours** : prévisions (`api.open-meteo.com/v1/forecast`, `timezone=auto`). Cache
  localStorage, rafraîchi au-delà de **3 h**, **affiché même périmé** (hors-ligne, la prévision
  d'hier soir vaut mieux qu'un trou).
- **Au-delà** : normales de saison = moyenne **ERA5** (`archive-api`, `models=era5`) des
  **5 dernières années**, ±3 jours autour de la date : maximales et minimales moyennes, part des
  jours de pluie (≥ 1 mm), temps le plus fréquent (à égalité, le plus clément). Affichées en
  grisé, « ~24° ». **Cache permanent**, indexé par MM-JJ (la normale du 14 mai ne dépend pas de
  l'année), plafonné aux 200 lieux les plus récents.
- **Regroupement à 0,1°** (≈ 11 km) : une ville = une ligne de requête. Une requête de
  prévisions pour tout le voyage ; cinq requêtes d'archive (une par année) pour les normales.
- Jours passés : pas de météo. Faute de prévision (jamais en ligne), une normale déjà en cache
  s'affiche.
- Tout passe par `context/TripWeatherContext.jsx` (lieux de chaque jour à venir, requête
  débouncée de 800 ms) et `services/weatherService.js` (cache + réseau, lecture synchrone).

## 6. Hors-ligne

- **Cache Firestore persistant** (déjà en place), relevé de 40 à **100 Mo**
  (`shared/lib/firebase.js`) : au-delà du plafond, Firestore évince d'abord les documents
  qu'aucun écran n'écoute, c'est-à-dire ceux d'un voyage préchargé. Avec des captures
  jusqu'à ~0,9 Mo chacune, deux voyages bien documentés dépassaient déjà 40 Mo.
- **Indicateur** « disponible hors-ligne · synchro 14:32 » (en-tête du voyage, Résas) : les
  quatre écoutes du voyage passent par `services/listen.js` (`includeMetadataChanges`). Les
  données ne sont redonnées qu'au premier instantané ou quand un document change vraiment, donc
  aucun re-rendu sur un simple changement de métadonnées. L'heure est notée quand les quatre
  parties sont confirmées par le serveur, sans écriture en attente. Elle est propre à
  l'appareil (localStorage) ; hors-ligne, l'indicateur dit « Hors-ligne · synchro … ».
- **Préchargement** (`offlineService.prewarmTrips`) : à l'ouverture de l'app en ligne (et au
  retour du réseau), les voyages en cours ou qui partent **sous 14 jours** sont relus en entier
  par `getDocsFromServer`, au plus une fois par heure, captures comprises.

## 7. Logique pure testée (`node --test`)

`tripDates` (jours, statut, progression, voyages à précharger) · `nights` · `timeline` (frise,
`dayStatus`, `isPast`, `pastKeys`) · `today` (`focusOf`, `destinationOf`, `tripChecks`) ·
`weather` (codes WMO, regroupement, plan prévisions/normales, URL, analyse des réponses,
fenêtres d'archive, normales) · `geo` · `route` · `mapsUrl` (dont `goUrl`) · `photon` · `image`
· `fields` · `format` (dont `formatUntil`, `formatSyncTime`) · `reservations` ·
`api/_lib/mapsResolver`.

```
node --test src/apps/trip/utils/*.test.mjs api/_lib/*.test.mjs
node --test src/apps/*/utils/*.test.mjs        # non-régression des autres apps
npm run build
```

## 8. Limites connues, pistes V2

- Une nuit dans un train ou un avion de nuit apparaît comme « sans hébergement ».
- La météo n'est demandée que pour le voyage **ouvert** : un voyage préchargé sans avoir été
  ouvert part sans prévisions en cache.
- Le préchargement ne tourne qu'à l'ouverture de Trip Planner, pas du portail.
- V2 : liens invités (`/v/:jeton`), trajets calculés (ORS), carte zoomable (MapLibre +
  OpenFreeMap), carte du monde.
