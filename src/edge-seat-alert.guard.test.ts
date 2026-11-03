// ═══════════════════════════════════════════════════════════════════
// Garde · `seat-alert` (alerte 80 % des sièges, lot 3 facturation, mig. 240)
// ═══════════════════════════════════════════════════════════════════
//
// Le point d'entrée Deno ne se lance pas ici : sa source est lue, commentaires
// retirés (le fichier cite ses interdits en commentaire). La sélection et le
// texte sont exécutés par `src/modules/billing/seat-alert-text.test.ts`.
//
// ❌ Un vert ici ne prouve rien de la fonction DÉPLOYÉE : `npm run check:edge`.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LF = String.fromCharCode(10);
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join(LF);
const codeOnly = (src: string) =>
  src
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(LF)
    .map((l) => {
      const at = l.indexOf('//');
      return at === -1 ? l : l.slice(0, at);
    })
    .join(LF);

const code = codeOnly(read('supabase/functions/seat-alert/index.ts'));
const sql = read('supabase/migration/240_org_seat_alerts.sql');
const workflow = read('.github/workflows/renewal-notice.yml');

const GUARD_ON_OWN_SECRET = /if\s*[(]\s*[A-Z_]*SECRET\s*&&/;

describe('seat-alert · secret en échec fermé', () => {
  it('TÉMOIN : le détecteur voit une garde conditionnelle à son secret', () => {
    expect(GUARD_ON_OWN_SECRET.test('if (CRON_SECRET && h !== CRON_SECRET) deny()')).toBe(true);
    expect(GUARD_ON_OWN_SECRET.test('if (!CRON_SECRET) deny()')).toBe(false);
  });

  it('refuse tout appel sans secret configuré, puis compare par égalité stricte', () => {
    expect(code.length).toBeGreaterThan(1000);
    expect(GUARD_ON_OWN_SECRET.test(code)).toBe(false);
    const missing = code.search(/if\s*[(]!CRON_SECRET[)]/);
    const compare = code.search(/x-cron-secret'[)]\s*!==\s*CRON_SECRET/);
    expect(missing).toBeGreaterThan(0);
    expect(compare).toBeGreaterThan(missing);
    expect(code).toContain("'cron_secret_not_configured' }, 503");
    // Rien n'est lu avant la porte.
    expect(code.indexOf("rpc('orgs_for_seat_alert')")).toBeGreaterThan(compare);
  });
});

describe('seat-alert · idempotence', () => {
  it('trace APRÈS l envoi et absorbe le 23505 d un rejeu', () => {
    const send = code.indexOf('await sendBillingMail(');
    const trace = code.indexOf(".from('org_seat_alerts').insert(");
    expect(send).toBeGreaterThan(0);
    expect(trace).toBeGreaterThan(send);
    expect(code).toMatch(/code\s*!==\s*'23505'/);
  });

  it('la migration pose la contrainte UNIQUE (org_id, tier_key), la RLS et aucune policy', () => {
    expect(sql).toMatch(/CONSTRAINT org_seat_alerts_org_tier_key UNIQUE \(org_id, tier_key\)/);
    expect(sql).toContain('ALTER TABLE public.org_seat_alerts ENABLE ROW LEVEL SECURITY;');
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toContain('REVOKE ALL ON public.org_seat_alerts FROM anon, authenticated;');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.orgs_for_seat_alert() FROM authenticated;');
  });

  it('la sélection suit org_seats_allowed : drapeau serveur, gratuit à 5, illimité exclu', () => {
    expect(sql).toContain("key = 'enterprise_seat_limit'");
    expect(sql).toMatch(/\(SELECT enabled FROM flag\) IS TRUE/);
    expect(sql).toMatch(/WHEN s\.status = 'active' THEN s\.max_members ELSE 5 END/);
    expect(sql).toContain('e.quota IS NOT NULL');
    expect(sql).toContain('FROM public.organization_members m WHERE m.org_id = e.org_id');
  });

  it('plafonne les envois par exécution (W-4)', () => {
    expect(code).toMatch(/slice\(0, MAX_ALERTS_PER_RUN\)/);
  });
});

describe('seat-alert · déclenchement quotidien', () => {
  it('le workflow quotidien appelle la fonction avec le secret, et échoue sans lui', () => {
    expect(workflow).toContain('/functions/v1/seat-alert');
    expect(workflow).toContain('-H "x-cron-secret: $CRON_SECRET"');
    const job = workflow.slice(workflow.indexOf('seat-alert:'));
    expect(job).toMatch(/\[ -z "\$CRON_SECRET" \][^]*exit 1/);
  });
});
