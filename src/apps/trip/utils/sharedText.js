// Ce qu'Android transmet quand on « Partage » un lieu depuis Google Maps vers
// l'app (Web Share Target, cf. vite.config.js) : `title`, `text` et `url`,
// remplis selon l'humeur de l'app qui partage. Google Maps met en général le
// nom (et parfois l'adresse) dans `text`, suivi du lien court :
//   « Tour de Belém\nAv. Brasília, 1400-038 Lisboa\nhttps://maps.app.goo.gl/… »
//
// Module pur, testé sous `node --test`.

import { isMapsUrl } from './mapsUrl.js'

const URL_RE = /https?:\/\/[^\s<>"]+/g
// Des titres qui ne nomment rien.
const GENERIC = /^(google maps|maps|partager|share)$/i

function stripUrls(text) {
  return text.replace(URL_RE, ' ').replace(/[ \t]+/g, ' ').trim()
}

function cleanUrl(url) {
  // Une ponctuation collée au lien par la phrase qui l'entoure.
  return url.replace(/[).,;!?»]+$/, '')
}

/**
 * `{ name, address, mapsUrl, url }` : le nom du lieu (le titre, sinon la
 * première ligne du texte), l'adresse (les lignes suivantes), le lien Google
 * Maps s'il y en a un, et à défaut le premier lien venu.
 */
export function parseSharedPlace({ title = '', text = '', url = '' } = {}) {
  const all = [url, text, title].filter(Boolean).join('\n')
  const links = (all.match(URL_RE) || []).map(cleanUrl)
  const mapsUrl = links.find(isMapsUrl) || null

  const lines = (text || '').split(/\r?\n/).map(stripUrls).filter(Boolean)
  const cleanTitle = stripUrls(title || '')
  const titleName = cleanTitle && !GENERIC.test(cleanTitle) ? cleanTitle : ''
  const name = titleName || lines[0] || ''
  const rest = titleName ? lines.filter((l) => l !== titleName) : lines.slice(1)

  return {
    name,
    address: rest.join(', ') || null,
    mapsUrl,
    url: mapsUrl || links[0] || null,
  }
}
