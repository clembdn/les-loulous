# Conception — MuscAuzi : séances « en boucle »

**Date :** 2026-11-21
**Périmètre :** MuscAuzi (`src/apps/muscauzi`). Deux comptes (Clément, Lise), données sous
`users/{uid}/`. Réglage par compte : un compte qui n'y touche pas ne voit rien changer.

## 1. Contexte & objectif

La séance du jour se choisit d'après le jour de la semaine (`isoDayOfWeek(date)` →
`programs[parité].days[jour]`). Qui ne va plus à la salle à jour fixe doit retoucher son
programme à chaque séance, et ses séances s'enregistrent sous le mauvais nom — ce qui fausse les
comparaisons (bilan, groupes de séances), toutes fondées sur ce nom.

On ajoute un mode **« en boucle »** : l'appli propose la séance qui SUIT la dernière séance faite
(Legs → Push → Pull → Rappel → Legs…), quel que soit le jour.

## 2. Modèle de données — un seul ajout

| Où | Ajout | Ancien document relu comme |
|----|-------|----------------------------|
| `program/even` | `scheduleMode: 'rotation'` | absent (ou `'weekday'`) = jours de la semaine |

Rangé à côté d'`alternateWeeks`, pour les mêmes raisons : déjà lu à l'ouverture, et les règles ne
valident que `days` et `dayNames` sur `program/{parity}`. **Aucune règle à publier.**

En boucle, seul le programme **pair** sert, alternance ou pas ; `program/odd` n'est ni affiché ni
effacé.

Les séances ne gagnent aucun champ : en boucle, `dayOfWeek` porte la **case** (1 à 7, ce que les
règles acceptent déjà) et `name` le nom de la case ; `parity` reste la vraie parité. Si le
programme n'a aucune case, la séance retombe sur le vrai jour (écrire `null` serait refusé).

**Normaliseurs** : `subscribeToProgram` expose `scheduleMode` ; `saveScheduleMode` l'écrit en
merge. La sauvegarde JSON relit `program/even` brut : rien à faire. L'export CSV : la colonne
`jour_semaine` est désormais tirée de la **date** — en boucle, `dayOfWeek` est une case, pas un
jour ; en mode jours de la semaine, c'était déjà la même valeur.

## 3. Logique — `utils/rotation.js` (pur, testé)

- **Cases** : les jours NON VIDES de `program/even`, dans l'ordre 1 → 7.
- **Case d'une séance** : par son NOM exact (`dayNames[case] === session.name`) ; sinon son
  `dayOfWeek` s'il désigne une case ; sinon aucune.
- **Case suivante pour une date** : la dernière séance STRICTEMENT avant cette date qui porte du
  travail (`hasCompletedWork`, échauffements exclus) et dont la case est connue → la case d'après,
  en boucle. Aucune → la première case. Une date = une séance : la boucle n'avance qu'une fois par
  jour.
- **Case d'une date** : la séance de cette date est commencée → SA case ; sinon le choix
  manuel ; sinon la case suivante. « Commencée » est ici plus large que pour faire avancer la
  boucle : un échauffement ou un « non fait » suffisent. Dès la première saisie, la séance porte
  le nom de la case, alors que le choix manuel ne vit qu'en mémoire : sans cette règle, rouvrir
  l'appli après un échauffement ramènerait à la case suivante, et la saisie d'après écraserait
  le nom. Le rattrapage d'une date passée suit le même calcul, relatif à
  cette date.

## 4. Interface

- **Séance du jour** : en tête « Séance 3/4 · Pull », avec un bouton « Changer » (liste des cases,
  nom + date de la dernière fois). Le choix est local, remis à zéro au changement de date, et
  n'est plus proposé dès qu'une série est enregistrée. Le badge « Semaine paire » disparaît. Le
  vrai jour sert toujours au reste (rappel de pesée du lundi, date affichée).
- **Programme** : interrupteur « Séances en boucle ». En boucle : onglets de parité et
  interrupteur d'alternance masqués, cases « S1, S2… » / « Séance 1, Séance 2… » au lieu des
  jours, le point marque la prochaine séance, libellés de copie assortis.
- **Bilan / groupes de séances** : comparent déjà par nom ; en boucle on leur dit simplement
  « pas d'alternance » (repli par case sans parité).
- **Mode jours de la semaine** : strictement rien ne change.
