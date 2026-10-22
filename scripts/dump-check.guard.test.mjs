// ═══════════════════════════════════════════════════════════════════
// dump-check.guard.test.mjs · LE TEMOIN DE LA RELECTURE DU DUMP CHIFFRE
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `dump-check` est le seul controle automatique qui relise la seule sauvegarde
// de la base. Depuis BK-1 (2026-10-13) il doit la DECHIFFRER. Relu le
// 2026-10-15, le shell qu'il remplace acceptait un `.gpg` non chiffre (gpg
// sort en 0 sur un paquet litteral) et laissait passer un dump en clair pose
// a cote du chiffre. Une garde qui se trompe dans le sens rassurant est pire
// qu'une garde absente.
//
// Chaque cas soumet au code REEL un artefact qui ne doit pas passer, et
// echoue si le code rend un exit 0. Le plancher : un artefact correct passe,
// et le dechiffre ne survit pas au controle.
// Les cas « gpg reel » ne tournent que la ou gpg est installe hors Windows
// (le runner Ubuntu de la CI) : ils prouvent que les lignes d'etat attendues
// sont celles que gpg ecrit vraiment, pas celles qu'on a supposees.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  ATTENDUES, classerArtefact, typePremierPaquet, verifierChiffre, verdictGpg,
  verifierClair, tablesManquantes, relireDump,
} from './dump-check.mjs';

const PHRASE = 'phrase-de-test-de-trente-deux-caracteres-au-moins';
const SKESK = Buffer.from([0x8c, 0x0d, 0x04, 0x09]); // premier octet reel de `gpg --symmetric`
const STORE = Buffer.from([0xa3, 0x01]); // premiers octets reels de `gpg --store` (paquet compresse, type 8)
const LITTERAL = Buffer.from([0xcb, 0x10]); // paquet litteral nu, nouveau format (type 11)
const CLAIR = Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(200_000, 1)]);
const TOC_COMPLETE = ATTENDUES.map((t, i) => `${i}; 1259 1 TABLE public ${t} postgres`).join('\n') + '\n';
const ETAT_OK = [
  '[GNUPG:] NEED_PASSPHRASE_SYM 9 3 8', '[GNUPG:] BEGIN_DECRYPTION', '[GNUPG:] DECRYPTION_INFO 2 9 0',
  '[GNUPG:] PLAINTEXT 62 0 x.dump', '[GNUPG:] DECRYPTION_OKAY', '[GNUPG:] GOODMDC', '[GNUPG:] END_DECRYPTION',
].join('\n');

const dossiers = [];
function artefact(fichiers) {
  const d = mkdtempSync(join(tmpdir(), 'dump-check-'));
  dossiers.push(d);
  for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(join(d, nom), contenu);
  return d;
}
afterEach(() => { while (dossiers.length) rmSync(dossiers.pop(), { recursive: true, force: true }); });

/** Un faux gpg / pg_restore qui ENREGISTRE ses appels. */
function faux({ gpg = { status: 0, stdout: ETAT_OK }, clair = CLAIR, toc = TOC_COMPLETE } = {}) {
  const appels = [];
  const executer = (cmd, args, opts) => {
    appels.push({ cmd, args, opts });
    if (cmd === 'gpg') {
      if (gpg.status === 0 && clair) writeFileSync(args[args.indexOf('-o') + 1], clair);
      return { ...gpg };
    }
    return { status: 0, stdout: toc, stderr: '' };
  };
  return { executer, appels };
}

describe('dump-check · un artefact en clair, vide ou absent ne passe JAMAIS', () => {
  it('refuse un artefact absent', () => {
    const { executer, appels } = faux();
    const r = relireDump({ dossier: join(tmpdir(), 'nexiste-pas-dump-check'), phrase: PHRASE, executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/vide ou absent/);
    expect(appels).toHaveLength(0);
  });

  it('refuse un dump en clair seul, sans meme l ouvrir', () => {
    const { executer, appels } = faux();
    const r = relireDump({ dossier: artefact({ 'cosmo.dump': CLAIR }), phrase: PHRASE, executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/non chiffre/);
    expect(appels).toHaveLength(0);
  });

  it('refuse un dump en clair pose A COTE du chiffre', () => {
    const { executer } = faux();
    const d = artefact({ 'cosmo.dump.gpg': SKESK, 'cosmo.dump': CLAIR });
    expect(relireDump({ dossier: d, phrase: PHRASE, executer }).exit).toBe(1);
  });

  it('refuse un clair cache dans un sous-dossier', () => {
    const d = artefact({ 'cosmo.dump.gpg': SKESK });
    mkdirSync(join(d, 'sous'));
    writeFileSync(join(d, 'sous', 'cosmo.dump'), CLAIR);
    expect(() => classerArtefact(['cosmo.dump.gpg', 'sous/cosmo.dump'])).toThrow(/non chiffre/);
    expect(relireDump({ dossier: d, phrase: PHRASE, executer: faux().executer }).exit).toBe(1);
  });

  it('refuse deux fichiers chiffres', () => {
    expect(() => classerArtefact(['a.dump.gpg', 'b.dump.gpg'])).toThrow(/un seul attendu/);
  });

  it('refuse un dump en clair renomme en .gpg, avant d appeler gpg', () => {
    const { executer, appels } = faux();
    const r = relireDump({ dossier: artefact({ 'cosmo.dump.gpg': CLAIR }), phrase: PHRASE, executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/EN CLAIR renomme/);
    expect(appels).toHaveLength(0);
  });

  it('refuse un fichier OpenPGP NON chiffre (gpg --store, paquet litteral)', () => {
    expect(typePremierPaquet(STORE)).toBe(8);
    expect(() => verifierChiffre(STORE)).toThrow(/chiffrement symetrique/);
    expect(typePremierPaquet(LITTERAL)).toBe(11);
    expect(() => verifierChiffre(LITTERAL)).toThrow(/chiffrement symetrique/);
  });

  it('reconnait le chiffrement symetrique dans les deux formats d en-tete', () => {
    expect(typePremierPaquet(SKESK)).toBe(3);
    expect(typePremierPaquet(Buffer.from([0xc3]))).toBe(3);
    expect(() => verifierChiffre(Buffer.from([0xc3, 0x0d]))).not.toThrow();
  });
});

describe('dump-check · un dump indechiffrable ne passe JAMAIS', () => {
  it('refuse sans phrase secrete, avant d appeler gpg', () => {
    const { executer, appels } = faux();
    const r = relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: '', executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/BACKUP_PASSPHRASE absent/);
    expect(appels).toHaveLength(0);
  });

  it('refuse une mauvaise phrase (gpg code 2, DECRYPTION_FAILED)', () => {
    const { executer } = faux({ gpg: { status: 2, stdout: '[GNUPG:] BEGIN_DECRYPTION\n[GNUPG:] DECRYPTION_FAILED\n' } });
    const r = relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: PHRASE, executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/INDECHIFFRABLE/);
  });

  it('refuse un gpg qui sort en 0 SANS avoir dechiffre', () => {
    const { executer } = faux({ gpg: { status: 0, stdout: '[GNUPG:] PLAINTEXT 62 0 x\n' } });
    const r = relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: PHRASE, executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/SANS l avoir dechiffre/);
  });

  it('refuse un gpg introuvable', () => {
    expect(() => verdictGpg(null, '', Object.assign(new Error('x'), { code: 'ENOENT' }))).toThrow(/ENOENT/);
  });

  it('la phrase passe par stdin, jamais en argument ni dans les lignes', () => {
    const { executer, appels } = faux();
    const r = relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: PHRASE, executer });
    expect(appels[0].opts.input).toBe(PHRASE);
    expect(appels[0].args.join(' ')).not.toContain(PHRASE);
    expect(r.lines.join()).not.toContain(PHRASE);
  });
});

describe('dump-check · un dechiffre incomplet ne passe JAMAIS', () => {
  it('refuse un dechiffre qui n est pas un dump pg_dump', () => {
    expect(() => verifierClair(500_000, Buffer.from('<html'))).toThrow(/PGDMP/);
  });

  it('refuse un dump tronque', () => {
    const { executer } = faux({ clair: Buffer.from('PGDMP-court') });
    expect(relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: PHRASE, executer }).exit).toBe(1);
  });

  it('refuse un dump sans le journal fiscal', () => {
    const toc = TOC_COMPLETE.replace('TABLE public payment_records ', 'TABLE public autre ');
    const { executer } = faux({ toc });
    const r = relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: PHRASE, executer });
    expect(r.exit).toBe(1);
    expect(r.resume.manquantes).toEqual(['payment_records']);
  });

  it('ne prend pas tasks_archive pour tasks', () => {
    expect(tablesManquantes('1; TABLE public tasks_archive postgres\n', ['tasks'])).toEqual(['tasks']);
    expect(tablesManquantes('1; TABLE DATA public tasks postgres\n', ['tasks'])).toEqual([]);
  });

  it('refuse un dump que pg_restore ne relit pas', () => {
    const executer = (cmd, args) => {
      if (cmd === 'gpg') { writeFileSync(args[args.indexOf('-o') + 1], CLAIR); return { status: 0, stdout: ETAT_OK }; }
      return { status: 1, stdout: '', stderr: 'pg_restore: error: corrupt' };
    };
    expect(relireDump({ dossier: artefact({ 'x.dump.gpg': SKESK }), phrase: PHRASE, executer }).exit).toBe(1);
  });
});

describe('dump-check · plancher : un artefact correct passe, et le clair ne survit pas', () => {
  it('rend exit 0 et efface le dechiffre', () => {
    const d = artefact({ 'cosmo-2026-10-14.dump.gpg': SKESK });
    const { executer } = faux();
    const r = relireDump({ dossier: d, phrase: PHRASE, executer });
    expect(r.exit).toBe(0);
    expect(r.resume.manquantes).toEqual([]);
    expect(existsSync(join(d, 'cosmo-2026-10-14.dump'))).toBe(false);
  });

  it('efface aussi le dechiffre sur un refus', () => {
    const d = artefact({ 'x.dump.gpg': SKESK });
    relireDump({ dossier: d, phrase: PHRASE, executer: faux({ toc: '' }).executer });
    expect(existsSync(join(d, 'x.dump'))).toBe(false);
  });
});

// ── gpg REEL : les lignes d'etat attendues sont-elles celles qu'il ecrit ? ──
const gpgReel = process.platform !== 'win32' && spawnSync('gpg', ['--version']).status === 0;
describe.skipIf(!gpgReel)('dump-check · avec le vrai gpg', () => {
  const home = gpgReel ? mkdtempSync(join(tmpdir(), 'dump-check-gnupg-')) : '';
  const env = { ...process.env, GNUPGHOME: home };
  const gpg = (args, input) => spawnSync('gpg', ['--batch', '--yes', ...args], { env, input });
  const executer = (cmd, args, opts) => (cmd === 'gpg'
    ? spawnSync('gpg', args, { ...opts, env: { ...env }, }) : { status: 0, stdout: TOC_COMPLETE, stderr: '' });

  function chiffrer(phrase) {
    const d = artefact({ 'x.dump': CLAIR });
    gpg(['--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256',
      '-o', join(d, 'x.dump.gpg'), join(d, 'x.dump')], phrase);
    rmSync(join(d, 'x.dump'));
    return d;
  }

  it('dechiffre ce que gpg --symmetric produit, a l identique', () => {
    const d = chiffrer(PHRASE);
    let lu = null;
    const r = relireDump({ dossier: d, phrase: PHRASE, executer: (c, a, o) => {
      const s = executer(c, a, o);
      if (c === 'gpg') lu = readFileSync(a[a.indexOf('-o') + 1]);
      return s;
    } });
    expect(r.exit).toBe(0);
    expect(lu.equals(CLAIR)).toBe(true);
  });

  it('refuse la mauvaise phrase', () => {
    const d = chiffrer(PHRASE);
    spawnSync('gpgconf', ['--kill', 'gpg-agent'], { env });
    const r = relireDump({ dossier: d, phrase: `${PHRASE}-fausse`, executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join()).toMatch(/INDECHIFFRABLE/);
  });

  it('gpg -d sort bien en 0 sur gpg --store, et le controle le refuse quand meme', () => {
    const d = artefact({ 'x.dump': CLAIR });
    gpg(['--store', '-o', join(d, 'x.dump.gpg'), join(d, 'x.dump')]);
    rmSync(join(d, 'x.dump'));
    const brut = spawnSync('gpg', ['--batch', '--yes', '--status-fd', '1', '-o', join(d, 'brut'), '-d',
      join(d, 'x.dump.gpg')], { env, encoding: 'utf8' });
    expect(brut.status).toBe(0);
    expect(() => verdictGpg(brut.status, brut.stdout)).toThrow(/SANS l avoir dechiffre/);
    expect(relireDump({ dossier: d, phrase: PHRASE, executer }).exit).toBe(1);
  });

  it('nettoyage de l agent', () => {
    spawnSync('gpgconf', ['--kill', 'all'], { env });
    rmSync(home, { recursive: true, force: true });
  });
});

describe('dump-check · le workflow appelle REELLEMENT ce module', () => {
  const yml = readFileSync(resolve('.github/workflows/restore-drill.yml'), 'utf8');
  const job = yml.slice(yml.indexOf('  dump-check:'), yml.indexOf('\n  drill:'));

  it('le job dump-check invoque scripts/dump-check.mjs', () => {
    expect(job).toMatch(/node scripts\/dump-check\.mjs/);
  });

  it('le job dump-check reste planifie', () => {
    expect(yml).toMatch(/schedule:\s*\n\s*#[^\n]*\n(?:\s*#[^\n]*\n)*\s*- cron:/);
  });

  it('le job dump-check ne touche a aucune base', () => {
    expect(job).not.toMatch(/DRILL_DB_URL|SUPABASE_DB_URL|psql/);
  });

  it('le drill garde sa confirmation tapee et attend dump-check', () => {
    expect(yml).toMatch(/"\$CONFIRMATION" != "RESTAURER"/);
    expect(yml).toMatch(/needs: dump-check/);
  });
});
