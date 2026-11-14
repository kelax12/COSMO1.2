// Temoin de check-docs-budget.mjs : chaque cas soumet au script REEL (lance tel quel, cwd = un
// arbre fabrique) et exige le bon verdict. Les deux premiers cas refusent un detecteur aveugle
// (`findClaudeFiles` rendant [], un exit 0 en dur) : sans eux, les autres ne prouvent rien.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const SCRIPT = resolve(process.cwd(), 'scripts/check-docs-budget.mjs')
const NL = String.fromCharCode(10)
/** L en-tete exige par la regle 8 (ADR 0021). */
const EN_TETE = '> **Quand lire** : x. **Fait foi** : y.'
const RACINE_SAINE = '# Racine\n\n| Zone | Fichier |\n|---|---|\n| Modules | [`src/modules/CLAUDE.md`](./src/modules/CLAUDE.md) |\n'
const lignes = (n) => Array.from({ length: n }, (_, i) => `l${i}`).join(NL)
const doc = (corps) => '# Doc' + NL + EN_TETE + NL + NL + corps + NL

let dir
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'docs-budget-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

function putBrut(rel, body) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), body, 'utf8')
}
/** Un doc vivant recoit l en-tete sous son titre, pour que les regles 1 a 7 ne rougissent pas sur la 8. */
function put(rel, body) {
  const vivant = rel.endsWith('.md') && !rel.startsWith('docs/archive/') && !rel.startsWith('docs/adr/')
  putBrut(rel, vivant ? body.replace(/^(# [^\n]*\n)/m, `$1${EN_TETE}${NL}`) : body)
}
const exceptions = (fichiers) => putBrut('docs/convention-exceptions.json', JSON.stringify({ fichiers }))
function run() {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}
/** Le verdict rouge, et sa sortie qui doit dire pourquoi. */
function rouge(...motifs) {
  const r = run()
  expect(r.code, r.out).toBe(1)
  for (const m of motifs) expect(r.out).toMatch(m)
}
function arbreSain() {
  put('docs/TESTING.md', '# Tests\n')
  put('CLAUDE.md', RACINE_SAINE)
  put('src/modules/CLAUDE.md', '# Modules\n\nVoir [`docs/TESTING.md`](../../docs/TESTING.md).\n')
}

describe('check-docs-budget · plafonds et pointeurs des CLAUDE.md', () => {
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
    expect(out).toMatch(/3 CLAUDE\.md \+ \d+ doc/)
  })
  it('ROUGE quand le CLAUDE.md racine depasse son plafond', () => {
    arbreSain()
    put('CLAUDE.md', `${RACINE_SAINE}${'x'.repeat(30_000)}`)
    rouge(/CLAUDE\.md pese \d+ o, au-dela du plafond/, /jamais relever la borne/)
  })
  it('ROUGE quand un CLAUDE.md de DOSSIER depasse son plafond', () => {
    arbreSain()
    put('src/modules/CLAUDE.md', `# Modules\n${'y'.repeat(20_000)}`)
    rouge(/src\/modules\/CLAUDE\.md pese/)
  })
  it('le plafond de DOSSIER est plus bas que celui du racine', () => {
    arbreSain()
    put('src/modules/CLAUDE.md', `# Modules\n${'z'.repeat(18_000)}`)
    expect(run().code).toBe(1)
    put('src/modules/CLAUDE.md', '# Modules\n')
    put('CLAUDE.md', `${RACINE_SAINE}${'z'.repeat(18_000)}`)
    expect(run().code).toBe(0)
  })
  it('ROUGE quand un CLAUDE.md de dossier n est cite par AUCUN pointeur du racine', () => {
    arbreSain()
    put('src/lib/CLAUDE.md', '# Lib\n\nUne regle que personne ne trouvera.\n')
    rouge(/src\/lib\/CLAUDE\.md n est cite par aucun pointeur/, /invisible depuis toute autre zone/)
  })
  it('ROUGE quand le racine pointe vers un CLAUDE.md qui n existe pas', () => {
    arbreSain()
    put('CLAUDE.md', `${RACINE_SAINE}| Parti | [\`src/disparu/CLAUDE.md\`](./src/disparu/CLAUDE.md) |\n`)
    rouge(/pointe vers \.\/src\/disparu\/CLAUDE\.md, qui n existe pas/)
  })
  it('ROUGE quand un CLAUDE.md de dossier cite un docs/ qui n existe pas', () => {
    arbreSain()
    put('src/modules/CLAUDE.md', '# Modules\n\nVoir [`docs/ABSENT.md`](../../docs/ABSENT.md).\n')
    rouge(/docs\/ABSENT\.md, qui n existe pas/)
  })
  it('resout les liens depuis le dossier du fichier, pas depuis la racine', () => {
    arbreSain()
    put('src/modules/CLAUDE.md', '# Modules\n\nVoir [`docs/TESTING.md`](./docs/TESTING.md).\n')
    rouge(/qui n existe pas/)
  })
  it('ignore les copies du depot (worktrees, skills, dependances)', () => {
    arbreSain()
    put('.worktrees/autre/CLAUDE.md', `# Copie\n${'w'.repeat(40_000)}`)
    put('.claude/skills/design/CLAUDE.md', `# Skill\n${'s'.repeat(40_000)}`)
    put('node_modules/paquet/CLAUDE.md', `# Dependance\n${'n'.repeat(40_000)}`)
    const { code, out } = run()
    expect(code, out).toBe(0)
    expect(out).toMatch(/2 CLAUDE\.md \+ \d+ doc/)
  })
  it('ROUGE quand un doc VIVANT de `docs/` porte un lien mort', () => {
    arbreSain()
    put('docs/SECURITY.md', '# Securite' + NL + NL + 'Voir [`a-faire-code.md`](./a-faire-code.md).' + NL)
    rouge(/docs\/SECURITY\.md pointe vers \.\/a-faire-code\.md/)
  })
  it('IGNORE les liens morts de `docs/archive/`, qui n est pas maintenu', () => {
    arbreSain()
    put('docs/archive/AUDIT-2026-01-01.md', '# Vieil audit' + NL + NL + '[parti](./DISPARU.md)' + NL)
    expect(run().code).toBe(0)
  })
  it('ROUGE si le CLAUDE.md racine disparait', () => {
    put('src/modules/CLAUDE.md', '# Modules\n')
    rouge(/CLAUDE\.md est absent de la racine/)
  })
})

describe('check-docs-budget · notes /100 (ADR 0012)', () => {
  it('ROUGE sur le marqueur note-audit de l ancienne garde C-109', () => {
    arbreSain()
    put('docs/TESTING.md', '<!-- note-audit: note=94 -->' + NL + '# Tests' + NL)
    rouge(/note-audit/)
  })
  it('ROUGE sur la phrase « Note d audit » et sur l en-tete de journal de notes', () => {
    arbreSain()
    put('docs/TESTING.md', "> **Note d'audit** : x" + NL + '# Tests' + NL)
    expect(run().code).toBe(1)
    put('docs/TESTING.md', '# Tests' + NL + NL + '## Note de tests : 80 → 83 → **94 / 100**' + NL)
    rouge(/en-tete/)
  })
  it('VERT sur un doc qui renvoie vers INDICATEURS.md, et IGNORE docs/archive/', () => {
    arbreSain()
    put('docs/TESTING.md', '# Tests' + NL + NL + 'Etat de sante : [INDICATEURS](./INDICATEURS.md).' + NL)
    put('docs/INDICATEURS.md', '# Indicateurs' + NL)
    put('docs/archive/TESTING-journal.md', '## Note de tests : 80 → 94 / 100' + NL)
    expect(run().code).toBe(0)
  })
})

describe('check-docs-budget · ancres', () => {
  it('ROUGE quand un lien vise une ancre qui n existe plus (section deplacee en archive)', () => {
    arbreSain()
    put('docs/TESTING.md', '# Tests' + NL + NL + '## Boucle locale' + NL)
    put('docs/ARCHITECTURE.md', '# Archi' + NL + NL + 'Voir [la boucle](./TESTING.md#journal-des-notes).' + NL)
    rouge(/journal-des-notes/, /ancre/)
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

describe('check-docs-budget · convention des docs (regle 8, ADR 0021)', () => {
  it('VERT sur un doc conforme : en-tete, date collee a un identifiant, ancre de section', () => {
    arbreSain()
    putBrut('docs/archive/X-2026-01-02-au-2026-02-03.md', '# Archive' + NL)
    put('docs/SECURITY.md', doc('Recit : [`archive/X-2026-01-02-au-2026-02-03.md`](./archive/X-2026-01-02-au-2026-02-03.md), branche `noyau/2026-01-02`, § Coffre.'))
    const r = run()
    expect(r.code, r.out).toBe(0)
  })
  it('ROUGE sur une date AAAA-MM-JJ isolee, dans un CLAUDE.md comme dans docs/', () => {
    arbreSain()
    put('docs/SECURITY.md', doc('Corrige le 2026-11-08.'))
    rouge(/docs\/SECURITY\.md : 1 date\(s\) AAAA-MM-JJ isolee/)
    put('docs/SECURITY.md', doc('Rien.'))
    put('src/modules/CLAUDE.md', '# Modules' + NL + 'Decide (2026-11-08).' + NL)
    rouge(/src\/modules\/CLAUDE\.md : 1 date/)
  })
  it('ROUGE sur un numero de ligne cite d un autre .md, sous ses trois formes', () => {
    for (const cite of ['Voir `TESTING.md:42`.', 'Voir [t](./TESTING.md#L42).', 'Voir `TESTING.md` ligne 42.']) {
      arbreSain()
      put('docs/SECURITY.md', doc(cite))
      rouge(/numero\(s\) de ligne/)
    }
  })
  it('ROUGE sans en-tete « Quand lire / Fait foi », ou relegue sous la troisieme ligne', () => {
    arbreSain()
    putBrut('docs/SECURITY.md', '# Securite' + NL + NL + 'Regles.' + NL)
    rouge(/docs\/SECURITY\.md : pas d'en-tete/)
    putBrut('docs/SECURITY.md', '# Securite' + NL + 'a' + NL + 'b' + NL + 'c' + NL + EN_TETE + NL)
    rouge(/pas d'en-tete/)
  })
  it('ROUGE au-dela du plafond de lignes, plus bas pour un CLAUDE.md que pour un doc', () => {
    arbreSain()
    put('docs/SECURITY.md', doc(lignes(200)))
    put('src/modules/CLAUDE.md', '# Modules' + NL + lignes(200) + NL)
    const r = run()
    expect(r.code, r.out).toBe(1)
    expect(r.out).toMatch(/src\/modules\/CLAUDE\.md : 20\d lignes, au-dela du plafond de 150/)
    expect(r.out).not.toMatch(/docs\/SECURITY\.md : \d+ lignes/)
    put('src/modules/CLAUDE.md', '# Modules' + NL)
    put('docs/SECURITY.md', doc(lignes(320)))
    rouge(/docs\/SECURITY\.md : 32\d lignes, au-dela du plafond de 300/)
  })
  it('ne juge ni docs/archive/ ni docs/adr/, dates et longueur comprises', () => {
    arbreSain()
    putBrut('docs/archive/X.md', 'Mesure du 2026-01-02, `Y.md:3`.' + NL)
    putBrut('docs/adr/0001-x.md', '# ADR' + NL + '- **Date** : 2026-01-02' + NL)
    expect(run().code).toBe(0)
  })
  it('un fichier GENERE n est pas juge sur ses dates (mesures datees par construction)', () => {
    arbreSain()
    putBrut('docs/INDICATEURS.md', '<!-- GENERE par x -->' + NL + '# Indicateurs' + NL + EN_TETE + NL + 'Mesure le 2026-01-02.' + NL)
    expect(run().code).toBe(0)
  })
  it('CLIQUET : une exception couvre sa mesure, pas un octet de plus', () => {
    arbreSain()
    putBrut('docs/SECURITY.md', '# Securite' + NL + 'Le 2026-01-01 et le 2026-01-02.' + NL)
    exceptions({ 'docs/SECURITY.md': { dates: 2, entete: false } })
    expect(run().code).toBe(0)
    putBrut('docs/SECURITY.md', '# Securite' + NL + 'Le 2026-01-01, le 2026-01-02 et le 2026-01-03.' + NL)
    rouge(/au-dela de sa mesure d'exception \(2\)/)
  })
  it('CLIQUET : une exception devenue inutile doit etre retiree (la liste ne fait que baisser)', () => {
    arbreSain()
    put('docs/SECURITY.md', doc('Conforme.'))
    exceptions({ 'docs/SECURITY.md': { dates: 3, entete: false } })
    rouge(/Retirer « dates »/, /Retirer « entete »/)
  })
  it('CLIQUET : une exception de lignes ne remonte pas, et se retire sous le plafond', () => {
    arbreSain()
    put('docs/SECURITY.md', doc(lignes(400)))
    exceptions({ 'docs/SECURITY.md': { lignes: 405 } })
    expect(run().code).toBe(0)
    put('docs/SECURITY.md', doc(lignes(410)))
    rouge(/au-dela de sa mesure d'exception \(405\)/)
    put('docs/SECURITY.md', doc(lignes(10)))
    rouge(/Retirer « lignes »/)
  })
  it('CLIQUET : une exception pour un fichier qui n est plus un doc vivant est refusee', () => {
    arbreSain()
    exceptions({ 'docs/DISPARU.md': { entete: false } })
    rouge(/cite docs\/DISPARU\.md, qui n'est plus un doc vivant/)
  })
})
