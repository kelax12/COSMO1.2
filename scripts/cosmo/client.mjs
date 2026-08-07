// Auth + transport uniquement. Ce module ne connaît aucune notion métier
// (pas de tâche, pas d'habitude) — c'est api.mjs qui porte le domaine.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CosmoAuthError } from './errors.mjs';

/** Session hors du dépôt : impossible de la committer par accident. */
export const SESSION_PATH = path.join(os.homedir(), '.cosmo', 'session.json');

const CONFIG_PATH = path.resolve(process.cwd(), '.env.cosmo-cli');

/**
 * AUD-13 — Restreint le fichier au seul propriétaire.
 *
 * `fs.writeFileSync(..., { mode: 0o600 })` est un NO-OP sous Windows : NTFS n'a
 * pas de bits de permission POSIX, Node ne mappe que le flag lecture seule. Le
 * fichier héritait donc des ACL du dossier utilisateur, et ce fichier contient
 * un refresh token de PRODUCTION à longue durée de vie : tout processus tournant
 * sous la même session Windows pouvait le lire.
 *
 * On repose donc les ACL explicitement avec `icacls` : héritage coupé
 * (`/inheritance:r`), puis contrôle total pour le seul utilisateur courant.
 * Best-effort — si `icacls` est indisponible on n'échoue pas, le CLI reste
 * utilisable (le fichier est simplement aussi protégé qu'avant).
 */
function restrictToOwner(filePath) {
  if (process.platform !== 'win32') return; // chmod POSIX a déjà fait le travail
  const owner = process.env.USERNAME
    ? `${process.env.USERDOMAIN ?? process.env.COMPUTERNAME ?? '.'}\\${process.env.USERNAME}`
    : null;
  if (!owner) return;
  try {
    execFileSync('icacls', [filePath, '/inheritance:r', '/grant:r', `${owner}:F`], {
      stdio: 'ignore',
    });
  } catch {
    // Best-effort : ne jamais casser le login pour une question d'ACL.
  }
}

/**
 * Storage synchrone sur fichier pour supabase-js. L'interface attendue est
 * getItem/setItem/removeItem. Un fichier illisible ou corrompu est traité
 * comme vide : on préfère redemander un login à planter sur du JSON cassé.
 */
export function createFileStorage(sessionPath = SESSION_PATH) {
  const readAll = () => {
    try {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch {
      return {};
    }
  };
  const writeAll = (data) => {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    const existed = fs.existsSync(sessionPath);
    fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    if (!existed) restrictToOwner(sessionPath);
  };
  return {
    getItem: (key) => {
      const value = readAll()[key];
      return value === undefined ? null : value;
    },
    setItem: (key, value) => {
      const data = readAll();
      data[key] = value;
      writeAll(data);
    },
    removeItem: (key) => {
      const data = readAll();
      delete data[key];
      writeAll(data);
    },
  };
}

/** Lit .env.cosmo-cli. Volontairement distinct du .env racine (mode démo). */
export function loadConfig(configPath = CONFIG_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    throw new CosmoAuthError(
      `Config absente : ${configPath}. Cree-le avec COSMO_SUPABASE_URL et COSMO_SUPABASE_ANON_KEY.`
    );
  }
  const config = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    config[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  if (!config.COSMO_SUPABASE_URL || !config.COSMO_SUPABASE_ANON_KEY) {
    throw new CosmoAuthError(
      `Config incomplete dans ${configPath} : COSMO_SUPABASE_URL et COSMO_SUPABASE_ANON_KEY sont requis.`
    );
  }
  return config;
}

/** Client authentifié comme l'utilisateur. Clé publishable uniquement. */
export function createCosmoClient({ config = loadConfig(), storage = createFileStorage() } = {}) {
  return createClient(config.COSMO_SUPABASE_URL, config.COSMO_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage,
    },
  });
}

/**
 * Interprète ce que l'utilisateur colle à l'étape de vérification.
 *
 * Le template d'email Supabase par défaut n'envoie qu'un lien (il faudrait y
 * ajouter `{{ .Token }}` pour obtenir un code). Plutôt que d'imposer une
 * modification de template en production, on accepte les deux formes :
 *   - un code numérique            → verifyOtp({ email, token, type: 'email' })
 *   - le lien magique collé tel quel → verifyOtp({ token_hash, type })
 *
 * La longueur de l'OTP est CONFIGURABLE dans Supabase (Authentication >
 * Providers > Email > OTP length), de 6 à 10 chiffres. Le projet COSMO est
 * réglé sur 8 : coder 6 en dur rejetait le code localement, avant tout appel
 * réseau, ce qui rendait l'échec incompréhensible côté logs Supabase.
 *
 * Fonction pure : aucune I/O, testable isolément.
 */
const OTP_PATTERN = /^\d{6,10}$/;

export function parseVerificationInput(raw) {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new CosmoAuthError('Saisie vide : colle le code recu par email, ou le lien complet.');
  }

  if (OTP_PATTERN.test(value)) {
    return { kind: 'otp', token: value };
  }

  if (/^https?:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new CosmoAuthError('Lien illisible : verifie que tu as colle l URL complete.');
    }
    const tokenHash = url.searchParams.get('token');
    if (!tokenHash) {
      throw new CosmoAuthError(
        'Ce lien ne contient pas de parametre `token` : ce n est pas le lien de connexion Supabase.'
      );
    }
    return { kind: 'magiclink', tokenHash, type: url.searchParams.get('type') || 'magiclink' };
  }

  throw new CosmoAuthError(
    `Saisie non reconnue (${value.length} caracteres) : attendu un code de 6 a 10 chiffres, ` +
      'ou le lien complet recu par email (commencant par https://).'
  );
}

/** Une panne réseau ne doit jamais être présentée comme une session invalide. */
function isTransient(error) {
  const msg = (error?.message ?? '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econn') ||
    msg.includes('enotfound') ||
    msg.includes('socket')
  );
}

/**
 * Garantit une session utilisable, sans jamais redemander de login tant que le
 * refresh token reste valide.
 *
 * `getSession()` rafraîchit déjà le jeton expiré au démarrage du client, mais
 * dans un process CLI court cette récupération peut échouer silencieusement.
 * On force donc un `refreshSession()` explicite avant d'abandonner, et on
 * distingue une panne réseau d'une session réellement morte : renvoyer
 * « relance cosmo:login » sur un wifi coupé est un faux négatif pénible.
 *
 * Ne tente JAMAIS de se ré-authentifier : le login est une action humaine.
 */
export async function requireSession(client) {
  const { data, error } = await client.auth.getSession();
  if (data?.session) return data.session;

  if (error && isTransient(error)) {
    throw new CosmoAuthError(`Reseau indisponible : ${error.message}. Session conservee, reessaie.`);
  }

  // Dernière chance : le storage contient peut-être un refresh token encore
  // valide que getSession n'a pas su exploiter.
  const refreshed = await client.auth.refreshSession();
  if (refreshed.data?.session) return refreshed.data.session;

  if (refreshed.error && isTransient(refreshed.error)) {
    throw new CosmoAuthError(
      `Reseau indisponible : ${refreshed.error.message}. Session conservee, reessaie.`
    );
  }

  throw new CosmoAuthError(
    'Session COSMO absente ou expiree. Lance `npm run cosmo:login` dans ton terminal.'
  );
}
