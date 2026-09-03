// ═══════════════════════════════════════════════════════════════════
// GARDE — `report-bug` et `renewal-notice`, les deux fonctions sans filet
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-36).
//
// Sur les trois Edge Functions non-Stripe, une seule portait une garde
// (`src/rgpd-erasure.guard.test.ts`, pour `delete-account`). Les deux autres
// n avaient AUCUN test, d aucune sorte — alors que `renewal-notice` a deja
// porte une garde INVERSEE (`if (SECRET && header !== SECRET)`, introduite
// puis corrigee le 2026-08-26), qui laissait passer tout le monde tant que le
// secret n etait pas pose. Rien n empechait sa reintroduction.
//
// FORME : gardes TEXTUELLES, comme leur ainee. Elles ne prouvent pas que les
// fonctions marchent — elles prouvent qu on n a pas SILENCIEUSEMENT remis un
// des trois defauts deja rencontres dans ce depot :
//
//   1. un expediteur par DEFAUT sur un domaine que Resend ne signera jamais
//      (defaut S-4 : la racine `thecosmo.app` porte les MX et le SPF d IONOS ;
//      seul `send.thecosmo.app` est verifie). Un defaut ne degradait pas
//      l envoi, il le rendait IMPOSSIBLE, en presentant une panne la ou il n y
//      avait qu un secret absent ;
//   2. une garde conditionnelle a la presence de son propre secret — on ne se
//      protege que quand on est deja protege ;
//   3. un corps d erreur du fournisseur relaye au client, qui peut porter des
//      details de compte Resend.
//
// ── LE TEMOIN ────────────────────────────────────────────────────────
//
// Chaque detecteur est soumis a un echantillon qu il DOIT voir. Sans ca, une
// regex cassee rendrait ces gardes vertes pour toujours — la classe de defaut
// que `CLAUDE.md` documente sous « une garde se verifie sur ce qu elle
// REGARDE ».

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (fn: string) =>
  readFileSync(path.resolve(process.cwd(), `supabase/functions/${fn}/index.ts`), 'utf8');

/**
 * Le CODE seul, commentaires retires.
 *
 * ⚠️ Indispensable : ces fichiers CITENT leurs anciens defauts en commentaire,
 * pour qu on ne les reintroduise pas. `renewal-notice` ecrit noir sur blanc
 * `if (CRON_SECRET && ...)` dans l explication de la faille du 2026-08-26. Une
 * garde qui lit les commentaires accuserait donc le fichier de porter
 * exactement ce contre quoi il previent.
 */
function codeOnly(source: string): string {
  const noBlocks = source.replace(/[/][*][^]*?[*][/]/g, ' ');
  return noBlocks
    .split(String.fromCharCode(10))
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join(String.fromCharCode(10));
}
const reportBug = codeOnly(read('report-bug'));
const renewalNotice = codeOnly(read('renewal-notice'));

/** Un `Deno.env.get('…FROM…')` muni d une valeur par defaut. */
const SENDER_WITH_DEFAULT = /Deno[.]env[.]get[(]'[A-Z_]*FROM'[)]\s*[?][?]/;
/** Une garde qui ne s applique que si son propre secret existe. */
const GUARD_ON_OWN_SECRET = /if\s*[(]\s*[A-Z_]*SECRET\s*&&/;
/** Un corps de reponse du fournisseur relaye tel quel. */
const PROVIDER_BODY_RELAYED = /await\s+res[.](text|json)[(][)]/;

describe('garde — report-bug et renewal-notice (C-36)', () => {
  it('lit bien les deux sources', () => {
    expect(reportBug.length).toBeGreaterThan(1000);
    expect(renewalNotice.length).toBeGreaterThan(1000);
  });

  it('TEMOIN : les trois detecteurs voient le defaut qu ils cherchent', () => {
    expect(SENDER_WITH_DEFAULT.test("const M = Deno.env.get('BUG_REPORT_FROM') ?? 'Cosmo <bug@thecosmo.app>'")).toBe(true);
    expect(SENDER_WITH_DEFAULT.test("const M = Deno.env.get('BUG_REPORT_FROM')")).toBe(false);

    expect(GUARD_ON_OWN_SECRET.test("if (CRON_SECRET && header !== CRON_SECRET) return deny()")).toBe(true);
    expect(GUARD_ON_OWN_SECRET.test("if (!CRON_SECRET) return notConfigured()")).toBe(false);

    expect(PROVIDER_BODY_RELAYED.test('const detail = await res.text()')).toBe(true);
    expect(PROVIDER_BODY_RELAYED.test("json({ error: 'send_failed' }, 502, req)")).toBe(false);
  });

  for (const [name, source] of [['report-bug', reportBug], ['renewal-notice', renewalNotice]] as const) {
    describe(name, () => {
      it('n a AUCUNE valeur par defaut d expediteur', () => {
        // Le domaine par defaut ne serait jamais signe : l envoi ne serait pas
        // degrade, il serait impossible, et l erreur ressemblerait a une panne.
        expect(SENDER_WITH_DEFAULT.test(source)).toBe(false);
      });

      it('echoue FERME quand un secret manque', () => {
        // Jamais `if (SECRET && …)` : on ne se protege pas seulement quand on
        // est deja protege.
        expect(GUARD_ON_OWN_SECRET.test(source)).toBe(false);
      });

      it('ne relaie aucun corps d erreur du fournisseur', () => {
        expect(PROVIDER_BODY_RELAYED.test(source)).toBe(false);
      });
    });
  }

  describe('renewal-notice — la garde de secret est bien du bon sens', () => {
    it('refuse tout appel quand CRON_SECRET est absent', () => {
      // Le sens compte autant que la presence : la version fautive du
      // 2026-08-26 avait bien une garde, elle etait juste a l envers.
      expect(renewalNotice).toMatch(/if\s*[(]!CRON_SECRET[)]/);
      expect(renewalNotice).toContain('cron_secret_not_configured');
    });

    it('compare le secret par egalite stricte, pas par presence', () => {
      expect(renewalNotice).toMatch(/x-cron-secret'[)]\s*!==\s*CRON_SECRET/);
    });
  });

  describe('report-bug — l allowlist de piece jointe n est pas decorative', () => {
    it('derive l extension du TYPE valide, jamais du nom envoye', () => {
      // C-32 : Resend type la piece jointe d apres `filename`. Valider `type`
      // sans le transmettre laissait passer un `.html` declare `image/png`.
      expect(reportBug).toContain('ATTACHMENT_EXTENSION_BY_TYPE');
      expect(reportBug).toMatch(/filename: `[$][{]stem[}][.][$][{]extension[}]`/);
    });

    it('distingue « anonyme » de « auteur non resolu »', () => {
      // C-33 : une panne de l API auth anonymisait un utilisateur CONNECTE, et
      // le rapport partait sans `reply_to`, donc sans moyen de lui repondre.
      expect(reportBug).toMatch(/const\s*[{]\s*data,\s*error\s*[}]\s*=\s*await\s+anon[.]auth[.]getUser[(][)]/);
      expect(reportBug).toContain('reporterUnresolved');
    });
  });
});
