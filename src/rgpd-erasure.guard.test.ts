// ═══════════════════════════════════════════════════════════════════
// Garde statique de l'effacement de compte (RGPD art. 17)
//
// POURQUOI CE FICHIER EXISTE
//
// `supabase/functions/delete-account/index.ts` purge les données d'un compte
// avant de supprimer la ligne `auth.users`. Sa boucle générique filtre sur
// `user_id`. Or trois tables de collaboration sont SYMÉTRIQUES : le compte
// supprimé peut y apparaître dans une SECONDE colonne, celle qui désigne
// « l'autre » — et cette colonne-là, la boucle ne la voit pas.
//
// Deux des trois avaient déjà été corrigées, chacune après coup :
//   • `shared_tasks`     (`friend_id` / `shared_by`) — finding M-6
//   • `friend_requests`  (`sender_id` / `receiver_id`)
//   • `friends`          (`user_id` / `friend_user_id`) — corrigé le 2026-08-24
//
// Le cas de `friends` était le plus grave des trois, et le dernier vu :
// la ligne contient le NOM, l'EMAIL et l'AVATAR de l'ami en clair. Après
// exercice du droit à l'effacement, ces données restaient dans les données de
// chacun de ses anciens contacts, sans limite de durée.
//
// ⚠️ Remesuré le 2026-09-03 (audit A-1) : `friends_friend_user_id_fkey` est
// `ON DELETE CASCADE`, plus `SET NULL`. La migration 116 l'a explicitement
// basculée, et ce commentaire décrivait donc l'état d'avant. La purge
// explicite garde tout son sens : elle ne dépend d'AUCUNE FK, donc elle
// survit à un changement de schéma fait ailleurs. C'est précisément ce qui
// vient d'arriver à la phrase qu'elle remplace.
//
// FORME : une garde textuelle, pas un test d'intégration. Elle ne prouve pas
// que la purge fonctionne — elle prouve qu'on n'a pas SILENCIEUSEMENT laissé
// une table symétrique retomber dans la boucle générique. C'est exactement la
// régression qui s'est produite trois fois.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EDGE_FN = path.resolve(process.cwd(), 'supabase/functions/delete-account/index.ts');
const source = readFileSync(EDGE_FN, 'utf8');

/** table → les deux colonnes qui peuvent porter l'identifiant du compte. */
const SYMMETRIC_TABLES: Record<string, [string, string]> = {
  friends: ['user_id', 'friend_user_id'],
  friend_requests: ['sender_id', 'receiver_id'],
  shared_tasks: ['friend_id', 'shared_by'],
};

describe('effacement de compte — tables symétriques (RGPD art. 17)', () => {
  it('lit bien la Edge Function', () => {
    expect(source.length).toBeGreaterThan(1000);
  });

  for (const [table, [colA, colB]] of Object.entries(SYMMETRIC_TABLES)) {
    it(`purge \`${table}\` sur ses DEUX colonnes (${colA} + ${colB})`, () => {
      // On cherche un `.from('<table>').delete().or(...)` citant les deux
      // colonnes. Le `.or()` est la seule forme qui couvre les deux sens.
      const block = new RegExp(
        `from\\('${table}'\\)[\\s\\S]{0,200}?\\.or\\(\\s*\`([^\`]*)\``,
      ).exec(source);

      expect(
        block,
        `Aucun \`.from('${table}').delete().or(...)\` trouvé dans delete-account.\n` +
          `\`${table}\` est symétrique : un compte y apparaît aussi en \`${colB}\`.\n` +
          'La boucle générique ne filtre que `user_id` — elle laisserait donc\n' +
          `des lignes orphelines portant les données personnelles du compte supprimé.`,
      ).not.toBeNull();

      const filter = block?.[1] ?? '';
      expect(filter, `Le filtre de \`${table}\` doit citer \`${colA}\``).toContain(`${colA}.eq.`);
      expect(filter, `Le filtre de \`${table}\` doit citer \`${colB}\``).toContain(`${colB}.eq.`);
    });
  }

  it('exclut ces tables de la boucle générique par `user_id`', () => {
    // La boucle générique fait `.delete().eq('user_id', …)`. Toute table
    // symétrique qui y reste serait purgée à moitié — le symptôme est
    // silencieux (aucune erreur, aucune ligne manquante côté propriétaire).
    const loopGuard = /if \(table === [\s\S]{0,200}?\) continue/.exec(source)?.[0] ?? '';
    for (const table of ['friends', 'friend_requests']) {
      expect(
        loopGuard,
        `\`${table}\` doit être sautée par la boucle générique (elle est purgée\n` +
          'explicitement, sur ses deux colonnes, avant la boucle).',
      ).toContain(`'${table}'`);
    }
  });
});
