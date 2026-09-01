import { useEffect } from 'react'

// Le clavier virtuel ne rétrécit PAS le viewport de mise en page : un panneau
// `position: fixed; bottom: 0` reste donc ancré au bas de l'écran physique,
// c'est-à-dire sous les touches. Résultat : dans une modale de recherche, les
// résultats s'affichaient derrière le clavier et il fallait le fermer pour
// choisir une ligne.
//
// On mesure donc le viewport *visuel* (la partie réellement visible) et on
// expose deux variables CSS que les modales consomment via `.kb-safe`
// (voir styles.css) :
//   --kb-inset : hauteur masquée en bas → nouvelle valeur de `bottom`
//   --vvh      : hauteur visible → base du `max-height`
//
// Un seul écouteur pour toutes les modales ouvertes (compteur de références) :
// deux sheets peuvent être empilées, ex. FoodPicker → FoodEditSheet.

// La barre d'URL mobile se replie/déplie et fait elle aussi varier le viewport
// visuel de quelques dizaines de pixels. Sous ce seuil ce n'est pas un clavier,
// et remonter le panneau serait un décalage visuel injustifié.
const MIN_KEYBOARD_PX = 120

let refCount = 0
let frame = 0
let lastInset = -1
let lastHeight = -1

function measure() {
  frame = 0
  const vv = window.visualViewport
  if (!vv) return
  const hidden = window.innerHeight - vv.height - vv.offsetTop
  const inset = hidden > MIN_KEYBOARD_PX ? Math.round(hidden) : 0
  const height = Math.round(vv.height)
  const root = document.documentElement
  // Écrire une variable CSS invalide le style de tout le document : on ne le
  // fait que si la valeur a réellement changé (le scroll du viewport visuel
  // émet en rafale sur iOS).
  if (inset !== lastInset) {
    lastInset = inset
    root.style.setProperty('--kb-inset', `${inset}px`)
  }
  if (height !== lastHeight) {
    lastHeight = height
    root.style.setProperty('--vvh', `${height}px`)
  }
}

function schedule() {
  if (frame) return
  frame = requestAnimationFrame(measure)
}

/**
 * Suit le clavier virtuel tant que le composant est monté.
 * À n'appeler que depuis un noeud monté avec la modale (sinon on écoute pour
 * rien pendant toute la vie de l'écran).
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport
    if (!vv) return undefined

    refCount += 1
    if (refCount === 1) {
      vv.addEventListener('resize', schedule)
      vv.addEventListener('scroll', schedule)
    }
    // Mesure immédiate : la modale peut s'ouvrir clavier déjà levé (ex. on
    // enchaîne deux sheets depuis un champ de recherche).
    measure()

    return () => {
      refCount -= 1
      if (refCount > 0) return
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      if (frame) { cancelAnimationFrame(frame); frame = 0 }
      // Purger : une variable restée à 300px décalerait la prochaine modale.
      lastInset = -1
      lastHeight = -1
      document.documentElement.style.removeProperty('--kb-inset')
      document.documentElement.style.removeProperty('--vvh')
    }
  }, [])
}

/**
 * Sonde à poser DANS le contenu de la modale (Radix ne monte ce sous-arbre que
 * lorsqu'elle est ouverte, alors que le composant qui la déclare, lui, reste
 * monté en permanence).
 */
export function KeyboardInsetProbe() {
  useKeyboardInset()
  return null
}
