// ═══════════════════════════════════════════════════════════════════
// Garde : aucun sondage PERMANENT ne revient dans l'application
//
// ── POURQUOI ───────────────────────────────────────────────────────
//
// Le sondage périodique a coûté à ce dépôt sa journée de trafic la plus chère :
// huit `refetchInterval` montés en permanence, ~30 requêtes par minute et par
// utilisateur connecté AVANT toute interaction, et ~58 Mo/mois d'egress par
// utilisateur sur le seul `useTasks`. Les trois canaux Realtime (mig. 118, 120,
// et `useSharedTasksRealtime`) les ont remplacés.
//
// 🔴 Mais surtout : ce nombre a été COMPTÉ FAUX. `CLAUDE.md` a annoncé « aucun
// sondage permanent » alors que deux l'étaient encore, dont `useOrgJoinRequests`
// — monté par `Layout`, donc actif sur TOUTES les pages protégées, pour tout
// admin d'organisation. Un audit indépendant l'a trouvé. La documentation dit
// depuis : « compter les refetchInterval ne suffit pas, il faut qualifier
// chacun », et la roadmap en fait un checkpoint à rejouer à 100 puis à 1 000
// utilisateurs, NOMINATIVEMENT.
//
// Un checkpoint qu'on rejoue à la main est un checkpoint qu'on oubliera : c'est
// l'argument même de `architecture.guard.test.ts`. Celui-ci le mécanise.
//
// ── CE QUE LA GARDE VÉRIFIE ────────────────────────────────────────
//
// Chaque `refetchInterval` de `src/` doit être CONDITIONNEL, c'est-à-dire l'un
// des deux seuls patrons acceptés dans ce dépôt :
//
//   • un spread gardé      `...(options?.live ? { refetchInterval: 20_000 } : {})`
//   • une valeur calculée  `refetchInterval: isDemo ? false : (query) => …`
//
// Une valeur littérale (`refetchInterval: 20_000`) est un sondage permanent, et
// c'est exactement la forme qui avait échappé au comptage.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * Les commentaires sont retirés AVANT la recherche.
 *
 * Ce dépôt commente abondamment ses décisions de sondage — cinq fichiers
 * expliquent en toutes lettres pourquoi tel `refetchInterval` a été retiré. Les
 * compter ferait dire à la garde qu'il y a douze sondages là où il y en a
 * quatre, et une garde qui crie faux finit désactivée (c'est le raisonnement
 * déjà écrit dans `architecture.guard.test.ts`).
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

interface Hit {
  file: string;
  line: number;
  text: string;
  conditional: boolean;
}

/** Repère chaque `refetchInterval` et dit s'il est gardé par une condition. */
export function findPolling(source: string, file = '?'): Hit[] {
  const lines = stripComments(source).split('\n');
  const hits: Hit[] = [];

  lines.forEach((line, i) => {
    if (!/\brefetchInterval\s*:/.test(line)) return;

    // Patron 1 — spread gardé : la condition vit sur la MÊME ligne.
    //   ...(options?.live ? { refetchInterval: 20_000 } : {})
    const spread = /\.\.\.\(.*\?.*refetchInterval/.test(line);

    // Patron 2 — valeur calculée : ternaire ou fonction, éventuellement sur les
    // lignes suivantes (`refetchInterval: isDemo\n ? false\n : (query) => …`).
    const tail = lines.slice(i, i + 4).join(' ');
    const computed = /refetchInterval\s*:\s*[^,}]*(\?|=>)/.test(tail);

    hits.push({ file, line: i + 1, text: line.trim(), conditional: spread || computed });
  });

  return hits;
}

/**
 * Les quatre sondages autorisés, NOMMÉS. Un total ne prouve rien — c'est la
 * leçon écrite trois fois dans ce dépôt. Cette liste ne doit que rétrécir.
 */
const ALLOWED = new Set([
  'src/modules/organizations/hooks.ts',
  'src/modules/team-okrs/hooks.ts',
  'src/modules/team-projects/hooks.ts',
  'src/modules/tasks/hooks.ts',
]);

const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, '/');

describe('sondage périodique — aucun `refetchInterval` permanent', () => {
  const hits = collect(SRC).flatMap((f) => findPolling(readFileSync(f, 'utf8'), rel(f)));

  it('chaque `refetchInterval` est conditionnel', () => {
    const permanents = hits
      .filter((h) => !h.conditional)
      .map((h) => `${h.file}:${h.line} → ${h.text}`);

    expect(
      permanents,
      'Sondage(s) PERMANENT(S) trouvé(s) :\n' +
        `${permanents.join('\n')}\n` +
        "Chaque tick est une requête pour tout le monde, en permanence. Si la donnée\n" +
        'doit se rafraîchir seule, passer par Realtime (publication supabase_realtime\n' +
        '+ REPLICA IDENTITY FULL) ; sinon `refetchOnWindowFocus` suffit.',
    ).toEqual([]);
  });

  it("aucun NOUVEAU fichier n'introduit de sondage", () => {
    const newcomers = [...new Set(hits.map((h) => h.file))].filter((f) => !ALLOWED.has(f));

    expect(
      newcomers,
      'Fichier(s) qui sondent sans être dans la liste nominative :\n' +
        `${newcomers.join('\n')}\n` +
        "Un sondage conditionnel reste un sondage : l'ajouter ici est une décision,\n" +
        'pas une formalité. Cf. docs/SCALABILITY.md §3.',
    ).toEqual([]);
  });

  // TÉMOIN — sans lui, une détection cassée (regex qui ne matche plus rien)
  // rendrait les deux tests ci-dessus verts en ne mesurant plus rien. C'est
  // exactement le mode de défaillance qui a laissé passer `useOrgJoinRequests`.
  it('détecte réellement un sondage permanent, et laisse passer un sondage gardé', () => {
    const permanent = findPolling('useQuery({ queryKey: k, refetchInterval: 20_000 });');
    expect(permanent).toHaveLength(1);
    expect(permanent[0].conditional).toBe(false);

    const spread = findPolling('...(options?.live ? { refetchInterval: 20_000 } : {}),');
    expect(spread[0].conditional).toBe(true);

    const ternaire = findPolling(
      'refetchInterval: isDemo\n  ? false\n  : (query) => compute(query),',
    );
    expect(ternaire[0].conditional).toBe(true);

    // Un commentaire qui PARLE de sondage n'en est pas un.
    expect(findPolling('// on a retire le refetchInterval: 15_000 ici')).toHaveLength(0);
  });
});
