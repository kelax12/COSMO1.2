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

const lireTexte = (chemin) => readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n')
const sousDossiers = (rep) =>
  existsSync(rep) ? readdirSync(rep).filter((e) => statSync(join(rep, e)).isDirectory()).sort() : []
const fichiers = (rep, re) => (existsSync(rep) ? readdirSync(rep).filter((e) => re.test(e)).sort() : [])
const compter = (texte, re) => (texte.match(re) ?? []).length

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

  const schemaChemin = join(racine, 'supabase', 'schema.sql')
  const schema = existsSync(schemaChemin) ? lireTexte(schemaChemin) : ''

  return {
    edgeFunctions: edge.length,
    migrations: migrations.length,
    derniereMigration: derniere,
    workflows: workflows.length,
    workflowsPlanifies: planifies.length,
    modules: modules.length,
    namespaces: namespaces.length,
    gardes: gardes.length,
    adr: adr.length,
    tables: compter(schema, /^CREATE TABLE public\./gm),
    tablesRls: compter(schema, /^ALTER TABLE public\.\S+ ENABLE ROW LEVEL SECURITY;/gm),
    policies: compter(schema, /^CREATE POLICY /gm),
    fonctionsSql: compter(schema, /^CREATE FUNCTION public\./gm),
  }
}

/** Le texte de `docs/FAITS.md`. Déterministe : mêmes faits, mêmes octets. */
export function rendre(f) {
  const lignes = [
    ['Edge Functions déployables', f.edgeFunctions, 'dossiers de `supabase/functions/` portant un `index.ts` (hors `_shared`)'],
    ['Migrations SQL', f.migrations, 'fichiers `NNN_*.sql` de `supabase/migration/`'],
    ['Dernière migration', f.derniereMigration, 'plus grand préfixe numérique de `supabase/migration/`'],
    ['Workflows GitHub', f.workflows, 'fichiers de `.github/workflows/`'],
    ['dont planifiés', f.workflowsPlanifies, 'workflows portant un `schedule:`'],
    ['Modules applicatifs', f.modules, 'dossiers de `src/modules/`'],
    ['Namespaces i18n', f.namespaces, 'fichiers de `src/locales/fr/`'],
    ['Gardes `check:` / `i18n:` / `validate:`', f.gardes, 'scripts de `package.json`'],
    ['ADR', f.adr, 'fichiers `NNNN-*.md` de `docs/adr/`'],
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
    'Un chiffre se calcule, il ne se recopie pas. Les autres documents renvoient ici au lieu de le répéter.',
    "Les chiffres de production (tables vivantes, ledger, taille de base) ne sont pas ici : ils se lisent en base.",
    '',
    '| Fait | Valeur | Source |',
    '|---|---|---|',
    ...lignes.map(([nom, valeur, source]) => `| ${nom} | **${valeur}** | ${source} |`),
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
  const attendu = rendre(calculerFaits(racine))
  if (process.argv.includes('--verifier')) {
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
