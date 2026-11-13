// ═══════════════════════════════════════════════════════════════════
// detection-violation.guard.test.mjs · LE TÉMOIN DU DÉTECTEUR ET DE SON ALERTE
//
// Vague 6.1 (OBS-01). Chaque cas soumet au code RÉEL une situation qu'il
// DOIT signaler, et échoue s'il répond « rien ». Le cas central rejoue BK-1 :
// un artefact avec un `pg_dump` en clair dedans ; sa version chiffrée (après
// `8c6a971d`) ne doit PAS rougir, sinon le détecteur crierait chaque jour.
// Le second : la même page relue des centaines de fois par l'application
// n'est pas un export massif (lignes DISTINCTES, pas lignes rendues).
//
// Côté alerte : une issue avec propriétaire et échéance, une seule à la fois,
// un plafond, et rien de personnel ni de catégoriel dans le texte public.
// Côté revue : une alerte échue entre dans la règle des 7 jours.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { load } from 'js-yaml';
import {
  classer, entreesZip, inspecterZip, lecteurArtefact, decider, executer, propre, MESURES, CATEGORIES, SQL_JOURNAUX, SQL_TRI,
} from './detection-violation.mjs';
import * as alerte from './detection-violation-alerte.mjs';
import { alertesEchues, signature, corps, run as revue } from './gardes-rouges-7j.mjs';

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

// ═══ Le contenu des fichiers (cas repris de la PR n° 125) ═══════════

describe('classer · ce qu un début de fichier dit de lui', () => {
  it('rougit sur un dump, une base, des lignes de table', () => {
    expect(classer('cosmo-2026-10-12.dump', PG_DUMP)).toMatch(/PGDMP/);
    expect(classer('x.bin', Buffer.from('SQLite format 3\u0000....'))).toMatch(/SQLite/);
    expect(classer('a.sql', Buffer.from('--\n-- PostgreSQL database dump\n--\n'))).toMatch(/SQL en clair/);
    expect(classer('t.txt', Buffer.from('COPY public.profiles (id, email) FROM stdin;\n1\ta@b.fr\n'))).toMatch(/COPY/);
    expect(classer('t.txt', Buffer.from("INSERT INTO public.tasks VALUES ('x');"))).toMatch(/INSERT/);
    expect(classer('sauvegarde.backup', Buffer.from('rien de reconnaissable'))).toMatch(/non chiffré/);
  });

  it('TÉMOIN : un instantané de schéma avec des INSERT dans des fonctions ne sonne pas, un vrai dump sonne', () => {
    const schema = [
      'CREATE FUNCTION public.f() RETURNS void LANGUAGE plpgsql AS $fn$',
      'BEGIN',
      '  INSERT INTO public.audit (a) VALUES (1);',
      'INSERT INTO auth.users (id) VALUES (1);',
      'END;',
      '$fn$;',
      'CREATE FUNCTION public.g() RETURNS void LANGUAGE sql AS $$',
      '  INSERT INTO public.t SELECT 1;',
      '$$;',
    ].join('\n');
    expect(classer('baseline.sql', Buffer.from(schema))).toBeNull();
    expect(classer('baseline.sql', Buffer.from('CREATE FUNCTION f() AS $$\n  INSERT INTO public.t SELECT 1;'))).toBeNull();
    expect(classer('d.sql', Buffer.from("SET x = 1;\nINSERT INTO public.users (id, email) VALUES (1, 'a@b.fr');\n"))).toMatch(/INSERT/);
    expect(classer('d.sql', Buffer.from(schema + '\nINSERT INTO auth.users (id) VALUES (2);\n'))).toMatch(/INSERT/);
    expect(classer('d.sql', Buffer.from('COPY public.users (id) FROM stdin;\n1\n'))).toMatch(/COPY/);
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

  it('un gros artefact se lit par Range sur l URL signée ; un Range refusé est une ERREUR', async () => {
    const z = zip([{ nom: 'sortie/base.bin', contenu: PG_DUMP }]);
    const fetchImpl = async (url, o = {}) => {
      if (String(url).endsWith('/zip')) return new Response(null, { status: 302, headers: { location: 'https://blob.invalid/z' } });
      const m = /bytes=(\d+)-(\d+)/.exec(o.headers?.Range ?? '');
      if (!m) return new Response(z, { status: 200 });
      return new Response(z.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
    };
    const a = { id: 1, nom: 'gros', taille: z.length, depot: 'o/r' };
    const { taille, lire } = await lecteurArtefact(a, 't', fetchImpl, 0);
    expect((await inspecterZip(taille, lire))[0].pourquoi).toMatch(/PGDMP/);
    const refuse = async (url) => (String(url).endsWith('/zip') ? fetchImpl(url) : new Response(z, { status: 200 }));
    const l2 = await lecteurArtefact(a, 't', refuse, 0);
    await expect(inspecterZip(l2.taille, l2.lire)).rejects.toThrow(/lecture partielle refusée/);
  });

  it('un SCHÉMA seul (schema.sql du contrat de données) n est pas un dump de données, même au-delà de 64 Ko', async () => {
    const ddl = `--\n-- PostgreSQL database dump\n--\n${'CREATE TABLE public.t (id uuid);\n'.repeat(4000)}`;
    const corpsFonction = '\nCREATE FUNCTION public.f() RETURNS trigger AS $$\nBEGIN\n  INSERT INTO public.notifications (id) VALUES (NEW.id);\nEND $$;\n';
    const z = zip([{ nom: 'supabase/schema.sql', contenu: Buffer.from(ddl + corpsFonction) }]);
    expect(await inspecterZip(z.length, lecteur(z))).toEqual([]);
  });

  it('TÉMOIN : le même dump avec des lignes de table APRÈS les 64 premiers Ko rougit (COPY ou INSERT)', async () => {
    const ddl = `--\n-- PostgreSQL database dump\n--\n${'CREATE TABLE public.t (id uuid);\n'.repeat(4000)}`;
    const copie = 'COPY public.profiles (id, email) FROM stdin;\n1\tpersonne@exemple.fr\n\\.\n';
    const inserts = "INSERT INTO public.profiles (id, email) VALUES (1, 'personne@exemple.fr');\n";
    for (const donnees of [copie, inserts]) {
      const z = zip([{ nom: 'dump.sql', contenu: Buffer.from(ddl + donnees) }]);
      expect((await inspecterZip(z.length, lecteur(z)))[0]?.pourquoi).toMatch(/avec des lignes de table/);
    }
    // Une table VIDE : COPY suivi aussitôt de la fin de bloc, pas une donnée.
    const vide = zip([{ nom: 'dump.sql', contenu: Buffer.from(`${ddl}COPY public.t (id) FROM stdin;\n\\.\n`) }]);
    expect(await inspecterZip(vide.length, lecteur(vide))).toEqual([]);
  });

  it('un zip sans répertoire central est une ERREUR, jamais « rien trouvé »', async () => {
    const b = Buffer.from('pas un zip du tout');
    await expect(inspecterZip(b.length, lecteur(b))).rejects.toThrow(/EOCD/);
  });
});

// ═══ Décision ═══════════════════════════════════════════════════════

/** Une journée ordinaire : beaucoup de lignes RENDUES (pages relues), peu de
 *  lignes DISTINCTES. Valeurs synthétiques. */
const JOUR_CALME = {
  echecs_auth: 0, echecs_auth_ip_max: 0, reinitialisations: 0, lignes_sujet_max: 800, requetes_sujet_max: 900, lignes_anon: 0,
};
const lue = (valeur) => ({ ok: true, valeur });
const sources = (o = {}) => ({
  secretScanning: lue([]),
  artefacts: lue({ lus: 3, suspects: [] }),
  journaux: lue({ mesures: { ...JOUR_CALME }, info: { requetes_lues: 3000, lignes_brutes_sujet_max: 80000 } }),
  ...o,
});

describe('décider', () => {
  it('PLANCHER : des pages relues en boucle, mesurées en lignes DISTINCTES, ne signalent rien', () => {
    const d = decider(sources());
    expect(d).toMatchObject({ statut: 'rien', exit: 0, signaux: [], categories: [] });
  });

  it('TÉMOIN : chaque mesure au-dessus de son plancher rougit, avec SA catégorie', () => {
    for (const [cle, def] of Object.entries(MESURES)) {
      const d = decider(sources({ journaux: lue({ mesures: { ...JOUR_CALME, [cle]: def.plancher + 1 }, info: {} }) }));
      expect(d.statut, cle).toBe('signal');
      expect(d.categories, cle).toEqual([def.categorie]);
    }
  });

  it('une source non lue rougit, même sans aucun signal', () => {
    const d = decider(sources({ journaux: { ok: false, erreur: 'HTTP 401' } }));
    expect(d).toMatchObject({ statut: 'source-non-lue', exit: 1, categories: ['source-non-lue'] });
  });

  it('une alerte de secret scanning ouverte, un artefact suspect : signal', () => {
    const d = decider(sources({
      secretScanning: lue([{ numero: 1, type: 'supabase_service_key', cree: '2026-04-05T22:22:29Z' }]),
      artefacts: lue({ lus: 1, suspects: [{ artefact: 'db', run: 9, fichier: 'x.dump', pourquoi: 'PGDMP' }] }),
    }));
    expect(d.categories).toEqual(['artefact-suspect', 'secret-scanning']);
  });

  it('TÉMOIN INJECTION : un nom d artefact venu d une fourche ne porte ni commande de workflow ni retour à la ligne', () => {
    const nom = 'x\n::add-mask::y %0A`fin`';
    const d = decider(sources({ artefacts: lue({ lus: 1, suspects: [{ artefact: nom, run: 9, fichier: 'a\r::error::b', pourquoi: 'PGDMP' }] }) }));
    const r = d.signaux[0].resume;
    expect(r).not.toMatch(/[\r\n`%]/);
    expect(r).not.toContain('::');
    expect(propre('a'.repeat(200)).length).toBeLessThanOrEqual(81);
  });

  it('les catégories sont un vocabulaire FERMÉ (seul mot qui sort du job)', () => {
    for (const def of Object.values(MESURES)) expect(CATEGORIES.has(def.categorie)).toBe(true);
    expect([...CATEGORIES].every((c) => /^[a-z-]+$/.test(c))).toBe(true);
  });
});

describe('requêtes de journaux · aucun identifiant en sortie', () => {
  /** La liste de sélection de PREMIER niveau (avant le premier FROM). */
  const sortie = (sql) => sql.slice(0, sql.indexOf('FROM'));

  it('les requêtes exécutées ne rendent que des agrégats, jamais un compte ni une IP', () => {
    for (const [nom, sql] of Object.entries(SQL_JOURNAUX)) {
      expect(sortie(sql), nom).not.toMatch(/AS (sujet|ip)\b/);
      // Le compte peut FILTRER (lignes sans session), jamais être une colonne rendue.
      expect(sortie(sql), nom).not.toMatch(/(subject|cf_connecting_ip)'\]\s+AS\b/);
    }
  });

  it('TÉMOIN : le volume par compte se compte par FORME de requête (relire la même page compte une fois)', () => {
    const s = SQL_JOURNAUX.sujets;
    expect(s).toMatch(/GROUP BY sujet, chemin, parametres, debut/);
    expect(s).toMatch(/max\(if\(match/);
    expect(s).toMatch(/max\(distinctes\) AS lignes_sujet_max/);
  });

  it('SQL_TRI (tri à la main) rend le compte, et n est exécutée nulle part dans le module', () => {
    expect(SQL_TRI).toMatch(/SELECT sujet/);
    const source = readFileSync(resolve(process.cwd(), 'scripts/detection-violation.mjs'), 'utf8');
    expect(source.match(/requeteJournaux\(SQL_TRI/g)).toBeNull();
  });
});

// ═══ Bout en bout, réseau simulé ════════════════════════════════════

const ENV = { GH_TOKEN: 'g', SECURITY_ALERTS_TOKEN: 's', SUPABASE_ACCESS_TOKEN: 'p', REPO: 'o/r' };
const MAINTENANT = new Date('2026-11-02T06:00:00Z');
const SECRET_EN_CLAIR = 'sb_secret_NE_DOIT_JAMAIS_SORTIR';
const IP = '203.0.113.77';
const COMPTE = '00000000-0000-4000-8000-00000000c0de';

function reseau({ artefact, secrets = [], totaux = { echecs_auth: 0, reinitialisations: 0, lignes_anon: 0, requetes_lues: 3000 }, fourche = false }) {
  const appels = [];
  const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (url, o = {}) => {
    const u = String(url);
    appels.push({ u, methode: o.method ?? 'GET' });
    if (u.includes('/secret-scanning/alerts')) return json(secrets);
    if (u.includes('/actions/artifacts?per_page')) {
      const wr = fourche ? { id: 1, repository_id: 100, head_repository_id: 666 } : { id: 1, repository_id: 100, head_repository_id: 100 };
      return json({ artifacts: [{ id: 9, name: 'db-dump', size_in_bytes: artefact.length, created_at: '2026-11-02T01:00:00Z', expired: false, workflow_run: wr }] });
    }
    if (u.endsWith('/actions/artifacts/9/zip')) return new Response(null, { status: 302, headers: { location: 'https://blob.invalid/9' } });
    if (u === 'https://blob.invalid/9') return new Response(artefact, { status: 200 });
    if (u.includes('/analytics/endpoints/logs')) {
      const sql = new URL(u).searchParams.get('sql');
      // Une réponse qui porterait un identifiant en trop : il ne doit pas traverser.
      if (sql.includes('requetes_lues')) return json({ result: [{ ...totaux, sujet: COMPTE }] });
      if (sql.includes('echecs_auth_ip_max')) return json({ result: [{ echecs_auth_ip_max: 2, ip: IP }] });
      return json({ result: [{ lignes_sujet_max: 800, lignes_brutes_sujet_max: 80000, requetes_sujet_max: 900, sujet: COMPTE }] });
    }
    return new Response('inconnu', { status: 404 });
  };
  return { fetchImpl, appels };
}

describe('executer · bout en bout', () => {
  it('ÉCHEC FERMÉ : un jeton absent, rien n est lu, le run rougit et l alerte reçoit « source non lue »', async () => {
    const { fetchImpl, appels } = reseau({ artefact: zip([]) });
    for (const manque of ['GH_TOKEN', 'SECURITY_ALERTS_TOKEN', 'SUPABASE_ACCESS_TOKEN', 'REPO']) {
      const r = await executer({ ...ENV, [manque]: '' }, { fetchImpl, maintenant: MAINTENANT });
      expect(r.exit, manque).toBe(1);
      expect(r.sorties.statut, manque).toBe('source-non-lue');
    }
    expect(appels).toEqual([]);
  });

  it('TÉMOIN BK-1 : un pg_dump en clair dans un artefact rougit', async () => {
    const { fetchImpl } = reseau({ artefact: zip([{ nom: 'cosmo-2026-10-12.dump', contenu: PG_DUMP }]) });
    const r = await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    expect(r.exit).toBe(1);
    expect(r.sorties).toMatchObject({ statut: 'signal', categories: 'artefact-suspect' });
    expect(r.resume).toMatch(/db-dump.*cosmo-2026-10-12\.dump.*PGDMP/);
  });

  it('PLANCHER : le même artefact CHIFFRÉ, journée calme → 0, « aucune, toutes sources lues »', async () => {
    const { fetchImpl } = reseau({ artefact: zip([{ nom: 'cosmo-2026-10-22.dump.gpg', contenu: GPG, deflate: false }]) });
    const r = await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    expect(r.lignes.filter((l) => l.startsWith('::error'))).toEqual([]);
    expect(r.exit).toBe(0);
    expect(r.sorties.statut).toBe('rien');
    expect(r.lignes.join('\n')).toMatch(/aucune, toutes sources lues/);
    expect(r.resume).toMatch(/somme brute des lignes du compte le plus lu 80000/);
  });

  it('la valeur d un secret fuité, une IP, un compte ne sortent JAMAIS (journal, résumé, sorties)', async () => {
    const { fetchImpl } = reseau({
      artefact: zip([]),
      secrets: [{ number: 1, secret_type: 'supabase_service_key', secret: SECRET_EN_CLAIR, created_at: '2026-04-05T22:22:29Z' }],
      totaux: { echecs_auth: 0, reinitialisations: 0, lignes_anon: 0, requetes_lues: 3000 },
    });
    const r = await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    expect(r.sorties.statut).toBe('signal');
    const tout = [...r.lignes, r.resume, JSON.stringify(r.sorties)].join('\n');
    for (const interdit of [SECRET_EN_CLAIR, IP, COMPTE]) expect(tout).not.toContain(interdit);
    expect(tout).toMatch(/n° 1 ouverte \(supabase_service_key/);
  });

  it('un artefact de FOURCHE n est pas inspecté (aucun secret de prod, contenu choisi par un tiers) : compté seulement', async () => {
    const { fetchImpl, appels } = reseau({ artefact: zip([{ nom: 'cosmo.dump', contenu: PG_DUMP }]), fourche: true });
    const r = await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    expect(r.sorties.statut).toBe('rien');
    expect(r.resume).toMatch(/de fourche, ignorés : 1/);
    expect(appels.some((a) => a.u.endsWith('/zip'))).toBe(false);
  });

  it('TÉMOIN INJECTION : un nom de zip cité par un message d ERREUR ne porte ni commande ni retour à la ligne', async () => {
    const z = zip([{ nom: 'x\n::error::injecte%0A`', contenu: Buffer.from('abc'), deflate: false }]);
    z.writeUInt32LE(0xdeadbeef, 0); // en-tête local corrompu : `debutEntree` lève en citant le nom
    const { fetchImpl } = reseau({ artefact: z });
    const r = await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    expect(r.sorties.statut).toBe('source-non-lue');
    for (const l of [...r.lignes, ...r.resume.split('\n')]) expect(l).not.toMatch(/^::error::injecte|[`%]0A/);
    expect(r.lignes.join('\n')).not.toMatch(/\n::error::injecte/);
  });

  it('un fichier forgé de 64 Ko sans `@` ne fait pas exploser la recherche d adresses', () => {
    const t0 = Date.now();
    expect(classer('a.txt', Buffer.alloc(64 * 1024, 0x61))).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('les journaux ne sont lus que par GET, sur le seul point de lecture', async () => {
    const { fetchImpl, appels } = reseau({ artefact: zip([]) });
    await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    const sb = appels.filter((a) => a.u.startsWith('https://api.supabase.com'));
    expect(sb.length).toBe(3);
    for (const a of sb) {
      expect(a.methode).toBe('GET');
      expect(new URL(a.u).pathname).toBe('/v1/projects/ykeugqfgklejcdbrmawy/analytics/endpoints/logs');
    }
  });

  it('des journaux qui ne voient aucune requête sont une source NON LUE', async () => {
    const { fetchImpl } = reseau({ artefact: zip([]), totaux: { echecs_auth: 0, reinitialisations: 0, lignes_anon: 0, requetes_lues: 0 } });
    const r = await executer(ENV, { fetchImpl, maintenant: MAINTENANT });
    expect(r.sorties.statut).toBe('source-non-lue');
  });
});

// ═══ L'alerte : propriétaire, échéance, plafond ═════════════════════

describe('alerte · ce qui sort du job, et vers où', () => {
  it('le vocabulaire est fermé ; un statut vide vaut « source non lue », « rien » ne publie rien', () => {
    expect(alerte.categoriesDe({ statut: 'signal', categories: 'export-massif,<script>,00000000-0000' })).toEqual(['categorie-inconnue', 'export-massif']);
    expect(alerte.categoriesDe({ statut: '', categories: '' })).toEqual(['source-non-lue']);
    expect(alerte.categoriesDe({ statut: 'rien', categories: 'export-massif' })).toEqual([]);
  });

  it('le texte public : seuil franchi le JJ/MM, résumé, propriétaire, échéance 72 h, et AUCUNE catégorie', () => {
    const cats = ['export-massif', 'secret-scanning'];
    const t = alerte.texte({
      cats, detecteLe: MAINTENANT, echeance: new Date(MAINTENANT.getTime() + 72 * 3600_000), runUrl: 'https://run', proprietaire: 'kelax12', premier: true,
    });
    expect(t).toMatch(/Seuil de détection franchi le 02\/11\*\*, voir le résumé du job : https:\/\/run/);
    expect(t).toMatch(/Propriétaire : kelax12 \(assigné\)/);
    expect(t).toMatch(/Échéance du tri : 05\/11 à 06:00 UTC/);
    expect(t).toMatch(/echeance=2026-11-05T06:00:00.000Z -->/);
    for (const c of cats) expect(t).not.toContain(c);
    expect(t).not.toMatch(/@kelax12/);
  });

  const BOT = { login: 'github-actions[bot]' };
  const fil = (body, jours, user = BOT) => ({ body, user, created_at: new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString() });
  const marque = (cats) => `${alerte.MARQUEUR} empreinte=${alerte.empreinte(cats)} echeance=x -->`;

  it('une seule issue ouverte : même signal = rien de nouveau ; signal changé = un commentaire', () => {
    const ouverte = { number: 4, elements: [fil(marque(['export-massif']), 1)] };
    expect(alerte.decider({ cats: ['export-massif'], ouverte, recentes: 1 }).action).toBe('inchange');
    expect(alerte.decider({ cats: ['export-massif', 'lignes-anon'], ouverte, recentes: 1 }).action).toBe('commenter');
    expect(alerte.decider({ cats: ['export-massif'], ouverte: null, recentes: 0 }).action).toBe('creer');
  });

  it('TÉMOIN PLAFOND : 3 publications sur 7 jours, la 4e ne part pas ; une publication de 8 jours ne compte plus', () => {
    const elements = [fil(marque(['a']), 1), fil(marque(['b']), 2), fil(marque(['c']), 6), fil('commentaire humain', 1), fil(marque(['d']), 8)];
    const n = alerte.publicationsRecentes(elements, MAINTENANT);
    expect(n).toBe(3);
    expect(alerte.decider({ cats: ['e'], ouverte: null, recentes: n }).action).toBe('plafond');
    expect(alerte.PLAFOND_7J).toBe(3);
  });

  it('TÉMOIN USURPATION : un commentaire tiers qui recopie le marqueur ne fait ni « inchangé » ni plafond', () => {
    const tiers = { login: 'quelquun' };
    const ouverte = { number: 4, elements: [fil(marque(['a']), 1), fil(marque(['export-massif']), 0, tiers)] };
    expect(alerte.decider({ cats: ['export-massif'], ouverte, recentes: 1 }).action).toBe('commenter');
    const remplissage = [1, 2, 3].map((k) => fil(marque([`x${k}`]), k, tiers));
    expect(alerte.publicationsRecentes(remplissage, MAINTENANT)).toBe(0);
  });

  function github(etat) {
    const ecrits = [];
    const fetchImpl = async (url, o = {}) => {
      const u = new URL(String(url));
      const methode = o.method ?? 'GET';
      const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
      if (methode === 'POST') {
        ecrits.push({ chemin: u.pathname, corps: JSON.parse(o.body) });
        if (u.pathname.endsWith('/labels')) return ok({ message: 'existe' }, 422);
        return ok({ html_url: `https://x.test${u.pathname}/1` }, 201);
      }
      if (u.pathname === '/repos/kelax12/r/issues') return ok(etat.issues);
      if (/\/issues\/\d+\/comments$/.test(u.pathname)) return ok(etat.commentaires ?? []);
      return ok({}, 404);
    };
    return { fetchImpl, ecrits };
  }
  const ENV_A = { GH_TOKEN: 't', REPO: 'kelax12/r', RUN_URL: 'https://run', STATUT: 'signal', CATEGORIES: 'export-massif', DETECTE_LE: MAINTENANT.toISOString() };

  it('premier signal : une issue créée, ASSIGNÉE au propriétaire du dépôt, labellisée, et le salon est appelé', async () => {
    const { fetchImpl, ecrits } = github({ issues: [] });
    const r = await alerte.run(ENV_A, { maintenant: MAINTENANT, fetchImpl });
    expect(r.exit).toBe(0);
    const issue = ecrits.find((e) => e.chemin === '/repos/kelax12/r/issues');
    expect(issue.corps).toMatchObject({ title: 'Seuil de détection franchi le 02/11', labels: ['detection-violation'], assignees: ['kelax12'] });
    expect(r.sorties).toMatchObject({ publie: 'true' });
    expect(r.sorties.resume).toMatch(/export-massif.*05\/11 06:00 UTC/);
  });

  it('plafond atteint : rien n est écrit, le job rougit', async () => {
    const issues = [1, 2, 3].map((k) => ({ number: k, state: 'closed', body: marque([`x${k}`]), user: BOT, created_at: fil('', k).created_at }));
    const { fetchImpl, ecrits } = github({ issues });
    const r = await alerte.run(ENV_A, { maintenant: MAINTENANT, fetchImpl });
    expect(r.exit).toBe(1);
    expect(ecrits).toEqual([]);
    expect(r.lignes.join()).toMatch(/plafond 3/);
  });

  it('exercice : rien n est écrit ; sans jeton : échec fermé', async () => {
    const { fetchImpl, ecrits } = github({ issues: [] });
    expect((await alerte.run({ ...ENV_A, EXERCICE: 'true' }, { maintenant: MAINTENANT, fetchImpl })).exit).toBe(0);
    expect(ecrits).toEqual([]);
    expect((await alerte.run({ ...ENV_A, GH_TOKEN: '' }, { maintenant: MAINTENANT, fetchImpl })).exit).toBe(1);
  });
});

// ═══ La revue : règle des 7 jours, revue du lundi ═══════════════════

describe('revue · une alerte échue entre dans la règle des 7 jours', () => {
  const NOW = new Date('2026-11-09T07:47:00Z');
  const issue = (number, echeance, o = {}) => ({
    number, html_url: `https://x.test/issues/${number}`, state: 'open', created_at: '2026-11-01T05:31:00Z',
    body: echeance ? `<!-- detection-violation empreinte=ab echeance=${echeance} -->\n**Seuil**` : '**sans marqueur**', ...o,
  });

  it('plancher : avant l échéance, rien ; TÉMOIN : après, listée avec ses jours', () => {
    expect(alertesEchues([issue(5, '2026-11-10T05:31:00.000Z')], NOW)).toEqual([]);
    expect(alertesEchues([issue(5, '2026-11-04T05:31:00.000Z')], NOW)).toMatchObject([{ numero: 5, jours: 5, lisible: true }]);
  });

  it('une échéance illisible vaut échue (échec fermé) ; une PR ou une issue fermée ne compte pas', () => {
    expect(alertesEchues([issue(6, null)], NOW)).toMatchObject([{ numero: 6, lisible: false }]);
    expect(alertesEchues([issue(7, '2026-11-01T00:00:00Z', { pull_request: {} }), issue(8, '2026-11-01T00:00:00Z', { state: 'closed' })], NOW)).toEqual([]);
  });

  it('l alerte échue change la signature et figure dans le corps de l issue ci-red', () => {
    const alertes = alertesEchues([issue(5, '2026-11-04T05:31:00.000Z')], NOW);
    expect(signature([], alertes)).not.toBe(signature([], []));
    const t = corps({ violations: [], recales: [], decisionsSansObjet: [], alertes, maintenant: NOW });
    expect(t).toMatch(/alerte n° 5 : échue depuis 5 j/);
  });

  afterEach(() => vi.unstubAllGlobals());

  /** GitHub simulé pour `run()` de la règle : aucun workflow rouge, une alerte échue, une issue ci-red déjà à jour. */
  function githubRevue({ auteur = 'github-actions[bot]' } = {}) {
    const ecrits = [];
    const alertes = [issue(5, '2026-11-04T05:31:00.000Z')];
    const texteActuel = corps({ violations: [], recales: [], decisionsSansObjet: [], alertes: alertesEchues(alertes, NOW), maintenant: NOW });
    vi.stubGlobal('fetch', async (url, o = {}) => {
      const u = new URL(String(url));
      const ok = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
      if ((o.method ?? 'GET') === 'POST') { ecrits.push(u.pathname); return ok({ html_url: 'https://x.test/c' }); }
      if (u.pathname.endsWith('/actions/workflows')) return ok({ workflows: [] });
      if (u.searchParams.get('labels') === 'detection-violation') return ok(alertes);
      if (u.searchParams.get('labels') === 'ci-red') {
        return ok([{ number: 64, body: 'issue ci-red', html_url: 'https://x.test/64', user: { login: 'github-actions[bot]' } }]);
      }
      if (u.pathname.endsWith('/comments')) return ok([{ body: texteActuel, html_url: 'https://x.test/64#c', user: { login: auteur } }]);
      return ok([]);
    });
    return ecrits;
  }

  it('TÉMOIN USURPATION : la même liste recopiée par un tiers ne fait pas taire la règle', async () => {
    const ecrits = githubRevue({ auteur: 'quelquun' });
    await revue({ GH_TOKEN: 't', REPO: 'kelax12/r', REVUE_HEBDO: 'false' }, NOW);
    expect(ecrits).toEqual(['/repos/kelax12/r/issues/64/comments']);
  });

  it('un jour ordinaire, la liste inchangée ne recommente pas ; le job rougit quand même', async () => {
    const ecrits = githubRevue();
    const r = await revue({ GH_TOKEN: 't', REPO: 'kelax12/r', REVUE_HEBDO: 'false' }, NOW);
    expect(r.exit).toBe(1);
    expect(ecrits).toEqual([]);
  });

  it('TÉMOIN REVUE DU LUNDI : la même liste est republiée tant qu une alerte reste échue', async () => {
    const ecrits = githubRevue();
    const r = await revue({ GH_TOKEN: 't', REPO: 'kelax12/r', REVUE_HEBDO: 'true' }, NOW);
    expect(r.exit).toBe(1);
    expect(ecrits).toEqual(['/repos/kelax12/r/issues/64/comments']);
  });
});

// ═══ Les workflows : droits, canaux, branchements ═══════════════════

describe('workflows · droits minimaux et canal unique', () => {
  const wf = (f) => load(readFileSync(resolve(process.cwd(), '.github/workflows', f), 'utf8'));
  const dv = wf('detection-violation.yml');

  it('detecter lit sans rien pouvoir écrire ; alerter écrit des issues sans aucun secret de production', () => {
    expect(dv.jobs.detecter.permissions).toEqual({ contents: 'read', actions: 'read' });
    expect(dv.jobs.alerter.permissions).toEqual({ contents: 'read', issues: 'write' });
    const secretsAlerter = JSON.stringify(dv.jobs.alerter.steps).match(/secrets\.([A-Z_]+)/g) ?? [];
    expect(secretsAlerter).toEqual(['secrets.OPS_ALERT_WEBHOOK_URL']);
    const etape = dv.jobs.detecter.steps.find((s) => s.id === 'lire');
    expect(Object.keys(etape.env).sort()).toEqual(['GH_TOKEN', 'REPO', 'SECURITY_ALERTS_TOKEN', 'SUPABASE_ACCESS_TOKEN']);
  });

  it('alerter joue après un détecteur ROUGE (always) et ne saute que sur « rien »', () => {
    expect(dv.jobs.alerter.if).toMatch(/always\(\)/);
    expect(dv.jobs.alerter.if).toMatch(/statut != 'rien'/);
  });

  it('pas de double alerte : absent de la liste de ci-alert.yml, qui passe REVUE_HEBDO à la règle des 7 jours', () => {
    const ca = wf('ci-alert.yml');
    expect(ca.on.workflow_run.workflows).not.toContain('Detection violation');
    const crons = ca.on.schedule.map((s) => s.cron);
    expect(crons).toContain('47 7 * * 1');
    const scan = ca.jobs['rouges-anciens'].steps.find((s) => s.id === 'scan');
    expect(scan.env.REVUE_HEBDO).toMatch(/github\.event\.schedule == '47 7 \* \* 1'/);
  });

  it('SECURITY_ALERTS_TOKEN a son lecteur au registre', () => {
    const reg = JSON.parse(readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8'));
    const e = reg.entries.find((x) => x.name === 'SECURITY_ALERTS_TOKEN');
    expect(e.readers.join(' ')).toMatch(/Detection violation/);
    expect(e.rotation).toBe('jeton-alertes-securite');
  });
});
