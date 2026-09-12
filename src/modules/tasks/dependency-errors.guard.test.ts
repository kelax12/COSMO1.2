// Garde statique : un refus de dépendance se nomme, il ne se DÉCRIT pas.
//
// POURQUOI CE FICHIER EXISTE (C-48)
// Les quatre triggers de dépendance (mig. 132 pour le personnel, 108/109 pour
// l'équipe) refusaient par des PHRASES anglaises. `normalizeApiError` ne
// promeut un message serveur en code métier que s'il matche `BUSINESS_CODE_RE`
// (`^[a-z][a-z0-9_]{2,49}$`) : une phrase avec des espaces et des majuscules
// n'y entre pas, donc le refus retombait sur le message générique en
// production, et arrivait en anglais dans le gabarit français en démo.
//
// La mig. **137** fait dire un IDENTIFIANT aux quatre triggers. Elle est
// appliquée en production depuis le 2026-09-12 (ledger : dernière entrée),
// vérifiée acteur par acteur sur 13 scénarios en transaction annulée — même
// verdict qu'avant pour chacun, seul le texte change.
//
// 🔴 CE QUE CETTE GARDE TIENT, et pourquoi elle n'est pas redondante avec les
// tests de comportement : entre le 2026-09-04 et le 2026-09-12,
// `dependency-errors.ts` portait une TABLE DE TRANSITION phrase → identifiant,
// le temps que la migration soit appliquée. Cette table faisait exactement ce
// que `CLAUDE.md` interdit nommément — identifier une erreur par son message —
// et rien ne l'empêchait de survivre à la migration, ni de revenir au prochain
// `RAISE`. La garde refuse donc :
//   1. toute chaîne-PHRASE dans `dependency-errors.ts` ;
//   2. tout `RAISE EXCEPTION '<phrase>'` dans une migration de numéro ≥ 137
//      qui touche l'une des quatre fonctions de dépendance.
//
// ⚠️ Les migrations 108, 109 et 132 gardent leurs phrases, et c'est normal :
// ce sont des instantanés historiques, remplacés par la 137. Une garde qui
// leur ferait la leçon demanderait de réécrire l'histoire du dépôt.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const MODULE_PATH = path.join(process.cwd(), 'src', 'modules', 'tasks', 'dependency-errors.ts');
const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migration');

/** Les quatre fonctions dont le texte de refus est un contrat avec le client. */
const DEPENDENCY_FUNCTIONS = [
  'validate_task_dependency',
  'prevent_task_dependency_cycle',
  'validate_team_task_dependency',
  'prevent_team_task_dependency_cycle',
];

/** La forme que `normalizeApiError` sait relayer (`BUSINESS_CODE_RE`). */
const IDENTIFIER = /^[a-z][a-z0-9_]{2,49}$/;

/** Deux mots latins de suite : la signature d'une phrase, pas d'un identifiant. */
const LOOKS_LIKE_A_SENTENCE = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/;

/** Retire commentaires de ligne et de bloc, pour ne juger que du CODE. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/** Les littéraux de chaîne d'un source TypeScript, commentaires exclus. */
function stringLiterals(source: string): string[] {
  const out: string[] = [];
  for (const match of stripComments(source).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)) {
    out.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return out;
}

/**
 * Les textes de `RAISE EXCEPTION '…'` d'un fichier SQL, COMMENTAIRES EXCLUS.
 *
 * ⚠️ L'exclusion n'est pas cosmétique : l'en-tête de la 137 cite la forme
 * attendue (`RAISE EXCEPTION '<identifiant>'`) pour l'expliquer, et la
 * première version de cette garde s'est arrêtée dessus. Une garde qui lit les
 * commentaires juge la documentation, pas le code.
 */
function raisedTexts(sql: string): string[] {
  const code = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
  return [...code.matchAll(/RAISE\s+EXCEPTION\s+'([^']*)'/gi)].map((m) => m[1]);
}

describe('dependency-errors.ts ne connaît aucune PHRASE', () => {
  it('aucun littéral de chaîne n a la forme d une phrase', () => {
    const offenders = stringLiterals(readFileSync(MODULE_PATH, 'utf-8')).filter((value) =>
      LOOKS_LIKE_A_SENTENCE.test(value),
    );
    expect(offenders).toEqual([]);
  });

  it('les identifiants exportés sont bien des identifiants', () => {
    const source = readFileSync(MODULE_PATH, 'utf-8');
    const codes = [...source.matchAll(/'(dependency_[a-z_]+)'/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(4);
    for (const code of codes) expect(code).toMatch(IDENTIFIER);
  });

  it('TÉMOIN : le détecteur voit revenir une table de transition', () => {
    // Exactement la forme retirée le 2026-09-12. Si ce témoin cesse d'être
    // rouge, c'est le détecteur qui est cassé, pas le module qui est propre.
    const saboted = `
      const LEGACY: Record<string, string> = {
        'This dependency would create a cycle': 'dependency_cycle',
      };
    `;
    expect(stringLiterals(saboted).filter((v) => LOOKS_LIKE_A_SENTENCE.test(v))).toEqual([
      'This dependency would create a cycle',
    ]);
  });

  it('TÉMOIN : le détecteur ne voit PAS une phrase écrite en COMMENTAIRE', () => {
    // Sans ça, la garde interdirait d'expliquer pourquoi elle existe — et ce
    // fichier comme le module cité commentent tous deux la phrase d'origine.
    const commented = `
      // « This dependency would create a cycle » était la phrase d avant.
      /* Both tasks must exist, disait la 132. */
      const CODE = 'dependency_cycle';
    `;
    expect(stringLiterals(commented).filter((v) => LOOKS_LIKE_A_SENTENCE.test(v))).toEqual([]);
  });
});

describe('les migrations ≥ 137 refusent par identifiant', () => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => Number.parseInt(f.slice(0, 3), 10) >= 137);

  it('le périmètre balayé n est pas vide', () => {
    // Témoin de cadrage : un filtre qui ne retient plus rien ferait passer la
    // garde en ne regardant aucun fichier.
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.startsWith('137'))).toBe(true);
  });

  it.each(files)('%s', (file) => {
    const sql = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    if (!DEPENDENCY_FUNCTIONS.some((fn) => sql.includes(fn))) return;
    const texts = raisedTexts(sql);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text).toMatch(IDENTIFIER);
  });

  it('TÉMOIN : un RAISE cité en COMMENTAIRE ne compte pas', () => {
    const documented = `-- Exemple : RAISE EXCEPTION 'Both tasks must exist';
      /* et RAISE EXCEPTION 'This dependency would create a cycle' aussi */
      BEGIN RAISE EXCEPTION 'dependency_cycle'; END;`;
    expect(raisedTexts(documented)).toEqual(['dependency_cycle']);
  });

  it('TÉMOIN : le détecteur voit un RAISE qui redeviendrait une phrase', () => {
    const saboted = `CREATE OR REPLACE FUNCTION public.prevent_task_dependency_cycle()
      AS $$ BEGIN RAISE EXCEPTION 'This dependency would create a cycle'; END; $$;`;
    expect(raisedTexts(saboted)).toEqual(['This dependency would create a cycle']);
    expect(raisedTexts(saboted)[0]).not.toMatch(IDENTIFIER);
  });
});
