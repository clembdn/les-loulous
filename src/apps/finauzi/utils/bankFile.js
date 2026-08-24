// FinAuzi — lecture d'un relevé bancaire téléchargé.
//
// Les deux banques du foyer exportent gratuitement depuis leur site :
//   Caisse d'Épargne  Gérer → Télécharger les opérations (CSV / QIF / OFX)
//   CommBank          NetBank → Export transactions (CSV / OFX / QIF)
//
// L'OFX est le format à privilégier, et de loin : chaque ligne y porte un
// `FITID`, identifiant unique et stable côté banque. C'est lui qui rend le
// dédoublonnage exact — deux imports du même mois ne créeront jamais deux
// fois la même dépense. En CSV il faut fabriquer une empreinte (date +
// montant + libellé), ce qui reste une heuristique : deux cafés identiques
// le même jour se ressemblent trop pour être distingués.
//
// Tout se passe dans le navigateur. Aucun octet du relevé ne part ailleurs.

const NBSP = /[\s  ]/g

// ─── Décodage ─────────────────────────────────────────────────────────────
// Les exports français sortent encore souvent en Windows-1252 : lus en UTF-8,
// « Libellé » devient « Libell� ». On tente l'UTF-8 strict, et on retombe sur
// le 1252 dès que le décodage échoue.
export function decodeBankFile(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

// ─── Nombres ──────────────────────────────────────────────────────────────
// « 1 234,56 » (France) et « -1234.56 » (Australie) dans la même fonction :
// c'est le DERNIER séparateur qui est le séparateur décimal.
export function parseAmount(raw) {
  if (raw == null) return null
  let s = String(raw).trim().replace(NBSP, '').replace(/[€$A]/g, '')
  if (!s) return null

  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.startsWith('-')) { negative = true; s = s.slice(1) }
  else if (s.startsWith('+')) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s)) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const cut = Math.max(lastComma, lastDot)

  let normalized = s
  if (cut !== -1) {
    const decimals = s.length - cut - 1
    const hasBoth = lastComma !== -1 && lastDot !== -1
    // Un relevé écrit toujours ses centimes sur deux chiffres. Trois chiffres
    // après le dernier séparateur, et pas d'autre séparateur pour trancher :
    // c'est « 1.234 » = mille deux cent trente-quatre, pas 1,234 €.
    const isThousands = !hasBoth && decimals === 3
    normalized = isThousands
      ? s.replace(/[.,]/g, '')
      : `${s.slice(0, cut).replace(/[.,]/g, '')}.${s.slice(cut + 1)}`
  }

  const value = Number(normalized)
  if (!isFinite(value)) return null
  return negative ? -value : value
}

// ─── Dates ────────────────────────────────────────────────────────────────
// Toujours rendues en clé locale « AAAA-MM-JJ », comme le reste de l'app :
// depuis l'Australie, passer par UTC daterait de la veille.
function toKey(year, month, day) {
  if (!(year > 1900) || !(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseBankDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()

  // OFX : AAAAMMJJ, éventuellement suivi de l'heure et du fuseau.
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (ofx && s.length >= 8 && !s.includes('-') && !s.includes('/')) {
    return toKey(+ofx[1], +ofx[2], +ofx[3])
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return toKey(+iso[1], +iso[2], +iso[3])

  // Jour en premier : les deux banques datent en JJ/MM.
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (dmy) {
    const year = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3]
    return toKey(year, +dmy[2], +dmy[1])
  }

  return null
}

// ─── OFX ──────────────────────────────────────────────────────────────────
// Le format est du SGML : les balises ne sont pas toujours refermées. On lit
// donc « valeur jusqu'à la prochaine balise ou fin de ligne », ce qui marche
// aussi bien sur les fichiers bien formés (OFX 2.x, XML) que sur les autres.

function ofxTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return match ? match[1].trim() : null
}

function parseOFX(text) {
  const lines = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []
  const currency = ofxTag(text, 'CURDEF')

  for (const block of blocks) {
    const date = parseBankDate(ofxTag(block, 'DTPOSTED'))
    const amount = parseAmount(ofxTag(block, 'TRNAMT'))
    if (!date || amount == null || amount === 0) continue

    const name = ofxTag(block, 'NAME')
    const memo = ofxTag(block, 'MEMO')
    const label = [name, memo].filter(Boolean).join(' — ') || 'Opération'

    lines.push({
      externalId: ofxTag(block, 'FITID') || null,
      date,
      amount,
      label: decodeEntities(label),
    })
  }

  return { format: 'ofx', currency: currency || null, lines }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(+code))
}

// ─── CSV ──────────────────────────────────────────────────────────────────

// Découpe une ligne CSV en respectant les guillemets — un libellé peut
// contenir le séparateur (« CARREFOUR MARKET, PARIS 11 »).
function splitCSVLine(line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i += 1 }
        else quoted = false
      } else current += char
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

function sniffDelimiter(lines) {
  const candidates = [';', ',', '\t', '|']
  let best = ';'
  let bestScore = -1
  for (const delimiter of candidates) {
    // Le bon séparateur est celui qui découpe toutes les lignes en un même
    // nombre de colonnes — et en plus d'une.
    const counts = lines.map((l) => splitCSVLine(l, delimiter).length)
    const width = counts[0]
    if (width < 2) continue
    const stable = counts.filter((c) => c === width).length
    const score = stable * 10 + width
    if (score > bestScore) { bestScore = score; best = delimiter }
  }
  return best
}

const HEADER_HINTS = {
  date: [/date.*(op[ée]ration|comptabilisation|valeur)/i, /^date/i, /\bdate\b/i],
  label: [/libell/i, /description/i, /nature/i, /d[ée]tail/i, /narrative/i],
  amount: [/^montant/i, /\bmontant\b/i, /^amount/i, /\bamount\b/i],
  debit: [/d[ée]bit/i, /withdrawal/i],
  credit: [/cr[ée]dit/i, /deposit/i],
}

function matchHeader(cells, hints) {
  for (const hint of hints) {
    const index = cells.findIndex((c) => hint.test(c))
    if (index !== -1) return index
  }
  return -1
}

// Un export CE commence souvent par plusieurs lignes d'en-tête de compte
// avant la vraie ligne de colonnes. On cherche donc la première ligne qui
// ressemble à un en-tête ; à défaut, le fichier est positionnel (CommBank).
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const cells = rows[i]
    const hasDate = matchHeader(cells, HEADER_HINTS.date) !== -1
    const hasMoney = matchHeader(cells, HEADER_HINTS.amount) !== -1
      || matchHeader(cells, HEADER_HINTS.debit) !== -1
      || matchHeader(cells, HEADER_HINTS.label) !== -1
    if (hasDate && hasMoney) return i
  }
  return -1
}

// CommBank exporte sans en-tête : date, montant, libellé, solde.
// On repère les colonnes par leur contenu plutôt que par leur nom.
function guessPositional(rows) {
  const sample = rows.slice(0, 20)
  const width = sample[0]?.length || 0
  let dateIndex = -1
  let amountIndex = -1
  let labelIndex = -1

  for (let col = 0; col < width; col += 1) {
    const values = sample.map((r) => r[col]).filter(Boolean)
    if (values.length === 0) continue
    const dates = values.filter((v) => parseBankDate(v)).length
    const numbers = values.filter((v) => parseAmount(v) != null).length
    if (dateIndex === -1 && dates === values.length) { dateIndex = col; continue }
    if (numbers === values.length) {
      // Deux colonnes numériques : la première est le montant, la seconde
      // le solde courant. C'est l'ordre de CommBank.
      if (amountIndex === -1) amountIndex = col
      continue
    }
    if (labelIndex === -1) labelIndex = col
  }

  return { dateIndex, amountIndex, labelIndex, debitIndex: -1, creditIndex: -1 }
}

function parseCSV(text) {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (rawLines.length === 0) return { format: 'csv', currency: null, lines: [] }

  const delimiter = sniffDelimiter(rawLines.slice(0, 20))
  const rows = rawLines.map((l) => splitCSVLine(l, delimiter))

  const headerIndex = findHeader(rows)
  let columns
  let bodyStart

  if (headerIndex === -1) {
    columns = guessPositional(rows)
    bodyStart = 0
  } else {
    const header = rows[headerIndex]
    columns = {
      dateIndex: matchHeader(header, HEADER_HINTS.date),
      labelIndex: matchHeader(header, HEADER_HINTS.label),
      amountIndex: matchHeader(header, HEADER_HINTS.amount),
      debitIndex: matchHeader(header, HEADER_HINTS.debit),
      creditIndex: matchHeader(header, HEADER_HINTS.credit),
    }
    bodyStart = headerIndex + 1
  }

  if (columns.dateIndex === -1) return { format: 'csv', currency: null, lines: [], error: 'no-date-column' }

  const lines = []
  for (let i = bodyStart; i < rows.length; i += 1) {
    const cells = rows[i]
    const date = parseBankDate(cells[columns.dateIndex])
    if (!date) continue

    // Colonnes Débit / Crédit séparées (Caisse d'Épargne) ou colonne unique
    // signée (CommBank).
    let amount = null
    if (columns.amountIndex !== -1) {
      amount = parseAmount(cells[columns.amountIndex])
    }
    if (amount == null && columns.debitIndex !== -1) {
      const debit = parseAmount(cells[columns.debitIndex])
      if (debit != null && debit !== 0) amount = -Math.abs(debit)
    }
    if (amount == null && columns.creditIndex !== -1) {
      const credit = parseAmount(cells[columns.creditIndex])
      if (credit != null && credit !== 0) amount = Math.abs(credit)
    }
    if (amount == null || amount === 0) continue

    const label = columns.labelIndex !== -1 ? cells[columns.labelIndex] : ''
    lines.push({ externalId: null, date, amount, label: label || 'Opération' })
  }

  return { format: 'csv', currency: null, lines }
}

// ─── Entrée publique ──────────────────────────────────────────────────────

export function parseBankFile(text) {
  const trimmed = text.trimStart()
  const isOFX = /<STMTTRN>/i.test(trimmed) || /^OFXHEADER/i.test(trimmed) || /<OFX>/i.test(trimmed)
  const result = isOFX ? parseOFX(text) : parseCSV(text)

  // Une empreinte de repli pour les formats sans identifiant : elle suffit à
  // ne pas réimporter deux fois le même fichier, sans prétendre distinguer
  // deux opérations réellement identiques le même jour.
  const seen = new Map()
  for (const line of result.lines) {
    if (line.externalId) continue
    const base = `${line.date}|${line.amount.toFixed(2)}|${line.label.slice(0, 40).toLowerCase()}`
    const seenCount = (seen.get(base) || 0) + 1
    seen.set(base, seenCount)
    line.externalId = `csv:${base}${seenCount > 1 ? `#${seenCount}` : ''}`
    line.isSyntheticId = true
  }

  result.lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return result
}
