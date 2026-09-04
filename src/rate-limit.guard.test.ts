// ═══════════════════════════════════════════════════════════════════
// GARDE — le plafond de débit de `report-bug` (C-31)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `report-bug` était un relais d'e-mail OUVERT : `verify_jwt` est
// à `true`, mais la clé anon suffit — elle est dans le bundle client — et
// c'est VOULU, on doit pouvoir signaler un bug depuis un compte cassé. Il n'y
// avait ensuite ni CAPTCHA, ni throttle client, ni compteur serveur, ni
// plafond par IP. Une boucle de quelques lignes brûlait la réputation
// d'expéditeur du domaine, celui-là même qui porte les e-mails
// d'authentification et les avis de reconduction (Conso. L215-1).
//
// ── CE QUE CETTE GARDE PEUT, ET CE QU'ELLE NE PEUT PAS ──────────────
//
// ⚠️ Elle est TEXTUELLE. Elle ne prouve pas que le compteur compte : il n'y a
// pas de Docker sur cette machine, donc pas de stack Supabase locale, donc
// aucun moyen d'exécuter le PL/pgSQL ici. La preuve d'exécution est la
// séquence de vérification écrite en tête de la migration 139, à jouer dans
// une transaction annulée à l'application.
//
// Ce qu'elle prouve, en revanche, est exactement ce qui a failli partir cassé :
// la BORNE. La première écriture de la migration comparait `hits >= p_limit`
// au lieu de `> p_limit`, et avec un plafond de 3 le quatrième appel était
// ACCEPTÉ — le plafond ne refusait jamais rien, tout en ayant l'air d'exister.
// C'est la forme la plus dangereuse d'une garde : celle qui rassure.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');

const migration = read('supabase/migration/139_rate_limits.sql');
const helper = read('supabase/functions/_shared/rate-limit.ts');
const reportBug = read('supabase/functions/report-bug/index.ts');

/** Le CODE seul : ces fichiers citent leurs propres pièges en commentaire. */
function codeOnly(source: string): string {
  return source
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(String.fromCharCode(10))
    .map((line) => {
      const at = line.indexOf('--') === -1 ? line.indexOf('//') : line.indexOf('--');
      return at === -1 ? line : line.slice(0, at);
    })
    .join(String.fromCharCode(10));
}

describe('garde — plafond de debit (C-31)', () => {
  it('la borne est `> p_limit`, jamais `>= p_limit`', () => {
    // 🔴 LE DÉFAUT QUI A FAILLI PARTIR. Avec `>=` et un plafond de 3, le 4ᵉ
    // appel trouve `hits >= 3`, laisse le compteur à 3, et `3 <= 3` le déclare
    // accepté : le plafond n'aurait jamais refusé un seul appel.
    const sql = codeOnly(migration);
    expect(sql).toMatch(/rl\.hits\s*>\s*p_limit/);
    expect(sql).not.toMatch(/rl\.hits\s*>=\s*p_limit/);
  });

  it('la fenetre ne glisse QUE quand elle a expire', () => {
    // Sinon un abus qui continue de taper repousse indéfiniment sa propre fin
    // de fenêtre, et un utilisateur légitime derrière la même IP partagée
    // (entreprise, université, opérateur mobile) ne repasse jamais.
    expect(codeOnly(migration)).toMatch(/window_start\s*=\s*CASE\s*WHEN\s*rl\.window_start\s*<\s*now\(\)\s*-\s*p_window/);
  });

  it('la decision est ATOMIQUE : lire, decider et incrementer en une instruction', () => {
    // Deux appels concurrents qui lisent « 2 » et écrivent « 3 » laissent
    // passer un appel de trop.
    const sql = codeOnly(migration);
    expect(sql).toContain('ON CONFLICT (bucket_key) DO UPDATE');
    expect(sql).toMatch(/RETURNING\s+rl\.hits\s+INTO/);
  });

  it('`authenticated` ne peut PAS appeler la fonction', () => {
    // Un client qui le pourrait épuiserait le compteur de quelqu'un d'autre en
    // devinant sa clé : un déni de service ciblé offert par la défense.
    const sql = codeOnly(migration);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.consume_rate_limit[^;]*FROM anon/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_rate_limit[^;]*TO authenticated/);
  });

  it('aucune adresse IP n atterrit en base', () => {
    // Une IP est une donnée à caractère personnel, et le registre art. 30 n'en
    // déclare aucune pour cette fonction. Seul un haché salé est stocké.
    expect(helper).toContain("crypto.subtle.digest('SHA-256'");
    expect(helper).toContain("Deno.env.get('RATE_LIMIT_SALT')");
    const code = codeOnly(helper);
    // L'IP brute ne doit jamais partir vers la RPC.
    expect(code).not.toMatch(/p_key:\s*(ip|bucket\.value)\b/);
  });

  it('le sel absent REFUSE, il ne laisse pas passer', () => {
    // Règle du dépôt, écrite après le `if (SECRET && …)` de `renewal-notice` :
    // on ne se protège pas seulement quand on est déjà protégé.
    expect(helper).toMatch(/if\s*\(!key\)[^]*?allowed:\s*false/);
  });

  it('le plafond s applique AVANT le decodage de la piece jointe', () => {
    // Un plafond appliqué après le travail coûteux ne protège que la boîte
    // mail, pas la fonction : 3 Mo de base64 sont décodés dans tous les cas.
    const gate = reportBug.indexOf('consumeRateLimits');
    const parse = reportBug.indexOf('await req.json()');
    expect(gate).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(parse);
  });

  it('les deux plafonds sont des CONDITIONS, pas des alternatives', () => {
    // Par IP ET par compte : un abus depuis plusieurs comptes derrière une même
    // IP reste borné par le premier, un abus d'un compte derrière plusieurs IP
    // par le second.
    expect(reportBug).toContain("domain: 'report-bug:ip'");
    expect(reportBug).toContain("domain: 'report-bug:account'");
    expect(reportBug).toContain('too_many_requests');
  });

  it('un abus (429) se distingue d une configuration absente (503)', () => {
    // Les deux ne veulent pas dire la même chose à celui qui les lit, et une
    // erreur de déploiement doit se voir comme telle.
    expect(reportBug).toContain('rate_limit_not_configured');
    expect(reportBug).toMatch(/misconfigured[^]{0,120}503/);
  });
});
