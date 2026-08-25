// ═══════════════════════════════════════════════════════════════════
// GARDE, le découpage des catalogues i18n ne peut pas se désaligner
//
// Depuis le 2026-08-25, seuls `common` et `errors` sont dans le chunk
// d'entrée : les 17 autres namespaces voyagent avec la page qui les utilise
// (`lazyWithRetry(factory, [...])`, src/App.tsx).
//
// Ce découpage repose sur UNE hypothèse, et une seule : la liste déclarée par
// chaque route couvre tout ce que son sous-arbre traduit. Si elle ne la couvre
// pas, `t()` renvoie la clé brute, `org.project.name` à l'écran, pendant que
// tout le reste a l'air normal. C'est exactement le genre de régression qu'une
// relecture ne voit pas et qu'un test doit voir.
//
// Les trois tests ci-dessous sont donc, dans l'ordre :
//   1. la liste eager reflète la MESURE du shell, ni plus ni moins ;
//   2. chaque route déclare au moins ce que son sous-arbre utilise ;
//   3. la liste des namespaces couvre exactement les fichiers de locales/fr.
//
// La mesure est faite par `scripts/i18n-shell-namespaces.mjs`, réutilisé ici
// tel quel : le test et l'outil de diagnostic ne peuvent pas diverger.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  shellNamespaces,
  pageNamespaces,
  // @ts-expect-error, script Node en .mjs, sans déclarations de types
} from '../../scripts/i18n-shell-namespaces.mjs';
import { EAGER_NAMESPACES, listNamespaces } from './catalog';

const ROOT = process.cwd();

/** Déclarations `lazyWithRetry(() => import('…'), [ns…])` lues dans App.tsx. */
function declaredByRoute(): Map<string, string[]> {
  const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
  const out = new Map<string, string[]>();
  const re =
    /lazyWithRetry\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)\s*(?:,\s*\[([^\]]*)\])?\s*\)/g;
  for (const m of app.matchAll(re)) {
    // `@/pages/X` → `src/pages/X`, sans extension : le script résout les
    // extensions, la regex non. On compare donc des clés sans suffixe.
    const spec = m[1].replace('@/', 'src/');
    const list = (m[2] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    out.set(spec, list);
  }
  return out;
}

/** `src/pages/TasksPage.tsx` → `src/pages/TasksPage`. */
const stripExt = (p: string): string => p.replace(/\\/g, '/').replace(/\.tsx?$/, '');

describe('découpage des catalogues i18n', () => {
  it('tout namespace RENDU par le shell est eager', () => {
    const { byNamespace } = shellNamespaces() as {
      byNamespace: Map<string, string[]>;
    };
    const renderedByShell = [...byNamespace.keys()].sort();
    const eager = new Set<string>(EAGER_NAMESPACES);

    // Le sens qui porte la correction : un namespace rendu avant qu'une route
    // soit résolue et absent du chunk d'entrée, ce sont des clés brutes à
    // l'écran. Mesuré, pas supposé.
    const notEager = renderedByShell.filter((ns) => !eager.has(ns));
    expect(
      notEager,
      `Ces namespaces sont rendus par le shell et doivent être eager :\n` +
        notEager.map((ns) => `  ${ns} → ${byNamespace.get(ns)?.join(', ')}`).join('\n')
    ).toEqual([]);
  });

  it('la liste eager ne contient QUE des cas justifiés', () => {
    // L'autre sens ne se déduit pas d'une analyse statique, donc il s'écrit.
    //
    //  • `common` : rendu par le shell (bannière cookies, boundary d'erreur,
    //    réclamation d'invitation). Le test précédent le prouve.
    //  • `errors` : catalogue TRANSVERSE. `normalizeApiError` peut lever avant
    //    qu'une route ait résolu, la première requête d'`AuthContext` suffit,
    //    et son message part dans un toast. Aucune route ne peut donc en
    //    garantir le chargement. 8 ko bruts, le prix est faible et la panne
    //    qu'il évite ne l'est pas.
    //
    // 🔴 Ajouter un troisième nom ici DOIT casser ce test : c'est le seul
    // endroit du dépôt où l'on remet du poids dans le chemin critique, et ça ne
    // doit jamais se faire par confort.
    expect([...EAGER_NAMESPACES].sort()).toEqual(['common', 'errors']);
  });

  // 60 s : ce test parcourt le graphe d'imports de tout `src/`. Le calcul est
  // fait par point fixe (≈1,5 s à vide), mais l'instrumentation de couverture
  // et 150 fichiers de test en parallèle peuvent le multiplier. Marge large
  // exprès : un timeout de contention se lirait comme un vrai désalignement.
  it('chaque route déclare AU MOINS les namespaces de son sous-arbre', { timeout: 60_000 }, () => {
    const required = pageNamespaces() as Map<string, string[]>;
    const declared = declaredByRoute();
    const eager = new Set<string>(EAGER_NAMESPACES);

    const declaredByKey = new Map(
      [...declared].map(([spec, list]) => [stripExt(spec), list])
    );

    const missing: string[] = [];
    for (const [page, needed] of required) {
      // `Layout.tsx` est déclaré comme les pages ; les autres entrées sont des
      // pages. Une entrée sans déclaration serait un oubli pur et simple.
      const list = new Set(declaredByKey.get(stripExt(page)) ?? []);
      for (const ns of needed) {
        if (eager.has(ns) || list.has(ns)) continue;
        missing.push(`${stripExt(page)} → '${ns}'`);
      }
    }

    // Message explicite : le correctif est mécanique, autant le donner.
    expect(
      missing,
      `Namespaces utilisés mais non déclarés.\n` +
        `Corriger la liste dans src/App.tsx, la bonne réponse est donnée par :\n` +
        `  npm run i18n:namespaces -- --pages\n\n` +
        missing.map((m) => `  ${m}`).join('\n')
    ).toEqual([]);
  });

  it('la liste des namespaces couvre exactement src/locales/fr/', () => {
    const files = readdirSync(join(ROOT, 'src/locales/fr'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();

    // `NAMESPACES` est écrit à la main depuis que `fr` n'est plus importé en
    // bloc : c'est le seul endroit du socle i18n qui peut se désynchroniser
    // d'un simple ajout de fichier.
    expect([...listNamespaces()].sort()).toEqual(files);
  });
});
