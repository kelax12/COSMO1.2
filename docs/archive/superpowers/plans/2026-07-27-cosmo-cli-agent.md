> ⚠️ **ARCHIVE — plan/spec exécuté, instantané du 2026-07-27, non maintenu.**
> Le code livré fait foi, pas ce document. Sources vivantes :
> [`CLAUDE.md`](../../../../CLAUDE.md) · [`docs/`](../../../README.md).

# CLI agent COSMO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à Claude Code un accès local, filtré par RLS, aux données COSMO réelles d'Axel — lecture des tâches / habitudes / agenda / OKR, et écriture limitée (créer une tâche, la cocher, marquer une habitude faite).

**Architecture:** Un CLI Node ESM dans `scripts/cosmo/`, découpé en quatre couches à responsabilité unique : `client.mjs` (auth + transport), `api.mjs` (domaine pur, future surface de tools MCP), `cli.mjs` (arguments + rendu), `login.mjs` (OTP, lancé par Axel uniquement). Le client s'authentifie avec la clé publishable et la session d'Axel ; la RLS fait le filtrage. Aucune `service_role` nulle part.

**Tech Stack:** Node ESM (`"type": "module"`), `@supabase/supabase-js` ^2.91.1 (déjà en dépendance), Vitest pour les tests.

**Spec de référence:** [`docs/superpowers/specs/2026-07-27-cosmo-cli-agent-design.md`](../specs/2026-07-27-cosmo-cli-agent-design.md)

---

## Contexte que l'implémenteur doit connaître

Ces faits ont été vérifiés dans le dépôt. Ne pas les redécouvrir, ne pas les contredire.

| Fait | Conséquence |
|---|---|
| Projet Supabase = `ykeugqfgklejcdbrmawy`, URL `https://ykeugqfgklejcdbrmawy.supabase.co` | Config du CLI |
| Le compte d'Axel est **Google-only** | Login = OTP email, jamais `signInWithPassword` |
| `"type": "module"` dans package.json | `.mjs` en ESM, `import` disponible |
| ESLint ne lint que `**/*.{ts,tsx}` | Les `.mjs` n'impactent pas `npm run lint` |
| Coverage n'inclut que `src/**/*.{ts,tsx}` | Les `.mjs` n'impactent pas les seuils de couverture |
| `vitest.config.ts` → `include: ['src/**/*.{test,spec}.{ts,tsx}']` | **Doit être étendu**, sinon les tests de `scripts/` ne tournent jamais (Tâche 1) |
| `deadline` est une colonne **timestamp** ; `''` doit devenir `NULL` | Voir `src/modules/tasks/mappers.ts:88` |
| Convention de date du projet : `new Date().toLocaleDateString('en-CA')` → `YYYY-MM-DD` **local** | Classe de bugs timezone déjà éradiquée — ne pas utiliser `toISOString().slice(0,10)` |
| `mapTaskToDb` n'émet **jamais** `user_id` (frontière de sécurité anti-mass-assignment) | Le CLI ne doit jamais envoyer `user_id` non plus |
| Habitudes : RPC `toggle_habit_completion(p_habit_id, p_date)` (mig. 023, TOCTOU-1) | **Interdit** de faire SELECT→mutate→UPDATE sur `completions` |
| `events` : depuis mig. 077 la RLS renvoie aussi l'agenda des membres d'équipe | Le CLI **doit** filtrer `.eq('user_id', <self>)` |

**État des tests avant travaux :** 3 tests échouent déjà sur `main` (modules listes + team-stats). Ils ne sont pas de notre fait. Référence = `main` au commit `d1a0a94`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `.env.cosmo-cli` (créé, gitignoré) | URL + clé publishable. Séparé du `.env` racine, qui doit garder `VITE_SUPABASE_URL` vide pour le mode démo. |
| `.gitignore` (modifié) | Ajout de `.env.cosmo-cli` |
| `vitest.config.ts` (modifié) | `include` étendu à `scripts/**/*.test.mjs` |
| `package.json` (modifié) | Scripts `cosmo` et `cosmo:login` |
| `scripts/cosmo/errors.mjs` (créé) | Types d'erreurs partagés. Sans I/O. |
| `scripts/cosmo/client.mjs` (créé) | Config, storage de session fichier, factory de client, `requireSession`. Ne connaît aucune notion métier. |
| `scripts/cosmo/login.mjs` (créé) | Flux OTP interactif. **Lancé par Axel seulement.** |
| `scripts/cosmo/api.mjs` (créé) | Domaine pur. Reçoit un client, ne lit ni `process.env` ni `process.argv`, n'écrit pas sur stdout. |
| `scripts/cosmo/api.test.mjs` (créé) | Tests unitaires, client mocké, zéro réseau. |
| `scripts/cosmo/cli.mjs` (créé) | Parsing d'arguments, rendu humain, `--json`, `--dry-run`. |
| `docs/COSMO-CLI.md` (créé) | Mode d'emploi + procédure de login. |

---

## Tâche 0 : Lever le risque bloquant OTP

Le compte étant Google-only, tout le plan dépend de la capacité à recevoir un code OTP par email. À faire **avant** d'écrire `login.mjs`.

- [ ] **Étape 1 : Vérifier que le provider Email est activé**

Dans la console Supabase du projet `ykeugqfgklejcdbrmawy` : *Authentication → Providers → Email*.

- Si **activé** : continuer, rien à faire.
- Si **désactivé** : c'est une action de configuration de compte — **demander à Axel de l'activer lui-même** et attendre sa confirmation. Ne pas la faire à sa place.

Vérifier aussi *Authentication → Providers → Email → Confirm email* : si l'option « Enable email OTP » / « Email OTP » existe, elle doit être active, sinon `verifyOtp` recevra un lien magique et non un code à 6 chiffres.

- [ ] **Étape 2 : Noter le résultat**

Si le provider Email ne peut pas être activé, **arrêter le plan ici** et remonter à Axel : sans OTP et sans mot de passe, il n'y a pas de chemin d'authentification. Ne pas contourner en utilisant la `service_role`.

---

## Tâche 1 : Config, gitignore et include Vitest

**Files:**
- Modify: `.gitignore`
- Modify: `vitest.config.ts` (ligne `include:`)
- Modify: `package.json` (bloc `scripts`)
- Create: `.env.cosmo-cli`

- [ ] **Étape 1 : Ignorer le fichier de config AVANT de le créer**

Ordre important : si le fichier est créé d'abord, un `git add -A` malencontreux le committe.

Dans `.gitignore`, juste après la ligne `.env.production` :

```gitignore
.env.cosmo-cli
```

- [ ] **Étape 2 : Vérifier que l'ignore fonctionne**

```bash
printf 'COSMO_SUPABASE_URL=x\n' > .env.cosmo-cli && git status --porcelain .env.cosmo-cli
```

Attendu : **aucune sortie** (le fichier est ignoré). Si le chemin s'affiche, l'ignore n'est pas pris en compte — corriger avant de continuer.

- [ ] **Étape 3 : Renseigner la vraie config**

Récupérer la clé publishable via le MCP Supabase (`get_publishable_keys` sur `ykeugqfgklejcdbrmawy`), en prenant une clé dont `disabled` est `false` ou absent. Si l'appel est refusé par le classifieur de permissions, demander la clé à Axel — elle est publique (déjà livrée dans le bundle navigateur), ce n'est pas un secret.

Contenu final de `.env.cosmo-cli` :

```
COSMO_SUPABASE_URL=https://ykeugqfgklejcdbrmawy.supabase.co
COSMO_SUPABASE_ANON_KEY=<clé publishable récupérée>
```

**Ne pas toucher au `.env` racine.** Son `VITE_SUPABASE_URL` vide est ce qui maintient l'app locale en mode démo.

- [ ] **Étape 4 : Étendre l'include Vitest**

Dans `vitest.config.ts`, remplacer :

```typescript
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
```

par :

```typescript
    // `scripts/**` : tests du CLI COSMO (scripts/cosmo/), en .mjs. Sans cette
    // entrée ils ne seraient jamais ramassés et passeraient pour "verts".
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.mjs'],
```

Ne pas toucher au bloc `coverage.include` : il reste sur `src/**`, donc les `.mjs` n'entrent pas dans les seuils bloquants de CI.

- [ ] **Étape 5 : Ajouter les scripts npm**

Dans `package.json`, après `"validate:migrations"` :

```json
    "cosmo": "node scripts/cosmo/cli.mjs",
    "cosmo:login": "node scripts/cosmo/login.mjs",
```

- [ ] **Étape 6 : Vérifier que rien n'est cassé**

```bash
npm test
```

Attendu : mêmes résultats qu'avant (3 échecs préexistants listes + team-stats, rien de plus).

- [ ] **Étape 7 : Commit**

```bash
git add .gitignore vitest.config.ts package.json
git commit -m "chore(cosmo-cli): config, gitignore et include vitest pour le CLI agent"
```

Vérifier que `.env.cosmo-cli` **n'apparaît pas** dans le commit :

```bash
git show --stat --name-only HEAD
```

---

## Tâche 2 : Erreurs typées

**Files:**
- Create: `scripts/cosmo/errors.mjs`
- Test: `scripts/cosmo/api.test.mjs` (créé en Tâche 4)

- [ ] **Étape 1 : Écrire le module**

```javascript
// scripts/cosmo/errors.mjs
// Erreurs typées du CLI COSMO. Aucune I/O : ce module ne doit jamais écrire
// sur stdout/stderr — c'est cli.mjs qui décide du rendu.

/** Session absente, expirée, ou refresh token révoqué. */
export class CosmoAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CosmoAuthError';
  }
}

/** Entité demandée introuvable (ou invisible via la RLS, ce qui revient au même). */
export class CosmoNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CosmoNotFoundError';
  }
}

/** Entrée utilisateur invalide, détectée avant tout appel réseau. */
export class CosmoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CosmoValidationError';
  }
}

/** Erreur remontée par PostgREST/Supabase, enveloppée pour garder le code. */
export class CosmoApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CosmoApiError';
    this.code = code;
  }
}
```

- [ ] **Étape 2 : Commit**

```bash
git add scripts/cosmo/errors.mjs
git commit -m "feat(cosmo-cli): erreurs typees du CLI"
```

---

## Tâche 3 : Client Supabase et stockage de session

**Files:**
- Create: `scripts/cosmo/client.mjs`
- Test: `scripts/cosmo/client.test.mjs`

- [ ] **Étape 1 : Écrire le test qui échoue**

```javascript
// scripts/cosmo/client.test.mjs
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStorage, requireSession } from './client.mjs';
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
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run scripts/cosmo/client.test.mjs
```

Attendu : ÉCHEC — `Failed to resolve import "./client.mjs"`.

- [ ] **Étape 3 : Écrire l'implémentation minimale**

```javascript
// scripts/cosmo/client.mjs
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
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run scripts/cosmo/client.test.mjs
```

Attendu : 7 tests PASS.

- [ ] **Étape 5 : Commit**

```bash
git add scripts/cosmo/client.mjs scripts/cosmo/client.test.mjs
git commit -m "feat(cosmo-cli): client Supabase et stockage de session sur fichier"
```

---

## Tâche 4 : Lecture des tâches + test anti-dérive de schéma

**Files:**
- Create: `scripts/cosmo/api.mjs`
- Create: `scripts/cosmo/api.test.mjs`

- [ ] **Étape 1 : Écrire les tests qui échouent**

```javascript
// scripts/cosmo/api.test.mjs
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TASK_COLUMNS, todayLocal, listTasks } from './api.mjs';

/**
 * Faux client Supabase : chaque méthode de chaînage se retourne elle-même,
 * et le résultat final est `await`-able via then(). Enregistre les appels
 * pour qu'on puisse asserter les filtres envoyés.
 */
function makeFakeClient(result = { data: [], error: null }) {
  const calls = [];
  const chain = {
    select: (...a) => (calls.push(['select', ...a]), chain),
    eq: (...a) => (calls.push(['eq', ...a]), chain),
    gte: (...a) => (calls.push(['gte', ...a]), chain),
    lte: (...a) => (calls.push(['lte', ...a]), chain),
    order: (...a) => (calls.push(['order', ...a]), chain),
    limit: (...a) => (calls.push(['limit', ...a]), chain),
    insert: (...a) => (calls.push(['insert', ...a]), chain),
    update: (...a) => (calls.push(['update', ...a]), chain),
    single: (...a) => (calls.push(['single', ...a]), chain),
    then: (resolve) => resolve(result),
  };
  return {
    calls,
    from: (table) => (calls.push(['from', table]), chain),
    rpc: (...a) => (calls.push(['rpc', ...a]), chain),
  };
}

describe('TASK_COLUMNS — garde anti-derive', () => {
  it('correspond exactement a TASK_LIST_COLUMNS du repository applicatif', () => {
    const repoPath = path.resolve(process.cwd(), 'src/modules/tasks/supabase.repository.ts');
    const source = fs.readFileSync(repoPath, 'utf8');
    const match = source.match(/TASK_LIST_COLUMNS[^'"`]*['"`]([^'"`]+)['"`]/);
    expect(match, 'TASK_LIST_COLUMNS introuvable dans le repository').not.toBeNull();

    const appColumns = match[1].split(',').map((c) => c.trim()).sort();
    const cliColumns = TASK_COLUMNS.split(',').map((c) => c.trim()).sort();
    expect(cliColumns).toEqual(appColumns);
  });
});

describe('todayLocal', () => {
  it('produit une date locale au format YYYY-MM-DD', () => {
    const value = todayLocal(new Date(2026, 6, 27, 23, 30));
    expect(value).toBe('2026-07-27');
  });

  it('utilise la date LOCALE et non UTC en fin de journee', () => {
    // 23h30 le 27 en local peut être le 28 en UTC. La convention du projet
    // (en-CA) doit renvoyer le 27 — c'est la classe de bugs timezone déjà
    // éradiquée dans l'app.
    const late = new Date(2026, 6, 27, 23, 59, 59);
    expect(todayLocal(late)).toBe('2026-07-27');
  });
});

describe('listTasks', () => {
  it('selectionne les colonnes canoniques et trie par echeance', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listTasks(client, {});
    expect(client.calls).toContainEqual(['from', 'tasks']);
    expect(client.calls).toContainEqual(['select', TASK_COLUMNS]);
    expect(client.calls.some(([m, col]) => m === 'order' && col === 'deadline')).toBe(true);
  });

  it('filtre sur completed quand l option est fournie', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listTasks(client, { completed: false });
    expect(client.calls).toContainEqual(['eq', 'completed', false]);
  });

  it('ne filtre pas sur completed quand l option est absente', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listTasks(client, {});
    expect(client.calls.some(([m, col]) => m === 'eq' && col === 'completed')).toBe(false);
  });

  it('mappe les colonnes snake_case vers le domaine', async () => {
    const row = {
      id: 't1', name: 'Ecrire le plan', priority: 2, category: 'Travail',
      deadline: '2026-07-27', estimated_time: 45, bookmarked: false,
      completed: false, completed_at: null, kr_id: null, recurrence: 'none',
    };
    const client = makeFakeClient({ data: [row], error: null });
    const tasks = await listTasks(client, {});
    expect(tasks[0]).toMatchObject({
      id: 't1', name: 'Ecrire le plan', estimatedTime: 45, completed: false, recurrence: 'none',
    });
  });
});
```

- [ ] **Étape 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : ÉCHEC — `Failed to resolve import "./api.mjs"`.

- [ ] **Étape 3 : Écrire l'implémentation minimale**

```javascript
// scripts/cosmo/api.mjs
// Couche métier pure. Contraintes :
//   - reçoit toujours un `client` en paramètre (jamais de singleton importé)
//   - ne lit ni process.env ni process.argv
//   - n'écrit rien sur stdout/stderr
// C'est cette couche, et elle seule, qu'un futur serveur MCP réutilisera :
// chaque fonction exportée correspond à un tool.
import { CosmoApiError, CosmoValidationError } from './errors.mjs';

/**
 * Colonnes de `tasks`. Duplique volontairement TASK_LIST_COLUMNS du
 * repository applicatif (on ne veut pas de chaîne de build TS dans scripts/).
 * Le test anti-dérive de api.test.mjs casse si les deux divergent.
 */
export const TASK_COLUMNS =
  'id,name,priority,category,deadline,estimated_time,created_at,updated_at,bookmarked,completed,completed_at,subtasks,kr_id,recurrence,is_collaborative,pending_invites,user_id';

/**
 * Date locale YYYY-MM-DD. `en-CA` est la convention du projet : elle évite la
 * classe de bugs où toISOString() décale d'un jour en soirée.
 */
export function todayLocal(now = new Date()) {
  return now.toLocaleDateString('en-CA');
}

/** Enveloppe une erreur PostgREST. Ne jamais laisser fuiter l'objet brut. */
function unwrap({ data, error }) {
  if (error) throw new CosmoApiError(error.message, error.code);
  return data;
}

function mapTaskFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    category: row.category ?? '',
    deadline: row.deadline ?? '',
    estimatedTime: row.estimated_time,
    bookmarked: row.bookmarked ?? false,
    completed: row.completed ?? false,
    completedAt: row.completed_at ?? undefined,
    krId: row.kr_id ?? undefined,
    recurrence: row.recurrence ?? 'none',
    createdAt: row.created_at,
  };
}

/**
 * Liste les tâches. La RLS restreint déjà à l'utilisateur courant : pas de
 * filtre user_id nécessaire ici (contrairement à `events`, voir listEvents).
 */
export async function listTasks(client, { completed, category, deadlineBefore, limit } = {}) {
  let query = client.from('tasks').select(TASK_COLUMNS);
  if (completed !== undefined) query = query.eq('completed', completed);
  if (category) query = query.eq('category', category);
  if (deadlineBefore) query = query.lte('deadline', deadlineBefore);
  query = query.order('deadline', { ascending: true }).order('priority', { ascending: false });
  if (limit) query = query.limit(limit);
  const rows = unwrap(await query) ?? [];
  return rows.map(mapTaskFromRow);
}
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : 7 tests PASS. Si le test anti-dérive échoue, c'est que `TASK_COLUMNS` diverge du repository — corriger `TASK_COLUMNS`, **pas** le test.

- [ ] **Étape 5 : Commit**

```bash
git add scripts/cosmo/api.mjs scripts/cosmo/api.test.mjs
git commit -m "feat(cosmo-cli): lecture des taches + garde anti-derive de schema"
```

---

## Tâche 5 : Écriture des tâches (créer, cocher)

**Files:**
- Modify: `scripts/cosmo/api.mjs`
- Modify: `scripts/cosmo/api.test.mjs`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Ajouter à la fin de `scripts/cosmo/api.test.mjs` (le helper `makeFakeClient` de la Tâche 4 est réutilisé) :

```javascript
import { createTask, completeTask, DEFAULT_TASK } from './api.mjs';
import { CosmoValidationError } from './errors.mjs';

describe('createTask', () => {
  it('refuse un nom vide sans appeler le reseau', async () => {
    const client = makeFakeClient();
    await expect(createTask(client, { name: '   ' })).rejects.toThrow(CosmoValidationError);
    expect(client.calls).toHaveLength(0);
  });

  it('retombe sur la premiere categorie de l utilisateur quand aucune n est fournie', async () => {
    const client = makeFakeClient({ data: [{ id: 'c1', name: 'Perso' }], error: null });
    await createTask(client, { name: 'X' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].category).toBe('Perso');
  });

  it('leve une erreur explicite si l utilisateur n a aucune categorie', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await expect(createTask(client, { name: 'X' })).rejects.toThrow(/categorie/i);
  });

  it('applique les defauts documentes', async () => {
    const client = makeFakeClient({ data: { id: 'n1', name: 'X' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso' }, { now: new Date(2026, 6, 27) });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1]).toMatchObject({
      name: 'X',
      category: 'Perso',
      priority: DEFAULT_TASK.priority,
      estimated_time: DEFAULT_TASK.estimatedTime,
      deadline: '2026-07-27',
      bookmarked: false,
      completed: false,
      recurrence: 'none',
    });
  });

  it('n envoie JAMAIS user_id (frontiere anti-mass-assignment)', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso', userId: 'pirate' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1]).not.toHaveProperty('user_id');
  });

  it('transforme une echeance vide en NULL (colonne timestamp)', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso', deadline: '' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].deadline).toBeNull();
  });
});

describe('completeTask', () => {
  it('pose completed ET completed_at', async () => {
    const client = makeFakeClient({ data: { id: 't1', completed: true }, error: null });
    await completeTask(client, 't1', { now: new Date(2026, 6, 27) });
    const update = client.calls.find(([m]) => m === 'update');
    expect(update[1]).toMatchObject({ completed: true, completed_at: '2026-07-27' });
  });

  it('cible bien la tache demandee', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await completeTask(client, 't1');
    expect(client.calls).toContainEqual(['eq', 'id', 't1']);
  });
});
```

- [ ] **Étape 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : ÉCHEC — `createTask is not a function` (ou erreur d'import).

- [ ] **Étape 3 : Écrire l'implémentation minimale**

Ajouter à `scripts/cosmo/api.mjs` :

```javascript
/** Défauts documentés dans le spec §4. */
export const DEFAULT_TASK = { priority: 3, estimatedTime: 30 };

/**
 * Catégorie par défaut = la première de l'utilisateur. On refuse de créer une
 * tâche sans catégorie : `category` est non-optionnel dans le modèle domaine,
 * et une chaîne vide produirait des tâches non classables dans l'app.
 */
async function defaultCategoryName(client) {
  const rows =
    unwrap(await client.from('categories').select('*').order('name', { ascending: true })) ?? [];
  if (rows.length === 0) {
    throw new CosmoValidationError(
      'Aucune categorie sur ce compte : precise --category, ou cree une categorie dans l app.'
    );
  }
  return rows[0].name;
}

/**
 * Crée une tâche. N'émet jamais `user_id` : la colonne est posée côté serveur
 * depuis auth.uid(). C'est la même frontière de sécurité que mapTaskToDb.
 */
export async function createTask(client, input, { now = new Date() } = {}) {
  const name = (input?.name ?? '').trim();
  if (!name) throw new CosmoValidationError('Le nom de la tache est obligatoire.');

  const category = input.category ?? (await defaultCategoryName(client));
  const deadline = input.deadline === undefined ? todayLocal(now) : input.deadline;
  const row = {
    name,
    priority: input.priority ?? DEFAULT_TASK.priority,
    category,
    deadline: deadline ? deadline : null,
    estimated_time: input.estimatedTime ?? DEFAULT_TASK.estimatedTime,
    bookmarked: false,
    completed: false,
    recurrence: input.recurrence ?? 'none',
  };
  if (input.description !== undefined) row.description = input.description;
  if (input.krId) row.kr_id = input.krId;

  const data = unwrap(await client.from('tasks').insert(row).select(TASK_COLUMNS).single());
  return mapTaskFromRow(data);
}

/**
 * Coche une tâche. Pose `completed_at` en plus de `completed` : ne poser que
 * le booléen fausserait les statistiques et le dashboard.
 */
export async function completeTask(client, taskId, { now = new Date() } = {}) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');
  const data = unwrap(
    await client
      .from('tasks')
      .update({ completed: true, completed_at: todayLocal(now) })
      .eq('id', taskId)
      .select(TASK_COLUMNS)
      .single()
  );
  return mapTaskFromRow(data);
}
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : tous PASS (15 tests).

- [ ] **Étape 5 : Commit**

```bash
git add scripts/cosmo/api.mjs scripts/cosmo/api.test.mjs
git commit -m "feat(cosmo-cli): creation et cloture de taches"
```

---

## Tâche 6 : Habitudes (lecture + complétion idempotente via RPC)

**Files:**
- Modify: `scripts/cosmo/api.mjs`
- Modify: `scripts/cosmo/api.test.mjs`

**À lire avant de coder :** `src/modules/habits/supabase.repository.ts:115-126`. La complétion passe par la RPC `toggle_habit_completion(p_habit_id, p_date)`, introduite par la migration 023 pour corriger la faille TOCTOU-1. Un `SELECT completions` → mutation JS → `UPDATE` perd les écritures concurrentes d'un autre appareil. **Ne pas reproduire ce pattern.**

La RPC est un **toggle**. « Marquer faite » doit donc être idempotent : lire d'abord, n'appeler la RPC que si l'habitude n'est pas déjà faite ce jour-là. Sinon la commande décoche une habitude déjà validée.

- [ ] **Étape 1 : Écrire les tests qui échouent**

```javascript
import { listHabitsToday, markHabitDone } from './api.mjs';

describe('listHabitsToday', () => {
  it('annote chaque habitude avec doneToday', async () => {
    const client = makeFakeClient({
      data: [
        { id: 'h1', name: 'Sport', completions: { '2026-07-27': true }, estimated_time: 30 },
        { id: 'h2', name: 'Lecture', completions: {}, estimated_time: 20 },
      ],
      error: null,
    });
    const habits = await listHabitsToday(client, { now: new Date(2026, 6, 27) });
    expect(habits[0]).toMatchObject({ id: 'h1', name: 'Sport', doneToday: true });
    expect(habits[1]).toMatchObject({ id: 'h2', name: 'Lecture', doneToday: false });
  });

  it('tolere completions absent', async () => {
    const client = makeFakeClient({ data: [{ id: 'h1', name: 'X' }], error: null });
    const habits = await listHabitsToday(client, { now: new Date(2026, 6, 27) });
    expect(habits[0].doneToday).toBe(false);
  });
});

describe('markHabitDone', () => {
  it('appelle la RPC toggle_habit_completion quand l habitude n est pas faite', async () => {
    const client = makeFakeClient({ data: [{ id: 'h1', name: 'Sport', completions: {} }], error: null });
    await markHabitDone(client, 'h1', { now: new Date(2026, 6, 27) });
    expect(client.calls).toContainEqual([
      'rpc', 'toggle_habit_completion', { p_habit_id: 'h1', p_date: '2026-07-27' },
    ]);
  });

  it('est idempotent : n appelle PAS la RPC si deja faite (sinon elle decocherait)', async () => {
    const client = makeFakeClient({
      data: [{ id: 'h1', name: 'Sport', completions: { '2026-07-27': true } }],
      error: null,
    });
    const result = await markHabitDone(client, 'h1', { now: new Date(2026, 6, 27) });
    expect(client.calls.some(([m]) => m === 'rpc')).toBe(false);
    expect(result.alreadyDone).toBe(true);
  });

  it('ne fait jamais de update direct sur completions (TOCTOU-1)', async () => {
    const client = makeFakeClient({ data: [{ id: 'h1', completions: {} }], error: null });
    await markHabitDone(client, 'h1', { now: new Date(2026, 6, 27) });
    expect(client.calls.some(([m]) => m === 'update')).toBe(false);
  });
});
```

- [ ] **Étape 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : ÉCHEC — `listHabitsToday is not a function`.

- [ ] **Étape 3 : Écrire l'implémentation minimale**

Ajouter à `scripts/cosmo/api.mjs` :

```javascript
function mapHabitFromRow(row, dayKey) {
  const completions = row.completions || {};
  return {
    id: row.id,
    name: row.name,
    estimatedTime: row.estimated_time,
    color: row.color,
    icon: row.icon,
    completions,
    doneToday: completions[dayKey] === true,
  };
}

/** Habitudes de l'utilisateur, annotées de leur état du jour. */
export async function listHabitsToday(client, { now = new Date() } = {}) {
  const dayKey = todayLocal(now);
  const rows = unwrap(await client.from('habits').select('*').order('name', { ascending: true })) ?? [];
  return rows.map((row) => mapHabitFromRow(row, dayKey));
}

/**
 * Marque une habitude comme faite aujourd'hui.
 *
 * Passe par la RPC atomique `toggle_habit_completion` (mig. 023, TOCTOU-1) :
 * jamais de SELECT→mutate→UPDATE, qui perdrait les écritures concurrentes.
 * Comme la RPC est un *toggle*, on lit d'abord l'état : sans ce garde, appeler
 * la commande deux fois décocherait l'habitude.
 */
export async function markHabitDone(client, habitId, { now = new Date() } = {}) {
  if (!habitId) throw new CosmoValidationError('Identifiant d habitude manquant.');
  const dayKey = todayLocal(now);

  const rows = unwrap(await client.from('habits').select('*').eq('id', habitId)) ?? [];
  const current = rows[0];
  if (!current) throw new CosmoNotFoundError(`Habitude introuvable : ${habitId}`);

  if ((current.completions || {})[dayKey] === true) {
    return { ...mapHabitFromRow(current, dayKey), alreadyDone: true };
  }

  const data = unwrap(
    await client.rpc('toggle_habit_completion', { p_habit_id: habitId, p_date: dayKey })
  );
  return { ...mapHabitFromRow(data, dayKey), alreadyDone: false };
}
```

Ajouter `CosmoNotFoundError` à l'import en tête de `api.mjs` :

```javascript
import { CosmoApiError, CosmoNotFoundError, CosmoValidationError } from './errors.mjs';
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : tous PASS (20 tests).

- [ ] **Étape 5 : Commit**

```bash
git add scripts/cosmo/api.mjs scripts/cosmo/api.test.mjs
git commit -m "feat(cosmo-cli): habitudes en lecture et completion idempotente via RPC"
```

---

## Tâche 7 : Agenda et OKR (lecture seule)

**Files:**
- Modify: `scripts/cosmo/api.mjs`
- Modify: `scripts/cosmo/api.test.mjs`

**À lire avant de coder :** `src/modules/events/supabase.repository.ts:17-19`. Depuis la migration 077, la policy RLS de `events` renvoie **aussi l'agenda des membres de l'équipe**. Le repository applicatif filtre donc explicitement `user_id = self`. Sans ce filtre, « mon agenda » afficherait les événements des collègues d'Axel — un problème de confidentialité, pas seulement d'affichage.

- [ ] **Étape 1 : Écrire les tests qui échouent**

```javascript
import { listUpcomingEvents, listOkrs } from './api.mjs';

describe('listUpcomingEvents', () => {
  it('filtre explicitement sur user_id (RLS mig. 077 renvoie aussi l equipe)', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listUpcomingEvents(client, { userId: 'me-123', now: new Date(2026, 6, 27) });
    expect(client.calls).toContainEqual(['eq', 'user_id', 'me-123']);
  });

  it('refuse de requeter sans userId plutot que de tout renvoyer', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await expect(listUpcomingEvents(client, {})).rejects.toThrow(CosmoValidationError);
    expect(client.calls).toHaveLength(0);
  });

  it('borne la fenetre a partir de maintenant et trie par start_time', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listUpcomingEvents(client, { userId: 'me', now: new Date(2026, 6, 27, 9, 0) });
    expect(client.calls.some(([m, col]) => m === 'gte' && col === 'start_time')).toBe(true);
    expect(client.calls.some(([m, col]) => m === 'order' && col === 'start_time')).toBe(true);
  });
});

describe('listOkrs', () => {
  it('lit les okrs et leurs key results', async () => {
    const client = makeFakeClient({
      data: [{ id: 'o1', title: 'Lancer COSMO', progress: 40, completed: false }],
      error: null,
    });
    const okrs = await listOkrs(client);
    expect(okrs[0]).toMatchObject({ id: 'o1', title: 'Lancer COSMO', progress: 40 });
  });

  it('n effectue aucune ecriture (OKR en lecture seule, journal kr_completions)', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listOkrs(client);
    expect(client.calls.some(([m]) => m === 'insert' || m === 'update' || m === 'rpc')).toBe(false);
  });
});
```

- [ ] **Étape 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : ÉCHEC — `listUpcomingEvents is not a function`.

- [ ] **Étape 3 : Écrire l'implémentation minimale**

Ajouter à `scripts/cosmo/api.mjs` :

```javascript
/**
 * Événements à venir de l'utilisateur.
 *
 * Le filtre `user_id` est OBLIGATOIRE : depuis la mig. 077 la policy RLS de
 * `events` expose aussi l'agenda des membres de l'équipe. S'en remettre à la
 * seule RLS mélangerait l'agenda perso et celui des collègues.
 */
export async function listUpcomingEvents(client, { userId, now = new Date(), days = 7 } = {}) {
  if (!userId) {
    throw new CosmoValidationError(
      'userId requis : la RLS events expose aussi l agenda de l equipe (mig. 077).'
    );
  }
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const rows =
    unwrap(
      await client
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', now.toISOString())
        .lte('start_time', until.toISOString())
        .order('start_time', { ascending: true })
    ) ?? [];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    allDay: row.all_day ?? false,
  }));
}

/**
 * OKR en LECTURE SEULE. Faire progresser un KR imposerait d'insérer
 * atomiquement dans le journal append-only `kr_completions` (sinon le
 * graphique « KR réalisés » du dashboard reste à 0). Cette logique vit dans
 * les repositories applicatifs et ne doit pas être dupliquée ici.
 */
export async function listOkrs(client) {
  const okrRows = unwrap(await client.from('okrs').select('*').order('created_at', { ascending: false })) ?? [];
  return okrRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    progress: row.progress,
    completed: row.completed,
  }));
}

/** Key results d'un OKR, pour rattacher une tâche via kr_id. */
export async function listKeyResults(client, okrId) {
  if (!okrId) throw new CosmoValidationError('Identifiant d OKR manquant.');
  const rows = unwrap(await client.from('key_results').select('*').eq('okr_id', okrId)) ?? [];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    unit: row.unit,
    currentValue: row.current_value,
    targetValue: row.target_value,
    completed: row.completed,
  }));
}
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run scripts/cosmo/api.test.mjs
```

Attendu : tous PASS (25 tests).

- [ ] **Étape 5 : Commit**

```bash
git add scripts/cosmo/api.mjs scripts/cosmo/api.test.mjs
git commit -m "feat(cosmo-cli): agenda et OKR en lecture seule"
```

---

## Tâche 8 : Login OTP

**Files:**
- Create: `scripts/cosmo/login.mjs`

Ce script est **interactif et lancé par Axel**. Claude ne l'exécute jamais et ne demande jamais le code OTP. Pas de test automatisé : il est purement I/O interactif, la logique testable est déjà couverte par `client.mjs`.

- [ ] **Étape 1 : Écrire le script**

```javascript
// scripts/cosmo/login.mjs
// Login interactif du CLI COSMO. À lancer PAR L'UTILISATEUR :
//   npm run cosmo:login
// Le compte étant Google-only, il n'y a pas de mot de passe : on passe par un
// code OTP envoyé par email. La session obtenue est persistée dans
// ~/.cosmo/session.json et rafraîchie automatiquement ensuite.
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createCosmoClient, SESSION_PATH } from './client.mjs';

async function main() {
  const rl = readline.createInterface({ input, output });
  const client = createCosmoClient();

  try {
    const email = (await rl.question('Email du compte COSMO : ')).trim();
    if (!email) {
      console.error('Email vide, abandon.');
      process.exitCode = 1;
      return;
    }

    // shouldCreateUser: false — sans ça, une faute de frappe dans l'email
    // creerait silencieusement un nouveau compte.
    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      console.error(`Envoi du code impossible : ${otpError.message}`);
      console.error('Si le message parle de provider desactive, active Email dans Supabase > Authentication > Providers.');
      process.exitCode = 1;
      return;
    }

    console.log(`Code envoye a ${email}.`);
    const token = (await rl.question('Colle le code recu : ')).trim();

    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      console.error(`Code refuse : ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Connecte en tant que ${data.user.email}.`);
    console.log(`Session enregistree dans ${SESSION_PATH}`);
    console.log('Tu peux maintenant lancer : npm run cosmo -- tasks list');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
```

- [ ] **Étape 2 : Vérifier que le script démarre sans crasher**

```bash
node -e "import('./scripts/cosmo/login.mjs').then(()=>{}).catch(e=>{console.error('IMPORT KO:',e.message);process.exit(1)})" < /dev/null
```

Attendu : pas d'erreur d'import. Le script demandera l'email puis s'arrêtera sur stdin vide — c'est normal.

- [ ] **Étape 3 : Commit**

```bash
git add scripts/cosmo/login.mjs
git commit -m "feat(cosmo-cli): login interactif par code OTP email"
```

---

## Tâche 9 : CLI (arguments, rendu, --json, --dry-run)

**Files:**
- Create: `scripts/cosmo/cli.mjs`

- [ ] **Étape 1 : Écrire le script**

```javascript
// scripts/cosmo/cli.mjs
// Présentation uniquement : parsing d'arguments, rendu, codes de sortie.
// Aucune requête directe — tout passe par api.mjs.
import { createCosmoClient, requireSession } from './client.mjs';
import {
  listTasks, createTask, completeTask,
  listHabitsToday, markHabitDone,
  listUpcomingEvents, listOkrs, listKeyResults,
  todayLocal,
} from './api.mjs';

const USAGE = `Usage : npm run cosmo -- <commande> [options]

Commandes
  tasks list [--all] [--category <c>] [--before <YYYY-MM-DD>] [--limit <n>]
  tasks add <nom> [--priority <1-5>] [--category <c>] [--deadline <YYYY-MM-DD>] [--time <min>]
  tasks done <id>
  habits today
  habits done <id>
  agenda [--days <n>]
  okr [--kr <okrId>]

Options globales
  --json      sortie JSON brute
  --dry-run   n'ecrit rien, affiche ce qui serait envoye
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function output(value, flags) {
  if (flags.json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log('(rien)');
      return;
    }
    for (const item of value) console.log(formatLine(item));
    return;
  }
  console.log(formatLine(value));
}

function formatLine(item) {
  if (item.doneToday !== undefined) {
    return `${item.doneToday ? '[x]' : '[ ]'} ${item.name}  (${item.id})`;
  }
  if (item.startTime !== undefined) {
    return `${item.startTime}  ${item.title}  (${item.id})`;
  }
  if (item.targetValue !== undefined) {
    return `${item.title} : ${item.currentValue}/${item.targetValue} ${item.unit ?? ''}  (${item.id})`;
  }
  if (item.progress !== undefined) {
    return `${item.completed ? '[x]' : '[ ]'} ${item.title} — ${item.progress}%  (${item.id})`;
  }
  const mark = item.completed ? '[x]' : '[ ]';
  const deadline = item.deadline ? ` echeance ${item.deadline.slice(0, 10)}` : '';
  return `${mark} P${item.priority} ${item.name}${deadline}  (${item.id})`;
}

async function run(argv) {
  const { positional, flags } = parseArgs(argv);
  const [domain, action, ...rest] = positional;

  if (!domain || flags.help) {
    console.log(USAGE);
    return;
  }

  const client = createCosmoClient();
  const session = await requireSession(client);

  if (domain === 'tasks' && (action === 'list' || action === undefined)) {
    const tasks = await listTasks(client, {
      completed: flags.all ? undefined : false,
      category: typeof flags.category === 'string' ? flags.category : undefined,
      deadlineBefore: typeof flags.before === 'string' ? flags.before : undefined,
      limit: flags.limit ? Number(flags.limit) : undefined,
    });
    output(tasks, flags);
    return;
  }

  if (domain === 'tasks' && action === 'add') {
    const name = rest.join(' ');
    const input = {
      name,
      priority: flags.priority ? Number(flags.priority) : undefined,
      category: typeof flags.category === 'string' ? flags.category : undefined,
      deadline: typeof flags.deadline === 'string' ? flags.deadline : undefined,
      estimatedTime: flags.time ? Number(flags.time) : undefined,
    };
    if (flags['dry-run']) {
      output({ dryRun: true, wouldCreate: { ...input, deadline: input.deadline ?? todayLocal() } }, flags);
      return;
    }
    const created = await createTask(client, input);
    // Ré-affiche la ligne telle que la base l'a renvoyée, pas la charge utile
    // envoyée : ça rend visibles les defaults et triggers serveur.
    output(created, flags);
    return;
  }

  if (domain === 'tasks' && action === 'done') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldComplete: id }, flags);
      return;
    }
    output(await completeTask(client, id), flags);
    return;
  }

  if (domain === 'habits' && (action === 'today' || action === undefined)) {
    output(await listHabitsToday(client), flags);
    return;
  }

  if (domain === 'habits' && action === 'done') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldMarkDone: id }, flags);
      return;
    }
    const result = await markHabitDone(client, id);
    if (result.alreadyDone && !flags.json) console.log('(deja faite aujourd hui, rien de change)');
    output(result, flags);
    return;
  }

  if (domain === 'agenda') {
    const events = await listUpcomingEvents(client, {
      userId: session.user.id,
      days: flags.days ? Number(flags.days) : 7,
    });
    output(events, flags);
    return;
  }

  if (domain === 'okr') {
    if (typeof flags.kr === 'string') {
      output(await listKeyResults(client, flags.kr), flags);
      return;
    }
    output(await listOkrs(client), flags);
    return;
  }

  console.error(`Commande inconnue : ${positional.join(' ')}\n`);
  console.log(USAGE);
  process.exitCode = 1;
}

run(process.argv.slice(2)).catch((err) => {
  console.error(`${err.name ?? 'Erreur'} : ${err.message}`);
  process.exitCode = 1;
});
```

- [ ] **Étape 2 : Vérifier le message d'aide et le chemin d'erreur d'auth**

```bash
npm run cosmo -- --help
```

Attendu : le bloc `Usage`, code de sortie 0.

```bash
npm run cosmo -- tasks list
```

Attendu **tant qu'Axel ne s'est pas connecté** : `CosmoAuthError : Session COSMO absente ou expiree. Lance \`npm run cosmo:login\` dans ton terminal.` et code de sortie 1. C'est le comportement correct, pas un échec.

- [ ] **Étape 3 : Commit**

```bash
git add scripts/cosmo/cli.mjs
git commit -m "feat(cosmo-cli): interface en ligne de commande"
```

---

## Tâche 10 : Validation de bout en bout sur données réelles

Cette tâche nécessite qu'**Axel se connecte lui-même**. Ne pas tenter de la faire à sa place.

- [ ] **Étape 1 : Demander à Axel de se connecter**

Lui indiquer :

```bash
npm run cosmo:login
```

Attendre sa confirmation. Ne pas lancer ce script, ne pas demander le code OTP.

- [ ] **Étape 2 : Vérifier la lecture**

```bash
npm run cosmo -- tasks list --limit 5
```

Attendu : jusqu'à 5 vraies tâches non terminées. Si `CosmoAuthError`, la session n'a pas été créée — revenir à l'étape 1.

- [ ] **Étape 3 : Vérifier l'écriture à blanc avant d'écrire pour de vrai**

```bash
npm run cosmo -- tasks add "Test CLI COSMO" --dry-run --json
```

Attendu : un objet `{"dryRun": true, "wouldCreate": {...}}`, **aucune écriture en base**.

- [ ] **Étape 4 : Créer une vraie tâche et la vérifier**

```bash
npm run cosmo -- tasks add "Test CLI COSMO" --category Perso --json
```

Attendu : la ligne créée, avec un `id` et un `deadline` du jour. Demander à Axel de confirmer qu'elle apparaît bien dans l'app COSMO déployée — c'est la seule preuve que la RLS a posé le bon `user_id`.

- [ ] **Étape 5 : Vérifier les trois autres domaines**

```bash
npm run cosmo -- habits today
```

```bash
npm run cosmo -- agenda --days 7
```

```bash
npm run cosmo -- okr
```

Attendu : données réelles. Sur `agenda`, vérifier avec Axel qu'**aucun événement de collègue** n'apparaît — c'est le test du filtre `user_id` de la Tâche 7.

- [ ] **Étape 6 : Vérifier l'idempotence des habitudes**

Lancer deux fois de suite sur la même habitude (remplacer `<id>` par un id réel obtenu à l'étape 5) :

```bash
npm run cosmo -- habits done <id>
```

Attendu : la première fois la marque faite ; la seconde affiche `(deja faite aujourd hui, rien de change)` et **ne la décoche pas**. Si elle est décochée, le garde d'idempotence de la Tâche 6 est cassé.

- [ ] **Étape 7 : Nettoyer la tâche de test**

Le CLI ne supprime rien par conception. Demander à Axel de supprimer « Test CLI COSMO » depuis l'app, ou la laisser s'il préfère.

- [ ] **Étape 8 : Vérification complète du dépôt**

```bash
npm run lint
```

Attendu : 0 erreur.

```bash
npm run typecheck
```

Attendu : 0 erreur.

```bash
npm test
```

Attendu : les nouveaux tests `scripts/cosmo/*.test.mjs` PASS, et **exactement les 3 mêmes échecs préexistants** (listes + team-stats). Tout échec supplémentaire est une régression à corriger avant de continuer.

```bash
git status --porcelain
```

Attendu : `.env.cosmo-cli` **absent** de la sortie.

---

## Tâche 11 : Documentation

**Files:**
- Create: `docs/COSMO-CLI.md`
- Modify: `CLAUDE.md` (tableau « Documentation détaillée »)

- [ ] **Étape 1 : Écrire le mode d'emploi**

```markdown
# CLI COSMO — accès agent aux données personnelles

Permet à Claude Code de lire tes tâches / habitudes / agenda / OKR et d'écrire
un sous-ensemble limité, depuis ce dépôt, sur ce PC.

## Mise en route

1. `.env.cosmo-cli` à la racine (gitignoré) :

   ```
   COSMO_SUPABASE_URL=https://ykeugqfgklejcdbrmawy.supabase.co
   COSMO_SUPABASE_ANON_KEY=<cle publishable>
   ```

2. Se connecter — **à faire toi-même**, Claude ne lance jamais cette commande :

   ```bash
   npm run cosmo:login
   ```

   Compte Google-only : un code arrive par email, tu le colles. La session est
   stockée dans `~/.cosmo/session.json` (hors du dépôt) et se rafraîchit seule.

## Commandes

| Commande | Effet |
|---|---|
| `npm run cosmo -- tasks list` | Tâches non terminées |
| `npm run cosmo -- tasks list --all` | Toutes les tâches |
| `npm run cosmo -- tasks add "<nom>" --category Perso` | Crée une tâche |
| `npm run cosmo -- tasks done <id>` | Coche une tâche |
| `npm run cosmo -- habits today` | Habitudes et état du jour |
| `npm run cosmo -- habits done <id>` | Marque une habitude faite (idempotent) |
| `npm run cosmo -- agenda --days 7` | Événements à venir |
| `npm run cosmo -- okr` | OKR (lecture seule) |

`--json` sur toute commande, `--dry-run` sur toute écriture.

## Ce que le CLI ne fait pas, volontairement

- **Aucune suppression.** Créer et cocher sont réversibles, supprimer non.
- **Aucune écriture OKR.** Faire progresser un KR impose une insertion atomique
  dans le journal `kr_completions` ; dupliquer cette logique ici casserait
  silencieusement le graphique du dashboard.
- **Aucun accès `service_role`.** Le CLI utilise la clé publishable et ta
  session : la RLS fait le filtrage, exactement comme dans le navigateur.

## Sécurité

- `~/.cosmo/session.json` contient des jetons d'accès. Hors du dépôt, jamais committé.
- `.env.cosmo-cli` est dans `.gitignore`. Vérifier `git status` avant tout commit.
- Le CLI ne demande jamais de mot de passe et ne stocke aucun mot de passe.
```

- [ ] **Étape 2 : Référencer la doc dans CLAUDE.md**

Dans le tableau « Documentation détaillée », ajouter une ligne :

```markdown
| [`docs/COSMO-CLI.md`](../../../COSMO-CLI.md) | Accès agent aux données COSMO réelles (lecture tâches/habitudes/agenda/OKR, écriture limitée) |
```

- [ ] **Étape 3 : Commit et push**

```bash
git add docs/COSMO-CLI.md CLAUDE.md
git commit -m "docs(cosmo-cli): mode d emploi du CLI agent"
git push origin main
```

---

## Récapitulatif des garde-fous

À vérifier avant de déclarer le travail terminé :

- [ ] Aucune utilisation de `VITE_SUPABASE_SERVICE_ROLE_KEY` ni de `service_role`
- [ ] `.env.cosmo-cli` gitignoré et absent de `git status`
- [ ] Le `.env` racine n'a pas été modifié (`VITE_SUPABASE_URL` toujours vide)
- [ ] `user_id` n'est jamais envoyé dans un insert de tâche
- [ ] Les habitudes passent par la RPC `toggle_habit_completion`, jamais par un UPDATE direct
- [ ] `listUpcomingEvents` filtre sur `user_id`
- [ ] Aucune écriture sur `okrs` / `key_results` / `kr_completions`
- [ ] Aucune commande de suppression
- [ ] Aucun `toast` (règle du projet : jamais hors UI)
- [ ] Dates produites via `toLocaleDateString('en-CA')`, jamais `toISOString().slice(0,10)`
