// check-docs-budget.mjs : garde de la documentation vivante (`npm run check:docs`, noyau CI).
// Regles (pourquoi : `docs/README.md` § Convention, ADR 0012, 0014, 0021) : 1-2 octets des CLAUDE.md, 3 chaque CLAUDE.md
// de dossier cite par le racine, 4-5 liens, 6 aucune note /100, 7 ancres, 8 convention en cliquet. `[--list | --mesurer]`.
// ❌ Ne JAMAIS relever un plafond ni ajouter une exception pour faire passer : un contenu doit descendre d'un cran.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'

export const ROOT_MAX_BYTES = 24_500
export const NESTED_MAX_BYTES = 14_000
export const PLAFOND_LIGNES_CLAUDE = 150 // se charge seul : ~3 000 tokens
export const PLAFOND_LIGNES_DOC = 300 // se lit sur declencheur : ~6 000 tokens
export const CHEMIN_EXCEPTIONS = 'docs/convention-exceptions.json'
// `.claude` et `.worktrees` portent des copies du depot (autres sessions) : jamais mesurees.
const IGNORED = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.claude', '.worktrees'])

export const REGLES_NOTES = [
  { re: /<!--\s*note-audit:/, dit: 'marqueur `note-audit` (ancienne garde C-109)' },
  { re: /^>\s*\*\*Note d'audit\*\*/m, dit: "phrase « Note d'audit »" },
  { re: /^#{1,4} .*\b\d{1,3} ?\/ ?100\b/m, dit: 'en-tete de note sur 100' },
  { re: /^#{1,4} Note (?:de |d'|du )?[^\n]*:\s*\d{2,3}\s*(?:→|->)/m, dit: 'en-tete de journal de notes (80 → 94)' },
]

const posix = (p) => p.split(sep).join('/')
const lire = (root, rel) => readFileSync(join(root, rel), 'utf8')

/** Tous les CLAUDE.md du depot, chemins POSIX relatifs a `root`. */
export function findClaudeFiles(root) {
  const out = []
  ;(function walk(dir) {
    let entries = []
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      if (IGNORED.has(e)) continue
      const p = join(dir, e)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) walk(p)
      else if (e === 'CLAUDE.md') out.push(posix(relative(root, p)))
    }
  })(root)
  return out.sort()
}

/** Les docs vivants : `docs/*.md` (ni `archive/` ni `adr/`) et `a-faire-code.md`. */
export function findLivingDocs(root) {
  const out = []
  const dir = join(root, 'docs')
  try {
    for (const e of readdirSync(dir)) if (e.endsWith('.md') && statSync(join(dir, e)).isFile()) out.push(`docs/${e}`)
  } catch { /* pas de docs/ */ }
  if (existsSync(join(root, 'a-faire-code.md'))) out.push('a-faire-code.md')
  return out.sort()
}

/** Les liens markdown `](x.md)` d'un fichier, resolus depuis SON dossier. */
function linksOf(root, rel) {
  const found = []
  for (const m of lire(root, rel).matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:\/\//i.test(m[1])) continue
    found.push({ href: m[1], rel: posix(relative(root, resolve(join(root, dirname(rel)), m[1]))) })
  }
  return found
}

/** Ancre GitHub d'un titre : minuscules, ponctuation (emoji compris) retiree sauf `-` et `_`, espaces en tirets. */
export function ancreDe(titre) {
  let t = titre.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  for (let avant = ''; avant !== t; ) { avant = t; t = t.replace(/<[^>]*>/g, '') }
  return t.replace(/`/g, '').replace(/[*~]/g, '').trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')
}

/** Les ancres d'un fichier (titres hors blocs de code, doublons suffixes -1, -2). */
export function ancresDe(texte) {
  const out = new Set()
  const vus = {}
  let code = false
  for (const l of texte.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(l)) code = !code
    const m = code ? null : /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(l)
    if (!m) continue
    const base = ancreDe(m[1])
    const n = vus[base] ?? 0
    vus[base] = n + 1
    out.add(n === 0 ? base : `${base}-${n}`)
  }
  return out
}

/** Les liens `](x.md#ancre)` et `](#ancre)` d'un fichier. */
function liensAvecAncre(root, rel) {
  const found = []
  for (const m of lire(root, rel).matchAll(/\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
    const href = m[1]
    if (/^[a-z]+:/i.test(href) || (href !== '' && !href.endsWith('.md'))) continue
    let ancre = m[2]
    try { ancre = decodeURIComponent(ancre) } catch { /* deja lisible */ }
    const cible = href === '' ? rel : posix(relative(root, resolve(join(root, dirname(rel)), href)))
    found.push({ href: `${href}#${m[2]}`, cible, ancre: ancre.toLowerCase() })
  }
  return found
}

/** Une date AAAA-MM-JJ isolee. Collee a un identifiant (`x-2026-01-02.md`, `noyau/2026-…`), c'est un nom. */
export function datesIsolees(texte) {
  return [...texte.matchAll(/[\w./@-]*\d{4}-\d{2}-\d{2}[\w./@-]*/g)]
    .map((m) => m[0].replace(/[.-]+$/, ''))
    .filter((j) => /^\d{4}-\d{2}-\d{2}$/.test(j))
}

/** Un numero de ligne cite d'un `.md` : `X.md:12`, `X.md#L12`, `X.md` ligne 12, `X.md, l. 12`. */
export function numerosDeLigne(texte) {
  return texte.match(/\.md(?::\d+|#L\d+\b|`?\]?(?:\([^)\s]*\))?,?\s+(?:lignes?|l\.)\s*\d+)/gi) ?? []
}

/** Dans les trois lignes non vides sous le premier `# `, « **Quand lire** » et « **Fait foi** ». */
export function aUnEnTete(texte) {
  const lignes = texte.replace(/\r\n/g, '\n').split('\n')
  const i = lignes.findIndex((l) => /^# /.test(l))
  const suite = i < 0 ? '' : lignes.slice(i + 1).filter((l) => l.trim() !== '').slice(0, 3).join('\n')
  return /\*\*Quand lire\*\*/.test(suite) && /\*\*Fait foi\*\*/.test(suite)
}

/** La mesure d'un fichier. Un fichier GENERE, un marqueur `<!-- … -->` lu par une garde : leurs dates sont des donnees. */
export function mesurerConvention(rel, texte) {
  return {
    plafond: rel.endsWith('CLAUDE.md') ? PLAFOND_LIGNES_CLAUDE : PLAFOND_LIGNES_DOC,
    lignes: texte.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length,
    dates: texte.startsWith('<!-- GENERE') ? 0 : datesIsolees(texte.replace(/<!--[\s\S]*?-->/g, '')).length,
    numerosDeLigne: numerosDeLigne(texte).length,
    entete: aUnEnTete(texte),
  }
}

/** Regle 8 en cliquet : une exception couvre sa mesure ; une mesure qui monte ou une exception inutile est rouge. */
export function auditConvention(root, fichiers) {
  const errors = []
  const p = join(root, CHEMIN_EXCEPTIONS)
  const { fichiers: exceptions = {}, datesLues = {} } = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}
  const retirer = (f, cle) => errors.push(`${f} : « ${cle} » n'est plus en defaut. Retirer « ${cle} » de ses exceptions dans ${CHEMIN_EXCEPTIONS}.`)
  // `datesLues` : un doc dont les dates sont des donnees lues par une garde ; valable si ce script cite le doc.
  const lues = new Set(Object.keys(datesLues).filter((f) => existsSync(join(root, datesLues[f])) && lire(root, datesLues[f]).includes(f)))
  for (const f of Object.keys(datesLues)) if (!lues.has(f)) errors.push(`${CHEMIN_EXCEPTIONS} : datesLues declare ${f} lu par ${datesLues[f]}, qui ne le cite pas.`)
  for (const f of fichiers) {
    const m = mesurerConvention(f, lire(root, f))
    if (lues.has(f)) m.dates = 0
    const ex = exceptions[f] ?? {}
    if (m.lignes > m.plafond && ex.lignes === undefined)
      errors.push(`${f} : ${m.lignes} lignes, au-dela du plafond de ${m.plafond}. Deplacer un recit dans docs/archive/ ou une regle dans le CLAUDE.md de sa zone ; jamais relever la borne.`)
    else if (m.lignes > m.plafond && m.lignes > ex.lignes)
      errors.push(`${f} : ${m.lignes} lignes, au-dela de sa mesure d'exception (${ex.lignes}). Le cliquet ne remonte pas.`)
    else if (m.lignes <= m.plafond && ex.lignes !== undefined) retirer(f, 'lignes')
    for (const [cle, dit, remede] of [
      ['dates', 'date(s) AAAA-MM-JJ isolee(s)', "Un recit date va dans docs/archive/, une decision dans docs/adr/ ; l'etat courant ne se date pas"],
      ['numerosDeLigne', "numero(s) de ligne cite(s) d'un .md", 'Renvoyer a une ancre de section, qui survit au commit suivant'],
    ]) {
      const permis = ex[cle] ?? 0
      if (m[cle] > permis) errors.push(`${f} : ${m[cle]} ${dit}${permis ? `, au-dela de sa mesure d'exception (${permis})` : ''}. ${remede}.`)
      else if (ex[cle] !== undefined && m[cle] === 0) retirer(f, cle)
    }
    if (!m.entete && ex.entete !== false)
      errors.push(`${f} : pas d'en-tete. Sous le titre, trois lignes au plus portant « **Quand lire** » (chemins touches) et « **Fait foi** » (code ou fichier source).`)
    else if (m.entete && ex.entete === false) retirer(f, 'entete')
  }
  for (const f of Object.keys(exceptions))
    if (!fichiers.includes(f)) errors.push(`${CHEMIN_EXCEPTIONS} cite ${f}, qui n'est plus un doc vivant : retirer l'entree.`)
  return errors
}

export function audit(root = process.cwd()) {
  const errors = []
  const rows = []
  const files = findClaudeFiles(root)
  if (!files.includes('CLAUDE.md')) return { errors: ['CLAUDE.md est absent de la racine.'], rows, files }
  const docs = findLivingDocs(root)

  for (const f of files) { // 1-2
    const bytes = statSync(join(root, f)).size
    const max = f === 'CLAUDE.md' ? ROOT_MAX_BYTES : NESTED_MAX_BYTES
    rows.push({ file: f, bytes, max, pct: Math.round((bytes / max) * 1000) / 10 })
    if (bytes > max)
      errors.push(`${f} pese ${bytes} o, au-dela du plafond de ${max} o. Faire DESCENDRE un contenu d un cran (CLAUDE.md de dossier, puis docs/), jamais relever la borne.`)
  }
  const rootLinks = new Set(linksOf(root, 'CLAUDE.md').map((l) => l.rel))
  for (const f of files) // 3 : un CLAUDE.md de dossier que le racine ne cite pas est orphelin
    if (f !== 'CLAUDE.md' && !rootLinks.has(f))
      errors.push(`${f} n est cite par aucun pointeur du CLAUDE.md racine : la regle qu il porte est invisible depuis toute autre zone. L ajouter a la table des CLAUDE.md de zone.`)
  for (const f of [...files, ...docs]) // 4-5
    for (const l of linksOf(root, f)) if (!existsSync(join(root, l.rel))) errors.push(`${f} pointe vers ${l.href}, qui n existe pas.`)
  for (const f of docs) { // 6
    const texte = lire(root, f)
    for (const r of REGLES_NOTES)
      if (r.re.test(texte)) errors.push(`${f} : ${r.dit}. Les notes /100 ont cesse (ADR 0012) : renvoyer vers docs/INDICATEURS.md, deplacer l'historique dans docs/archive/.`)
  }
  const cache = new Map() // 7
  for (const f of [...docs, ...files])
    for (const l of liensAvecAncre(root, f)) {
      if (!l.cible.endsWith('.md') || !existsSync(join(root, l.cible))) continue
      if (!cache.has(l.cible)) cache.set(l.cible, ancresDe(lire(root, l.cible)))
      if (!cache.get(l.cible).has(l.ancre)) errors.push(`${f} pointe vers ${l.href}, dont l'ancre n'existe pas dans ${l.cible}.`)
    }
  errors.push(...auditConvention(root, [...new Set([...docs, ...files])].sort())) // 8
  return { errors, rows, files }
}

const isMain = process.argv[1] && import.meta.url.endsWith(posix(process.argv[1]))
if (isMain) {
  const root = process.cwd()
  if (process.argv.includes('--mesurer')) {
    for (const f of [...findLivingDocs(root), ...findClaudeFiles(root)].sort())
      console.log(JSON.stringify({ f, ...mesurerConvention(f, lire(root, f)) }))
    process.exit(0)
  }
  const { errors, rows } = audit(root)
  if (process.argv.includes('--list') || errors.length) {
    for (const r of rows.sort((a, b) => b.pct - a.pct))
      console.log(`${r.bytes > r.max ? '❌' : r.pct > 90 ? '⚠️ ' : '  '} ${String(r.bytes).padStart(6)} o / ${r.max}  (${r.pct} %)  ${r.file}`)
    console.log('')
  }
  if (errors.length) {
    for (const e of errors) console.error(`::error::${e}`)
    console.error(`\n${errors.length} probleme(s). CLAUDE.md est charge a CHAQUE session : il reste court.`)
    process.exit(1)
  }
  const r = rows.find((x) => x.file === 'CLAUDE.md')
  console.log(`${rows.length} CLAUDE.md + ${findLivingDocs(root).length} doc(s) vivant(s) verifie(s) : racine a ${r.bytes} o (${r.pct} % du plafond), pointeurs coherents, aucun lien mort.`)
}
