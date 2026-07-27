import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStorage, requireSession, parseVerificationInput } from './client.mjs';
import { CosmoAuthError } from './errors.mjs';

let tmpDir;
let sessionPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo-cli-'));
  sessionPath = path.join(tmpDir, 'nested', 'session.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createFileStorage', () => {
  it('retourne null quand le fichier de session n existe pas', () => {
    const storage = createFileStorage(sessionPath);
    expect(storage.getItem('k')).toBeNull();
  });

  it('cree les dossiers parents et relit ce qu il a ecrit', () => {
    const storage = createFileStorage(sessionPath);
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    expect(fs.existsSync(sessionPath)).toBe(true);
  });

  it('supprime une cle sans effacer les autres', () => {
    const storage = createFileStorage(sessionPath);
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
    expect(storage.getItem('b')).toBe('2');
  });

  it('traite un fichier corrompu comme vide au lieu de planter', () => {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, '{ pas du json');
    const storage = createFileStorage(sessionPath);
    expect(storage.getItem('k')).toBeNull();
  });
});

describe('requireSession', () => {
  it('leve CosmoAuthError quand il n y a pas de session', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null }, error: null }) } };
    await expect(requireSession(client)).rejects.toThrow(CosmoAuthError);
  });

  it('leve CosmoAuthError quand le refresh echoue', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: { message: 'refresh_token_not_found' } }),
      },
    };
    await expect(requireSession(client)).rejects.toThrow(/cosmo:login/);
  });

  it('retourne la session quand elle est valide', async () => {
    const session = { user: { id: 'u1', email: 'a@b.c' } };
    const client = { auth: { getSession: async () => ({ data: { session }, error: null }) } };
    await expect(requireSession(client)).resolves.toBe(session);
  });
});

describe('parseVerificationInput', () => {
  it('reconnait un code OTP a 6 chiffres', () => {
    expect(parseVerificationInput('123456')).toEqual({ kind: 'otp', token: '123456' });
  });

  it('tolere les espaces autour du code', () => {
    expect(parseVerificationInput('  123456  ')).toEqual({ kind: 'otp', token: '123456' });
  });

  it('extrait le token_hash d un lien magique', () => {
    const link =
      'https://ykeugqfgklejcdbrmawy.supabase.co/auth/v1/verify?token=abc123hash&type=magiclink&redirect_to=https%3A%2F%2Fexample.com';
    expect(parseVerificationInput(link)).toEqual({
      kind: 'magiclink',
      tokenHash: 'abc123hash',
      type: 'magiclink',
    });
  });

  it('respecte le type porte par le lien quand il differe', () => {
    const link = 'https://x.supabase.co/auth/v1/verify?token=h&type=signup';
    expect(parseVerificationInput(link)).toMatchObject({ kind: 'magiclink', type: 'signup' });
  });

  it('rejette un lien sans parametre token', () => {
    expect(() => parseVerificationInput('https://x.supabase.co/auth/v1/verify?type=magiclink')).toThrow(
      /token/i
    );
  });

  it('rejette une saisie qui n est ni un code ni une URL', () => {
    expect(() => parseVerificationInput('bonjour')).toThrow(/code a 6 chiffres|lien/i);
  });

  it('rejette une saisie vide', () => {
    expect(() => parseVerificationInput('   ')).toThrow();
  });
});
