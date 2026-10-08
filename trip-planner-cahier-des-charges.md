# Trip Planner · Cahier des charges

> **Pour Claude Code** : ce cahier des charges décrit une nouvelle app dans le repo `les-loulous` (React 18 + Vite + Tailwind + Firebase, déployé sur Vercel).
> Commence par la **V1** uniquement. Suis les conventions existantes du repo :
> - une app = une entrée dans `src/platform/apps.config.js` + une route lazy dans `src/App.jsx` (voir `src/apps/cookit` et `src/apps/muscauzi`) ;
> - organisation `src/apps/<app>/{components,views,hooks,services,config,utils}`, services Firestore avec `onSnapshot` comme `src/apps/cookit/services/mealPlanService.js` ;
> - métadonnées `createdBy` / `updatedBy` validées dans `firestore.rules`, règles ajoutées avant le « tout refuser » final ;
> - composants partagés de `src/shared/ui` et tokens de `src/styles.css`.
> Maquette visuelle de référence : https://claude.ai/artifact/14rpF55J2jeqy1urB7RSoZ

## Contexte et objectifs

Trip Planner est la 4ᵉ app des Loulous, à côté de FinAuzi, Cook'It et MuscAuzi. Elle sert à préparer nos vacances jour par jour, puis à les suivre sur le téléphone pendant le voyage, même sans réseau.

Les outils existants (Wanderlog, TripIt, Polarsteps) sont payants pour l'essentiel ou mal adaptés. Trip Planner doit tout faire gratuitement, avec les comptes Firebase et l'hébergement Vercel déjà en place.

Trois objectifs :

1. Savoir à tout moment ce qui est prévu demain : lieux, horaires, trajets, hébergement et sa réservation.
2. Voir chaque journée d'un coup d'œil grâce à une mini-carte épurée du parcours.
3. Partager le voyage en lecture seule avec des proches, sans qu'ils créent de compte.

## Utilisateurs et usages

On planifie surtout sur ordinateur et on consulte surtout sur téléphone. L'écran desktop est donc un éditeur confortable, et l'écran mobile un carnet de bord rapide à lire.

| Qui | Appareil | Moment | Ce qu'il fait |
| --- | --- | --- | --- |
| Clément et Lise | Ordinateur | Avant le voyage | Créent le voyage, ajoutent hébergements, trajets réservés, jours et étapes |
| Clément et Lise | Téléphone (PWA) | Pendant le voyage, souvent sans réseau | Regardent aujourd'hui et demain, ouvrent l'adresse dans Google Maps, montrent la réservation à l'accueil |
| Invité (famille, amis) | N'importe lequel | Quand il veut | Consulte tout le voyage en lecture seule via son lien, sans compte |

Les deux comptes ont les mêmes droits : chacun peut tout créer, modifier et supprimer, comme dans les autres apps.

## Fonctionnalités

La V1 est un carnet complet et utilisable hors-ligne. La V2 ajoute le partage et les vraies cartes. La V3 regroupe les bonus inspirés des applis premium. Chaque version est utilisable seule.

| Fonction | Détail | Version |
| --- | --- | --- |
| Voyages | Liste des voyages à venir, en cours et archivés. Un voyage passé s'archive tout seul après sa date de fin | V1 |
| Hébergements | Hôtel, Airbnb, camping : adresse, arrivée et départ, référence, prix, code d'accès, notes. Affichés comme une bande au-dessus des jours | V1 |
| Trajets réservés | Train, bus, avion, ferry saisis à la main : numéro, gare ou aéroport, horaires, place, référence | V1 |
| Jours et étapes | Une page par jour avec ses étapes ordonnées : heure, durée, catégorie, notes | V1 |
| Ajouter un lieu | Coller un lien Google Maps : nom et coordonnées récupérés automatiquement | V1 |
| Aujourd'hui / Demain | Pendant un voyage, l'app s'ouvre sur la journée en cours et le lendemain | V1 |
| Justificatifs | Capture d'écran du mail de réservation + lien vers le mail, attachés à un hébergement ou un trajet | V1 |
| Mini-cartes | Dessin épuré du parcours de chaque jour, étapes numérotées | V1 |
| Météo | Petite icône météo sur chaque lieu de chaque jour. Normales de saison en grisé au-delà de 16 jours | V1 |
| Heure locale | Tous les horaires en heure locale du lieu, fuseau déduit des coordonnées | V1 |
| Hors-ligne | Tout le voyage, captures comprises, consultable sans réseau | V1 |
| Liens invités | Un lien par personne, lecture seule, sans compte, révocable | V2 |
| Trajets calculés | Voiture, marche et vélo calculés une fois à l'enregistrement : distance, durée, tracé | V2 |
| Carte zoomable | Vraie carte sobre du jour ou du voyage entier, ouverte d'un tap sur la mini-carte | V2 |
| Carte du monde | Pays déjà visités allumés. Au survol d'un pays, les villes visitées et les voyages concernés | V2 |
| Liste « à caser » | Lieux repérés mais pas encore placés, à glisser dans un jour | V3 |
| Optimiser l'ordre | Réordonne les étapes d'une journée pour le trajet le plus court | V3 |
| Liste de valises | Liste partagée et cochable, sur le modèle des listes de Cook'It | V3 |
| Export agenda | Fichier .ics avec check-ins, départs et étapes | V3 |
| Dépenses vers FinAuzi | Le prix d'une réservation crée une dépense dans FinAuzi | V3 |
| Récap du voyage | Après le voyage : km parcourus, nombre de lieux, carte de tout le trajet | V3 |

## Écrans

Six écrans suffisent. La maquette interactive montre déjà la vue jour sur téléphone : [maquette Trip Planner](https://claude.ai/artifact/14rpF55J2jeqy1urB7RSoZ).

| Écran | Appareil principal | Contenu |
| --- | --- | --- |
| Mes voyages | Les deux | Carte du monde avec les pays visités allumés, puis voyages en cours, à venir et archivés |
| Éditeur de voyage | Ordinateur | Trois colonnes : la liste des jours avec la bande des nuits, le détail du jour sélectionné, la carte. Glisser-déposer des étapes entre les jours |
| Aujourd'hui / Demain | Téléphone | Prochaine étape en grand, bouton « Y aller » vers Google Maps, hébergement du soir avec sa capture de réservation |
| Vue jour | Téléphone | Mini-carte, étapes avec heure et météo, trajets entre les étapes, hébergement du soir |
| Fiche réservation | Les deux | Hébergement ou trajet réservé : toutes les infos, la capture en plein écran, le lien vers le mail |
| Vue invité | Les deux | Même contenu que la vue jour et les fiches, sans aucun bouton de modification, accessible sur `/v/:jeton` sans connexion |

## Modèle de données

Tout vit sous `couples/main/trips`, comme les autres apps. Un hébergement couvre des nuits et n'appartient à aucun jour ; un jour contient ses étapes dans l'ordre.

```
couples/main/trips/{tripId}
  { title, startDate, endDate, status: 'upcoming'|'ongoing'|'archived',
    countries: ['PT', 'ES'], createdBy, updatedBy, createdAt, updatedAt }

  stays/{stayId}            // hôtel, Airbnb, camping
  { kind, name, address, lat, lng, mapsUrl, tz,
    checkIn: '2027-05-12T15:00', checkOut: '2027-05-14T11:00',
    confirmation, price, currency, accessCode, mailUrl, notes, attachmentIds: [] }

  transports/{id}           // train, bus, avion, ferry
  { mode, ref: 'TGV 6173',
    from: { name, lat, lng, tz, at: '2027-05-12T08:12' },
    to:   { name, lat, lng, tz, at: '2027-05-12T10:52' },
    seat, confirmation, price, currency, mailUrl, notes, attachmentIds: [] }

  days/{YYYY-MM-DD}         // une page par jour, comme mealPlan
  { title, notes,
    stops: [{ id, name, lat, lng, mapsUrl, country, tz, time, durationMin, category, notes }],
    legs:  [{ fromStopId, toStopId, mode: 'car'|'walk'|'bike',
              distanceM, durationS, polyline }] }   // V2, calculé une fois

  attachments/{id}          // une capture par document, ≤ 900 Ko
  { name, mime: 'image/webp', data: '<base64>', width, height, createdBy }

publicTrips/{jeton}         // la vitrine invité (V2), hors de couples/main
  { tripId, label: 'Maman', createdAt, trip, stays, transports, days }
  attachments/{id}          // copie des captures pour l'invité
```

Les heures sont stockées en heure locale avec le fuseau du lieu (`tz`), pour que « 08:12 » reste « 08:12 » quel que soit le pays du téléphone. Les captures ont leur propre document parce qu'un document Firestore est limité à 1 Mo.

Règles Firestore à ajouter (avant le « tout refuser » final) :

```
match /couples/main/trips/{tripId}/{document=**} {
  allow read, write: if isAuthorizedUser();
}
match /couples/main/trips/{tripId} {
  allow read, write: if isAuthorizedUser();
}
match /publicTrips/{token}/{document=**} {
  allow get:   if true;              // qui a le lien peut lire
  allow list:  if false;             // personne ne peut énumérer les vitrines
  allow write: if isAuthorizedUser();
}
```

## Choix techniques

Tout est gratuit à notre échelle et rien ne demande de passer Firebase en formule Blaze. La seule nouveauté côté serveur est un dossier `api/` de fonctions Vercel, pour cacher une clé et dérouler les liens Google Maps.

| Besoin | Choix | Coût | Pourquoi |
| --- | --- | --- | --- |
| Stack | React 18, Vite, Tailwind, Firestore, route lazy `/trip/*` | 0 € | Même plomberie que les 3 autres apps |
| Lien Google Maps | Fonction Vercel `api/resolve-maps` qui suit le lien court et lit nom + coordonnées | 0 € | Les liens `maps.app.goo.gl` ne se lisent pas depuis le navigateur |
| Mini-cartes | SVG dessiné depuis les coordonnées, sans fond de carte | 0 €, 0 requête | Ultra léger, hors-ligne, entièrement dans notre style |
| Carte zoomable | MapLibre GL + tuiles OpenFreeMap, style « Positron » | 0 €, sans clé | Carte vectorielle sobre ; lib d'environ 800 Ko chargée seulement à l'ouverture |
| Trajets calculés | OpenRouteService via une fonction Vercel `api/route` | Free tier avec clé | Calculé une seule fois à l'enregistrement puis stocké : les invités ne déclenchent aucun appel |
| Trains, bus, avions, ferries | Saisie manuelle, ligne stylisée sur la carte | 0 € | Le billet est déjà réservé, pas besoin de le calculer |
| Optimiser l'ordre | Endpoint d'optimisation d'OpenRouteService | Free tier | Même clé que les trajets |
| Météo | Open-Meteo : prévisions à 16 jours, normales de saison au-delà | 0 €, sans clé | Mise en cache dans l'app pour rester visible hors-ligne |
| Fuseau horaire | Calculé hors-ligne depuis les coordonnées (lib type `tz-lookup`) | 0 € | Aucune API à appeler |
| Captures | Compressées en WebP dans le navigateur (1600 px de large max), stockées en base64 dans Firestore | 0 € | Hors-ligne grâce au cache Firestore déjà activé, sans Firebase Storage |
| Carte du monde | SVG avec `d3-geo` + fond de pays Natural Earth (\~100 Ko) | 0 € | Pays visités déduits des coordonnées des étapes, sans API |
| Hors-ligne | Cache Firestore persistant (déjà en place) + service worker de la PWA | 0 € | Le voyage s'ouvre sans réseau ; seule la carte zoomable a besoin d'internet |

Limites à connaître : un lien vers un mail Gmail ouvre parfois la boîte de réception au lieu du mail sur téléphone, d'où la capture. Une très longue capture (plus de 900 Ko compressée) sera réduite automatiquement.

## Partage invité et sécurité

Un lien invité fonctionne comme un billet de concert avec un QR code : celui qui l'a entre, personne ne peut deviner les autres, et on peut annuler un billet sans changer la serrure. L'invité voit tout, ne peut rien modifier, et le lien reste ouvert pour toujours tant qu'on ne le révoque pas.

1. Dans un voyage, on crée un lien et on lui donne un nom (« Maman », « Les potes »).
2. L'app tire un jeton aléatoire de 32 caractères et crée la vitrine `publicTrips/{jeton}`, copie complète du voyage et de ses captures.
3. À chaque modification du voyage, la vitrine est mise à jour dans la même écriture (`writeBatch`) : l'invité voit les changements en direct.
4. L'invité ouvre `/v/{jeton}`, une page hors de la connexion qui ne charge pas le reste des Loulous.
5. Firestore autorise la lecture d'une vitrine dont on connaît le jeton, refuse d'en lister, et refuse toute écriture qui ne vient pas de nos deux comptes.
6. Révoquer un lien supprime sa vitrine : le lien affiche alors « Ce voyage n'est plus partagé ».

Point d'attention : comme l'invité voit tout, une personne à qui il transfère le lien voit aussi les codes d'accès et les prix. Un lien par personne permet de couper uniquement celui-là. La vitrine n'est jamais indexée par les moteurs de recherche (`noindex`).

## Thème et design

Trip Planner est la seule app claire à accent bleu lagon, ce qui la distingue des trois autres au premier coup d'œil sur le dashboard.

| App | Thème | Accent |
| --- | --- | --- |
| FinAuzi | Sombre | Ambre |
| Cook'It | Clair | Émeraude |
| MuscAuzi | Sombre | Rouge |
| Trip Planner | Clair | Bleu lagon (proche du cyan 600, `#0891B2`) |

- Nouvelle clé `data-accent="lagoon"` dans `src/styles.css` et `COLOR_BY_ID`, entrée `theme: 'light'` dans `apps.config.js`.
- Icône Lucide : `Plane` ou `Luggage`.
- Réutiliser les composants partagés (`AppShell`, `sheet`, `Modal`, `calendar`) et la police Geist.
- Mini-cartes et carte du monde en niveaux de gris, l'accent réservé au tracé et aux pays visités.
- Couleurs des hébergements dans la bande des nuits : une par hébergement, tirée d'une palette douce fixe.

## Hors périmètre

Ces fonctions sont volontairement exclues pour garder l'app légère, à côté des trois autres :

- Photos et journal de voyage pendant le séjour.
- Navigation GPS pas à pas : le bouton « Y aller » ouvre Google Maps.
- Calcul automatique des transports en commun.
- Alertes de retard ou de changement de porte (API payantes).
- Import automatique des mails de réservation.
- Notifications push.
- Modification par les invités.

## Points ouverts

- [ ] Valider le bleu lagon sur un premier écran.
- [ ] Créer une clé OpenRouteService gratuite et l'ajouter aux variables Vercel avant la V2.
- [ ] Dire si la V1 se livre en une seule PR ou en plusieurs (éditeur desktop, puis vue téléphone).
