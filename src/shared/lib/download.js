/**
 * Faire télécharger un fichier fabriqué dans le navigateur.
 *
 * L'URL d'objet est révoquée aussitôt : sans ça, chaque export garderait son
 * contenu en mémoire jusqu'au rechargement de la page.
 *
 * `bom` ajoute la marque d'ordre des octets UTF-8 en tête. Excel en a besoin
 * pour ne pas massacrer les accents ; les analyseurs de CSV la traitent au
 * mieux comme du bruit, au pire comme le premier caractère du premier en-tête.
 * On choisit donc au cas par cas, selon qui lira le fichier.
 */
export function downloadText(filename, content, { type = 'text/plain;charset=utf-8;', bom = false } = {}) {
  const parts = bom ? ['﻿', content] : [content]
  const url = URL.createObjectURL(new Blob(parts, { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
