// ═══════════════════════════════════════════════════════════════════
// GARDE — toute variable de catalogue s'écrit `{{nom}}`, jamais `{nom}`
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02).
//
// `translate()` ne reconnaît que la double accolade. Une clé écrite avec une
// seule affiche donc son gabarit tel quel, à l'écran, sans rien casser :
//
//     "Etape {current} sur {total}"   → « Etape {current} sur {total} »
//
// C'est exactement ce que rendait le compteur d'étapes de `FirstRunSetup`, la
// fonctionnalité d'accueil livrée la veille (T-23). Personne ne l'avait vu, et
// aucune gate ne pouvait le voir :
//
//   - `i18n:check` compare les CLÉS des deux catalogues. Elles étaient
//     identiques des deux côtés, donc conformes.
//   - `i18n:scan` cherche du français resté dans le CODE. Une clé de catalogue
//     n'est pas du code, et « Etape » s'écrivait justement sans accent.
//   - TypeScript type la clé, jamais le contenu de la chaîne.
//
// La seule chose qui l'aurait attrapé est ce test. Il coûte trois lignes et
// couvre les 19 namespaces, dans les deux langues.
//
// ⚠️ Un `{` littéral dans une traduction devrait être échappé plutôt que
// toléré ici : le jour où un texte en a réellement besoin, ajouter une
// exception NOMMÉE, pas assouplir l'expression régulière.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'src/locales';

/** `{nom}` non précédé et non suivi d'une seconde accolade. */
const SINGLE_BRACE = /(?<!\{)\{[a-zA-Z][a-zA-Z0-9_]*\}(?!\})/g;

interface Offender {
  file: string;
  key: string;
  value: string;
}

function walkCatalog(
  node: unknown,
  prefix: string,
  file: string,
  out: Offender[],
): void {
  if (typeof node === 'string') {
    const hits = node.match(SINGLE_BRACE);
    if (hits) out.push({ file, key: prefix, value: node });
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walkCatalog(v, prefix ? `${prefix}.${k}` : k, file, out);
    }
  }
}

describe('catalogues i18n — syntaxe d’interpolation', () => {
  const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  it('au moins deux locales sont vérifiées', () => {
    // Sans cette assertion, un chemin cassé rendrait le test vert à vide.
    expect(locales.length).toBeGreaterThanOrEqual(2);
  });

  it.each(locales)('%s : aucune variable en simple accolade', (locale) => {
    const dir = join(LOCALES_DIR, locale);
    const offenders: Offender[] = [];

    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const catalog = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      walkCatalog(catalog, '', `${locale}/${file}`, offenders);
    }

    expect(
      offenders.map((o) => `${o.file} → ${o.key} : ${o.value}`),
      'Ces chaînes affichent leur gabarit au lieu de la valeur.\n' +
        'La syntaxe reconnue par `translate()` est `{{nom}}`, avec DEUX accolades.',
    ).toEqual([]);
  });
});
