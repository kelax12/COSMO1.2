// ═══════════════════════════════════════════════════════════════════
// migration-guards.test.mjs — tester les GARDES, pas seulement le code
//
// Deux findings du 2026-08-24 (B-1 et B-3 de faille.md) sont passés parce que
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
    expect(p.file).toBe('128_events_managed_ids_indexable.sql');
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
// check-prod-drift — un DROP de SURCHARGE n'efface pas le nom attendu
//
// Trouvé le 2026-08-28 en exécutant la garde contre la prod : `get_my_habits`
// et `toggle_habit_completion_v2` étaient annoncées « EN TROP en prod, héritage
// dashboard » alors qu'elles sont versionnées depuis les migrations 119 et 121.
//
// La cause est le motif normal d'un changement de signature — CREATE la
// nouvelle, DROP l'ancienne — quand le DROP arrive en fin de fichier
// (mig. 122 : CREATE lignes 55 et 159, DROP lignes 279 et 280). Le parseur
// retirait alors le nom de l'ensemble attendu.
//
// 🔴 Le symptôme était bénin, le défaut ne l'est pas : il fait échouer la garde
// dans le sens RASSURANT. Si l'une de ces deux fonctions avait réellement
// manqué en production, le script ne l'aurait pas signalée — il ne l'attendait
// plus. C'est exactement la même classe que les faux positifs de
// `check-rls-advisors` : une garde qui mesure le mauvais ensemble apprend à
// ignorer sa propre sortie.
// ══════════════════════════════════════════════════════════════════════
describe('check-prod-drift — le DROP d\'une surcharge ne fait pas oublier la fonction', { timeout: 30_000 }, () => {
  const DRIFT = resolve(ROOT, 'scripts/check-prod-drift.mjs');

  const introspection = (functions) =>
    JSON.stringify({ tables: [], functions, triggers: [], policies: [] });

  const runDrift = (functionsInProd) => {
    const file = join(dir, 'introspection.json');
    writeFileSync(file, introspection(functionsInProd), 'utf8');
    // Ce script-ci résout ses migrations depuis SON emplacement, pas depuis
    // `cwd` — le `cwd: dir` des autres gardes ne l'isole donc pas. D'où la
    // variable d'environnement, seule porte prévue pour les tests.
    const r = spawnSync(process.execPath, [DRIFT, file], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, COSMO_MIGRATION_DIR: join(dir, 'supabase', 'migration') },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };

  // Le motif exact de la mig. 122 : on crée la nouvelle signature, puis on
  // supprime l'ancienne, plus bas dans le MÊME fichier.
  const RESIGNATURE = `
CREATE OR REPLACE FUNCTION public.get_my_habits(p_days INTEGER, p_today DATE)
RETURNS TABLE (id uuid) LANGUAGE sql AS $$ SELECT gen_random_uuid(); $$;

DROP FUNCTION IF EXISTS public.get_my_habits(INTEGER);
`;

  it('attend toujours la fonction en prod après un DROP signé', () => {
    write('119_creation.sql', RESIGNATURE);
    const { code, out } = runDrift(['get_my_habits']);
    expect(out).not.toMatch(/EN TROP/);
    expect(code).toBe(0);
  });

  // TÉMOIN — c'est le test qui compte. Sans lui, un parseur qui n'oublierait
  // JAMAIS rien passerait aussi le cas ci-dessus, en cessant de détecter les
  // fonctions réellement absentes de la production.
  it('SIGNALE la fonction si elle manque réellement en prod', () => {
    write('119_creation.sql', RESIGNATURE);
    const { code, out } = runDrift([]);
    expect(out).toMatch(/get_my_habits/);
    expect(code).not.toBe(0);
  });

  it('un DROP NON signé reste une suppression franche', () => {
    write('119_creation.sql', RESIGNATURE);
    write('120_suppression.sql', 'DROP FUNCTION IF EXISTS public.get_my_habits;');
    const { out } = runDrift(['get_my_habits']);
    expect(out).toMatch(/EN TROP/);
  });
});
