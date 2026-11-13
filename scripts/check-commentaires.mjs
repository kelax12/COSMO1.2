// check-commentaires.mjs : cliquet sur les commentaires de `src/` qui racontent
// au lieu d'expliquer (COD-01, vague 17.1).
//
// Un commentaire dit un invariant ou un pourquoi, en une à trois lignes. Un récit
// d'incident (date ISO, marqueur 🔴) va dans le message de commit ou dans un ADR
// (`docs/adr/`). Cette garde COMPTE, dans les commentaires de code de production :
//   · `dates`  : les lignes de commentaire qui portent une date ISO (AAAA-MM-JJ) ;
//   · `rouges` : les lignes de commentaire qui portent le marqueur 🔴.
// et échoue si l'un des deux monte au-delà de `scripts/commentaires.reference.json`.
//
// La référence ne fait que BAISSER : `--update` la recale vers le bas et refuse de
// la relever. ❌ Ne jamais la remonter pour faire passer la CI : un dépassement dit
// qu'un commentaire doit devenir une ligne de « pourquoi » ou un message de commit.
//
// Le périmètre est lu par le PARSEUR TypeScript (un `//` dans une chaîne ou dans
// une URL n'est pas un commentaire), jamais par une expression régulière sur le
// texte. Les tests (`*.test.*`) sont comptés à part et ne sont pas bornés : leurs
// dates sont des témoins d'incident, c'est leur rôle.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const RACINE = process.cwd()
const REFERENCE = join(RACINE, 'scripts', 'commentaires.reference.json')

const DATE_ISO = /\b20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/
const MARQUEUR = '\u{1F534}'
const EST_UN_TEST = /\.(test|spec)\.(ts|tsx)$/
const IGNORES = new Set(['node_modules', 'dist', 'coverage', '__test__'])

/** Tous les `.ts` / `.tsx` de `src/`, chemins POSIX relatifs à `racine`. */
export function listerSources(racine = RACINE) {
  const out = []
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (IGNORES.has(entree)) continue
      const chemin = join(rep, entree)
      if (statSync(chemin).isDirectory()) marcher(chemin)
      else if (/\.(ts|tsx)$/.test(entree) && !entree.endsWith('.d.ts')) {
        out.push(relative(racine, chemin).split(sep).join('/'))
      }
    }
  }
  const src = join(racine, 'src')
  if (existsSync(src)) marcher(src)
  return out.sort()
}

/** Les commentaires d'un source : `{ texte, ligne }` (ligne de début, base 1). */
export function commentairesDe(texte, nom = 'x.tsx') {
  const kind = nom.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(nom, texte, ts.ScriptTarget.Latest, true, kind)
  const vus = new Set()
  const out = []
  const noter = (plages) => {
    for (const p of plages ?? []) {
      if (vus.has(p.pos)) continue
      vus.add(p.pos)
      out.push({ texte: texte.slice(p.pos, p.end), pos: p.pos })
    }
  }
  const visiter = (noeud) => {
    noter(ts.getLeadingCommentRanges(texte, noeud.pos))
    noter(ts.getTrailingCommentRanges(texte, noeud.end))
    for (const enfant of noeud.getChildren(sf)) visiter(enfant)
  }
  visiter(sf)
  return out.sort((a, b) => a.pos - b.pos)
}

/** Les lignes de commentaire qui portent une date ISO et le marqueur 🔴. */
export function compterDans(texte, nom) {
  let dates = 0
  let rouges = 0
  for (const c of commentairesDe(texte, nom)) {
    for (const ligne of c.texte.split(/\r?\n/)) {
      if (DATE_ISO.test(ligne)) dates++
      if (ligne.includes(MARQUEUR)) rouges++
    }
  }
  return { dates, rouges }
}

export function mesurer(racine = RACINE) {
  const prod = { dates: 0, rouges: 0 }
  const tests = { dates: 0, rouges: 0 }
  const fichiers = []
  for (const f of listerSources(racine)) {
    const n = compterDans(readFileSync(join(racine, f), 'utf8'), f)
    const cible = EST_UN_TEST.test(f) ? tests : prod
    cible.dates += n.dates
    cible.rouges += n.rouges
    if (!EST_UN_TEST.test(f) && (n.dates || n.rouges)) fichiers.push({ fichier: f, ...n })
  }
  fichiers.sort((a, b) => b.dates + b.rouges - (a.dates + a.rouges))
  return { prod, tests, fichiers }
}

/** Verdict : rouge si un compteur dépasse la référence. */
export function juger(mesure, reference) {
  const erreurs = []
  const baisses = []
  for (const cle of ['dates', 'rouges']) {
    if (mesure[cle] > reference[cle]) {
      erreurs.push(
        `${mesure[cle]} commentaire(s) avec ${cle === 'dates' ? 'une date ISO' : 'le marqueur 🔴'}, ` +
          `la référence est ${reference[cle]}. Réécrire en une à trois lignes de « pourquoi » ` +
          `(le récit va dans le message de commit ou dans un ADR), ne jamais relever la référence.`,
      )
    } else if (mesure[cle] < reference[cle]) {
      baisses.push(`${cle} : ${mesure[cle]} < ${reference[cle]}, lancer \`npm run check:commentaires -- --update\``)
    }
  }
  return { erreurs, baisses }
}

export function lireReference(chemin = REFERENCE) {
  const j = JSON.parse(readFileSync(chemin, 'utf8'))
  return { dates: j.dates, rouges: j.rouges }
}

/** Recale vers le bas. Refuse de relever : renvoie les clés refusées. */
export function recaler(mesure, reference) {
  const refus = ['dates', 'rouges'].filter((c) => mesure[c] > reference[c])
  const nouveau = {
    dates: Math.min(mesure.dates, reference.dates),
    rouges: Math.min(mesure.rouges, reference.rouges),
  }
  return { refus, nouveau }
}

const principal = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'))
if (principal) {
  const { prod, tests, fichiers } = mesurer()
  if (process.argv.includes('--detail')) {
    for (const f of fichiers.slice(0, 40)) console.log(`${String(f.dates).padStart(4)} dates ${String(f.rouges).padStart(4)} 🔴  ${f.fichier}`)
  }
  console.log(`production : ${prod.dates} ligne(s) datée(s), ${prod.rouges} marqueur(s) 🔴 · tests (non bornés) : ${tests.dates} / ${tests.rouges}`)

  // Une seule ouverture : lire, et traiter ENOENT, au lieu de tester puis relire
  // (CodeQL js/file-system-race). `--init` crée avec le drapeau `wx`.
  let reference
  try {
    reference = lireReference()
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    if (process.argv.includes('--init')) {
      writeFileSync(REFERENCE, JSON.stringify({ dates: prod.dates, rouges: prod.rouges }, null, 2) + '\n', { flag: 'wx' })
      console.log('référence créée')
      process.exit(0)
    }
    console.error('::error::scripts/commentaires.reference.json absent')
    process.exit(1)
  }
  if (process.argv.includes('--update')) {
    const { refus, nouveau } = recaler(prod, reference)
    if (refus.length) {
      console.error(`::error::la référence ne se relève pas (${refus.join(', ')}) : réécrire les commentaires`)
      process.exit(1)
    }
    writeFileSync(REFERENCE, JSON.stringify(nouveau, null, 2) + '\n')
    console.log(`référence recalée : ${nouveau.dates} dates, ${nouveau.rouges} 🔴`)
    process.exit(0)
  }
  const { erreurs, baisses } = juger(prod, reference)
  for (const b of baisses) console.log(`::notice title=Commentaires::${b}`)
  if (erreurs.length) {
    for (const e of erreurs) console.error(`::error title=Commentaires::${e}`)
    process.exit(1)
  }
  console.log(`ok : référence ${reference.dates} dates, ${reference.rouges} 🔴`)
}
