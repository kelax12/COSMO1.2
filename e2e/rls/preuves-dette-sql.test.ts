// ═══════════════════════════════════════════════════════════════════
// Preuves des mig. 242, 243, 244, 248, 249, 250 et 251, rejouées sur la base fraîche du job
// `rls-integration`.
//
// Une preuve de `supabase/proofs/` est un bloc `DO` qui se termine TOUJOURS
// par `RAISE EXCEPTION 'PREUVE-ANNULEE <n> ECHEC | …'` (forme de
// `208-210.proof.sql`). Elle embarque le texte de sa migration
// (`EXECUTE $mig$ … $mig$`) pour se jouer en production AVANT application.
// Jusqu'ici, une preuve ne tournait qu'une fois, à la main. Ce fichier la
// fait tourner à chaque commit, et vérifie deux choses qu'un geste manuel ne
// vérifie pas :
//   · le texte embarqué EST celui du fichier de migration (sinon la preuve
//     prouverait une autre migration que celle qu'on applique) ;
//   · le verdict est « 0 ECHEC », et l'annulation a bien tout emporté.
//
// La base a déjà toutes les migrations : la preuve les rejoue (elles sont
// idempotentes), puis juge l'état. Rôle : `postgres`, celui qui applique.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { connecter } from './catalogue';

/**
 * `depassee` : la migration a été remplacée par une suivante qui change le
 * TYPE DE RETOUR d'une fonction qu'elle crée. La rejouer par-dessus lève
 * « cannot change return type » : son texte reste vérifié, son exécution non.
 * La preuve a été jouée en production avant application (0 ECHEC), et la
 * migration suivante reprend ses garanties dans SA preuve.
 */
const PREUVES: { preuve: string; migration: string; depassee?: string }[] = [
  { preuve: '242.proof.sql', migration: '242_ferme_par_defaut_anon.sql' },
  { preuve: '243.proof.sql', migration: '243_regle_unique_projet_equipe.sql' },
  { preuve: '244.proof.sql', migration: '244_select_permissive_unique.sql' },
  // DAT-02 (V13.3, V13.4) : séries, totaux et temps investi inchangés par le
  // passage de `habits.completions` à `habit_completions`.
  { preuve: '248.proof.sql', migration: '248_habit_completions.sql',
    depassee: 'mig. 251 (2026-11-13) : get_my_habits et toggle_habit_completion_v2 rendent deux colonnes de plus ; '
      + 'la preuve 251 compare chaque habitude sans jours prévus au calcul de la 248, avant et après.' },
  // Échéance et priorité facultatives (PAR-01, PAR-02), décision du 2026-11-09.
  { preuve: '249.proof.sql', migration: '249_taches_echeance_priorite_facultatives.sql' },
  // `friend_requests` à la forme de la production (divergence FRIENDS-USER-ID).
  { preuve: '250.proof.sql', migration: '250_friend_requests_forme_prod.sql' },
  // Jours prévus des habitudes : séries sur les seuls jours prévus, rien ne bouge sans réglage.
  { preuve: '251.proof.sql', migration: '251_habit_scheduled_days.sql' },
];

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8').replace(/\r\n/g, '\n');
const db = await connecter();

afterAll(async () => {
  await db.end();
});

describe('supabase/proofs : preuves 242 à 244 et 248 à 251 rejouées sur la base fraîche', () => {
  for (const { preuve, migration, depassee } of PREUVES) {
    it(`${preuve} embarque le texte exact de ${migration}`, () => {
      const texte = lire(`supabase/proofs/${preuve}`);
      const m = texte.match(/EXECUTE \$mig\$\n([\s\S]*?)\n\$mig\$;/);
      expect(m, `${preuve} : aucun bloc EXECUTE $mig$ … $mig$`).not.toBeNull();
      expect(m![1], `${preuve} : le texte embarqué a dérivé de ${migration}`).toBe(
        lire(`supabase/migration/${migration}`).replace(/\n+$/, ''),
      );
    });

    it.skipIf(!!depassee)(`${preuve} : PREUVE-ANNULEE 0 ECHEC${depassee ? ` (non rejouée, dépassée par la ${depassee})` : ''}`, async () => {
      let verdict: string;
      try {
        await db.query(lire(`supabase/proofs/${preuve}`));
        verdict = 'le bloc DO a VALIDÉ au lieu de lever : la preuve ne s’annule pas';
      } catch (e) {
        verdict = (e as Error).message;
      }
      // Une ligne par assertion, lisible dans le journal du job.
      console.log(`PREUVE ${preuve}\n  ${verdict.split(' | ').join('\n  ')}`);
      expect(verdict).toMatch(/^PREUVE-ANNULEE 0 ECHEC \|/);
    }, 60_000);
  }

  it('l’annulation a tout emporté : ni table de preuve, ni compte, ni organisation', async () => {
    const { rows } = await db.query<{ table_242: string | null; comptes: string; orgs: string }>(
      `SELECT to_regclass('public.preuve_242_ferme')::text AS table_242,
              (SELECT count(*)::text FROM auth.users WHERE email LIKE ANY (ARRAY['%24_@proof.invalid', '%25_@proof.invalid'])) AS comptes,
              (SELECT count(*)::text FROM public.organizations WHERE join_code LIKE 'PRF243%') AS orgs`,
    );
    expect(rows[0]).toEqual({ table_242: null, comptes: '0', orgs: '0' });
  });
});
