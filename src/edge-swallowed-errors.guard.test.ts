// ═══════════════════════════════════════════════════════════════════
// Garde statique : aucune lecture de `delete-account` n'avale son erreur
//
// POURQUOI CE FICHIER EXISTE (audit A-1, 2026-09-03)
//
// C'est la famille S-1 / S-2 de `faille.md`, trouvée cette fois hors Stripe :
// une lecture dont le RÉSULTAT DÉCIDE d'un routage, et dont l'erreur n'est pas
// regardée, transforme une panne de lecture en réponse « il n'y a rien ».
//
// Le cas mesuré : `delete-account` choisit le successeur d'une organisation
// avec
//
//     const { data: others } = await supabaseAdmin.from('organization_members')…
//
// Sur erreur, `others` vaut `null`, donc « aucun autre membre », donc aucun
// transfert de propriété — puis `auth.admin.deleteUser` s'exécute et
// `organizations.owner_id` étant `ON DELETE CASCADE`, l'organisation entière
// part avec le compte. Mesuré en prod le 2026-09-03 : 22 clés étrangères
// visent `organizations(id)`, dont 21 en CASCADE (membres, équipes, projets,
// tâches d'équipe, OKR, et les preuves `renewal_notices` /
// `withdrawal_consents`).
//
// FORME : garde textuelle. Elle ne prouve pas que la purge marche, elle prouve
// qu'aucune lecture n'a SILENCIEUSEMENT reperdu son `error`. Elle embarque un
// TÉMOIN : si le détecteur cesse de détecter, le témoin le dit.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EDGE_FN = path.resolve(process.cwd(), 'supabase/functions/delete-account/index.ts');
const source = readFileSync(EDGE_FN, 'utf8');

/**
 * Déstructuration d'un `await supabase*` qui prend `data` sans prendre `error`.
 * On ne regarde que les accolades de la déstructuration, jamais la suite.
 */
const SWALLOWED = /const\s*\{([^}]*)\}\s*=\s*await\s+supabase/g;

function swallowedReads(code: string): string[] {
  return [...code.matchAll(SWALLOWED)]
    .map((m) => m[1])
    .filter((binding) => binding.includes('data') && !binding.includes('error'));
}

describe('delete-account — aucune lecture n\'avale son erreur (famille S-1 / S-2)', () => {
  it('lit bien la Edge Function', () => {
    expect(source.length).toBeGreaterThan(1000);
  });

  it('TÉMOIN : le détecteur voit une lecture qui ignore son `error`', () => {
    // Sans ce témoin, un détecteur cassé rendrait « zéro occurrence », donc
    // vert, donc rassurant. C'est exactement le défaut relevé le 2026-09-03
    // sur quatre gardes du dépôt.
    const echantillon = `
      const { data: others } = await supabaseAdmin.from('organization_members').select('*')
    `;
    expect(swallowedReads(echantillon)).toHaveLength(1);
  });

  it('aucune déstructuration ne prend `data` sans `error`', () => {
    expect(
      swallowedReads(source),
      'Une lecture de `delete-account` prend `data` sans regarder `error`.\n' +
        'Sur panne de lecture, `data` vaut `null` : le code conclut « rien à faire »\n' +
        'et poursuit la suppression. Sur le choix du successeur d\'une organisation,\n' +
        'cela détruit une organisation entière (owner_id est ON DELETE CASCADE).\n' +
        'Relancer plutôt que deviner : pousser la table dans `failedTables`.',
    ).toEqual([]);
  });
});
