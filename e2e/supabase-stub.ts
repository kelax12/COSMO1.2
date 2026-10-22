import type { Locator, Page, Route, Request as PWRequest } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Jouer un parcours HORS mode demo, sans aucun vrai Supabase
 * ═══════════════════════════════════════════════════════════════════
 *
 * POURQUOI CE MODULE EXISTE.
 *
 * Toute la suite E2E passe par `e2e/fixtures.ts`, qui ouvre le mode demo. Or
 * une part du produit a une garde qui commence par `!isDemo` — `FirstRunSetup`
 * en tete — et cette part etait donc STRUCTURELLEMENT hors de portee de la
 * suite, pas simplement oubliee. C'est la raison pour laquelle C-27 pouvait
 * constater « 25 tests unitaires, zero parcours » : le parcours n'etait pas
 * atteignable avec l'outillage existant.
 *
 * Le mode Vite `e2e-stub` (`.env.e2e-stub`) donne a l'app deux variables
 * Supabase NON VIDES, donc `appModeStore` demarre en mode production. L'hote
 * pointe est INEXISTANT (`stub.cosmo.invalid`) et ce module intercepte tout ce
 * qui part vers lui.
 *
 * 🔴 CE QUE CE HARNAIS PROUVE, ET CE QU'IL NE PROUVE PAS.
 *
 * Il prouve le PARCOURS CLIENT : quel ecran s'affiche, dans quel ordre, et
 * quelles ecritures partent avec quel corps. Il ne prouve RIEN du serveur — ni
 * la RLS, ni les triggers, ni la forme reelle des reponses PostgREST. Ces
 * frontieres-la se prouvent ailleurs (`npm run test:rls`, `npm run check:rls`),
 * et un test ecrit ici ne doit jamais etre presente comme une preuve
 * d'isolation.
 *
 * ⚠️ Le stub est GENERIQUE, jamais complaisant : il repond une liste VIDE a
 * toute lecture non decrite. Une requete inattendue ne rend donc jamais une
 * donnee inventee qui ferait passer un test pour la mauvaise raison.
 */

/** Hote declare par `.env.e2e-stub`. Doit rester non resolvable. */
export const STUB_HOST = 'stub.cosmo.invalid';
/** `sb-${hostname.split('.')[0]}-auth-token` — derivation de supabase-js. */
const STORAGE_KEY = 'sb-stub-auth-token';

export const STUB_USER_ID = '00000000-0000-4000-8000-0000000000e2';
export const STUB_EMAIL = 'e2e-stub@cosmo.invalid';

/** JWT non signe : rien ne le verifie ici, mais auth-js le DECODE. */
function fakeJwt(expiresAt: number): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({
      sub: STUB_USER_ID,
      email: STUB_EMAIL,
      role: 'authenticated',
      aud: 'authenticated',
      aal: 'aal1',
      exp: expiresAt,
      iat: Math.floor(Date.now() / 1000),
    }),
    'e2e-stub-signature',
  ].join('.');
}

/** Une ecriture captee : de quoi assurer sur la table ET sur le corps. */
export interface CapturedWrite {
  method: string;
  /** Segment PostgREST vise : `tasks`, `habits`, `rpc/get_my_tasks`… */
  path: string;
  body: unknown;
}

/** Un appel d'Edge Function capte : de quoi assurer sur le corps ET l'entete. */
export interface CapturedFunctionCall {
  /** Nom de la fonction : `stripe-org-refund`, `stripe-org-checkout`... */
  name: string;
  body: unknown;
  /** Vrai si un `Authorization: Bearer ...` accompagnait l'appel. */
  authorized: boolean;
}

export interface SupabaseStub {
  /**
   * URLs parties vers un hote Supabase qui N'EST PAS le stub.
   *
   * 🔴 Doit toujours rester vide. Une entree ici signifie que l'app a boote
   * avec une vraie `VITE_SUPABASE_URL` — donc que ces tests parlaient a un
   * projet reel avec une session forgee. Le cas est rendu impossible par la
   * surcharge `env` du webServer (`playwright.config.ts`), et cette liste est
   * le TEMOIN qui le dit si jamais elle sautait.
   */
  foreignSupabaseCalls: string[];
  /** Toutes les ecritures (POST/PATCH/DELETE) parties vers le stub, en ordre. */
  writes: CapturedWrite[];
  /**
   * Les appels d'Edge Function partis vers le stub, en ordre.
   *
   * 🔴 C'est le SEUL detecteur de rejeu dont dispose un parcours de
   * remboursement : la borne qui empeche de rembourser deux fois vit dans
   * Stripe et dans la fonction, donc hors de portee d'ici. Ce qu'on peut
   * mesurer, c'est qu'un clic ne fait partir QU'UN appel.
   */
  functionCalls: CapturedFunctionCall[];
  /** Ecritures sur une table donnee. */
  writesTo(table: string): CapturedWrite[];
  /** Force la reponse d'un chemin precis (`rpc/get_my_tasks`, `tasks`…). */
  reply(path: string, body: unknown, status?: number): void;
}

/**
 * Installe la session et l'interception. A appeler AVANT le premier `goto`.
 */
export async function installSupabaseStub(page: Page): Promise<SupabaseStub> {
  const writes: CapturedWrite[] = [];
  const functionCalls: CapturedFunctionCall[] = [];
  const canned = new Map<string, { body: unknown; status: number }>();

  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: fakeJwt(expiresAt),
    refresh_token: 'e2e-stub-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: STUB_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: STUB_EMAIL,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { name: 'Compte E2E' },
      identities: [],
      factors: [],
    },
  };

  // `addInitScript` s'execute avant tout script de la page, donc avant que
  // AuthContext appelle `getSession()`. Poser la session apres un `goto`
  // arriverait trop tard : l'app aurait deja decide qu'elle n'a personne.
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key as string, value as string);
        // Meme neutralisation que la fixture demo : la banniere cookies est
        // ancree en bas sur toute la largeur en mobile et intercepte les clics.
        localStorage.setItem('cosmo_cookie_consent', 'refused');
      } catch {
        /* mode prive : le test echouera plus loin, avec un message parlant */
      }
    },
    [STORAGE_KEY, JSON.stringify(session)],
  );

  const handle = async (route: Route, request: PWRequest) => {
    const url = new URL(request.url());
    // `/rest/v1/tasks` → `tasks` ; `/rest/v1/rpc/get_my_tasks` → `rpc/get_my_tasks`
    const path = url.pathname.replace(/^\/rest\/v1\//, '').replace(/^\/+|\/+$/g, '');
    const method = request.method();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(request) });
      return;
    }

    // ─── Edge Functions ────────────────────────────────────────────
    //
    // `supabase.functions.invoke` ne passe pas par `/rest/v1/` : son chemin est
    // `/functions/v1/<nom>`. Sans cette branche, un appel a `stripe-org-refund`
    // tombait dans le repli generique et repondait `[]` — donc un parcours de
    // remboursement aurait mesure « le serveur n'a rien rendu » sans jamais
    // savoir si la requete etait meme partie.
    if (url.pathname.startsWith('/functions/v1/')) {
      let fnBody: unknown = null;
      try {
        fnBody = request.postDataJSON();
      } catch {
        fnBody = request.postData();
      }
      functionCalls.push({
        name: url.pathname.replace('/functions/v1/', ''),
        body: fnBody,
        authorized: /^Bearer .+/.test(request.headers()['authorization'] ?? ''),
      });
      const cannedFn = canned.get(path);
      // Pas de repli complaisant : une fonction non decrite repond une ERREUR,
      // pas un succes vide. Un `{}` ferait lire `refundedCents = 0` a l'ecran,
      // donc « rien a rembourser » — un stub qui fabrique un resultat plausible.
      await fulfillJson(
        route,
        request,
        cannedFn?.body ?? { error: 'stub_function_not_declared' },
        cannedFn?.status ?? 500,
      );
      return;
    }

    let posted: unknown = null;
    if (method !== 'GET' && url.pathname.startsWith('/rest/v1/')) {
      try {
        posted = request.postDataJSON();
      } catch {
        posted = request.postData();
      }
      writes.push({ method, path, body: posted });
    }

    const forced = canned.get(path);
    if (forced) {
      await fulfillJson(route, request, forced.body, forced.status);
      return;
    }

    // Auth : la session vit deja dans localStorage, aucune de ces routes n'est
    // sur le chemin nominal. On repond quand meme, pour qu'un rafraichissement
    // opportuniste n'affiche pas une erreur qui n'en est pas une.
    if (url.pathname.startsWith('/auth/v1/')) {
      await fulfillJson(route, request, url.pathname.endsWith('/user') ? session.user : session);
      return;
    }

    // PostgREST : `.single()` demande un OBJET, tout le reste un TABLEAU.
    // Sur une ecriture, on renvoie la ligne postee augmentee des colonnes que
    // Postgres remplit lui-meme — c'est ce dont les mappers ont besoin pour
    // que la mutation aboutisse au lieu d'afficher une erreur qui n'en est pas.
    //
    // 🔴 L'echo ne s'applique JAMAIS a `rpc/…`. Une RPC est un POST elle aussi,
    // et `get_my_tasks` part avec un corps `{}` : l'echouer aurait rendu UNE
    // ligne bidon, donc « ce compte a une tache », donc `shouldOfferFirstRun`
    // faux — un stub qui fabrique la donnee que le test cherche a mesurer.
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object+json');
    const row =
      method === 'POST' && posted && !path.startsWith('rpc/')
        ? { ...(Array.isArray(posted) ? posted[0] : posted), ...synthesizedColumns() }
        : null;

    if (wantsObject) {
      await fulfillJson(route, request, row ?? {});
      return;
    }
    await fulfillJson(route, request, row ? [row] : []);
  };

  await page.route(`https://${STUB_HOST}/**`, handle);

  // Filet : tout ce qui ressemble a un vrai projet Supabase est COUPE, et
  // trace. On n'abandonne pas silencieusement — un test qui echoue sur une
  // requete avortee est infiniment preferable a un test qui reussit en ayant
  // ecrit dans une base reelle.
  const foreignSupabaseCalls: string[] = [];
  await page.route(/^https:\/\/[^/]*supabase\.(co|in|net)\//, async (route, request) => {
    foreignSupabaseCalls.push(request.url());
    await route.abort('blockedbyclient');
  });

  return {
    foreignSupabaseCalls,
    writes,
    functionCalls,
    writesTo: (table: string) => writes.filter((w) => w.path === table),
    reply: (path, body, status = 200) => canned.set(path, { body, status }),
  };
}

/**
 * Ouvrir une URL sur le serveur du mode `e2e-stub`, et attendre que l'app soit
 * REELLEMENT peinte.
 *
 * 🔴 TROIS PIEGES, tous mesures le 2026-09-08, aucun evitable en ecrivant
 * simplement `page.goto(url)` :
 *
 *  1. `load` n'arrive JAMAIS : le canal Realtime rouvre en boucle un WebSocket
 *     vers un hote qui ne resout pas.
 *  2. `domcontentloaded` non plus, au premier passage : Vite decouvre les
 *     dependances de la page, les pre-empaquette et recharge, et l'evenement se
 *     perd dans ce rechargement. Mesure : `goto` expirait a 240 s sur une page
 *     qui finissait par s'afficher. D'ou `commit`, qui rend la main des la
 *     reponse — c'est ensuite l'ancre qui dit que la vue est la.
 *  3. Une re-optimisation qui tombe PENDANT le chargement fait echouer un
 *     `import()` de route (« Failed to fetch dynamically imported module ») :
 *     l'`AppErrorBoundary` prend la main et la page reste vide, definitivement.
 *     Un rechargement suffit — mais UN SEUL, borne, jamais une boucle qui
 *     finirait par masquer une vraie panne du produit.
 *
 * ⚠️ Ces trois-la sont des artefacts du SERVEUR DE DEVELOPPEMENT, pas des
 * comportements du produit. Les absorber ici, une fois, vaut mieux que de les
 * recopier dans chaque spec — c'est ce qui avait laisse `first-run` rouge au
 * premier lancement a cache vide pendant que `refund` passait.
 */
export async function gotoStubbed(
  page: Page,
  url: string,
  shell: Locator,
  attempts = 3,
): Promise<void> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Le `timeout` explicite compte : sans lui, une navigation que Vite
      // recommence indefiniment consomme le budget du test ENTIER, et on n'a
      // jamais l'occasion de reessayer.
      await page.goto(url, { waitUntil: 'commit', timeout: 90_000 });
      await shell.first().waitFor({ state: 'visible', timeout: 90_000 });
      return;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

/** Colonnes que Postgres remplit lui-meme et que les mappers relisent. */
function synthesizedColumns() {
  const now = new Date().toISOString();
  return {
    id: `stub-${Math.random().toString(36).slice(2, 10)}`,
    created_at: now,
    updated_at: now,
  };
}

function corsHeaders(request: PWRequest): Record<string, string> {
  return {
    'access-control-allow-origin': new URL(request.frame().url()).origin,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
  };
}

async function fulfillJson(route: Route, request: PWRequest, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { ...corsHeaders(request), 'content-range': '0-0/*' },
    body: JSON.stringify(body),
  });
}
