// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// db-contract.guard.test.ts · TEMOIN : renommer une colonne casse `tsc` (ARC-07)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Les lignes brutes des mappers sont ecrites a la main. Le contrat
// (`db-contract.ts`) les accroche aux types generes depuis le schema, mais un
// contrat qui ne rougit jamais ne prouve rien : un type conditionnel qui se
// resout en `true` pour toute entree compile aussi. Ce temoin construit un
// vrai programme TypeScript sur les mappers des quatre grands modules, avec
// `src/generated/database.types.ts` REMPLACE EN MEMOIRE par une copie ou une
// colonne est renommee, et exige :
//   · zero erreur sur le fichier genere tel quel ;
//   · au moins une erreur, dans le bon mapper, nommant la colonne, pour chaque
//     renommage.
// Le vrai fichier n'est jamais modifie.
//
// Seconde moitie (en fin de fichier) : le CLIENT est type par le meme schema
// (`createClient<ClientDatabase>`), sinon `.eq()`, `.rpc()` et les insertions
// recompileraient en silence.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RACINE = process.cwd();
const norm = (f: string) => path.resolve(f).replace(/\\/g, '/').toLowerCase();
const GENERE = norm(path.join(RACINE, 'src/generated/database.types.ts'));
const TEXTE = readFileSync(path.join(RACINE, 'src/generated/database.types.ts'), 'utf8');

const MAPPERS = [
  'src/modules/tasks/mappers.ts',
  'src/modules/habits/mappers.ts',
  'src/modules/okrs/mappers.ts',
  'src/modules/team-projects/supabase.mappers.ts',
].map((f) => path.join(RACINE, f));

function options(): ts.CompilerOptions {
  const lu = ts.readConfigFile(path.join(RACINE, 'tsconfig.app.json'), ts.sys.readFile);
  if (lu.error) throw new Error(ts.flattenDiagnosticMessageText(lu.error.messageText, '\n'));
  const o = ts.parseJsonConfigFileContent(lu.config, ts.sys, RACINE).options;
  // Les mappers n'ont besoin d'aucun type d'environnement ; on ne charge pas ceux de vitest ou de node.
  return { ...o, types: [], noEmit: true, incremental: false, composite: false };
}

const OPTIONS = options();
// Les fichiers lus au disque sont analyses une seule fois pour tous les programmes du fichier.
const CACHE = new Map<string, ts.SourceFile | undefined>();

/** Les erreurs de compilation des quatre mappers quand le fichier genere vaut `genere`. */
function erreurs(genere: string): string[] {
  const host = ts.createCompilerHost(OPTIONS, true);
  const lireOriginal = host.getSourceFile.bind(host);
  host.getSourceFile = (nom, langue, ...reste) => {
    if (norm(nom) === GENERE) return ts.createSourceFile(nom, genere, langue, true);
    if (!CACHE.has(nom)) CACHE.set(nom, lireOriginal(nom, langue, ...reste));
    return CACHE.get(nom);
  };
  const programme = ts.createProgram(MAPPERS, OPTIONS, host);
  return ts.getPreEmitDiagnostics(programme)
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => `${d.file ? path.relative(RACINE, d.file.fileName).replace(/\\/g, '/') : '?'}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
}

/** Renomme `colonne` dans le bloc de `table` (Row, Insert et Update). */
function renommerDansTable(texte: string, table: string, colonne: string): string {
  const debut = texte.search(new RegExp(`"${table}": \\{\\s*Row:`));
  if (debut < 0) throw new Error(`table ${table} introuvable dans le fichier genere`);
  const fin = texte.indexOf('Relationships:', debut);
  const bloc = texte.slice(debut, fin);
  return texte.slice(0, debut) + bloc.split(`"${colonne}"`).join(`"${colonne}_renommee"`) + texte.slice(fin);
}

/** Renomme `colonne` dans le type de retour de `fonction`. */
function renommerDansFonction(texte: string, fonction: string, colonne: string): string {
  const debut = texte.indexOf(`"${fonction}":`);
  if (debut < 0) throw new Error(`fonction ${fonction} introuvable dans le fichier genere`);
  const fin = texte.indexOf('}[]', debut);
  const bloc = texte.slice(debut, fin);
  return texte.slice(0, debut) + bloc.split(`"${colonne}"`).join(`"${colonne}_renommee"`) + texte.slice(fin);
}

describe('db-contract : un renommage de colonne du schema fait echouer tsc', () => {
  it('le fichier genere tel quel : zero erreur sur les quatre mappers', () => {
    expect(erreurs(TEXTE)).toEqual([]);
  }, 120_000);

  it.each([
    ['tasks', 'tasks/mappers.ts', () => renommerDansTable(TEXTE, 'tasks', 'estimated_time'), 'estimated_time'],
    ['habits (table, ecriture)', 'habits/mappers.ts', () => renommerDansTable(TEXTE, 'habits', 'frequency'), 'frequency'],
    ['habits (get_my_habits, lecture)', 'habits/mappers.ts', () => renommerDansFonction(TEXTE, 'get_my_habits', 'streak_best'), 'streak_best'],
    ['okrs', 'okrs/mappers.ts', () => renommerDansTable(TEXTE, 'okrs', 'end_date'), 'end_date'],
    ['key_results', 'okrs/mappers.ts', () => renommerDansTable(TEXTE, 'key_results', 'target_value'), 'target_value'],
    ['team_projects', 'team-projects/supabase.mappers.ts', () => renommerDansTable(TEXTE, 'team_projects', 'created_by'), 'created_by'],
    ['team_tasks', 'team-projects/supabase.mappers.ts', () => renommerDansTable(TEXTE, 'team_tasks', 'assignee_ids'), 'assignee_ids'],
  ])('TEMOIN %s : la colonne %#', (_nom, mapper, sabote, colonne) => {
    const modifie = sabote();
    // Le sabotage doit exister : un remplacement sans effet ferait passer le temoin pour de mauvaises raisons.
    expect(modifie).not.toBe(TEXTE);
    const trouvees = erreurs(modifie).filter((e) => e.startsWith(`src/modules/${mapper}`) && e.includes(colonne));
    expect(trouvees.length, `aucune erreur de compilation dans ${mapper} apres le renommage de ${colonne}`).toBeGreaterThan(0);
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════════════
// TEMOIN : le client Supabase est typé par le schéma (supabase.ts → ClientDatabase)
// Un `SupabaseClient` sans paramètre, ou un `createClient()` nu, laisserait
// recompiler en silence une colonne inconnue, un argument de RPC mal nommé,
// une insertion incomplète. Un fichier virtuel par cas, en UN programme.
// ⚠️ `.order()` n'est PAS vérifié : postgrest-js a une surcharge `order(string)`
// pour trier sur une table jointe, une colonne inconnue y compile.
// ═══════════════════════════════════════════════════════════════════

const JUSTE = `
  await supabase.from('tasks').select('*').eq('id', 'x').order('due_date');
  await supabase.from('categories').update({ name: 'a' }).eq('id', 'x');
  await supabase.rpc('toggle_task_complete_v2', { p_task_id: 'x' });
  await supabase.rpc('set_member_manager', { p_org: 'o', p_user: 'u', p_manager: null });
  const patch: DbPatch<'tasks'> = { name: 'a', priority: 2 };
  void patch;
`;

const FAUX: [string, string][] = [
  ['colonne inconnue dans un filtre', "await supabase.from('tasks').select('*').eq('colonne_absente', 'x');"],
  ['argument de RPC mal nommé', "await supabase.rpc('toggle_task_complete_v2', { p_tache: 'x' });"],
  ['fonction inconnue', "await supabase.rpc('fonction_absente', {});"],
  ['insertion sans colonne obligatoire', "await supabase.from('categories').insert({ color: 'blue' });"],
  ['colonne inconnue dans une mise à jour', "await supabase.from('categories').update({ nom: 'a' }).eq('id', 'x');"],
  ['user_id dans un patch de mapper (faille V1)', "const p: DbPatch<'tasks'> = { user_id: 'u' }; void p;"],
];

const fichierClient = (i: number) => path.join(RACINE, `src/lib/__temoin_client_type_${i}__.ts`);
const texteClient = (corps: string) => [
  "import { supabase } from '@/lib/supabase';",
  "import type { DbPatch } from '@/lib/db-contract';",
  'export async function temoin(): Promise<void> {',
  corps,
  '}',
].join('\n');

function optionsClient(): ts.CompilerOptions {
  const lu = ts.readConfigFile(path.join(RACINE, 'tsconfig.app.json'), ts.sys.readFile);
  if (lu.error) throw new Error(ts.flattenDiagnosticMessageText(lu.error.messageText, '\n'));
  const o = ts.parseJsonConfigFileContent(lu.config, ts.sys, RACINE).options;
  return { ...o, types: ['vite/client'], noEmit: true, incremental: false, composite: false };
}

/**
 * `noUnusedLocals` : chaque fichier importe `supabase` ET `DbPatch`, un cas
 * n'en lit qu'un. Ces erreurs-là ne disent rien du typage ; sans ce filtre,
 * un client non typé laissait chaque cas « faux » rouge pour la mauvaise
 * raison (constaté en sabotant `supabase.ts`).
 */
const IMPORT_INUTILISE = new Set([6133, 6196]);

/** Index du cas (0 = juste, 1.. = faux) → erreurs de compilation de son fichier. */
let parCas: string[][] = [];

beforeAll(() => {
  const corps = [JUSTE, ...FAUX.map(([, appel]) => appel)];
  const virtuels = new Map(corps.map((c, i) => [path.resolve(fichierClient(i)), texteClient(c)]));
  const opts = optionsClient();
  const host = ts.createCompilerHost(opts, true);
  const lire = host.getSourceFile.bind(host);
  host.getSourceFile = (nom, langue, ...reste) => {
    const virtuel = virtuels.get(path.resolve(nom));
    return virtuel !== undefined ? ts.createSourceFile(nom, virtuel, langue, true) : lire(nom, langue, ...reste);
  };
  const programme = ts.createProgram([...virtuels.keys()], opts, host);
  parCas = corps.map((_, i) => ts.getPreEmitDiagnostics(programme, programme.getSourceFile(fichierClient(i)))
    .filter((d) => d.category === ts.DiagnosticCategory.Error && !IMPORT_INUTILISE.has(d.code))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')));
}, 300_000);

describe('client Supabase typé (supabase.ts → ClientDatabase)', () => {
  it('le client est déclaré avec le schéma, sans createClient nu', () => {
    const source = readFileSync(path.join(RACINE, 'src/lib/supabase.ts'), 'utf8');
    expect(source).toContain('SupabaseClient<ClientDatabase>');
    expect(source.match(/createClient\(/g) ?? []).toEqual([]);
  });

  it('des appels justes compilent', () => {
    expect(parCas[0]).toEqual([]);
  });

  it.each(FAUX.map(([nom], i) => [nom, i + 1] as const))('refuse : %s', (_nom, i) => {
    expect(parCas[i].length).toBeGreaterThan(0);
  });
});
