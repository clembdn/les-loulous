// Génère src/apps/courses/data/ciqual.json depuis la table CIQUAL 2020 de l'ANSES.
//
// À lancer UNE SEULE FOIS (le JSON produit est commité) :
//   node scripts/build-ciqual.mjs
//
// Aucune dépendance npm : le .xls est converti en CSV par LibreOffice (`soffice`),
// déjà présent sur la machine. Si soffice manque : sudo apt install libreoffice-calc
//
// Source : https://ciqual.anses.fr — table de composition nutritionnelle des
// aliments, ~3 200 aliments bruts en français, données publiques et gratuites.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const XLS_URL = 'https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xls'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/apps/courses/data/ciqual.json')

// Index de colonnes dans le CSV converti (cf. en-tête de la table CIQUAL 2020).
const COL = {
  code: 6, name: 7, group: 3,
  kcal: 10,        // Energie, Règlement UE N° 1169/2011 (kcal/100 g)
  proteins: 14,    // Protéines, N x facteur de Jones
  carbs: 16, fat: 17, sugars: 18,
  fiber: 26,       // Fibres alimentaires
  satFat: 31,      // AG saturés
  salt: 49,        // Sel chlorure de sodium
}

// Parse une valeur CIQUAL : "12,5" → 12.5, "-" → null, "traces" → 0, "< 0,3" → 0.3.
function num(raw) {
  const s = String(raw ?? '').trim()
  if (!s || s === '-') return null
  if (/^traces$/i.test(s)) return 0
  const n = Number(s.replace('<', '').replace(',', '.').trim())
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// Parseur CSV minimal (guillemets doublés, séparateur virgule, sauts de ligne échappés).
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const tmp = mkdtempSync(join(tmpdir(), 'ciqual-'))
try {
  console.log('→ téléchargement de la table CIQUAL…')
  const res = await fetch(XLS_URL)
  if (!res.ok) throw new Error(`téléchargement échoué : HTTP ${res.status}`)
  writeFileSync(join(tmp, 'ciqual.xls'), Buffer.from(await res.arrayBuffer()))

  console.log('→ conversion xls → csv (LibreOffice)…')
  execFileSync('soffice', [
    '--headless',
    '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,true',
    '--outdir', tmp, join(tmp, 'ciqual.xls'),
  ], { stdio: 'ignore' })

  const rows = parseCsv(readFileSync(join(tmp, 'ciqual.csv'), 'utf8'))
  const foods = []
  let skipped = 0
  for (const r of rows.slice(1)) {
    const kcal = num(r[COL.kcal])
    const name = String(r[COL.name] || '').trim()
    // Sans énergie ni nom, la ligne est inutilisable pour un calcul nutritionnel.
    if (!name || kcal == null) { skipped += 1; continue }
    foods.push([
      String(r[COL.code] || '').trim(),
      name,
      String(r[COL.group] || '').trim(),
      kcal,
      num(r[COL.proteins]), num(r[COL.carbs]), num(r[COL.fat]),
      num(r[COL.sugars]), num(r[COL.fiber]), num(r[COL.satFat]), num(r[COL.salt]),
    ])
  }
  foods.sort((a, b) => a[1].localeCompare(b[1], 'fr'))

  // Format compact (tableaux positionnels) : ~2× plus léger qu'un tableau d'objets.
  writeFileSync(OUT, JSON.stringify({
    source: 'CIQUAL 2020 — ANSES (https://ciqual.anses.fr)',
    fields: ['code', 'name', 'group', 'kcal', 'proteins', 'carbs', 'fat', 'sugars', 'fiber', 'satFat', 'salt'],
    foods,
  }))
  console.log(`✓ ${foods.length} aliments écrits (${skipped} lignes sans énergie ignorées) → ${OUT}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
