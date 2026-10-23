// ═══════════════════════════════════════════════════════════════════
// detection-violation.guard.test.mjs · LE TÉMOIN DU DÉTECTEUR
//
// Chaque cas soumet au code RÉEL une situation où une violation est en
// cours, et échoue si le détecteur rend un exit 0. Le cas central rejoue
// BK-1 : un artefact déposé avec un `pg_dump` en clair dedans. Sa version
// chiffrée (après `8c6a971d`) ne doit PAS rougir, sinon le détecteur crierait
// tous les jours et serait ignoré.
//
// Plancher symétrique : un run propre, toutes sources lues, sort en 0 et
// écrit « aucune, toutes sources lues ». Sans ce cas, un détecteur qui
// rougirait toujours passerait les autres.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import {
  classer, entreesZip, inspecterZip, lecteurArtefact, reference, serieDe, decider, executer, messageAlerte, MESURES,
} from './detection-violation.mjs';

// ─── Un zip minimal, écrit à la main (stocké ou deflate) ──────────

function zip(fichiers) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const { nom, contenu, deflate = true } of fichiers) {
    const n = Buffer.from(nom);
    const donnees = deflate ? deflateRawSync(contenu) : contenu;
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(deflate ? 8 : 0, 8);
    l.writeUInt32LE(donnees.length, 18);
    l.writeUInt32LE(contenu.length, 22);
    l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(deflate ? 8 : 0, 10);
    c.writeUInt32LE(donnees.length, 20);
    c.writeUInt32LE(contenu.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(decalage, 42);
    locaux.push(l, n, donnees);
    centraux.push(c, n);
    decalage += 30 + n.length + donnees.length;
  }
  const cd = Buffer.concat(centraux);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(fichiers.length, 8);
  e.writeUInt16LE(fichiers.length, 10);
  e.writeUInt32LE(cd.length, 12);
  e.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, cd, e]);
}
const lecteur = (b) => async (d, l) => b.subarray(d, d + l);

/** Ce que `pg_dump -Fc` écrit en tête : la signature BK-1. */
const PG_DUMP = Buffer.concat([Buffer.from('PGDMP\u0001\u000e\u0000\u0004\u0008\u0001'), Buffer.alloc(4000, 0x41)]);
/** Ce que `gpg --symmetric` écrit en tête (paquet 3, ancien format). */
const GPG = Buffer.concat([Buffer.from([0x8c, 0x0d, 0x04, 0x09, 0x03, 0x08]), Buffer.alloc(4000, 0x5a)]);

// ═══ Le contenu des fichiers ════════════════════════════════════════

describe('classer · ce qu un début de fichier dit de lui', () => {
  it('rougit sur un dump, une base, des lignes de table', () => {
    expect(classer('cosmo-2026-10-12.dump', PG_DUMP)).toMatch(/PGDMP/);
    expect(classer('x.bin', Buffer.from('SQLite format 3\u0000....'))).toMatch(/SQLite/);
    expect(classer('a.sql', Buffer.from('--\n-- PostgreSQL database dump\n--\n'))).toMatch(/SQL en clair/);
    expect(classer('t.txt', Buffer.from('COPY public.profiles (id, email) FROM stdin;\n1\ta@b.fr\n'))).toMatch(/COPY/);
    expect(classer('t.txt', Buffer.from("INSERT INTO public.tasks VALUES ('x');"))).toMatch(/INSERT/);
    expect(classer('sauvegarde.backup', Buffer.from('rien de reconnaissable'))).toMatch(/non chiffré/);
  });

  it('rougit sur un « .gpg » dont le contenu est en clair', () => {
    expect(classer('d.dump.gpg', PG_DUMP)).toMatch(/extension chiffrée/);
  });

  it('rougit sur vingt adresses réelles, pas sur des adresses fictives', () => {
    const vraies = Array.from({ length: 20 }, (_, i) => `p${i}@gmail.com`).join(' ');
    const fictives = Array.from({ length: 40 }, (_, i) => `p${i}@example.com e${i}@cosmo.test`).join(' ');
    expect(classer('rapport.html', Buffer.from(vraies))).toMatch(/20 adresses/);
    expect(classer('rapport.html', Buffer.from(fictives))).toBeNull();
  });

  it('se tait sur un chiffré et sur un rapport ordinaire', () => {
    expect(classer('cosmo.dump.gpg', GPG)).toBeNull();
    expect(classer('x.age', Buffer.from('age-encryption.org/v1\n-> scrypt'))).toBeNull();
    expect(classer('index.html', Buffer.from('<html><body>coverage 81 %</body></html>'))).toBeNull();
  });
});

describe('zip · lu par son répertoire central', () => {
  it('liste les entrées et lit une entrée deflate comme une stockée', async () => {
    const z = zip([{ nom: 'a.txt', contenu: Buffer.from('bonjour'), deflate: false }, { nom: 'b/c.dump', contenu: PG_DUMP }]);
    const e = await entreesZip(z.length, lecteur(z));
    expect(e.map((x) => x.nom)).toEqual(['a.txt', 'b/c.dump']);
    expect(await inspecterZip(z.length, lecteur(z))).toEqual([{ fichier: 'b/c.dump', pourquoi: expect.stringMatching(/PGDMP/) }]);
  });

  it('un fichier de plusieurs Mo ne se lit que par son début, et se reconnaît quand même', async () => {
    const gros = Buffer.concat([PG_DUMP, Buffer.alloc(3 * 1024 * 1024, 0x42)]);
    const z = zip([{ nom: 'gros.dump', contenu: gros }]);
    const lus = [];
    const lire = async (d, l) => { lus.push(l); return z.subarray(d, d + l); };
    expect((await inspecterZip(z.length, lire))[0].pourquoi).toMatch(/PGDMP/);
    expect(Math.max(...lus)).toBeLessThanOrEqual(65557 + 20);
  });

  it('un gros artefact se lit par Range sur l URL signée ; un Range refusé est une ERREUR', async () => {
    const z = zip([{ nom: 'sortie/base.bin', contenu: PG_DUMP }]);
    const plages = [];
    const fetchImpl = async (url, o = {}) => {
      if (String(url).endsWith('/zip')) return new Response(null, { status: 302, headers: { location: 'https://blob.invalid/z' } });
      const m = /bytes=(\d+)-(\d+)/.exec(o.headers?.Range ?? '');
      if (!m) return new Response(z, { status: 200 });
      plages.push(m[0]);
      return new Response(z.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
    };
    const a = { id: 1, nom: 'gros', taille: z.length, depot: 'o/r' };
    const { taille, lire } = await lecteurArtefact(a, 't', fetchImpl, 0);
    expect((await inspecterZip(taille, lire))[0].pourquoi).toMatch(/PGDMP/);
    expect(plages.length).toBeGreaterThan(0);
    const refuse = async (url) => (String(url).endsWith('/zip') ? fetchImpl(url) : new Response(z, { status: 200 }));
    const l2 = await lecteurArtefact(a, 't', refuse, 0);
    await expect(inspecterZip(l2.taille, l2.lire)).rejects.toThrow(/lecture partielle refusée/);
  });

  it('un zip sans répertoire central est une ERREUR, jamais « rien trouvé »', async () => {
    const b = Buffer.from('pas un zip du tout');
    await expect(inspecterZip(b.length, lecteur(b))).rejects.toThrow(/EOCD/);
  });
});

// ═══ Référence d'écart ══════════════════════════════════════════════

describe('référence · plancher et écart aux jours précédents', () => {
  it('moins de 7 jours : le plancher seul', () => {
    expect(reference([1, 2, 3], 30)).toEqual({ seuil: 30, base: expect.stringMatching(/plancher seul/) });
  });
  it('une série haute relève le seuil au-dessus du plancher', () => {
    expect(reference([100, 110, 90, 105, 95, 100, 100], 30).seuil).toBeGreaterThan(100);
  });
  it('la série ne prend que les runs de main, un par jour', () => {
    const j = [
      { date: '2026-10-20T06:00:00Z', branche: 'main', mesures: { echecs_auth: 4 } },
      { date: '2026-10-20T07:00:00Z', branche: 'main', mesures: { echecs_auth: 5 } },
      { date: '2026-10-21T06:00:00Z', branche: 'pr', mesures: { echecs_auth: 900 } },
    ];
    expect(serieDe(j, 'echecs_auth')).toEqual([5]);
  });
});

// ═══ Décision ═══════════════════════════════════════════════════════

const calme = { echecs_auth: 0, echecs_auth_ip_max: 0, reinitialisations: 0, lignes_sujet_max: 8087, requetes_sujet_max: 587, lignes_anon: 5 };
const toutLu = (m = calme) => ({
  secretScanning: { ok: true, valeur: [] },
  codeScanning: { ok: true, valeur: [] },
  artefacts: { ok: true, valeur: { lus: 12, octets: 1, suspects: [] } },
  journaux: { ok: true, valeur: { mesures: m, details: {} } },
});

describe('décider', () => {
  it('PLANCHER : toutes sources lues, journée de prod réelle (2026-10-23) → 0', () => {
    expect(decider({ sources: toutLu() })).toMatchObject({ exit: 0, signaux: [], erreurs: [] });
  });
  it('une source non lue rougit, même sans aucun signal', () => {
    const s = { ...toutLu(), secretScanning: { ok: false, erreur: 'HTTP 404 Secret scanning is disabled' } };
    expect(decider({ sources: s })).toMatchObject({ exit: 1, signaux: [] });
  });
  it('chaque mesure au-dessus de son plancher rougit', () => {
    for (const [cle, def] of Object.entries(MESURES)) {
      const d = decider({ sources: toutLu({ ...calme, [cle]: def.plancher + 1 }) });
      expect(d.exit, cle).toBe(1);
      expect(d.signaux.map((x) => x.detail.cle)).toEqual([cle]);
    }
  });
  it('une alerte de secret, une alerte de sécurité : signal ; une alerte de qualité : non', () => {
    const s = toutLu();
    s.secretScanning.valeur = [{ numero: 1, type: 'supabase_service_key' }];
    s.codeScanning.valeur = [{ numero: 2, gravite: 'high' }, { numero: 3, gravite: null }];
    expect(decider({ sources: s }).signaux.map((x) => x.source)).toEqual(['secret-scanning', 'code-scanning']);
  });
  it('le message poussé porte l échéance de 72 h', () => {
    const m = messageAlerte({ signaux: [{ source: 'artefacts' }], maintenant: new Date('2026-10-13T11:26:00Z'), runUrl: 'u' });
    expect(m).toContain('2026-10-16T11:26:00Z');
  });
});

// ═══ Bout en bout, réseau simulé ════════════════════════════════════

const ENV = {
  GH_TOKEN: 'g', SECURITY_ALERTS_TOKEN: 's', SUPABASE_ACCESS_TOKEN: 'p', PASSPHRASE: 'x'.repeat(40),
  WEBHOOK: 'https://hook.invalid', REPO: 'o/r', RUN_URL: 'https://run', BRANCHE: 'main',
};
const SECRET_EN_CLAIR = 'sb_secret_NE_DOIT_JAMAIS_SORTIR';
const IP = '203.0.113.77';

function reseau({ artefact, secrets = [], journaux = { echecs_auth: 0, reinitialisations: 0, lignes_anon: 5, requetes_lues: 1448 } }) {
  const appels = [];
  const json = (b, h = {}) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json', ...h } });
  const fetchImpl = async (url) => {
    const u = String(url);
    appels.push(u);
    if (u.includes('/secret-scanning/alerts')) return json(secrets);
    if (u.includes('/code-scanning/alerts')) return json([]);
    if (u.includes('/actions/artifacts?per_page')) {
      return json({ artifacts: [{ id: 9, name: 'db-dump', size_in_bytes: artefact.length, created_at: '2026-10-23T05:00:00Z', expired: false, workflow_run: { id: 1 } }] });
    }
    if (u.endsWith('/actions/artifacts/9/zip')) return new Response(null, { status: 302, headers: { location: 'https://blob.invalid/9' } });
    if (u === 'https://blob.invalid/9') return new Response(artefact, { status: 200 });
    if (u.includes('/analytics/endpoints/logs')) {
      const sql = new URL(u).searchParams.get('sql');
      if (sql.includes('requetes_lues')) return json({ result: [journaux] });
      if (sql.includes(' AS ip')) return json({ result: [{ ip: IP, n: 2 }] });
      return json({ result: [{ sujet: 'uuid-sujet', requetes: 587, lignes: 8087 }] });
    }
    return new Response('inconnu', { status: 404 });
  };
  return { fetchImpl, appels };
}
const sansPrecedent = async () => null;

describe('executer · bout en bout', () => {
  it('ÉCHEC FERMÉ : sans jeton, rien n est lu et le run rougit', async () => {
    const { fetchImpl, appels } = reseau({ artefact: zip([]) });
    for (const manque of ['GH_TOKEN', 'SECURITY_ALERTS_TOKEN', 'SUPABASE_ACCESS_TOKEN', 'PASSPHRASE', 'WEBHOOK']) {
      const r = await executer({ ...ENV, [manque]: '' }, { fetchImpl, precedentImpl: sansPrecedent });
      expect(r.exit, manque).toBe(1);
      expect(r.journal).toBeNull();
    }
    expect(appels).toEqual([]);
  });

  it('TÉMOIN BK-1 : un pg_dump en clair dans un artefact rougit et pousse l échéance', async () => {
    const { fetchImpl } = reseau({ artefact: zip([{ nom: 'cosmo-2026-10-12.dump', contenu: PG_DUMP }]) });
    const pousses = [];
    const r = await executer(ENV, { fetchImpl, precedentImpl: sansPrecedent, maintenant: new Date('2026-10-23T06:00:00Z'), deliverImpl: async (_u, m) => { pousses.push(m); return 204; } });
    expect(r.exit).toBe(1);
    expect(r.journal.detection).toBe('SIGNAL');
    expect(r.journal.signaux[0]).toMatchObject({ source: 'artefacts', detail: { artefact: 'db-dump', fichier: 'cosmo-2026-10-12.dump' } });
    expect(pousses).toHaveLength(1);
    expect(pousses[0]).toContain('2026-10-26T06:00:00Z');
  });

  it('PLANCHER : le même artefact CHIFFRÉ (après 8c6a971d), journée calme → 0, et la ligne dit « aucune »', async () => {
    const { fetchImpl } = reseau({ artefact: zip([{ nom: 'cosmo-2026-10-22.dump.gpg', contenu: GPG, deflate: false }]) });
    const r = await executer(ENV, { fetchImpl, precedentImpl: sansPrecedent, deliverImpl: async () => { throw new Error('ne doit pas pousser'); } });
    expect(r.lignes.filter((l) => l.startsWith('::error'))).toEqual([]);
    expect(r.exit).toBe(0);
    expect(r.journal.detection).toBe('aucune, toutes sources lues');
    expect(Object.values(r.journal.sources)).toEqual(['lue', 'lue', 'lue', 'lue']);
  });

  it('la valeur d un secret fuité, une IP, un compte ne sortent JAMAIS au journal public ni dans le message', async () => {
    const { fetchImpl } = reseau({
      artefact: zip([]),
      secrets: [{ number: 4, secret_type: 'supabase_secret_key', secret: SECRET_EN_CLAIR, created_at: 'x', html_url: 'h' }],
      journaux: { echecs_auth: 400, reinitialisations: 0, lignes_anon: 5, requetes_lues: 1448 },
    });
    const pousses = [];
    const r = await executer(ENV, { fetchImpl, precedentImpl: sansPrecedent, deliverImpl: async (_u, m) => { pousses.push(m); return 204; } });
    expect(r.exit).toBe(1);
    const public_ = [...r.lignes, ...pousses].join('\n');
    expect(public_).not.toContain(SECRET_EN_CLAIR);
    expect(public_).not.toContain(IP);
    expect(public_).not.toContain('uuid-sujet');
    expect(JSON.stringify(r.journal)).not.toContain(SECRET_EN_CLAIR);
    expect(JSON.stringify(r.journal)).toContain(IP); // le détail vit dans le journal, chiffré ensuite
  });

  it('des journaux Supabase qui ne voient aucune requête sont une source NON LUE', async () => {
    const { fetchImpl } = reseau({ artefact: zip([]), journaux: { echecs_auth: 0, reinitialisations: 0, lignes_anon: 0, requetes_lues: 0 } });
    const r = await executer(ENV, { fetchImpl, precedentImpl: sansPrecedent });
    expect(r.exit).toBe(1);
    expect(r.journal.sources.journaux).toMatch(/ERREUR.*0 requête/);
  });

  it('un journal précédent illisible rougit, mais la lecture du jour a lieu', async () => {
    const { fetchImpl } = reseau({ artefact: zip([]) });
    const r = await executer(ENV, { fetchImpl, precedentImpl: async () => { throw new Error('déchiffrement refusé'); } });
    expect(r.exit).toBe(1);
    expect(r.journal.sources.journaux).toBe('lue');
    expect(r.journal.sources.reference).toMatch(/ILLISIBLE/);
  });
});
