import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { resetRepositories, clearDemoStorage, getTasksRepository, getHabitsRepository } from '@/lib/repository.factory';
import { appModeStore, useIsDemo, wasDemoPersisted } from '@/lib/app-mode.store';
import { taskKeys } from '@/modules/tasks/constants';
import { habitKeys } from '@/modules/habits/constants';
import { withTimeout } from '@/lib/withTimeout';
import { sanitizeEmail, isValidEmail } from '@/lib/email';
import { recordDemoVisit, recordDemoConversionIfAny } from '@/lib/demo-metrics';
import { readFirstTouch } from '@/lib/attribution';
import { recordSeedLocale, seedLocaleMatchesCurrent } from '@/lib/seed-i18n';
import {
  DEMO_SENTINEL_EMAIL,
  buildDemoUser,
  persistDemoProfile,
  type DemoProfilePatch,
} from './demo-profile';
import { authLoginGeneric, authRegisterGeneric, safeAuthError } from './auth-errors';
import { User as SupabaseUser } from '@supabase/supabase-js';
// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { toast } from 'sonner';
import { translator } from '@/i18n/useT';
import {
  readLocalCache,
  writeLocalCache,
  clearLocalCache,
  purgeAllLocalCache,
} from './session-cache';
import { localeStore } from '@/i18n/store';
import { DEFAULT_LOCALE } from '@/i18n/locale';
import { postAuthRoute } from '@/lib/safe-redirect';
import {
  recordOAuthRedirectIntent,
  clearOAuthRedirectIntent,
  reportOAuthLandingMismatch,
} from './oauth-landing';

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
const dlog = (msg: string) => {
  if (DEBUG) console.warn(`[AUTH] @${Math.round(performance.now())}ms ${msg}`);
};

// Dernière connexion — ping fire-and-forget de la RPC touch_last_seen()
// (migration 054, timestamp pris côté serveur). Dédupliqué par utilisateur et
// par chargement de page : Supabase refire SIGNED_IN à chaque refresh de token,
// on ne veut écrire qu'à l'ouverture de session, pas toutes les heures.
const lastSeenTouched = new Set<string>();
function touchLastSeen(userId: string): void {
  if (!isSupabaseConfigured || appModeStore.isDemo || lastSeenTouched.has(userId)) return;
  lastSeenTouched.add(userId);
  supabase.rpc('touch_last_seen').then(({ error }) => {
    if (error) dlog(`touchLastSeen: ${error.message}`);
  });
  // Même moment « session réelle ouverte » : si cet appareil a testé la démo,
  // on marque la conversion démo → compte (no-op sinon, cf. demo-metrics.ts).
  recordDemoConversionIfAny();
}

// User type — identity fields only.
// Premium/financial state (premiumTokens, subscriptionEndDate, win_streak, …) lives
// exclusively in the Supabase `subscriptions` table and is consumed via useBilling().
// `autoValidation` is a UI preference stored locally in demo mode (see user/hooks.ts).
export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  // Auth provider used to sign in ('email' | 'google' | …). Sourced from
  // Supabase `app_metadata.provider` (server-controlled, not spoofable). Used to
  // gate email editing: third-party (OAuth) accounts manage their email upstream.
  provider?: string;
  // Optional local-only preference (demo mode). Never sourced from user_metadata.
  autoValidation?: boolean;
};

// Type de compte choisi à l'inscription (mode entreprise). Simple flag UX —
// la frontière de sécurité reste organization_members + RLS. Le trigger DB
// handle_new_user_profile re-valide la valeur (jamais de confiance brute).
export type AccountType = 'personal' | 'business';

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  register: (name: string, email: string, password: string, accountType?: AccountType, captchaToken?: string) => Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }>;
  loginWithGoogle: (redirectPath?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  /**
   * Met à jour le profil de la session DÉMO uniquement. No-op hors démo — un
   * vrai compte passe par `supabase.auth.updateUser`, jamais par le client.
   */
  updateDemoProfile: (patch: DemoProfilePatch) => void;
};

/**
 * Le fournisseur OAuth renvoie ses echecs dans l'URL, pas dans une exception.
 *
 * Google redirige vers `/dashboard?error=access_denied&error_description=...`
 * (ou la meme chose dans le fragment, selon le flux). `detectSessionInUrl`
 * n'ouvre alors aucune session et ne signale rien : cote utilisateur, la
 * connexion « a marche » puis l'app est vide. On lit ces parametres au
 * demarrage pour en laisser une trace exploitable, puis on nettoie l'URL
 * (elle peut contenir un identifiant de tentative).
 *
 * Retourne la description lisible s'il y en a une.
 */
const consumeOAuthErrorFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = query.get('error') ?? hash.get('error');
    if (!code) return null;
    const description =
      query.get('error_description') ?? hash.get('error_description') ?? code;
    console.error('[auth] retour OAuth en erreur', code, description);
    monitoring.captureMessage(`OAuth callback error: ${code}`, {
      level: 'warning',
      tags: { context: 'oauth-callback' },
    });
    // Nettoie l'URL : sans ca, un rechargement rejoue l'erreur a l'infini.
    //
    // 🔴 On ne retire QUE les parametres d'erreur. Reecrire sur le seul
    // `pathname` jetait la query string entiere, `?redirect=` compris : un
    // echec OAuth transitoire faisait perdre la destination d'une invitation
    // d'entreprise, donc le jeton a usage unique qu'elle portait (garde R-04).
    for (const key of ['error', 'error_code', 'error_description']) query.delete(key);
    const remaining = query.toString();
    const clean = `${window.location.pathname}${remaining ? `?${remaining}` : ''}`;
    window.history.replaceState(null, '', clean);
    return description;
  } catch {
    return null;
  }
};

/**
 * Sonde C-45 : appelée au moment où une session s'ouvre réellement.
 *
 * Une intention de redirection n'existe que si `loginWithGoogle` vient de
 * partir chez Google depuis cet onglet. Si une session s'ouvre alors que
 * l'URL courante n'est pas celle qu'on avait demandée, c'est que GoTrue a
 * substitué le Site URL, donc que la « Redirect URL allow list » du projet
 * ne couvre pas la destination. On le dit à l'exploitant (console + Sentry)
 * ET à l'utilisateur, dont l'invitation vient de se perdre.
 */
const checkOAuthLanding = (): void => {
  if (typeof window === 'undefined') return;
  const mismatch = reportOAuthLandingMismatch(window.location.href);
  if (!mismatch) return;
  // Toast différé : Sonner est monté par App, sous ce provider.
  setTimeout(() => {
    toast.error(translator('common').t('auth.oauthRedirectLostTitle'), {
      description: translator('common').t('auth.oauthRedirectLostBody'),
    });
  }, 0);
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Miroir de `isLoading` lisible depuis un timer : le watchdog doit savoir si
  // la session était ENCORE non résolue au moment où il tire, sans faire de ce
  // constat un effet de bord glissé dans un updater de `setState`.
  const isLoadingRef = useRef(true);
  isLoadingRef.current = isLoading;

  // Source de vérité unique : appModeStore (faille B0 — l'ancien check sur l'email
  // était contournable en s'inscrivant avec demo@cosmo.app via supabase.auth.signUp).
  const isDemo = useIsDemo();
  const isAuthenticated = !!user;

  // Observabilité : corrèle les erreurs/transactions Sentry à l'utilisateur.
  // Id uniquement — pas d'email ni de PII (cohérent avec sendDefaultPii:false).
  useEffect(() => {
    monitoring.setUser(user ? { id: user.id } : null);
  }, [user]);

  // Map a Supabase session user to our App user type.
  // We deliberately read ONLY identity fields. Premium/authorization state must
  // come from the `subscriptions` table via useBilling() — never from user_metadata
  // (which is user-writable from the client and trivially spoofable). Faille N5/N6.
  const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || translator('common').t('auth.defaultUserName'),
    email: supabaseUser.email || '',
    avatar: supabaseUser.user_metadata?.avatar_url,
    provider: supabaseUser.app_metadata?.provider,
  });

  useEffect(() => {
    // Unsubscribe fn for the queryCache write-back listener.
    let cacheWriteUnsub: (() => void) | undefined;

    // Registers a queryCache subscriber that persists tasks/habits to localStorage
    // whenever a successful fetch completes. Called once per authenticated user.
    const setupCacheWriter = (userId: string) => {
      cacheWriteUnsub?.();
      const taskKeyStr = JSON.stringify(taskKeys.lists());
      const habitKeyStr = JSON.stringify(habitKeys.lists());
      cacheWriteUnsub = queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated') return;
        const action = event.action as { type: string };
        if (action.type !== 'success') return;
        const qk = JSON.stringify(event.query.queryKey);
        if (qk === taskKeyStr) {
          writeLocalCache(userId, 'tasks', event.query.state.data);
        } else if (qk === habitKeyStr) {
          writeLocalCache(userId, 'habits', event.query.state.data);
        }
      });
    };

    // Pre-populates the React Query cache from localStorage so the page renders
    // instantly with stale data, then fires a background refetch.
    const restoreAndRefresh = (userId: string, alreadySetupWriter: boolean) => {
      const cachedTasks = readLocalCache(userId, 'tasks');
      if (cachedTasks) queryClient.setQueryData(taskKeys.lists(), cachedTasks);
      dlog(`restoreAndRefresh: tasks cache hit=${!!cachedTasks}`);

      const cachedHabits = readLocalCache(userId, 'habits');
      if (cachedHabits) queryClient.setQueryData(habitKeys.lists(), cachedHabits);
      dlog(`restoreAndRefresh: habits cache hit=${!!cachedHabits}`);

      if (!alreadySetupWriter) setupCacheWriter(userId);

      // staleTime:0 forces a background refresh even though setQueryData just
      // stamped the data as "fresh". User sees stale data immediately, then
      // the fresh payload arrives silently in ~400–700 ms.
      dlog('restoreAndRefresh: prefetchQuery(tasks) START');
      const tTasks = performance.now();
      queryClient.prefetchQuery({
        queryKey: taskKeys.lists(),
        queryFn: () => withTimeout(getTasksRepository().getAll(), 10_000),
        staleTime: 0,
      }).then(() => dlog(`restoreAndRefresh: prefetchQuery(tasks) DONE in ${Math.round(performance.now() - tTasks)}ms`))
        .catch((err) => dlog(`restoreAndRefresh: prefetchQuery(tasks) FAIL — ${(err as Error).message}`));

      dlog('restoreAndRefresh: prefetchQuery(habits) START');
      const tHabits = performance.now();
      queryClient.prefetchQuery({
        queryKey: habitKeys.lists(),
        queryFn: () => withTimeout(getHabitsRepository().fetchHabits(), 10_000),
        staleTime: 0,
      }).then(() => dlog(`restoreAndRefresh: prefetchQuery(habits) DONE in ${Math.round(performance.now() - tHabits)}ms`))
        .catch((err) => dlog(`restoreAndRefresh: prefetchQuery(habits) FAIL — ${(err as Error).message}`));
    };

    const initializeAuth = async () => {
      dlog('initializeAuth: start');
      // Session démo persistée (flag cosmo_demo_active) : un F5 pendant une
      // démo restaure l'utilisateur démo avec SES données (pas de
      // clearDemoStorage ici — seul un loginDemo() explicite réinitialise).
      if (wasDemoPersisted()) {
        dlog('initializeAuth: restoring persisted demo session');
        // Langue changée depuis le seed (bascule FR↔EN, ou arrivée sur `/en`
        // après avoir lancé la démo depuis `/`) : les données en place sont
        // dans l'ancienne langue et ne se retraduisent pas — elles sont
        // modifiables, donc relues telles quelles. On les régénère, sinon
        // l'interface et le contenu parlent deux langues différentes.
        if (!seedLocaleMatchesCurrent()) {
          dlog('initializeAuth: demo seed locale stale — reseeding');
          clearDemoStorage(); // efface aussi cosmo_demo_active…
          appModeStore.setDemo(true); // …que ce setter réécrit aussitôt.
          resetRepositories();
          queryClient.clear();
          recordSeedLocale();
        }
        appModeStore.setDemo(true);
        setUser(buildDemoUser());
        setIsLoading(false);
        return;
      }
      try {
        dlog('initializeAuth: calling getSession()');
        let session;
        try {
          ({ data: { session } } = await supabase.auth.getSession());
        } catch (err) {
          // Erreur transitoire (réseau, cold start) — un seul retry avant
          // d'abandonner, pour éviter de traiter un raté ponctuel comme une
          // déconnexion et d'envoyer l'utilisateur sur la landing page.
          dlog(`initializeAuth: getSession() failed, retrying once — ${(err as Error)?.message}`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          ({ data: { session } } = await supabase.auth.getSession());
        }
        dlog(`initializeAuth: getSession() resolved — session=${!!session?.user}`);
        if (session?.user) {
          checkOAuthLanding();
          setUser(mapSupabaseUserToAppUser(session.user));
          touchLastSeen(session.user.id);
          dlog('initializeAuth: calling restoreAndRefresh()');
          restoreAndRefresh(session.user.id, !!cacheWriteUnsub);
          dlog('initializeAuth: restoreAndRefresh() returned');
        }
      } catch (err) {
        dlog(`initializeAuth: caught error after retry — ${(err as Error)?.message}`);
        monitoring.captureException(err, { tags: { context: 'auth-init-getSession-retry-failed' } });
      } finally {
        dlog('initializeAuth: setIsLoading(false) — done');
        setIsLoading(false);
      }
    };

    // Message d'erreur OAuth eventuel, lu AVANT initializeAuth : c'est lui
    // qui nettoie l'URL, et getSession() n'a de toute facon rien a en tirer.
    const oauthError = consumeOAuthErrorFromUrl();
    if (oauthError) {
      // Toast differe : Sonner est monte par App, sous ce provider.
      setTimeout(() => {
        toast.error(translator('common').t('auth.oauthFailed'), { description: oauthError });
      }, 0);
    }

    initializeAuth();

    // GARDE-FOU — `ProtectedRoute` ne rend RIEN tant que `isLoading` est vrai,
    // et `RootRoute` non plus. Si la resolution de session ne se termine
    // jamais (socket morte sur mobile Safari, echange PKCE bloque, onglet
    // reveille apres un long arriere-plan), l'utilisateur reste devant un
    // ecran vide — noir ou blanc selon son theme — sans le moindre bouton,
    // deconnexion comprise.
    //
    // Au-dela de ce delai on tranche : pas de session resolue = non
    // authentifie. L'utilisateur retombe sur la landing, d'ou il peut se
    // reconnecter. Un `onAuthStateChange` tardif corrigera le tir tout seul.
    const loadingWatchdog = window.setTimeout(() => {
      // Les effets de bord (log, Sentry) sont HORS de l'updater : React peut
      // rejouer un updater de `setState` — c'est explicitement autorisé, et il
      // le fait en StrictMode — ce qui dédoublait l'événement Sentry. Un
      // updater doit rester une fonction pure de l'état précédent, et il ne
      // s'exécute d'ailleurs PAS au moment de l'appel : lire son argument pour
      // décider ici n'aurait rien décidé du tout. D'où le ref.
      const fired = isLoadingRef.current;
      setIsLoading(false);
      if (fired) {
        dlog('watchdog: session non resolue apres 12 s — on debloque l UI');
        monitoring.captureMessage('auth: isLoading watchdog fired', {
          level: 'warning',
          tags: { context: 'auth-watchdog' },
        });
      }
    }, 12_000);

    // Track the previous user id so we only blow away the cache when the
    // user identity actually changes. Supabase JS fires SIGNED_IN on token
    // refresh too (not just on real sign-ins) — clearing the cache on every
    // such event aborts in-flight queries and leaves pages stuck on their
    // loading skeleton, especially on mobile Safari where refresh / focus
    // events fire more often.
    let lastUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      dlog(`onAuthStateChange: ${event} — session=${!!session?.user}`);
      // Demo mode is sticky once entered. Without this guard, a token-refresh event
      // racing with loginDemo() would snap the user out of demo and start hitting
      // Supabase repositories mid-session (faille B7).
      if (appModeStore.isDemo) return;

      const currentUserId = session?.user?.id ?? null;

      // INITIAL_SESSION fires once on subscribe with the restored session. There
      // are no stale cache entries from a previous user at this point — clearing
      // the cache here aborts the very first useTasks/useHabits query that the
      // page already mounted, making /tasks and /habits load "1 in 4" on mobile.
      // Also restore the localStorage cache here because INITIAL_SESSION may fire
      // before initializeAuth()'s getSession() resolves — whichever runs first
      // wins; the second call is idempotent (setQueryData is a no-op if data
      // already matches, prefetchQuery deduplicates in-flight requests).
      if (event === 'INITIAL_SESSION') {
        lastUserId = currentUserId;
        if (session?.user) {
          checkOAuthLanding();
          setUser(mapSupabaseUserToAppUser(session.user));
          touchLastSeen(session.user.id);
          restoreAndRefresh(session.user.id, !!cacheWriteUnsub);
        }
        setIsLoading(false);
        return;
      }

      const userIdChanged = currentUserId !== lastUserId;

      if (userIdChanged) {
        if (lastUserId) clearLocalCache(lastUserId);
        appModeStore.setDemo(!session && !isSupabaseConfigured);
        resetRepositories();
        queryClient.clear();
        lastUserId = currentUserId;
        if (currentUserId) restoreAndRefresh(currentUserId, false);
      }

      if (session?.user) {
        // `checkOAuthLanding` consomme l'intention : les trois points d'appel
        // couvrent les trois ordres possibles (getSession, INITIAL_SESSION,
        // SIGNED_IN), le premier arrivé gagne, les suivants sont des no-op.
        checkOAuthLanding();
        setUser(mapSupabaseUserToAppUser(session.user));
        touchLastSeen(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        // Un re-login dans le même chargement de page doit re-pinger last_seen_at.
        lastSeenTouched.clear();
        // L-11 — purge every cached cosmo:qcache:* entry, not only the user
        // we just signed out. Defense for shared devices.
        purgeAllLocalCache();
      }
      setIsLoading(false);
    });

    return () => {
      window.clearTimeout(loadingWatchdog);
      subscription.unsubscribe();
      cacheWriteUnsub?.();
    };
    // Abonnement auth monté une seule fois ; queryClient et les autres deps sont stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sort proprement du mode démo avant une authentification réelle. Sans ça,
  // le flag démo persistant (cosmo_demo_active) rendrait la démo « collante » :
  // onAuthStateChange ignore les événements tant que isDemo est vrai, et un
  // reload restaurerait la démo par-dessus la vraie session.
  const exitDemoIfActive = () => {
    if (!appModeStore.isDemo) return;
    clearDemoStorage();
    appModeStore.setDemo(false);
    resetRepositories();
    queryClient.clear();
  };

  const login = async (email: string, password: string, captchaToken?: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: translator('common').t('auth.supabaseMissing') };
    }
    exitDemoIfActive();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (error) return { success: false, error: safeAuthError(error, authLoginGeneric()) };
      return { success: true };
    } catch {
      return { success: false, error: translator('common').t('auth.genericError') };
    }
  };

  const register = async (name: string, email: string, password: string, accountType: AccountType = 'personal', captchaToken?: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: translator('common').t('auth.supabaseMissing') };
    }
    // Sanitize (strip copy-paste invisible chars) then enforce a real email
    // format BEFORE signUp. HTML5 `type=email` and Supabase both accept
    // malformed domains without a TLD (e.g. "user@stcom"); such accounts then
    // get stuck because the email-change flow rejects the invalid current
    // address. Validating at this chokepoint blocks the problem at the source.
    const cleanEmail = sanitizeEmail(email);
    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: translator('common').t('auth.invalidEmail') };
    }
    // Block the sentinel email at signup to prevent the email-based isDemo bypass
    // even on Supabase projects where email confirmation is disabled. Faille B0.
    if (cleanEmail.toLowerCase() === DEMO_SENTINEL_EMAIL) {
      return { success: false, error: translator('common').t('auth.reservedEmail') };
    }
    exitDemoIfActive();
    // Source d'acquisition first-touch (src/lib/attribution.ts). Déjà normalisée
    // et validée : le trigger la re-valide de son côté (mig. 097), la metadata
    // étant contrôlée par le client.
    const firstTouch = readFirstTouch();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          captchaToken,
          data: {
            name: name,
            // Lu par le trigger handle_new_user_profile (mig. 060) avec garde
            // stricte : toute valeur ≠ 'business' retombe en 'personal'.
            account_type: accountType === 'business' ? 'business' : 'personal',
            ...(firstTouch
              ? {
                  acquisition_source: firstTouch.source,
                  ...(firstTouch.campaign ? { acquisition_campaign: firstTouch.campaign } : {}),
                }
              : {}),
          },
        },
      });
      if (error) return { success: false, error: safeAuthError(error, authRegisterGeneric()) };
      return { success: true, needsEmailConfirmation: !data.session }; // pas de session = confirmation exigée
    } catch {
      return { success: false, error: translator('common').t('auth.genericError') };
    }
  };

  const loginDemo = (): void => {
    // Set demo state synchronously so callers can navigate immediately
    // (existing callsites do not await this function).
    clearDemoStorage();
    appModeStore.setDemo(true);
    resetRepositories();
    queryClient.clear();
    // Langue du seed qu'on vient d'invalider — relue au prochain démarrage
    // pour détecter un changement de langue (cf. initializeAuth).
    recordSeedLocale();
    // Compteur d'appareils distincts ayant testé la démo (fire-and-forget).
    recordDemoVisit();
    // `clearDemoStorage()` vient d'effacer `cosmo_demo_profile` : une nouvelle
    // démo repart d'un profil neuf, pas de celui du visiteur précédent.
    setUser(buildDemoUser());
    setIsLoading(false);
    // Sign out any real Supabase session in the background. Without this we'd
    // leave the device in a hybrid state where `appModeStore.isDemo === true`
    // but a valid Supabase refresh token still sits in localStorage — on next
    // load onAuthStateChange would silently revive the previous user (B2/B7).
    // We don't await: the onAuthStateChange handler is now guarded by
    // `if (appModeStore.isDemo) return;` so it cannot revert the local state.
    void supabase.auth.signOut().catch(() => {
      /* no-op — signing out without a session is harmless */
    });
  };

  /**
   * @param redirectPath Destination interne après retour de Google. À défaut,
   *   le `?redirect=` de l'URL courante — le départ OAuth se fait toujours
   *   depuis `/login` ou `/signup`, qui le portent déjà. Validée par
   *   `postAuthRoute` : une valeur forgée retombe sur `/dashboard`.
   */
  const loginWithGoogle = async (redirectPath?: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: translator('common').t('auth.supabaseMissing') };
    }
    exitDemoIfActive();
    try {
      // Deux choses que `${origin}/dashboard` perdait :
      //   1. le PRÉFIXE DE LOCALE — le `basename` du routeur porte `/en`, donc
      //      un anglophone revenait sur la version française du produit ;
      //   2. le `?redirect=` de la garde R-04 — une invitation d'entreprise
      //      réclamée via Google perdait sa destination, et son jeton à usage
      //      unique avec elle.
      // 🔴 CÔTÉ SUPABASE : la « Redirect URL allow list » du projet doit couvrir
      //    ces destinations, pas seulement `/dashboard`. Un motif large comme
      //    `https://thecosmo.app/**` suffit ; sans lui, GoTrue renvoie sur le
      //    Site URL par défaut et le retour d'invitation se reperd — vérifier
      //    ce réglage AVANT de déployer ce changement.
      const localePrefix = localeStore.locale === DEFAULT_LOCALE ? '' : `/${localeStore.locale}`;
      const requested =
        redirectPath ??
        (typeof window === 'undefined'
          ? null
          : new URLSearchParams(window.location.search).get('redirect'));
      const destination = postAuthRoute(requested);
      const redirectTo = `${window.location.origin}${localePrefix}${destination}`;
      // Sonde C-45 : on note où on a demandé à revenir. Au retour, si
      // l'atterrissage ne correspond pas, `checkOAuthLanding` le dit au lieu
      // de laisser la destination se perdre en silence (cf. oauth-landing.ts).
      recordOAuthRedirectIntent(redirectTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        // Départ avorté : l'intention n'a plus de retour à décrire, et la
        // laisser traîner ferait accuser la prochaine navigation.
        clearOAuthRedirectIntent();
        return { success: false, error: error.message || translator('common').t('auth.googleFailed') };
      }
      return { success: true };
    } catch (err) {
      clearOAuthRedirectIntent();
      const message = err instanceof Error ? err.message : translator('common').t('auth.genericError');
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    // Clear the persisted query cache for this user before signing out.
    if (user && !appModeStore.isDemo) clearLocalCache(user.id);

    // ALWAYS sign out from Supabase, regardless of whether we think we're in demo
    // mode. Without this, a stranded real Supabase session can survive a "logout"
    // and silently re-authenticate the user on next mount. Faille B2.
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — signOut on no session is a no-op
    }
    if (appModeStore.isDemo) {
      clearDemoStorage();
      appModeStore.setDemo(false);
      resetRepositories();
      queryClient.clear();
    }
    setUser(null);
  };

  // Mutation du profil DÉMO. Trois gardes, dans cet ordre :
  //   1. hors démo, no-op — un vrai profil ne se modifie pas côté client ;
  //   2. whitelist de champs — `id` n'est jamais modifiable, sinon la session
  //      démo pourrait usurper un identifiant utilisé comme clé des seeds ;
  //   3. persistance ET `setUser` — l'écran doit changer TOUT DE SUITE (c'est
  //      le bug corrigé) et survivre au rechargement (`buildDemoUser`).
  const updateDemoProfile = (patch: DemoProfilePatch): void => {
    if (!appModeStore.isDemo) return;
    const applied = persistDemoProfile(patch);
    if (!applied) return;
    // Persistance ET `setUser` : l'écran doit changer TOUT DE SUITE (c'est le
    // bug corrigé) et survivre au rechargement (`buildDemoUser`).
    setUser((prev) => (prev ? { ...prev, ...applied } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isDemo, isLoading, login, loginDemo, register, loginWithGoogle, logout, updateDemoProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
