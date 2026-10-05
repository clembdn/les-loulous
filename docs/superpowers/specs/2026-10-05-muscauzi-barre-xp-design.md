# Conception — MuscAuzi : barre d'XP, fourchettes, échauffements, alternance optionnelle

**Date :** 2026-10-05
**Périmètre :** MuscAuzi (`src/apps/muscauzi`). Deux comptes (Clément, Lise), données sous
`users/{uid}/`. Le fil conducteur : un **coach intégré sans IA** — des consignes calculées par
des règles sur l'historique, jamais par un modèle.

## 1. Contexte & objectif

Le programme se suit par jour de la semaine, les séances se notent série par série. Il manquait
deux choses :

- **savoir quand monter la charge** : on le décide de tête aujourd'hui, au feeling ;
- **un programme unique toutes les semaines** pour qui ne veut pas d'alternance paire/impaire,
  sans l'imposer à l'autre compte.

On adopte la **double progression** : on reste à la même charge tant que toutes les séries
prévues n'ont pas atteint le haut de la fourchette ; barre pleine, on monte d'un cran.

## 2. Modèle de données — uniquement des ajouts

Aucune migration : un document ancien se relit comme avant.

| Où | Ajout | Ancien document relu comme |
|----|-------|----------------------------|
| Ligne de programme | `repsMin`, `repsMax` (+ `reps` = `repsMax`, toujours écrit) | min = max = `reps` |
| Entrée de séance | `prescribedRepsMin`, `prescribedRepsMax` (+ `prescribedReps` = max) | ligne de programme actuelle du même exercice, à défaut min = max = `prescribedReps` |
| Série | `warmup: true` (écrit seulement si vrai) | série de travail |
| Exercice | `incrementKg`, stocké seulement s'il diffère du défaut du type | défaut : haltères 2, barre 2,5, machine 7, poids du corps 0 |
| `program/even` | `alternateWeeks: false` pour couper l'alternance | absent = alternance active |

**Règles Firestore inchangées** : sur `program/{parity}` seuls `days` et `dayNames` sont
validés, sur `sessions` seul `entries`, sur `exercises` seuls `name` et `type`.

**Le piège des normaliseurs** : chacun ne garde que les champs qu'il connaît. Les nouveaux champs
passent par `normalizeLine` / `copyLines` (`programService`), `normalizeEntry` / `normalizeSet` /
`saveEntry` (`sessionsService`), `normalize` / `addExercise` / `updateExercise`
(`exercisesService`). La sauvegarde JSON est brute (tout y
est) ; le CSV gagne en fin de ligne les colonnes `echauffement`,
`reps_min`, `reps_max`, `pas_kg`.

## 3. Logique — modules purs testés

### Échauffements (`utils/sets.js`)
`doneSets` exclut les séries `warmup` : elles sortent d'un coup de l'XP, des records, de
« la dernière fois », de la pastille « exercice terminé », des volumes. `loggedSets` (tout,
échauffements compris) ne sert qu'à l'export.

### Fourchettes (`utils/repRange.js`)
`entryRange(entry, fallback)` : la fourchette figée dans l'entrée ; à défaut celle du programme
actuel (`programRangeIndex`, semaine en cours d'abord) ; à défaut l'ancien nombre fixe.

### Barre d'XP (`utils/progression.js`)
Sur les séances **strictement avant** la date affichée, un passage par date et par exercice —
le regroupement de « la dernière fois » (`passagesByExercise`, `utils/previous.js`), réutilisé.

- **Charge de travail** : celle du plus grand nombre de séries ; à égalité, la plus lourde.
- **N** = séries prévues ce jour-là ; on prend les N premières séries à cette charge, une
  série manquante compte 0.
- **XP** = Σ min(max(reps − min, 0), max − min) / (N × (max − min)).
  Nombre fixe : part des séries ≥ max. Poids du corps non lesté : min(Σ reps / (N × max), 1).
- **Niveau** = nombre de montées de charge faites alors que la barre précédente était pleine.
- **Suggestion**, par priorité : redescendre d'un pas (deux séances de suite à la même charge,
  toutes les séries sous min) › monter d'un pas (barre pleine) › barre pleine sans pas réglé
  (« ajoute du lest ») › rester.
- **Avertissement neutre** : charge du jour au-dessus de la précédente alors que la barre
  n'était pas pleine.

Tests : les cinq exemples synthétiques et cinq séances réelles (incliné 16 × 10/12/12 → 18 kg ;
militaire 14 × 12/12/12 → 16 kg ; rowing 54 × 12/12/12 + 61 × 8 → 54 kg, 75 % ; couché
16 × 12/12 + 18 × 8/10 → 18 kg, 17 % ; curl marteau 12 × 5/7/8/3 → 0 %, et après 12 × 5/5/7 →
redescendre).

## 4. Interface

- **Carte d'exercice** : « Dernière fois · date : séries », puis la barre d'XP (dernière séance,
  puis remplissage en direct avec la dernière en repère), la phrase d'action (« Reste à 18 kg —
  bats 8/7/7/6 », « Niveau suivant : passe à 20 kg », « Redescends à 16 kg »), le record. Badge
  « Niv. N » à côté du nom, animé à la première série faite à la nouvelle charge.
- **Rien n'est pré-rempli** : quand il faut monter ou redescendre, la charge conseillée devient
  le placeholder, et c'est elle que la pastille ✓ et « Répéter » enregistrent.
- **Ligne de série** sur une ligne : numéro (le toucher bascule en échauffement « É ») ·
  kg × reps · ✓. Boutons « + série », « + échauffement », « Répéter ».
- **Aperçu / rail** : « 4 × 6–10 », niveau, mini-barre d'XP, « ↑ 20 kg » / « ↓ 16 kg ».
- **Programme** : séries + deux steppers reps min / max ; interrupteur « Alterner semaines
  paires/impaires » en tête.
- **Fiche exercice** : pas de charge (puces 1,25 · 2 · 2,5 · 5 · 7 ou saisie libre).

## 5. Alternance par compte

Coupée (`program/even.alternateWeeks === false`) : la séance du jour lit toujours le programme
pair, l'onglet impair et les copies vers l'autre semaine disparaissent, `program/odd` est gardé
intact. La séance **enregistre toujours sa vraie parité** ; le bilan et les groupes de séances
comparent alors au seul jour de la semaine. Active : comportement d'avant, plus la mention
« Semaine paire / impaire » en tête de la séance du jour.
