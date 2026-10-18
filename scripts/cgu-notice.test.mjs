// Témoin de `scripts/cgu-notice.mjs` (M-63, M-75).
//
// 🔴 Ce que ce fichier doit garantir avant tout : SANS DRAPEAU, RIEN NE PART.
// Le préavis des CGU part une seule fois vers tous les comptes ; un envoi
// accidentel ne se rattrape pas.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  lireArguments,
  sqlComptage,
  sqlDestinataires,
  compter,
  envoyer,
  message,
  lignes,
  dateEffet,
  verifierCheminPreuve,
  hacher,
  DELAI_MIN_MS,
  PREAVIS_JOURS,
} from './cgu-notice.mjs';

const SCRIPT = fileURLToPath(new URL('./cgu-notice.mjs', import.meta.url));
const DEPOT = resolve(dirname(SCRIPT), '..');
const ENV = { SUPABASE_ACCESS_TOKEN: 't', RESEND_API_KEY: 'r', CGU_NOTICE_FROM: 'Cosmo <x@send.example>' };
const COMPTES = [
  { email: 'a@example.test', google_sans_cgu: true },
  { email: 'b@example.test', google_sans_cgu: false },
];

/** Faux réseau : enregistre chaque appel, sépare Supabase et Resend. */
function faux({ comptes = COMPTES, comptage = [{ tous: 2, avant_cgu_0924: 1, google_sans_cgu: 1 }], resendOk = true } = {}) {
  const appels = { supabase: [], resend: [] };
  const fetchImpl = async (url, init) => {
    const corps = JSON.parse(init.body);
    if (url.includes('api.supabase.com')) {
      appels.supabase.push(corps.query);
      const rows = corps.query.includes('count(*)') ? comptage : comptes;
      return { ok: true, status: 200, json: async () => rows };
    }
    appels.resend.push(corps);
    return { ok: resendOk, status: resendOk ? 200 : 422, json: async () => ({ id: `re_${appels.resend.length}` }) };
  };
  return { fetchImpl, appels };
}

const preuveTemp = () => join(mkdtempSync(join(tmpdir(), 'cgu-notice-')), 'preuve.jsonl');
const sansPause = async () => {};

describe('cgu-notice · à blanc par défaut', () => {
  it('sans argument, le mode est le comptage à blanc', () => {
    const o = lireArguments([]);
    expect(o.send).toBe(false);
    expect(o.preview).toBe(false);
  });

  it('le comptage ne sélectionne que des agrégats, jamais une adresse', () => {
    const select = sqlComptage().split(/\bFROM\b/)[0];
    expect(select).not.toMatch(/email/i);
    expect(select.match(/count\(\*\)/g)).toHaveLength(3);
  });

  it('le comptage n’appelle jamais Resend', async () => {
    const { fetchImpl, appels } = faux();
    const n = await compter(ENV, { fetchImpl });
    expect(n).toEqual({ tous: 2, avantCgu0924: 1, googleSansCgu: 1 });
    expect(appels.resend).toHaveLength(0);
    expect(appels.supabase[0]).not.toMatch(/SELECT u\.email/);
  });

  it('comptage et envoi partagent le même prédicat', () => {
    const where = (sql) => sql.split(/\bWHERE\b/).slice(-1)[0].replace(/ORDER BY[\s\S]*|;/g, '').trim();
    expect(where(sqlDestinataires())).toBe(where(sqlComptage()));
  });

  it('lancé sans drapeau ni jeton, le script s’arrête sans rien envoyer', () => {
    const env = { ...process.env };
    delete env.SUPABASE_ACCESS_TOKEN;
    delete env.RESEND_API_KEY;
    const r = spawnSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).not.toMatch(/Envoyés/);
  });
});

describe('cgu-notice · l’envoi réel exige ses drapeaux', () => {
  it('--send sans --expected est refusé', () => {
    expect(() => lireArguments(['--send', '--proof', 'x'])).toThrow(/--expected/);
  });
  it('--send sans --proof est refusé', () => {
    expect(() => lireArguments(['--send', '--expected', '2'])).toThrow(/--proof/);
  });
  it('un débit plus rapide que Resend ne l’accepte est refusé', () => {
    expect(() => lireArguments(['--send', '--expected', '2', '--proof', 'x', '--delay-ms', String(DELAI_MIN_MS - 1)])).toThrow(/delay-ms/);
  });
  it('un argument inconnu est refusé (une faute de frappe sur --send ne doit rien déclencher)', () => {
    expect(() => lireArguments(['--sned'])).toThrow(/inconnu/);
  });
  it('le script refuse --send sans --expected avant tout réseau', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--send'], { env: { ...process.env, ...ENV }, encoding: 'utf8' });
    expect(r.status).toBe(2);
  });

  it('un compte qui diffère de --expected arrête tout avant le premier e-mail', async () => {
    const { fetchImpl, appels } = faux();
    await expect(envoyer(ENV, { expected: 3, proof: preuveTemp(), delaiMs: DELAI_MIN_MS }, { fetchImpl, pause: sansPause })).rejects.toThrow(/rien n'est parti/);
    expect(appels.resend).toHaveLength(0);
  });

  it('une preuve dans le dépôt (public) est refusée', () => {
    expect(() => verifierCheminPreuve(join(DEPOT, 'preuve.jsonl'), DEPOT)).toThrow(/HORS du dépôt/);
    expect(() => verifierCheminPreuve(preuveTemp(), DEPOT)).not.toThrow();
  });

  it('secret absent : refus, aucun appel', async () => {
    const { fetchImpl, appels } = faux();
    await expect(envoyer({ ...ENV, CGU_NOTICE_FROM: '' }, { expected: 2, proof: preuveTemp(), delaiMs: 600 }, { fetchImpl })).rejects.toThrow(/CGU_NOTICE_FROM/);
    expect(appels.supabase).toHaveLength(0);
  });
});

describe('cgu-notice · envoi', () => {
  it('un message par compte, jamais d’adresse dans la preuve ni dans le journal', async () => {
    const { fetchImpl, appels } = faux();
    const preuve = preuveTemp();
    const logs = [];
    const r = await envoyer(ENV, { expected: 2, proof: preuve, delaiMs: 600 }, { fetchImpl, pause: sansPause, log: (l) => logs.push(l) });
    expect(r).toMatchObject({ envoyes: 2, echecs: 0, sautes: 0 });
    expect(appels.resend.map((m) => m.to)).toEqual([['a@example.test'], ['b@example.test']]);
    const contenu = readFileSync(preuve, 'utf8');
    expect(contenu).not.toMatch(/@example\.test/);
    expect(contenu).toContain(hacher('a@example.test'));
    expect(contenu).toContain('re_1');
  });

  it('le paragraphe Google ne va qu’aux comptes Google sans CGU', async () => {
    const { fetchImpl, appels } = faux();
    await envoyer(ENV, { expected: 2, proof: preuveTemp(), delaiMs: 600 }, { fetchImpl, pause: sansPause });
    expect(appels.resend[0].text).toMatch(/créé votre compte avec Google/);
    expect(appels.resend[1].text).not.toMatch(/créé votre compte avec Google/);
  });

  it('une reprise ne renvoie pas aux comptes déjà servis', async () => {
    const preuve = preuveTemp();
    await envoyer(ENV, { expected: 2, proof: preuve, delaiMs: 600 }, { ...faux(), pause: sansPause });
    const second = faux();
    const r = await envoyer(ENV, { expected: 2, proof: preuve, delaiMs: 600 }, { fetchImpl: second.fetchImpl, pause: sansPause });
    expect(r.sautes).toBe(2);
    expect(second.appels.resend).toHaveLength(0);
  });

  it('un refus de Resend est compté en échec, l’adresse n’est pas imprimée, le compte repartira', async () => {
    const logs = [];
    const preuve = preuveTemp();
    const r = await envoyer(ENV, { expected: 2, proof: preuve, delaiMs: 600 }, { ...faux({ resendOk: false }), pause: sansPause, log: (l) => logs.push(l) });
    expect(r.echecs).toBe(2);
    expect(logs.join('\n')).not.toMatch(/@/);
    expect(existsSync(preuve)).toBe(true);
  });
});

describe('cgu-notice · le texte', () => {
  const effet = dateEffet(new Date('2026-10-20T10:00:00Z'));

  it('entre en vigueur 30 jours après l’envoi', () => {
    expect(PREAVIS_JOURS).toBe(30);
    expect(effet.toISOString().slice(0, 10)).toBe('2026-11-19');
    expect(message(effet).subject).toContain('19 novembre 2026');
  });

  it('nomme les trois clauses, la règle des 3 ans et le droit de partir, en fr et en en', () => {
    const t = lignes(effet).join('\n');
    for (const attendu of ['article 3.3', 'article 6.3', 'article 9', '3 ans', 'sans frais', 'section 3.3', 'section 6.3', 'section 9', '3 years', 'free of charge']) {
      expect(t).toContain(attendu);
    }
  });

  it('aucun tiret long (règle de rédaction du dépôt)', () => {
    const m = message(effet, { googleSansCgu: true });
    expect(`${m.subject}\n${m.text}`).not.toMatch(/—/);
  });

  it('le HTML échappe et rend les liens cliquables', () => {
    const { html } = message(effet);
    expect(html).toContain('<a href="https://thecosmo.app/cgu">');
    expect(html).toContain('mailto:contact@thecosmo.app');
  });
});
