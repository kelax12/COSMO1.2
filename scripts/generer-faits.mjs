// generer-faits.mjs : les faits chiffrés du dépôt, lus dans la source, écrits en UN seul fichier.
//
// Un chiffre recopié dans une doc vieillit sans que rien ne le signale (15 puis 16 Edge Functions
// selon le fichier, 33 puis 34 namespaces). Ici chaque chiffre est calculé depuis les fichiers et
// écrit dans `docs/FAITS.md`. Les autres docs vivantes y renvoient au lieu de le recopier.
//
//   node scripts/generer-faits.mjs             écrit docs/FAITS.md
//   node scripts/generer-faits.mjs --verifier  échoue si le fichier diffère de la génération
//
// La vérification joue dans le noyau (`ci-noyau.yml`, étape `faits`). Un écart se règle par
// `npm run faits:generer` puis un commit du fichier : on ne l'édite jamais à la main.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const lireTexte = (chemin) => readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n')
const sousDossiers = (rep) =>
  existsSync(rep) ? readdirSync(rep).filter((e) => statSync(join(rep, e)).isDirectory()).sort() : []
const fichiers = (rep, re) => (existsSync(rep) ? readdirSync(rep).filter((e) => re.test(e)).sort() : [])
const compter = (texte, re) => (texte.match(re) ?? []).length

const IGNORES = new Set(['node_modules', '.git', 'dist', 'coverage'])
const marcher = (rep, sortie = []) => {
  for (const e of existsSync(rep) ? readdirSync(rep) : []) {
    if (IGNORES.has(e)) continue
    const p = join(rep, e)
    if (statSync(p).isDirectory()) marcher(p, sortie)
    else sortie.push(p)
  }
  return sortie
}

/** Fichiers suivis par git (le même ensemble en local et en CI), sinon parcours du disque. */
function suivis(racine, dossier) {
  try {
    const sortie = execFileSync('git', ['ls-files', '-z', '--', dossier], { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const liste = sortie.split(String.fromCharCode(0)).filter(Boolean)
    if (liste.length) return liste.map((f) => join(racine, ...f.split('/')))
  } catch {
    /* hors dépôt git (arbre de test) : parcours du disque */
  }
  return marcher(join(racine, dossier))
}

/** Les quatre mesures du budget d'outillage (MAI-02). */
export function mesurerOutillage(racine, planifies) {
  const scripts = suivis(racine, 'scripts').filter((f) => existsSync(f))
  const lignes = scripts.reduce((n, f) => n + lireTexte(f).split(String.fromCharCode(10)).length - 1, 0)
  const gardes = suivis(racine, '.').filter((f) => /\.guard\.test\./.test(f)).length
  return { scriptsFichiers: scripts.length, scriptsLignes: lignes, workflowsPlanifies: planifies, gardesTests: gardes }
}

export const REFERENCE_OUTILLAGE = ['scripts', 'outillage.reference.json']
const CLES = ['scriptsFichiers', 'scriptsLignes', 'workflows', 'workflowsPlanifies', 'gardesTests']
const REGLE = 'un nouvel outil en remplace un : retire ou fusionne avant d ajouter. Ne jamais relever un plafond.'

/** Verdict du cliquet : un dépassement échoue, une baisse doit être recopiée (`--recaler`). */
export function juger(faits, plafonds) {
  const erreurs = []
  for (const c of CLES) {
    if (faits[c] > plafonds[c]) erreurs.push(`${c} : ${faits[c]} > plafond ${plafonds[c]}. ${REGLE}`)
    else if (faits[c] < plafonds[c]) erreurs.push(`${c} : ${faits[c]} < plafond ${plafonds[c]}. Recopier la baisse : npm run faits:generer -- --recaler`)
  }
  return erreurs
}

const IGNORES_CLAUDE = new Set(['node_modules', '.git', 'dist', 'coverage', '.claude', '.worktrees', 'prive'])

/** Les `CLAUDE.md` du dépôt (racine et dossiers), hors copies et dépendances. */
function compterClaudeMd(rep) {
  let n = 0
  for (const e of existsSync(rep) ? readdirSync(rep) : []) {
    if (IGNORES_CLAUDE.has(e)) continue
    const p = join(rep, e)
    if (statSync(p).isDirectory()) n += compterClaudeMd(p)
    else if (e === 'CLAUDE.md') n += 1
  }
  return n
}

/** Les faits, calculés depuis les fichiers du dépôt à `racine`. */
export function calculerFaits(racine = process.cwd()) {
  const edgeDir = join(racine, 'supabase', 'functions')
  const edge = sousDossiers(edgeDir).filter((d) => !d.startsWith('_') && existsSync(join(edgeDir, d, 'index.ts')))

  const migrations = fichiers(join(racine, 'supabase', 'migration'), /^\d{3}_.*\.sql$/)
  const derniere = migrations.length ? migrations[migrations.length - 1].slice(0, 3) : '000'

  const wfDir = join(racine, '.github', 'workflows')
  const workflows = fichiers(wfDir, /\.ya?ml$/)
  const planifies = workflows.filter((f) => /^\s*schedule:/m.test(lireTexte(join(wfDir, f))))

  const modules = sousDossiers(join(racine, 'src', 'modules'))
  const namespaces = fichiers(join(racine, 'src', 'locales', 'fr'), /\.json$/)

  const pkg = JSON.parse(lireTexte(join(racine, 'package.json')))
  const gardes = Object.keys(pkg.scripts ?? {}).filter((s) => /^(check|i18n|validate):/.test(s))

  const adr = fichiers(join(racine, 'docs', 'adr'), /^\d{4}-.*\.md$/)
  const fonctionsVercel = fichiers(join(racine, 'api'), /^[^_.].*\.ts$/).filter((f) => !/\.test\.ts$/.test(f))
  const docsDir = join(racine, 'docs')
  const docsVivantes = fichiers(docsDir, /\.md$/).filter((f) => statSync(join(docsDir, f)).isFile())

  const schemaChemin = join(racine, 'supabase', 'schema.sql')
  const schema = existsSync(schemaChemin) ? lireTexte(schemaChemin) : ''

  return {
    ...mesurerOutillage(racine, planifies.length),
    edgeFunctions: edge.length,
    migrations: migrations.length,
    derniereMigration: derniere,
    workflows: workflows.length,
    workflowsPlanifies: planifies.length,
    modules: modules.length,
    namespaces: namespaces.length,
    gardes: gardes.length,
    adr: adr.length,
    fonctionsVercel: fonctionsVercel.length,
    claudeMd: compterClaudeMd(racine),
    docsVivantes: docsVivantes.length,
    tables: compter(schema, /^CREATE TABLE public\./gm),
    tablesRls: compter(schema, /^ALTER TABLE public\.\S+ ENABLE ROW LEVEL SECURITY;/gm),
    policies: compter(schema, /^CREATE POLICY /gm),
    fonctionsSql: compter(schema, /^CREATE FUNCTION public\./gm),
  }
}

/** Les faits volatils : la commande qui les mesure, jamais leur valeur. */
export const VOLATILS = [
  ['Fichiers de test Vitest', '`git ls-files "*.test.ts" "*.test.tsx" "*.test.mjs" \\| wc -l`'],
  ['Cas de test Vitest', '`npx vitest list \\| wc -l` (lent : toute la collecte)'],
  ['Specs Playwright', '`git ls-files "e2e/*.spec.ts" \\| wc -l`'],
  ['Lignes et tokens d\'un doc vivant', '`npm run check:docs -- --mesurer` (tokens ≈ caractères / 4)'],
  ['Fichiers et valeurs du cliquet de complexité', '`eslint-rules/complexite.baseline.json`'],
  ['Exceptions du cliquet des docs', '`docs/convention-exceptions.json`'],
  ['Taille du bundle', '`npm run build && npm run check:bundle`'],
]

/** Le texte de `docs/FAITS.md`. Déterministe : mêmes faits, mêmes octets. */
export function rendre(f) {
  const lignes = [
    ['Edge Functions déployables', f.edgeFunctions, 'dossiers de `supabase/functions/` portant un `index.ts` (hors `_shared`)'],
    ['Migrations SQL', f.migrations, 'fichiers `NNN_*.sql` de `supabase/migration/`'],
    ['Dernière migration', f.derniereMigration, 'plus grand préfixe numérique de `supabase/migration/`'],
    ['Workflows GitHub', f.workflows, 'fichiers de `.github/workflows/`'],
    ['dont planifiés', f.workflowsPlanifies, 'workflows portant un `schedule:`'],
    ['Fichiers de `scripts/`', f.scriptsFichiers, 'fichiers suivis (budget d outillage, `scripts/outillage.reference.json`)'],
    ['Lignes de `scripts/`', f.scriptsLignes, 'lignes des fichiers suivis de `scripts/`'],
    ['Tests de garde', f.gardesTests, 'fichiers `*.guard.test.*` du dépôt'],
    ['Modules applicatifs', f.modules, 'dossiers de `src/modules/`'],
    ['Namespaces i18n', f.namespaces, 'fichiers de `src/locales/fr/`'],
    ['Gardes `check:` / `i18n:` / `validate:`', f.gardes, 'scripts de `package.json`'],
    ['ADR', f.adr, 'fichiers `NNNN-*.md` de `docs/adr/`'],
    ['Fonctions Vercel', f.fonctionsVercel, 'fichiers `.ts` de `api/` (hors tests et `_*`)'],
    ['`CLAUDE.md`', f.claudeMd, 'racine et dossiers, hors `node_modules`, `.claude`, `.worktrees`'],
    ['Docs vivantes de `docs/`', f.docsVivantes, 'fichiers `.md` de `docs/`, hors `archive/` et `adr/`'],
    ['Tables du schéma `public`', f.tables, '`CREATE TABLE public.` dans `supabase/schema.sql`'],
    ['dont sous RLS', f.tablesRls, '`ENABLE ROW LEVEL SECURITY` dans `supabase/schema.sql`'],
    ['Policies RLS', f.policies, '`CREATE POLICY` dans `supabase/schema.sql`'],
    ['Fonctions SQL de `public`', f.fonctionsSql, '`CREATE FUNCTION public.` dans `supabase/schema.sql`'],
  ]
  return [
    '<!-- GENERE par scripts/generer-faits.mjs. NE PAS EDITER A LA MAIN. Regenerer : npm run faits:generer -->',
    '',
    '# Faits chiffrés du dépôt',
    '',
    '> **Quand lire** : avant d\'écrire un nombre de fonctions, migrations, tables, gardes, tests ou lignes. **Fait foi** : `scripts/generer-faits.mjs`, qui le calcule.',
    '',
    '❌ Ne jamais recopier un de ces chiffres ailleurs : y renvoyer. Les chiffres de production (tables vivantes, ledger, taille de base) se lisent en base.',
    '',
    '| Fait | Valeur | Source |',
    '|---|---|---|',
    ...lignes.map(([nom, valeur, source]) => `| ${nom} | **${valeur}** | ${source} |`),
    '',
    '## Se mesurent, ne s\'écrivent pas',
    '',
    'Ces chiffres bougent à chaque commit : les écrire ici ferait rougir le noyau à chaque test ajouté. Citer la commande.',
    '',
    '| Fait | Commande |',
    '|---|---|',
    ...VOLATILS.map(([nom, cmd]) => `| ${nom} | ${cmd} |`),
    '',
    'Vérifié dans le noyau CI : `npm run check:faits` échoue si ce fichier diffère de la génération.',
    '',
  ].join('\n')
}

export const CHEMIN_FAITS = ['docs', 'FAITS.md']

const principal = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'))
if (principal) {
  const racine = process.cwd()
  const cible = join(racine, ...CHEMIN_FAITS)
  const faits = calculerFaits(racine)
  const attendu = rendre(faits)
  const refChemin = join(racine, ...REFERENCE_OUTILLAGE)
  const mesure = Object.fromEntries(CLES.map((c) => [c, faits[c]]))
  if (process.argv.includes('--recaler')) {
    const ancien = existsSync(refChemin) ? JSON.parse(lireTexte(refChemin)) : mesure
    const monte = CLES.filter((c) => mesure[c] > ancien[c])
    if (monte.length) {
      console.error(`::error title=Outillage::le plafond ne se relève pas (${monte.join(', ')}). ${REGLE}`)
      process.exit(1)
    }
    writeFileSync(refChemin, JSON.stringify(mesure, null, 2) + String.fromCharCode(10))
    console.log('plafonds recalés : ' + JSON.stringify(mesure))
    process.exit(0)
  }
  if (process.argv.includes('--verifier')) {
    const erreursOutillage = existsSync(refChemin) ? juger(mesure, JSON.parse(lireTexte(refChemin))) : ['scripts/outillage.reference.json absent']
    if (erreursOutillage.length) {
      for (const e of erreursOutillage) console.error(`::error title=Outillage::${e}`)
      process.exit(1)
    }
    const actuel = existsSync(cible) ? lireTexte(cible) : null
    if (actuel === attendu) {
      console.log('docs/FAITS.md est à jour avec les sources.')
    } else {
      console.error(
        '::error title=Faits::docs/FAITS.md diffère de la génération depuis les sources. ' +
          'Lancer `npm run faits:generer` et commiter le fichier (ne jamais l\'éditer à la main).',
      )
      process.exit(1)
    }
  } else {
    writeFileSync(cible, attendu)
    console.log('docs/FAITS.md écrit.')
  }
}
