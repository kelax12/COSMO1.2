// Auth + transport uniquement. Ce module ne connaît aucune notion métier
// (pas de tâche, pas d'habitude) — c'est api.mjs qui porte le domaine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CosmoAuthError } from './errors.mjs';

/** Session hors du dépôt : impossible de la committer par accident. */
export const SESSION_PATH = path.join(os.homedir(), '.cosmo', 'session.json');

const CONFIG_PATH = path.resolve(process.cwd(), '.env.cosmo-cli');

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
    fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), { mode: 0o600 });
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
 * Garantit une session utilisable. Ne tente JAMAIS de se ré-authentifier :
 * le login est une action humaine (voir login.mjs).
 */
export async function requireSession(client) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) {
    throw new CosmoAuthError(
      'Session COSMO absente ou expiree. Lance `npm run cosmo:login` dans ton terminal.'
    );
  }
  return data.session;
}
