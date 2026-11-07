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
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
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
