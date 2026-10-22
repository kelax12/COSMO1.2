// ═══════════════════════════════════════════════════════════════════
// check-docs-budget.mjs — le cliquet des CLAUDE.md
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `CLAUDE.md` est le SEUL fichier de ce depot qui se paie a chaque session :
// il est charge integralement avant chaque demande. Le 2026-09-16 il pesait
// 2 070 lignes et ~43 000 tokens, contre 17,8 ko dix semaines plus tot, soit
// x8,4, avec 78 commits sur ce seul fichier en trente jours.
//
// La courbe ne s est JAMAIS auto-corrigee. Elle ne se corrigera pas davantage
// par bonne volonte : un fichier se complete par le bas, sans etre relu, et
// c est ainsi qu il a porte des affirmations fausses pendant des jours.
//
// Ce script mesure QUATRE choses, pas une. Un simple comptage d octets
// laisserait passer la vraie regression : une regle qui descend dans un
// CLAUDE.md de dossier que le racine ne cite plus devient ORPHELINE, donc
// invisible depuis toute autre zone. C est le seul risque du decoupage, et
// c est le point 3.
//
// ❌ Ne JAMAIS relever un plafond pour faire passer la CI. Un depassement dit
// qu un contenu doit descendre d un cran (dossier, puis docs/), pas que la
// borne est trop basse.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'

/** Plafonds, poses ~5 % au-dessus du mesure du 2026-09-16 (23 189 / 13 289). */
export const ROOT_MAX_BYTES = 24_500
export const NESTED_MAX_BYTES = 14_000

// `.claude` et `.worktrees` portent des COPIES du depot (worktrees d autres
// sessions, skills installes). Les mesurer ferait echouer la garde sur un
// arbre qui n est pas le notre, et dont le CLAUDE.md est celui d AVANT.
const IGNORED = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.next',
  'build',
  '.claude',
  '.worktrees',
])

/** Tous les CLAUDE.md du depot, chemins POSIX relatifs a `root`. */
export function findClaudeFiles(root) {
  const out = []
  ;(function walk(dir) {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const e of entries) {
      if (IGNORED.has(e)) continue
      const p = join(dir, e)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(p)
      else if (e === 'CLAUDE.md') out.push(relative(root, p).split(sep).join('/'))
    }
  })(root)
  return out.sort()
}

/** Les liens markdown d un fichier, resolus depuis SON dossier. */
function linksOf(root, rel) {
  const body = readFileSync(join(root, rel), 'utf8')
  const found = []
  const re = /\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g
  let m
  while ((m = re.exec(body)) !== null) {
    const href = m[1]
    if (/^[a-z]+:\/\//i.test(href)) continue
    const abs = resolve(join(root, dirname(rel)), href)
    found.push({ href, rel: relative(root, abs).split(sep).join('/') })
  }
  return found
}

/**
 * Les documents VIVANTS dont les liens doivent tenir.
 *
 * `docs/archive/**` en est exclu : ce sont des instantanes dates, non
 * maintenus, et le depot interdit deja de les lire comme un etat courant.
 * Un lien mort y est une trace d'epoque, pas une regression.
 */
export function findLivingDocs(root) {
  const out = []
  const dir = join(root, 'docs')
  try {
    for (const e of readdirSync(dir)) {
      if (e.endsWith('.md') && statSync(join(dir, e)).isFile()) out.push(`docs/${e}`)
    }
  } catch {
    /* pas de docs/ : rien a verifier */
  }
  for (const f of ['faille.md', 'a-faire-code.md']) {
    if (existsSync(join(root, f))) out.push(f)
  }
  return out.sort()
}

export function audit(root = process.cwd()) {
  const errors = []
  const rows = []
  const files = findClaudeFiles(root)

  if (!files.includes('CLAUDE.md')) {
    errors.push('CLAUDE.md est absent de la racine.')
    return { errors, rows, files }
  }

  // ── 1 et 2 · les plafonds ────────────────────────────────────────
  for (const f of files) {
    const bytes = statSync(join(root, f)).size
    const max = f === 'CLAUDE.md' ? ROOT_MAX_BYTES : NESTED_MAX_BYTES
    const pct = Math.round((bytes / max) * 1000) / 10
    rows.push({ file: f, bytes, max, pct })
    if (bytes > max) {
      errors.push(
        `${f} pese ${bytes} o, au-dela du plafond de ${max} o. ` +
          `Faire DESCENDRE un contenu d un cran (CLAUDE.md de dossier, puis docs/), jamais relever la borne.`,
      )
    }
  }

  // ── 3 · integrite des pointeurs, dans LES DEUX SENS ──────────────
  //
  // Sens A : un CLAUDE.md de dossier que le racine ne cite pas est
  // ORPHELIN. Personne ne peut le trouver depuis une autre zone, et la
  // regle qu il porte est perdue sans qu aucun octet ne manque.
  const rootLinks = new Set(linksOf(root, 'CLAUDE.md').map((l) => l.rel))
  for (const f of files) {
    if (f === 'CLAUDE.md') continue
    if (!rootLinks.has(f)) {
      errors.push(
        `${f} n est cite par aucun pointeur du CLAUDE.md racine : la regle qu il porte est ` +
          `invisible depuis toute autre zone. L ajouter a la table « Ou est ecrit le reste ».`,
      )
    }
  }
  // Sens B : un pointeur qui ne vise rien.
  for (const l of linksOf(root, 'CLAUDE.md')) {
    if (!existsSync(join(root, l.rel))) {
      errors.push(`CLAUDE.md pointe vers ${l.href}, qui n existe pas.`)
    }
  }

  // ── 4 · tout lien cite par un CLAUDE.md doit exister ─────────────
  for (const f of files) {
    for (const l of linksOf(root, f)) {
      if (!existsSync(join(root, l.rel))) {
        errors.push(`${f} pointe vers ${l.href}, qui n existe pas.`)
      }
    }
  }

  // ── 5 · les liens des DOCS vivants ───────────────────────────────
  //
  // Ajoute le 2026-09-16, apres que la decoupe de `CLAUDE.md` a produit SIX
  // liens morts d'un coup : des chemins ecrits pour la racine (`./docs/X.md`)
  // recopies tels quels dans `docs/`, ou ils visent `docs/docs/`. Ils ont ete
  // trouves A LA MAIN, donc ils seraient revenus.
  //
  // ⚠️ Un lien mort dans un doc n'est pas cosmetique : c'est la carte qui
  // envoie dans le vide, et ce depot RENVOIE au doc de domaine pour presque
  // toute regle depuis la meme decoupe.
  for (const f of findLivingDocs(root)) {
    for (const l of linksOf(root, f)) {
      if (!existsSync(join(root, l.rel))) {
        errors.push(`${f} pointe vers ${l.href}, qui n existe pas.`)
      }
    }
  }

  return { errors, rows, files }
}

// ── CLI ────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'))
if (isMain) {
  const { errors, rows } = audit(process.cwd())
  const wantList = process.argv.includes('--list')

  if (wantList || errors.length) {
    for (const r of rows.sort((a, b) => b.pct - a.pct)) {
      const flag = r.bytes > r.max ? '❌' : r.pct > 90 ? '⚠️ ' : '  '
      console.log(`${flag} ${String(r.bytes).padStart(6)} o / ${r.max}  (${r.pct} %)  ${r.file}`)
    }
    console.log('')
  }

  if (errors.length) {
    for (const e of errors) console.error(`::error::${e}`)
    console.error(`\n${errors.length} probleme(s). CLAUDE.md est charge a CHAQUE session : il reste court.`)
    process.exit(1)
  }

  const root = rows.find((r) => r.file === 'CLAUDE.md')
  const docs = findLivingDocs(process.cwd()).length
  console.log(
    `${rows.length} CLAUDE.md + ${docs} doc(s) vivant(s) verifie(s) : racine a ${root.bytes} o ` +
      `(${root.pct} % du plafond), pointeurs coherents, aucun lien mort.`,
  )
}
