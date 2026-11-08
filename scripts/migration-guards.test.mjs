// ═══════════════════════════════════════════════════════════════════
// migration-guards.test.mjs — tester les GARDES, pas seulement le code
//
// Deux findings du 2026-08-24 (B-1 et B-3 de `faille.md` (hors dépôt, `prive/` du checkout principal)) sont passés parce que
// la règle qu'ils enfreignaient ne vivait que dans un fichier Markdown. Les
// gardes ajoutées ce jour-là ne valent donc que si elles échouent VRAIMENT sur
// la régression qu'elles prétendent attraper — une garde qu'on n'a jamais vue
// rouge est une intention, pas une garde.
//
// Chaque cas construit un JEU DE MIGRATIONS MINIMAL dans un dossier temporaire
// et exécute le script réel avec ce dossier comme cwd. On teste le script tel
// qu'il tourne en CI, sans le mocker ni ré-implémenter sa logique.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const CHECK_RLS = resolve(ROOT, 'scripts/check-rls-advisors.mjs');
const VALIDATE = resolve(ROOT, 'scripts/validate-migrations.mjs');

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cosmo-guards-'));
  mkdirSync(join(dir, 'supabase', 'migration'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name, sql) => writeFileSync(join(dir, 'supabase', 'migration', name), sql, 'utf8');
const run = (script) => {
  const r = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

// ── Le REVOKE qui a fermé la fuite inter-organisations (mig. 100) ────
const REVOKE_GET_SUBTREE = `
REVOKE EXECUTE ON FUNCTION public.get_subtree(uuid, uuid) FROM authenticated, anon;
`;

// 30 s au lieu des 5 s par défaut : CHAQUE test de ce fichier lance le script
// réel dans un sous-processus Node. Sous instrumentation de couverture, avec
// 150 fichiers de test en parallèle, un spawn peut dépasser 5 s sans que rien
// ne soit cassé — un timeout de contention se lit comme un échec de garde, ce
// qui est le pire message possible pour un test de sécurité.
describe('check-rls-advisors — règle 3 : fonction appelée par une policy (B-1)', { timeout: 30_000 }, () => {
  it('ÉCHOUE quand une policy appelle une fonction révoquée à authenticated', () => {
    write('100_revoke.sql', REVOKE_GET_SUBTREE);
    write(
      '107_policy.sql',
      `CREATE POLICY "t_update" ON public.t FOR UPDATE
         USING (true)
         WITH CHECK (user_id IN (SELECT public.get_subtree(org_id, (select auth.uid()))));`,
    );

    const { code, out } = run(CHECK_RLS);
    expect(code).toBe(1);
    expect(out).toContain('appelle get_subtree()');
  });

  it('PASSE avec le helper équivalent resté exécutable (is_above)', () => {
    write('100_revoke.sql', REVOKE_GET_SUBTREE);
    write(
      '107_policy.sql',
      `CREATE POLICY "t_update" ON public.t FOR UPDATE
         USING (true)
         WITH CHECK (public.is_above(org_id, user_id));`,
    );

    expect(run(CHECK_RLS).code).toBe(0);
  });

  it("ne se déclenche pas si la fonction a été RE-GRANTée après le REVOKE", () => {
    write('100_revoke.sql', REVOKE_GET_SUBTREE);
    write('101_regrant.sql', 'GRANT EXECUTE ON FUNCTION public.get_subtree(uuid, uuid) TO authenticated;');
    write(
      '107_policy.sql',
      `CREATE POLICY "t_update" ON public.t FOR UPDATE
         USING (true)
         WITH CHECK (user_id IN (SELECT public.get_subtree(org_id, (select auth.uid()))));`,
    );

    expect(run(CHECK_RLS).code).toBe(0);
  });

  it("ne compte PAS un REVOKE qui ne vise que PUBLIC (leçon de la mig. 094b)", () => {
    // `REVOKE … FROM PUBLIC` ne retire pas le GRANT par défaut de Supabase :
    // la fonction reste exécutable, la policy reste valide.
    write('100_revoke.sql', 'REVOKE ALL ON FUNCTION public.get_subtree(uuid, uuid) FROM PUBLIC;');
    write(
      '107_policy.sql',
      `CREATE POLICY "t_update" ON public.t FOR UPDATE
         USING (true)
         WITH CHECK (user_id IN (SELECT public.get_subtree(org_id, (select auth.uid()))));`,
    );

    expect(run(CHECK_RLS).code).toBe(0);
  });
});

// Une migration sauvegarde en en-tête, en commentaire, le corps des policies
// qu'elle retire (retour arrière, mig. 243 et 244). Lu comme du code, ce
// commentaire ressuscitait la policy retirée : deux PERMISSIVE, rouge à tort.
describe('check-rls-advisors — un CREATE POLICY en commentaire n’est pas du code', { timeout: 30_000 }, () => {
  const VIVANTE = `DROP POLICY IF EXISTS "t_view" ON public.t;
CREATE POLICY "t_view" ON public.t FOR SELECT USING ((select auth.uid()) = user_id);`;

  it('PASSE quand la seconde policy n’existe que dans un commentaire de retour arrière', () => {
    write('244_fusion.sql', `-- RETOUR ARRIÈRE :\n--   CREATE POLICY "t_read" ON public.t FOR SELECT USING (auth.uid() = user_id);\n${VIVANTE}`);
    expect(run(CHECK_RLS).code).toBe(0);
  });

  it('TÉMOIN : ÉCHOUE toujours quand la seconde policy est du code', () => {
    write('244_fusion.sql', `CREATE POLICY "t_read" ON public.t FOR SELECT USING ((select auth.uid()) = user_id);\n${VIVANTE}`);
    const { code, out } = run(CHECK_RLS);
    expect(out).toMatch(/t a 2 policies PERMISSIVE pour SELECT/);
    expect(code).toBe(1);
  });
});

describe('validate-migrations — règle 5 : fonctions de trigger (B-3)', { timeout: 30_000 }, () => {
  const TRIGGER_FN = (extra = '') => `
CREATE OR REPLACE FUNCTION public.validate_thing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  RETURN NEW;
END;
$fn$;
${extra}`;

  it('ÉCHOUE sur une fonction de trigger jamais révoquée', () => {
    write('109_thing.sql', TRIGGER_FN());
    const { code, out } = run(VALIDATE);
    expect(code).toBe(1);
    expect(out).toContain('validate_thing()');
    expect(out).toContain('anon');
  });

  it('PASSE avec REVOKE explicite pour anon ET authenticated', () => {
    write(
      '109_thing.sql',
      TRIGGER_FN('REVOKE ALL ON FUNCTION public.validate_thing() FROM PUBLIC, anon, authenticated;'),
    );
    expect(run(VALIDATE).code).toBe(0);
  });

  it('ÉCHOUE si seul PUBLIC est révoqué', () => {
    write('109_thing.sql', TRIGGER_FN('REVOKE ALL ON FUNCTION public.validate_thing() FROM PUBLIC;'));
    expect(run(VALIDATE).code).toBe(1);
  });

  it("accepte qu'une migration ULTÉRIEURE répare l'oubli (état final, pas par fichier)", () => {
    write('109_thing.sql', TRIGGER_FN());
    write('110_fix.sql', 'REVOKE ALL ON FUNCTION public.validate_thing() FROM PUBLIC, anon, authenticated;');
    expect(run(VALIDATE).code).toBe(0);
  });

  it('AVERTIT sans échouer sur un trigger SECURITY DEFINER correctement révoqué', () => {
    write(
      '109_thing.sql',
      `CREATE OR REPLACE FUNCTION public.notify_thing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.notify_thing() FROM PUBLIC, anon, authenticated;`,
    );
    const { code, out } = run(VALIDATE);
    expect(code).toBe(0);
    expect(out).toContain('SECURITY DEFINER');
  });

  it("ne juge PAS les migrations antérieures au cliquet (plancher 109)", () => {
    write('108_thing.sql', TRIGGER_FN());
    expect(run(VALIDATE).code).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chemin d'accès `events` : la RLS hiérarchique reste INDEXABLE (mig. 128)
//
// Troisième occurrence, après `tasks` (mig. 085) et `team_tasks` (mig. 113),
// du même défaut : une policy qui appelle une fonction SUR UNE COLONNE la
// rappelle pour chaque ligne examinée, et perd l'index. Mesuré en prod le
// 2026-08-26 : 17,19 ms → 0,61 ms sur la lecture d'un agenda non géré.
//
// Ce test lit les VRAIES migrations et juge l'ÉTAT FINAL de la policy, comme
// le fait check-rls-advisors : une migration ultérieure peut la redéfinir.
// Il échoue si quelqu'un ré-introduit `manages_user(user_id)` dans le
// prédicat de lecture, ce que rien d'autre n'attraperait.
// ═══════════════════════════════════════════════════════════════════
describe('events, le prédicat de lecture reste hissable en InitPlan (mig. 128)', () => {
  const finalReadPolicy = () => {
    const dirReal = resolve(ROOT, 'supabase/migration');
    const files = readdirSync(dirReal).filter((f) => f.endsWith('.sql')).sort();
    let last = null;
    for (const f of files) {
      const sql = readFileSync(join(dirReal, f), 'utf8');
      // Toutes les policies SELECT posées sur `events` par ce fichier.
      const re = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+public\.events\s+FOR\s+SELECT\s+USING\s*\(([\s\S]*?)\n\s*\);/gi;
      let m;
      while ((m = re.exec(sql)) !== null) last = { file: f, name: m[1], using: m[2] };
    }
    return last;
  };

  it('la dernière policy SELECT de `events` existe et est bien trouvée', () => {
    const p = finalReadPolicy();
    expect(p, 'aucune CREATE POLICY ... ON public.events FOR SELECT trouvée').not.toBeNull();
    // La 244 a retiré la seconde policy SELECT (« read own », mig. 004) et
    // recréé celle de la 128 à l'identique : c'est elle, désormais, l'état final.
    expect(p.file).toBe('244_select_permissive_unique.sql');
  });

  it("n'appelle plus de fonction sur la COLONNE `user_id` (coût par ligne)", () => {
    const { using } = finalReadPolicy();
    expect(using).not.toMatch(/manages_user\s*\(\s*user_id\s*\)/i);
  });

  it('compare `user_id` à un ensemble calculé une fois par requête', () => {
    const { using } = finalReadPolicy();
    expect(using).toMatch(/user_id\s*=\s*ANY\s*\(\s*public\.my_managed_user_ids\(\)\s*\)/i);
  });

  it('`my_managed_user_ids` reste exécutable par `authenticated` (mig. 107, B-1)', () => {
    const sql = readFileSync(
      resolve(ROOT, 'supabase/migration/128_events_managed_ids_indexable.sql'), 'utf8');
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.my_managed_user_ids\(\)\s+TO\s+authenticated/i);
  });
});

// ══════════════════════════════════════════════════════════════════════
// validate-migrations : la checklist « avant tout commit qui touche
// supabase/migration/*.sql » devenue des règles (SECURITY.md AM-4)
//
// Chaque règle part d'une migration CONFORME (elle doit passer : sans ce
// premier cas, une règle trop large rougirait sur tout et serait vite
// contournée), puis d'UN SEUL écart introduit par `saboter()`. Chaque cas
// `TÉMOIN` a été vu rouge contre le script d'avant ces règles, le 2026-10-24.
//
// 🔴 Cliquet à partir de la mig. 227 : la même migration numérotée 226 passe.
// L'historique n'est pas jugé, il diverge de la prod (cf. check-rls-advisors).
// ══════════════════════════════════════════════════════════════════════
describe('validate-migrations : checklist AM-4, cliquet 227', { timeout: 30_000 }, () => {
  const CONFORME = `
CREATE TABLE IF NOT EXISTS public.notes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.notes(id) ON DELETE NO ACTION,
  titre     text
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_notes_user_id ON public.notes;
CREATE TRIGGER trg_notes_user_id BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.notes_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT count(*)::int FROM public.notes WHERE user_id = (select auth.uid()); $$;
REVOKE EXECUTE ON FUNCTION public.notes_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notes_count() TO authenticated;
`;

  /** Un seul écart, et la preuve qu'il a bien été introduit. */
  const saboter = (chercher, remplacer) => {
    const sql = CONFORME.replace(chercher, remplacer);
    expect(sql, `le sabotage n a rien remplace : ${chercher}`).not.toBe(CONFORME);
    return sql;
  };
  const rougit = (sql, raison) => {
    write('227_notes.sql', sql);
    const { code, out } = run(VALIDATE);
    expect(out).toMatch(raison);
    expect(code).toBe(1);
  };

  it('PASSE sur la migration conforme (aucun faux positif)', () => {
    write('227_notes.sql', CONFORME);
    const { code, out } = run(VALIDATE);
    expect(out).toContain('0 erreur(s)');
    expect(code).toBe(0);
  });

  it('TÉMOIN : ÉCHOUE sur une fonction SECURITY DEFINER sans SET search_path', () => {
    rougit(saboter("SET search_path = ''\n", ''), /notes_count\(\) en SECURITY DEFINER sans SET search_path = ''/);
  });

  it('TÉMOIN : ÉCHOUE sur un GRANT EXECUTE sans REVOKE FROM PUBLIC, anon', () => {
    rougit(saboter('REVOKE EXECUTE ON FUNCTION public.notes_count() FROM PUBLIC, anon;\n', ''), /notes_count\(\) jamais REVOKE-ee pour PUBLIC/);
  });

  it('TÉMOIN : ÉCHOUE si seul PUBLIC est révoqué (anon garde le GRANT par défaut)', () => {
    rougit(saboter('FROM PUBLIC, anon;', 'FROM PUBLIC;'), /notes_count\(\) jamais REVOKE-ee pour anon/);
  });

  it('TÉMOIN : ÉCHOUE sur un CREATE FUNCTION sans OR REPLACE', () => {
    rougit(saboter('CREATE OR REPLACE FUNCTION public.notes_count', 'CREATE FUNCTION public.notes_count'), /notes_count\(\) creee sans OR REPLACE/);
  });

  it('TÉMOIN : ÉCHOUE sur un CREATE POLICY sans DROP POLICY IF EXISTS préalable', () => {
    rougit(saboter('DROP POLICY IF EXISTS "notes_update" ON public.notes;\n', ''), /policy "notes_update" sur notes creee sans DROP POLICY IF EXISTS/);
  });

  it('TÉMOIN : ÉCHOUE sur une policy FOR UPDATE sans WITH CHECK', () => {
    rougit(saboter('\n  WITH CHECK (user_id = (select auth.uid()))', ''), /policy "notes_update" sur notes : FOR UPDATE sans WITH CHECK/);
  });

  it('TÉMOIN : ÉCHOUE sur une table sans ENABLE ROW LEVEL SECURITY', () => {
    rougit(saboter('ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n', ''), /table notes creee sans ENABLE ROW LEVEL SECURITY/);
  });

  // SEC-10 (mig. 242) : entre deux fichiers, la table existe sans RLS. Si le
  // second n'est jamais appliqué (session interrompue, ordre inversé), elle le
  // reste, ouverte à tout rôle qui a le GRANT. L'état final ne suffit pas.
  it('TÉMOIN : ÉCHOUE sur une table dont la RLS n’est activée que dans une migration suivante', () => {
    write('227_notes.sql', saboter('ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n', ''));
    write('228_notes_rls.sql', 'ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n');
    const { code, out } = run(VALIDATE);
    expect(out).toMatch(/table notes creee sans ENABLE ROW LEVEL SECURITY dans le meme fichier/);
    expect(code).toBe(1);
  });

  it('TÉMOIN : ÉCHOUE sur une table dont la RLS est désactivée par une migration suivante', () => {
    write('227_notes.sql', CONFORME);
    write('228_notes_rls.sql', 'ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;\n');
    const { code, out } = run(VALIDATE);
    expect(out).toMatch(/table notes : RLS desactivee par une migration ulterieure/);
    expect(code).toBe(1);
  });

  // SEC-10 (mig. 242) : le défaut de `public` est fermé à `anon`. Le rouvrir
  // rendrait chaque table future lisible et écrivable par un visiteur.
  it('TÉMOIN : ÉCHOUE sur un privilège par défaut rendu à anon', () => {
    write('227_notes.sql', `${CONFORME}\nALTER DEFAULT PRIVILEGES IN SCHEMA public\n  GRANT ALL ON TABLES TO anon, authenticated;\n`);
    const { code, out } = run(VALIDATE);
    expect(out).toMatch(/ALTER DEFAULT PRIVILEGES accorde a anon/);
    expect(code).toBe(1);
  });

  it('PASSE sur la fermeture du défaut (REVOKE) et sur un défaut accordé à authenticated seul', () => {
    write(
      '227_notes.sql',
      `${CONFORME}\nALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;\n` +
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;\n',
    );
    expect(run(VALIDATE).code).toBe(0);
  });

  it('TÉMOIN : ÉCHOUE sur une table à user_id sans trigger prevent_user_id_change', () => {
    rougit(saboter('EXECUTE FUNCTION public.prevent_user_id_change()', 'EXECUTE FUNCTION public.touch_updated_at()'), /table notes porte user_id sans trigger prevent_user_id_change/);
  });

  it('TÉMOIN : ÉCHOUE sur une auto-référence ON DELETE CASCADE ou RESTRICT', () => {
    rougit(saboter('ON DELETE NO ACTION', 'ON DELETE CASCADE'), /notes\.parent_id reference notes ON DELETE CASCADE/);
    rougit(saboter('ON DELETE NO ACTION', 'ON DELETE RESTRICT'), /notes\.parent_id reference notes ON DELETE RESTRICT/);
  });

  it('TÉMOIN : ÉCHOUE sur une fonction de trigger SECURITY DEFINER, quel que soit son nom', () => {
    rougit(
      `${CONFORME}
CREATE OR REPLACE FUNCTION public.notify_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$ BEGIN RETURN NEW; END; $fn$;
REVOKE ALL ON FUNCTION public.notify_notes() FROM PUBLIC, anon, authenticated;`,
      /fonction de trigger notify_notes\(\) en SECURITY DEFINER a partir de la mig\. 227/,
    );
  });

  it('TÉMOIN : ÉCHOUE sur une policy UPDATE ou DELETE du journal fiscal', () => {
    rougit(
      `${CONFORME}
DROP POLICY IF EXISTS "pr_delete" ON public.payment_records;
CREATE POLICY "pr_delete" ON public.payment_records FOR DELETE USING (user_id = (select auth.uid()));`,
      /policy "pr_delete" FOR DELETE sur payment_records/,
    );
  });

  it('TÉMOIN : ÉCHOUE sur une purge du journal fiscal ou des preuves de renouvellement', () => {
    rougit(`${CONFORME}\nDELETE FROM public.payment_closures WHERE true;`, /purge ou reecriture de payment_closures/);
    rougit(`${CONFORME}\nTRUNCATE public.renewal_notices;`, /purge ou reecriture de renewal_notices/);
  });

  it('TÉMOIN : ÉCHOUE sur une policy gardée par admin_allowlisted()', () => {
    rougit(
      saboter('USING (user_id = (select auth.uid()))', 'USING (public.admin_allowlisted())'),
      /policy "notes_update" sur notes appelle admin_allowlisted\(\)/,
    );
  });

  it('TÉMOIN : ÉCHOUE sur raw_user_meta_data recopié sans sanitize_display_name()', () => {
    rougit(
      `${CONFORME}
CREATE OR REPLACE FUNCTION public.copy_name()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN
  INSERT INTO public.notes (user_id, titre)
  SELECT u.id, u.raw_user_meta_data->>'name' FROM auth.users u;
END; $$;`,
      /copy_name\(\) recopie raw_user_meta_data sans sanitize_display_name\(\)/,
    );
  });

  it('accepte raw_user_meta_data passé par sanitize_display_name()', () => {
    write(
      '227_notes.sql',
      `${CONFORME}
CREATE OR REPLACE FUNCTION public.copy_name()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN
  INSERT INTO public.notes (user_id, titre)
  SELECT u.id, public.sanitize_display_name(u.raw_user_meta_data->>'name') FROM auth.users u;
END; $$;`,
    );
    expect(run(VALIDATE).code).toBe(0);
  });

  it("ne juge PAS les migrations antérieures au cliquet (226)", () => {
    write('226_notes.sql', saboter("SET search_path = ''\n", '').replace('ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n', ''));
    expect(run(VALIDATE).code).toBe(0);
  });

  it('ignore les commentaires : un mot interdit dans un -- ne fait pas rougir', () => {
    write('227_notes.sql', `${CONFORME}\n-- jamais : DELETE FROM public.payment_records ; SECURITY DEFINER\n`);
    expect(run(VALIDATE).code).toBe(0);
  });
});

// ── Une garde d'arbre ne doit JAMAIS être SECURITY DEFINER (mig. 143) ──
//
// Un trigger BEFORE s'exécute avant le WITH CHECK de la RLS : en DEFINER, ses
// messages d'erreur deviennent un oracle sur des lignes non lisibles (B-3).
// Ce cas EXISTE pour être vu rouge : il a été vérifié en retirant le mot
// SECURITY INVOKER de la migration réelle avant d'être committé.
describe('trigger de garde de l arbre des categories', () => {
  it('refuse une fonction de trigger SECURITY DEFINER', () => {
    // ⚠️ La clause SECURITY doit précéder le `AS $$` : le parseur de
    // validate-migrations.mjs ne lit que ce qui se trouve ENTRE `RETURNS
    // TRIGGER` et le premier `AS` — exactement la convention déjà suivie par
    // toutes les fonctions de trigger du dépôt (cf. mig. 132). REVOKE est posé
    // pour isoler le seul défaut testé ici (DEFINER) des deux erreurs, sans
    // rapport, que la règle REVOKE lève déjà par ailleurs.
    write(
      '143_categories_tree.sql',
      `CREATE OR REPLACE FUNCTION public.enforce_category_tree()
       RETURNS TRIGGER
       LANGUAGE plpgsql
       SECURITY DEFINER
       AS $$ BEGIN RETURN NEW; END; $$;
       CREATE TRIGGER trg_enforce_category_tree
         BEFORE INSERT ON public.categories
         FOR EACH ROW EXECUTE FUNCTION public.enforce_category_tree();
       REVOKE ALL ON FUNCTION public.enforce_category_tree() FROM PUBLIC, anon, authenticated;`,
    );
    const { code, out } = run(VALIDATE);
    expect(code).not.toBe(0);
    expect(out).toMatch(/DEFINER/i);
  });

  it('accepte la fonction reelle, en INVOKER et REVOKE-ee', () => {
    write(
      '143_categories_tree.sql',
      readFileSync(resolve(ROOT, 'supabase/migration/143_categories_tree.sql'), 'utf8'),
    );
    expect(run(VALIDATE).code).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// mig. 139 — le plafond de debit (C-31)
//
// Deux invariants, et les deux ont ete vus ROUGES le 2026-09-12 avant d'etre
// verts. Ils ne sont pas de meme nature :
//
//  1. LA BORNE. `hits > p_limit`, jamais `>=`. Mesure en prod, transaction
//     annulee : avec `>=` et un plafond de 3, les cinq appels d'affilee sont
//     ACCEPTES (le compteur gele sur 3, donc `3 <= 3` reste vrai) — le plafond
//     ne refuse JAMAIS rien. Avec `>`, le 4e ecrit 4 et part en refus.
//     ❌ « Trois appels passent » est vrai des DEUX versions : c'est le
//        QUATRIEME qui distingue, et lui seul.
//
//  2. LE REVOKE A `authenticated`. Celui-la est contre-intuitif, et la
//     migration s'y trompait : elle disait « PAS de GRANT a authenticated » et
//     s'arretait la. Or `REVOKE ... FROM PUBLIC` NE LE RETIRE PAS. Mesure en
//     prod : le schema `public` porte un privilege par defaut qui accorde
//     EXECUTE a `anon`, `authenticated` ET `service_role` NOMMEMENT a la
//     creation. Ne pas accorder n'est pas retirer — il faut REVOKE-er.
//     Sans lui, n'importe quel compte connecte pouvait epuiser le compteur
//     d'un autre en devinant sa cle : un deni de service cible offert par la
//     defense elle-meme.
// ══════════════════════════════════════════════════════════════════════

describe('plafond de debit, mig. 139 (C-31)', () => {
  const SQL = () =>
    readFileSync(resolve(ROOT, 'supabase/migration/139_rate_limits.sql'), 'utf8');

  /** Le corps du `CASE` qui decide de l'increment, commentaires retires. */
  const borderClause = (sql) => {
    const body = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    const m = body.match(/WHEN\s+rl\.hits\s*(>=?)\s*p_limit\s+THEN\s+rl\.hits/i);
    return m ? m[1] : null;
  };

  it('la borne du compteur est bien trouvee dans le fichier', () => {
    expect(borderClause(SQL()), 'clause `WHEN rl.hits ? p_limit` introuvable').not.toBeNull();
  });

  it('la borne est `>`, jamais `>=`', () => {
    expect(borderClause(SQL())).toBe('>');
  });

  it('TEMOIN — la sonde refuse bien la variante `>=`', () => {
    // Sans ce temoin, un detecteur casse (regex qui ne matche plus rien)
    // laisserait les deux tests ci-dessus passer sur un fichier fautif.
    const sabote = SQL().replace(/WHEN\s+rl\.hits\s*>\s*p_limit/i, 'WHEN rl.hits >= p_limit');
    expect(sabote, 'le sabotage n a rien remplace').not.toBe(SQL());
    expect(borderClause(sabote)).toBe('>=');
  });

  it('`consume_rate_limit` est REVOKE-ee a `authenticated`, pas seulement non accordee', () => {
    expect(SQL()).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.consume_rate_limit\([^)]*\)\s+FROM\s+authenticated/i);
  });

  it('`consume_rate_limit` est accordee EXPLICITEMENT a `service_role`', () => {
    // Le privilege par defaut suffirait aujourd hui. Il ne doit pas etre la
    // seule chose qui tienne : un echec de la RPC n est PAS bloquant cote Deno
    // (`consumeRateLimits` laisse passer et alerte), donc un GRANT perdu
    // rendrait le plafond inoperant EN SILENCE.
    expect(SQL()).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.consume_rate_limit\([^)]*\)\s+TO\s+service_role/i);
  });

  it('la table ne porte aucune policy, et reste fermee a anon comme a authenticated', () => {
    expect(SQL()).toMatch(/ALTER\s+TABLE\s+public\.rate_limits\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(SQL()).toMatch(/REVOKE\s+ALL\s+ON\s+public\.rate_limits\s+FROM\s+anon,\s*authenticated/i);
    expect(SQL()).not.toMatch(/CREATE\s+POLICY[\s\S]*public\.rate_limits/i);
  });
});
