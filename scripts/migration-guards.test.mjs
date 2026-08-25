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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
