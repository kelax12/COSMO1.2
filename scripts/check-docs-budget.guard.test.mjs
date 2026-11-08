// ═══════════════════════════════════════════════════════════════════
// check-docs-budget.guard.test.mjs — le TEMOIN du cliquet des CLAUDE.md
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `check-docs-budget.mjs` repond « tout va bien » sur un depot sain. Une garde
// qui se trompe dans le sens rassurant est pire qu une garde absente : elle
// donne une reponse, et on la croit (CLAUDE.md, § garde-fous transversaux).
// Quatre gardes de ce depot l ont deja fait en cinq jours.
//
// Chaque cas SOUMET au script REEL un arbre fabrique et exige le bon verdict.
// Le script est execute TEL QUEL dans un dossier temporaire pris pour cwd,
// jamais re-implemente ici : une garde qui reecrit la logique qu elle teste ne
// teste que sa copie.
//
// Les deux premiers cas sont les plus importants. Sans eux, un script qui ne
// detecterait PLUS RIEN (`findClaudeFiles` rendant `[]`, un `exit 0` en dur)
// passerait tous les autres sans qu aucun ne bronche.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const SCRIPT = resolve(process.cwd(), 'scripts/check-docs-budget.mjs')

/** Retour a la ligne, pour garder les fixtures lisibles sur une ligne. */
const NL = String.fromCharCode(10)

let dir

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'docs-budget-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Ecrit un fichier, en creant ses dossiers. */
function put(rel, body) {
  const p = join(dir, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body, 'utf8')
}

function run() {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

const RACINE_SAINE =
  '# Racine\n\n| Zone | Fichier |\n|---|---|\n| Modules | [`src/modules/CLAUDE.md`](./src/modules/CLAUDE.md) |\n'

/** Un arbre sain minimal : racine + un dossier cite + un doc vise. */
function arbreSain() {
  put('docs/TESTING.md', '# Tests\n')
  put('CLAUDE.md', RACINE_SAINE)
  put('src/modules/CLAUDE.md', '# Modules\n\nVoir [`docs/TESTING.md`](../../docs/TESTING.md).\n')
}

describe('check-docs-budget · le cliquet des CLAUDE.md', () => {
  // ─── LES TEMOINS ──────────────────────────────────────────────────
  it('VERT sur un arbre sain (sans ce cas, tous les autres sont vides de sens)', () => {
    arbreSain()
    const { code, out } = run()
    expect(code, out).toBe(0)
    expect(out).toMatch(/2 CLAUDE\.md \+ \d+ doc/)
  })

  it('compte REELLEMENT les fichiers : un CLAUDE.md de plus se voit dans le verdict', () => {
    arbreSain()
    put('CLAUDE.md', `${RACINE_SAINE}| E2E | [\`e2e/CLAUDE.md\`](./e2e/CLAUDE.md) |\n`)
    put('e2e/CLAUDE.md', '# E2E\n')
    const { code, out } = run()
    expect(code, out).toBe(0)
    // Un script qui rendrait un total fige, ou qui aurait cesse de parcourir
    // l arbre, resterait bloque sur « 2 ».
    expect(out).toMatch(/3 CLAUDE\.md \+ \d+ doc/)
  })

  // ─── LES PLAFONDS ─────────────────────────────────────────────────
  it('ROUGE quand le CLAUDE.md racine depasse son plafond', () => {
    arbreSain()
    put('CLAUDE.md', `${RACINE_SAINE}${'x'.repeat(30_000)}`)
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/CLAUDE\.md pese \d+ o, au-dela du plafond/)
    expect(out).toMatch(/jamais relever la borne/)
  })

  it('ROUGE quand un CLAUDE.md de DOSSIER depasse son plafond', () => {
    arbreSain()
    put('src/modules/CLAUDE.md', `# Modules\n${'y'.repeat(20_000)}`)
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/src\/modules\/CLAUDE\.md pese/)
  })

  it('le plafond de DOSSIER est plus bas que celui du racine', () => {
    // 18 000 o : au-dela du plafond de dossier, sous celui du racine. Un script
    // qui appliquerait la meme borne partout rendrait le meme verdict aux deux.
    arbreSain()
    put('src/modules/CLAUDE.md', `# Modules\n${'z'.repeat(18_000)}`)
    expect(run().code).toBe(1)

    put('src/modules/CLAUDE.md', '# Modules\n')
    put('CLAUDE.md', `${RACINE_SAINE}${'z'.repeat(18_000)}`)
    expect(run().code).toBe(0)
  })

  // ─── L INTEGRITE DES POINTEURS ────────────────────────────────────
  //
  // C est le vrai risque du decoupage : une regle qui descend dans un
  // CLAUDE.md que le racine ne cite plus devient invisible depuis toute
  // autre zone, sans qu un seul octet ne manque nulle part.
  it('ROUGE quand un CLAUDE.md de dossier n est cite par AUCUN pointeur du racine', () => {
    arbreSain()
    put('src/lib/CLAUDE.md', '# Lib\n\nUne regle que personne ne trouvera.\n')
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/src\/lib\/CLAUDE\.md n est cite par aucun pointeur/)
    expect(out).toMatch(/invisible depuis toute autre zone/)
  })

  it('ROUGE quand le racine pointe vers un CLAUDE.md qui n existe pas', () => {
    arbreSain()
    put('CLAUDE.md', `${RACINE_SAINE}| Parti | [\`src/disparu/CLAUDE.md\`](./src/disparu/CLAUDE.md) |\n`)
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/pointe vers \.\/src\/disparu\/CLAUDE\.md, qui n existe pas/)
  })

  // ─── LES LIENS DE DOCS ────────────────────────────────────────────
  it('ROUGE quand un CLAUDE.md de dossier cite un docs/ qui n existe pas', () => {
    arbreSain()
    put('src/modules/CLAUDE.md', '# Modules\n\nVoir [`docs/ABSENT.md`](../../docs/ABSENT.md).\n')
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/docs\/ABSENT\.md, qui n existe pas/)
  })

  it('resout les liens depuis le dossier du fichier, pas depuis la racine', () => {
    // `./docs/TESTING.md` ecrit DANS src/modules vise src/modules/docs/, qui
    // n existe pas. C est exactement l erreur que la decoupe du 2026-09-16 a
    // produite deux fois, en recopiant des liens ecrits pour la racine.
    arbreSain()
    put('src/modules/CLAUDE.md', '# Modules\n\nVoir [`docs/TESTING.md`](./docs/TESTING.md).\n')
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/qui n existe pas/)
  })

  // ─── LE PERIMETRE ─────────────────────────────────────────────────
  it('ignore les copies du depot (worktrees, skills, dependances)', () => {
    arbreSain()
    put('.worktrees/autre/CLAUDE.md', `# Copie d un autre arbre\n${'w'.repeat(40_000)}`)
    put('.claude/skills/design/CLAUDE.md', `# Skill installe\n${'s'.repeat(40_000)}`)
    put('node_modules/paquet/CLAUDE.md', `# Dependance\n${'n'.repeat(40_000)}`)
    const { code, out } = run()
    expect(code, out).toBe(0)
    expect(out).toMatch(/2 CLAUDE\.md \+ \d+ doc/)
  })

  it('ROUGE quand un doc VIVANT de `docs/` porte un lien mort', () => {
    // Ajoute le 2026-09-16 : la decoupe de CLAUDE.md a produit SIX liens
    // morts d'un coup, des chemins ecrits pour la racine (`./docs/X.md`)
    // recopies dans `docs/`, ou ils visent `docs/docs/`. Trouves a la main,
    // donc ils seraient revenus.
    arbreSain()
    put('docs/SECURITY.md', '# Securite' + NL + NL + 'Voir [`a-faire-code.md`](./a-faire-code.md).' + NL)
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/docs\/SECURITY\.md pointe vers \.\/a-faire-code\.md/)
  })

  it('IGNORE les liens morts de `docs/archive/`, qui n est pas maintenu', () => {
    // Le depot interdit deja de lire une archive comme un etat courant : un
    // lien mort y est une trace d'epoque, pas une regression. Sans ce cas,
    // la garde rougirait sur 27 instantanes dates et finirait desarmee.
    arbreSain()
    put('docs/archive/AUDIT-2026-01-01.md', '# Vieil audit' + NL + NL + '[parti](./DISPARU.md)' + NL)
    const { code, out } = run()
    expect(code, out).toBe(0)
  })

  it('ROUGE si le CLAUDE.md racine disparait', () => {
    put('src/modules/CLAUDE.md', '# Modules\n')
    const { code, out } = run()
    expect(code, out).toBe(1)
    expect(out).toMatch(/CLAUDE\.md est absent de la racine/)
  })
})

// ── Règle 6 : aucune note /100 dans les docs vivantes (ADR 0012) ────
describe('check-docs-budget · notes /100 (ADR 0012)', () => {
  it('ROUGE sur le marqueur note-audit de l ancienne garde C-109', () => {
    arbreSain()
    put('docs/TESTING.md', '<!-- note-audit: note=94 -->' + NL + '# Tests' + NL)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('note-audit')
  })

  it('ROUGE sur la phrase « Note d audit » et sur l en-tete de journal de notes', () => {
    arbreSain()
    put('docs/TESTING.md', "> **Note d'audit** : x" + NL + '# Tests' + NL)
    expect(run().code).toBe(1)
    put('docs/TESTING.md', '# Tests' + NL + NL + '## Note de tests : 80 → 83 → **94 / 100**' + NL)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('en-tete')
  })

  it('VERT sur un doc qui renvoie vers INDICATEURS.md, et IGNORE docs/archive/', () => {
    arbreSain()
    put('docs/TESTING.md', '# Tests' + NL + NL + 'Etat de sante : [INDICATEURS](./INDICATEURS.md).' + NL)
    put('docs/INDICATEURS.md', '# Indicateurs' + NL)
    put('docs/archive/TESTING-journal.md', '## Note de tests : 80 → 94 / 100' + NL)
    expect(run().code).toBe(0)
  })
})

// ── Règle 7 : les ancres internes tiennent (ADR 0014) ───────────────
describe('check-docs-budget · ancres', () => {
  it('ROUGE quand un lien vise une ancre qui n existe plus (section deplacee en archive)', () => {
    arbreSain()
    put('docs/TESTING.md', '# Tests' + NL + NL + '## Boucle locale' + NL)
    put('docs/ARCHITECTURE.md', '# Archi' + NL + NL + 'Voir [la boucle](./TESTING.md#journal-des-notes).' + NL)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('journal-des-notes')
    expect(r.out).toContain('ancre')
  })

  it('VERT quand l ancre existe, emoji et ponctuation compris, et sur les liens internes #x', () => {
    arbreSain()
    put('docs/TESTING.md', '# Tests' + NL + NL + '## 📋 Tableau de conformité (C-1) : état' + NL + NL + 'Retour : [haut](#-tableau-de-conformité-c-1--état).' + NL)
    put('docs/ARCHITECTURE.md', '# Archi' + NL + NL + 'Voir [le tableau](./TESTING.md#-tableau-de-conformité-c-1--état).' + NL)
    expect(run().code).toBe(0)
  })

  it('une ancre dans un bloc de code n est pas un titre, et les doublons recoivent -1', () => {
    arbreSain()
    put('docs/TESTING.md', '# Tests' + NL + NL + '```bash' + NL + '# faux-titre' + NL + '```' + NL + NL + '## Suite' + NL + NL + '## Suite' + NL)
    put('docs/ARCHITECTURE.md', '# A' + NL + NL + '[a](./TESTING.md#suite) [b](./TESTING.md#suite-1)' + NL)
    expect(run().code).toBe(0)
    put('docs/ARCHITECTURE.md', '# A' + NL + NL + '[a](./TESTING.md#faux-titre)' + NL)
    expect(run().code).toBe(1)
  })

  it('IGNORE docs/archive/ : une ancre y est une trace d epoque', () => {
    arbreSain()
    put('docs/archive/X.md', '[a](../TESTING.md#absente)' + NL)
    expect(run().code).toBe(0)
  })
})
