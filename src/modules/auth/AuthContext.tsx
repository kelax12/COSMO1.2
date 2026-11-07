import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { resetRepositories } from '@/lib/repository.factory';
import { appModeStore, useIsDemo } from '@/lib/app-mode.store';
import { sanitizeEmail, isValidEmail } from '@/lib/email';
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
import { toast } from '@/lib/toast';
import { translator } from '@/i18n/useT';
import { localeStore } from '@/i18n/store';
import { DEFAULT_LOCALE } from '@/i18n/locale';
import { postAuthRoute } from '@/lib/safe-redirect';
import {
  recordOAuthRedirectIntent,
  clearOAuthRedirectIntent,
} from './oauth-landing';
// Les deux sondes qui lisent le retour OAuth dans l'URL : un échec OAuth est
// silencieux par défaut, et ce sont elles qui le rendent visible.
import { consumeOAuthErrorFromUrl, checkOAuthLanding } from './oauth-url-probes';
// ARC-03 (V12.4) : ce fichier ne tient plus que l'authentification (session,
// OAuth, inscription, démo comme backend). Le reste s'abonne aux événements
// de session qu'il émet, une unité par fichier.
import { dlog } from './auth-debug';
import { createAuthEvents } from './auth-events';
import { useLastSeen } from './use-last-seen';
import { useAttribution, signupAttributionMetadata } from './use-attribution';
import { useOfflineCache } from './use-offline-cache';
import { useSessionPreload } from './use-session-preload';
import { startLoadingWatchdog } from './loading-watchdog';
import { restorePersistedDemoBackend, enterDemoBackend, exitDemoBackend } from './demo-session';

// User type — identity fields only.
// Premium/financial state (plan, status, période Stripe) lives exclusively in the
// Supabase `subscriptions` table and is consumed via useBilling().
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Map a Supabase session user to our App user type.
// We deliberately read ONLY identity fields. Premium/authorization state must
// come from the `subscriptions` table via useBilling(), never from user_metadata
// (which is user-writable from the client and trivially spoofable). Faille N5/N6.
const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): User => ({
  id: supabaseUser.id,
  name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || translator('common').t('auth.defaultUserName'),
  email: supabaseUser.email || '',
  avatar: supabaseUser.user_metadata?.avatar_url,
  provider: supabaseUser.app_metadata?.provider,
});

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

  // Événements de session, propres à CETTE instance du provider (auth-events.ts).
  const [events] = useState(createAuthEvents);

  // 🔴 UNITÉS ABONNÉES AUX ÉVÉNEMENTS DE SESSION. L'ORDRE DES APPELS EST
  // L'ORDRE D'EXÉCUTION, et c'est un contrat (AuthContext.sequence.test.tsx) :
  //   · sessionOpened   : last_seen, puis acquisition, puis affiliation ;
  //   · dataScopeOpened : cache hors ligne pré-rempli, PUIS préchargement ;
  //   · signedOut       : last_seen remis à zéro, puis purge du cache.
  // Chacune s'abonne dans son effet, déclaré avant l'effet de session
  // ci-dessous : React les monte d'abord, aucun événement n'est perdu.
  useLastSeen(events);
  useAttribution(events);
  useOfflineCache(events, queryClient);
  useSessionPreload(events, queryClient);

  useEffect(() => {
    // Session réelle connue : sonde OAuth, utilisateur posé, puis annonce.
    // `checkOAuthLanding` consomme l'intention : les trois points d'appel
    // couvrent les trois ordres possibles (getSession, INITIAL_SESSION,
    // SIGNED_IN), le premier arrivé gagne, les suivants sont des no-op.
    const openSession = (sessionUser: SupabaseUser) => {
      checkOAuthLanding();
      setUser(mapSupabaseUserToAppUser(sessionUser));
      events.emit('sessionOpened', sessionUser);
    };

    const initializeAuth = async () => {
      dlog('initializeAuth: start');
      // F5 pendant une démo : backend démo restauré avec SES données
      // (demo-session.ts), seul un loginDemo() explicite réinitialise.
      if (restorePersistedDemoBackend(queryClient)) {
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
          openSession(session.user);
          dlog('initializeAuth: emitting dataScopeOpened');
          events.emit('dataScopeOpened', { userId: session.user.id, initial: true });
          dlog('initializeAuth: dataScopeOpened handled');
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

    // GARDE-FOU : sans résolution de session sous 12 s, on débloque l'écran
    // (loading-watchdog.ts). `isLoadingRef` est lu au moment où le délai expire.
    const stopWatchdog = startLoadingWatchdog(
      () => isLoadingRef.current,
      () => setIsLoading(false),
    );

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
          openSession(session.user);
          events.emit('dataScopeOpened', { userId: session.user.id, initial: true });
        }
        setIsLoading(false);
        return;
      }

      const userIdChanged = currentUserId !== lastUserId;

      if (userIdChanged) {
        // Le cache hors ligne de l'utilisateur sortant est effacé AVANT le
        // vidage ; celui de l'entrant est réchauffé APRÈS (use-offline-cache).
        if (lastUserId) events.emit('userLeaving', lastUserId);
        appModeStore.setDemo(!session && !isSupabaseConfigured);
        resetRepositories();
        queryClient.clear();
        lastUserId = currentUserId;
        if (currentUserId) events.emit('dataScopeOpened', { userId: currentUserId, initial: false });
      }

      if (session?.user) {
        openSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        // last_seen remis à zéro (re-login dans la même page), puis purge de
        // tout le cache hors ligne (L-11) : use-last-seen, use-offline-cache.
        events.emit('signedOut', undefined);
      }
      setIsLoading(false);
    });

    return () => {
      stopWatchdog();
      subscription.unsubscribe();
      // L'écrivain du cache hors ligne est libéré par sa propre unité.
    };
    // Abonnement auth monté une seule fois ; queryClient et les autres deps sont stables.
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    abonnement monte UNE FOIS pour la vie de l application : le remonter
       rejouerait la sequence de session. `queryClient` vient d un provider
       stable, `events` est cree une fois par `useState`, les autres valeurs
       lues sont des setters de state, stables par contrat React. */
  }, []);

  // Sort proprement du mode démo avant une authentification réelle
  // (demo-session.ts dit pourquoi la démo serait sinon « collante »).
  const exitDemoIfActive = () => {
    if (!appModeStore.isDemo) return;
    exitDemoBackend(queryClient);
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
    // Source first-touch et slug d'affilié, lus ici, avant l'appel réseau
    // (use-attribution.ts). Les triggers les re-valident (mig. 097, 236).
    const attribution = signupAttributionMetadata();
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
            ...attribution,
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
    // (existing callsites do not await this function). Séquence : demo-session.ts.
    enterDemoBackend(queryClient);
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
    // Clear the persisted query cache for this user before signing out
    // (use-offline-cache.ts, abonné à `userLeaving`).
    if (user && !appModeStore.isDemo) events.emit('userLeaving', user.id);

    // ALWAYS sign out from Supabase, regardless of whether we think we're in demo
    // mode. Without this, a stranded real Supabase session can survive a "logout"
    // and silently re-authenticate the user on next mount. Faille B2.
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — signOut on no session is a no-op
    }
    if (appModeStore.isDemo) exitDemoBackend(queryClient);
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
