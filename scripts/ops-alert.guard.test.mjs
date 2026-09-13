// ═══════════════════════════════════════════════════════════════════
// ops-alert.guard.test.mjs · LE TEMOIN DU CANAL D'ALERTE
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `ci-alert.yml` est le seul canal qui POUSSE. Il existe parce que l'issue
// GitHub, elle, n'a pas ete lue pendant quatre jours (2026-08-29 → 09-01)
// pendant qu'un script tiers captait des emails.
//
// Or l'etape qui pousse sortait en 0 dans DEUX cas ou rien n'etait parti :
// secret absent, et webhook qui refuse. C'est le motif exact retire
// d'`uptime.yml` le 2026-09-03 et de `renewal-notice.yml` le 09-04 — « une
// garde se verifie sur ce qu'elle REGARDE » — et il etait reste dans le
// fichier dont le metier EST d'alerter. Un exercice a blanc vert qui n'a
// rien envoye est pire qu'aucun exercice : il repond.
//
// Chaque cas ci-dessous soumet au code REEL une situation ou rien n'arrive
// dans le salon, et echoue si le code rend un exit 0. Le plancher est pose
// par deux cas symetriques : une livraison reelle doit sortir en 0, et
// l'envoi doit etre OBSERVE par un serveur (pas deduit d'un code de retour),
// sinon un `deliver` qui ne posterait rien passerait tous les autres.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMessage, deliver, run } from './ops-alert.mjs';

/** Serveur jetable : repond les codes donnes, dans l'ordre, et ENREGISTRE. */
async function serveurJetable(codes) {
  const recu = [];
  let i = 0;
  const srv = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      recu.push({ method: req.method, type: req.headers['content-type'], body });
      const code = codes[Math.min(i++, codes.length - 1)];
      res.writeHead(code).end();
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${srv.address().port}/hook`,
    recu,
    close: () => new Promise((r) => srv.close(r)),
  };
}

const env = (o) => ({ GITHUB_EVENT_NAME: 'workflow_run', WF: 'CI', SHA: 'abcdef1234', RUN_URL: 'https://x/1', ...o });

describe('ops-alert · le secret absent ne sort JAMAIS en 0', () => {
  // 🔴 LE CAS QUI A MOTIVE LE FICHIER. Regle de CLAUDE.md, deja violee
  // trois fois dans ce depot : « ne jamais rendre une garde conditionnelle
  // a la presence de son propre secret ».
  it('rend exit 1 quand OPS_ALERT_WEBHOOK_URL est absent (incident)', async () => {
    const r = await run(env({ WEBHOOK: '' }));
    expect(r.exit).toBe(1);
  });

  it('rend exit 1 quand le secret est absent a l exercice a blanc', async () => {
    const r = await run(env({ WEBHOOK: '', GITHUB_EVENT_NAME: 'workflow_dispatch' }));
    expect(r.exit).toBe(1);
  });

  it('rend exit 1 sur un secret qui n est que des espaces', async () => {
    const r = await run(env({ WEBHOOK: '   ' }));
    expect(r.exit).toBe(1);
  });
});

describe('ops-alert · un webhook qui refuse n est pas une livraison', () => {
  it('rend exit 1 sur un 404 (webhook Discord supprime)', async () => {
    const s = await serveurJetable([404]);
    const r = await run(env({ WEBHOOK: s.url }), { retries: 1, delayMs: 0 });
    await s.close();
    expect(r.exit).toBe(1);
  });

  it('rend exit 1 a l exercice a blanc sur un 500', async () => {
    const s = await serveurJetable([500]);
    const r = await run(env({ WEBHOOK: s.url, GITHUB_EVENT_NAME: 'workflow_dispatch' }), { retries: 1, delayMs: 0 });
    await s.close();
    expect(r.exit).toBe(1);
  });

  it('rend exit 1 quand l hote n existe pas (aucun code HTTP)', async () => {
    const r = await run(env({ WEBHOOK: 'http://127.0.0.1:1/hook' }), { retries: 1, delayMs: 0 });
    expect(r.exit).toBe(1);
  });
});

describe('ops-alert · plancher : la livraison reelle sort en 0, et elle est OBSERVEE', () => {
  // Sans ces deux cas, un `deliver` qui echouerait toujours passerait tous
  // les temoins ci-dessus — la garde mesurerait sa propre panne.
  it('rend exit 0 sur un 204, et le serveur a REELLEMENT recu un POST JSON', async () => {
    const s = await serveurJetable([204]);
    const r = await run(env({ WEBHOOK: s.url }), { retries: 1, delayMs: 0 });
    await s.close();
    expect(r.exit).toBe(0);
    expect(s.recu).toHaveLength(1);
    expect(s.recu[0].method).toBe('POST');
    expect(s.recu[0].type).toContain('application/json');
  });

  it('envoie `text` ET `content` dans le meme corps (Slack et Discord)', async () => {
    const s = await serveurJetable([204]);
    await run(env({ WEBHOOK: s.url }), { retries: 1, delayMs: 0 });
    await s.close();
    const corps = JSON.parse(s.recu[0].body);
    expect(corps.text).toBe(corps.content);
    expect(corps.text).toContain('CI');
  });

  it('retente puis reussit : deux refus suivis d un 204 sortent en 0', async () => {
    const s = await serveurJetable([500, 500, 204]);
    const r = await run(env({ WEBHOOK: s.url }), { retries: 3, delayMs: 0 });
    await s.close();
    expect(r.exit).toBe(0);
    expect(s.recu).toHaveLength(3);
  });
});

describe('ops-alert · un test ne doit pas etre pris pour une panne', () => {
  it('distingue le message d exercice de celui d incident', () => {
    const drill = buildMessage({ event: 'workflow_dispatch', wf: 'CI', sha: 'abcdef1234', runUrl: 'https://x/1' });
    const incident = buildMessage({ event: 'workflow_run', wf: 'CI', sha: 'abcdef1234', runUrl: 'https://x/1' });
    expect(drill).not.toBe(incident);
    expect(drill).toMatch(/aucun incident/i);
    expect(incident).toContain('https://x/1');
    expect(incident).toContain('abcdef1');
  });
});

describe('ops-alert · le secret ne fuit nulle part', () => {
  it('ne recopie jamais l URL du webhook dans les lignes rendues', async () => {
    const s = await serveurJetable([404]);
    const r = await run(env({ WEBHOOK: s.url }), { retries: 1, delayMs: 0 });
    await s.close();
    expect(r.lines.join('\n')).not.toContain(s.url);
  });
});

describe('ops-alert · le workflow appelle REELLEMENT ce script', () => {
  // Une garde testee mais non branchee est une garde absente : c'est le
  // defaut jumeau de C-35. Sans ce cas, le fichier pourrait rester vert
  // pendant que `ci-alert.yml` execute encore l ancien shell en `exit 0`.
  const yml = readFileSync(resolve(process.cwd(), '.github/workflows/ci-alert.yml'), 'utf8');

  it('ci-alert.yml invoque scripts/ops-alert.mjs', () => {
    expect(yml).toContain('scripts/ops-alert.mjs');
  });

  it('ci-alert.yml ne porte plus d exit 0 sur secret absent', () => {
    expect(yml).not.toMatch(/OPS_ALERT_WEBHOOK_URL absent[\s\S]{0,1200}?exit 0/);
  });

  it('l exercice a blanc reste declenchable a la main', () => {
    expect(yml).toContain('workflow_dispatch');
  });
});
