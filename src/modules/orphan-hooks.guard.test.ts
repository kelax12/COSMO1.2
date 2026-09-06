// ═══════════════════════════════════════════════════════════════════
// Aucun hook exporté par `src/modules` sans consommateur (C-49)
//
// POURQUOI CE FICHIER EXISTE
// Le 2026-09-03, un balayage a trouvé 52 hooks exportés que rien ne montait —
// un quart de la surface publique des modules. Ce n'est pas du poids, c'est du
// code NON ÉPROUVÉ : personne ne peut dire s'il marche, parce que personne ne
// s'en sert. Même famille que `MobileScreen` / `ListRow` (C-10) et que
// `MobileHeader`, cassé pendant un mois sur la seule page qui le montait.
//
// 49 ont été supprimés le 2026-09-05. Cette garde existe pour que le chiffre
// ne remonte pas : un hook livré sans écran échoue ici, à l'écriture, pas dans
// un audit six semaines plus tard.
//
// ⚠️ CE QUE CETTE GARDE REGARDE, ET SES DEUX ANGLES MORTS CONNUS
// La leçon des quatre gardes prises en défaut le 2026-09-03 : la question
// n'est pas « tourne-t-elle ? » mais « sur QUOI ? ». Les deux pièges ci-dessous
// ont été rencontrés POUR DE VRAI pendant la passe C-49 :
//
//   1. Les COMMENTAIRES sont retirés avant la recherche. Sans ça,
//      `useCreateKRCompletion` sortait de la liste des orphelins parce que
//      deux commentaires expliquant pourquoi il est dangereux le nommaient.
//      Une mention n'est pas un appel — c'est le même correctif que
//      `architecture.guard.test.ts` a dû faire pour `supabase.from(`.
//   2. Un hook appelé par un AUTRE hook du même fichier n'est PAS orphelin.
//      `useFilteredTasks` n'est importé par aucun écran, mais `usePendingTasks`
//      l'appelle, et celui-là sert `DeadlineCalendar` et `TasksSummary`. Le
//      supprimer — ce que la liste d'origine demandait — cassait deux écrans.
//      C'est pourquoi le fichier déclarant compte comme consommateur dès qu'il
//      mentionne le hook AILLEURS que dans sa propre déclaration.
//
// ❌ Ne jamais « autoriser » un orphelin par une liste d'exceptions sans note
//    écrite. Une capacité d'interface assumée se garde AVEC sa justification
//    (cf. `ALLOWED_ORPHANS`), jamais par défaut.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/');
const isTest = (f: string) => /\.(test|spec)\.tsx?$/.test(f);
const isBarrel = (f: string) => /\/index\.ts$/.test(rel(f));

/** Une mention en commentaire n'est pas un appel (angle mort n°1). */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const moduleFiles = walk(path.join(ROOT, 'src', 'modules')).filter((f) => !isTest(f));
const appFiles = walk(path.join(ROOT, 'src')).filter((f) => !isTest(f));
const codeOf = new Map(appFiles.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));

/** Hooks exportés, déclarés hors baril (un baril réexporte, il ne déclare pas). */
const declarations = new Map<string, string>();
for (const file of moduleFiles) {
  if (isBarrel(file)) continue;
  const re = /export\s+(?:async\s+)?(?:function|const)\s+(use[A-Z][A-Za-z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(codeOf.get(file) as string))) declarations.set(m[1], file);
}

function consumerCount(name: string): number {
  const word = new RegExp(`\\b${name}\\b`);
  const declFile = declarations.get(name) as string;
  return appFiles.filter((file) => {
    if (isBarrel(file)) return false;
    const code = codeOf.get(file) as string;
    if (file === declFile) {
      // Angle mort n°2 : le fichier déclarant compte s'il mentionne le hook
      // ailleurs que dans sa propre déclaration.
      const occurrences = code.match(word ? new RegExp(`\\b${name}\\b`, 'g') : / /g);
      return (occurrences?.length ?? 0) > 1;
    }
    return word.test(code);
  }).length;
}

/**
 * Orphelins TOLÉRÉS, chacun avec sa raison. La liste doit rester courte, et
 * chaque entrée doit dire pourquoi le code vit sans consommateur direct.
 */
const ALLOWED_ORPHANS = new Map<string, string>([
  // Aucun pour l'instant. `useFilteredTasks` n'y figure pas : il EST consommé,
  // par `usePendingTasks`, dans son propre fichier — la garde le voit.
]);

describe('modules — aucun hook exporté sans consommateur (C-49)', () => {
  // 🔴 TÉMOIN. Sans lui, un balayage qui cesserait de trouver des fichiers (un
  // chemin qui change, un dossier déplacé) passerait au VERT en ne regardant
  // plus rien — le défaut exact relevé sur quatre gardes le 2026-09-03.
  it('TÉMOIN : le balayage voit des hooks, et sait les compter', () => {
    expect(declarations.size).toBeGreaterThan(100);

    // Des hooks connus comme VIVANTS doivent rendre plusieurs consommateurs.
    // Si ce bloc tombe à zéro, c'est la mesure qui est cassée, pas le code.
    for (const live of ['useTasks', 'useHabits', 'useEvents', 'useOkrs', 'useCreateTask']) {
      expect(declarations.has(live), `${live} devrait être déclaré`).toBe(true);
      expect(consumerCount(live), `${live} devrait avoir des consommateurs`).toBeGreaterThan(3);
    }

    // Et un hook manifestement inexistant ne doit PAS être compté vivant :
    // sans cette sonde, un `consumerCount` qui rendrait toujours > 0 rendrait
    // la garde incapable de détecter quoi que ce soit.
    declarations.set('useHookQuiNExistePas', path.join(ROOT, 'src', 'modules', 'inexistant.ts'));
    expect(consumerCount('useHookQuiNExistePas')).toBe(0);
    declarations.delete('useHookQuiNExistePas');
  });

  it('aucun hook orphelin', () => {
    const orphans = [...declarations.keys()]
      .filter((name) => !ALLOWED_ORPHANS.has(name))
      .filter((name) => consumerCount(name) === 0)
      .map((name) => `${name}  (${rel(declarations.get(name) as string)})`)
      .sort();

    expect(
      orphans,
      'Hook(s) exporté(s) que rien ne monte :\n' +
        `${orphans.join('\n')}\n\n` +
        "Un hook sans écran n'est pas seulement du poids : il est NON ÉPROUVÉ.\n" +
        "Deux sorties, jamais une troisième — le brancher sur un écran, ou le\n" +
        "supprimer. « On le garde, ça resservira » suppose qu'il marche, et\n" +
        "c'est précisément ce que personne ne peut affirmer.\n" +
        "Capacité d'interface assumée ? L'inscrire dans ALLOWED_ORPHANS AVEC sa\n" +
        'raison écrite.',
    ).toEqual([]);
  });
});
