import React, { Suspense, lazy } from 'react';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/modules/auth/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { installMobileFocusRecovery } from '@/lib/mobileFocus';
import { shouldRetryQuery } from '@/lib/query-retry';
import { useLocale } from '@/i18n/store';
import { routeSlug } from '@/i18n/routes';
// Extrait de ce fichier vers `@/lib/lazy-with-retry` pour que les onglets de
// /entreprise puissent s'en servir aussi. ⚠️ `lazy-namespaces.guard.test.ts`
// lit les appels `lazyWithRetry` D'ICI : les listes de catalogues ci-dessous
// restent la source de vérité par route.
import { lazyWithRetry } from '@/lib/lazy-with-retry';

import { getLastVisitedPage } from '@/modules/ui-states';
import { useSharedTasksRealtime } from '@/modules/tasks/useSharedTasksRealtime';
import { useOrgInboxRealtime } from '@/modules/organizations/useOrgInboxRealtime';
import { useFriendsInboxRealtime } from '@/modules/friends/useFriendsInboxRealtime';
// Import `/react` (pas `/next` — réservé aux apps Next.js) : ce projet est
// Vite + React Router, hébergé sur Vercel (cf. vercel.json).
import { Analytics } from '@vercel/analytics/react';
import { useCookieConsent } from '@/lib/use-cookie-consent';

// Providers
import { AuthProvider } from '@/modules/auth/AuthContext';
import { ActiveOrgProvider, useActiveOrganization } from '@/modules/organizations';
import { BillingProvider } from '@/modules/billing/billing.context';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import ProtectedRoute from '@/components/ProtectedRoute';
import CookieBanner from '@/components/CookieBanner';
import NewVersionBanner from '@/components/NewVersionBanner';
import ShareInviteClaimer from '@/components/ShareInviteClaimer';
// Audit perf 2026-05-29 — CommandPalette only renders on Ctrl/Cmd+K. Lazy-load
// it so its imports (framer-motion subset, lucide icons, fuzzy search) don't
// land in the entry chunk. Suspense fallback is null because the palette
// itself is invisible until opened.
const CommandPalette = lazy(() => import('@/components/CommandPalette'));

// Lazy load pages for code splitting.
//
// Le second argument est la liste des catalogues i18n du SOUS-ARBRE de la page.
// Régénérer après tout déplacement de composant : `npm run i18n:namespaces`.
const LandingPage = lazyWithRetry(() => import('@/pages/LandingPage'), ['landing', 'seo']);
const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'), ['seo']);
const SignupPage = lazyWithRetry(() => import('@/pages/SignupPage'), ['seo']);
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/ForgotPasswordPage'), ['seo']);
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/ResetPasswordPage'), ['seo']);
const DashboardPage = lazyWithRetry(() => import('@/pages/DashboardPage'), ['dashboard', 'eventModal', 'okr', 'org', 'taskModal', 'tasks']);
const TasksPage = lazyWithRetry(() => import('@/pages/TasksPage'), ['eventModal', 'org', 'taskModal', 'tasks', 'tutorials']);
const AgendaPage = lazyWithRetry(() => import('@/pages/AgendaPage'), ['agenda', 'eventModal', 'org', 'taskModal', 'tasks', 'tutorials']);
const HabitsPage = lazyWithRetry(() => import('@/pages/HabitsPage'), ['eventModal', 'habits', 'premium', 'tasks', 'tutorials']);
const OKRPage = lazyWithRetry(() => import('@/pages/OKRPage'), ['eventModal', 'okr', 'taskModal', 'tasks', 'tutorials']);
const StatisticsPage = lazyWithRetry(() => import('@/pages/StatisticsPage'), ['dashboard', 'premium', 'statistics']);
// `tasks` : DataTab (export CSV) et `csv-export.ts` importent le BARREL
// `@/modules/lists` pour `listKeys`, qui réexporte aussi `useDeleteListWithUndo`
// (`delete-flow.hooks.ts`), dont le toast d'annulation passe par
// `translator('tasks')`. Importer un seul nom d'un barrel charge tout son
// graphe : trouvé par `npm run i18n:namespaces -- --pages` le 2026-09-03.
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'), ['csv', 'org', 'settings', 'tasks']);
const PremiumPage = lazyWithRetry(() => import('@/pages/PremiumPage'), ['premium']);
const GuidePage = lazyWithRetry(() => import('@/pages/GuidePage'), ['guide', 'seo']);
const MentionsLegalesPage = lazyWithRetry(() => import('@/pages/MentionsLegalesPage'), ['legal', 'seo']);
const PolitiqueConfidentialitePage = lazyWithRetry(() => import('@/pages/PolitiqueConfidentialitePage'), ['legal', 'seo']);
const CGUPage = lazyWithRetry(() => import('@/pages/CGUPage'), ['legal', 'seo']);
// `tasks` : même mécanisme que `SettingsPage` ci-dessus, un cran plus loin —
// `usePreviewShareLink` (`@/modules/friends`) importe `listKeys` du barrel
// `@/modules/lists`, qui traîne `delete-flow.hooks.ts` et son
// `translator('tasks')`.
const InvitePage = lazyWithRetry(() => import('@/pages/InvitePage'), ['invite', 'tasks']);
const AdminPage = lazyWithRetry(() => import('@/pages/AdminPage'), ['admin']);
const OrganizationOnboardingPage = lazyWithRetry(() => import('@/pages/OrganizationOnboardingPage'), ['org']);
const OrganizationPage = lazyWithRetry(() => import('@/pages/OrganizationPage'), ['csv', 'eventModal', 'okr', 'org', 'tasks']);
const ClaimOrgInvitePage = lazyWithRetry(() => import('@/pages/ClaimOrgInvitePage'), ['org']);
const NotFoundPage = lazyWithRetry(() => import('@/pages/NotFoundPage'), ['seo']);
const BlogIndexPage = lazyWithRetry(() => import('@/pages/BlogIndexPage'), ['landing', 'seo']);
const BlogArticlePage = lazyWithRetry(() => import('@/pages/BlogArticlePage'), ['landing', 'seo']);
const AProposPage = lazyWithRetry(() => import('@/pages/AProposPage'), ['landing', 'seo']);
const UseCasePage = lazyWithRetry(() => import('@/pages/UseCasePage'), ['landing', 'seo']);

// Lazy load Layout. Il enveloppe TOUTES les routes protégées : son `org` est
// donc chargé une seule fois pour toute la session connectée, et les pages
// qu'il contient le retrouvent déjà en mémoire.
const Layout = lazyWithRetry(() => import('@/components/Layout'), ['org', 'tasks']);

// Query client config optimized
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      gcTime: 1000 * 60 * 30,      // 30 minutes
      // Prédicat extrait dans `@/lib/query-retry`, avec ses tests. Il vivait
      // ici, donc testable par rien, et il était doublement faux : il lisait
      // `error.message` alors que le code vit dans `.code`, sur des valeurs qui
      // n'étaient même pas des `Error`. Détail complet dans le module.
      retry: shouldRetryQuery,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 3000),
      refetchOnWindowFocus: false,
      // `networkMode: 'always'` runs queries regardless of `navigator.onLine`.
      // The default ('online') pauses queries when the browser thinks it's
      // offline — and `navigator.onLine` is notoriously unreliable on mobile
      // Safari (often falsely reports offline after a backgrounding event),
      // leaving every page stuck on its loading skeleton even though the
      // network is fine. Faille: TasksPage + HabitsPage stuck loading on iOS.
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

installMobileFocusRecovery(queryClient);

// Pendant le boot (auth en cours, chunks en vol), on n'affiche rien :
// le body garde son fond thémé, pas d'écran « Chargement... » plein écran.

// Page loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--color-accent-solid))]"></div>
  </div>
);

// Layout wrapper with Suspense
// AppErrorBoundary ICI aussi : le Layout est le parent de TOUTES les pages
// protegees et il est lazy. Sans boundary, un chunk perime ou un throw dans
// la barre laterale faisait remonter l erreur au-dessus des routes et vidait
// l ecran. Le fallback est le plein cadre par defaut (pas null) : c est une
// coquille de page, pas un widget secondaire.
const LayoutWithSuspense = () => (
  <AppErrorBoundary>
    <Suspense fallback={null}>
      <Layout />
    </Suspense>
  </AppErrorBoundary>
);

// Page wrapper with Suspense
const PageWithSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </AppErrorBoundary>
);

// Pages protégées éligibles à la réouverture « dernière page visitée » (#34).
const RESUMABLE_PAGES = ['/dashboard', '/tasks', '/agenda', '/habits', '/okr', '/statistics', '/settings', '/entreprise'];

/**
 * Squelette de la landing — le fallback qu'elle mérite.
 *
 * MESURÉ LE 2026-08-30, à 4x de bridage CPU : pendant ~2 s, `/` affichait un
 * écran BLANC avec un spinner, puis la landing sombre apparaissait d'un coup,
 * son animation d'entrée déjà terminée. Le fallback par défaut (`PageLoader`)
 * est un spinner sur le fond de l'APPLICATION, qui suit le thème et se trouve
 * donc être clair, alors que la landing est sombre par construction.
 *
 * Ce squelette ne cherche pas à faire patienter : il occupe exactement la
 * place du hero, dans ses couleurs, pour que l'arrivée du vrai contenu soit
 * une continuité et non un flash. Aucune animation ici — un squelette qui
 * pulse sur une page qui va elle-même s'animer fait deux mouvements
 * concurrents.
 *
 * Il est volontairement écrit en primitives (des `div`) et vit dans le chunk
 * d'entrée : il doit s'afficher AVANT que quoi que ce soit d'autre ne charge.
 */
const LandingSkeleton = () => (
  <div
    className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    aria-hidden="true"
  >
    <div className="mx-auto max-w-5xl px-4 pt-6">
      <div className="h-14 rounded-2xl bg-white/[0.04]" />
    </div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 lg:pt-16">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="space-y-4">
          <div className="h-12 lg:h-16 w-11/12 rounded-xl bg-white/[0.06]" />
          <div className="h-12 lg:h-16 w-10/12 rounded-xl bg-white/[0.06]" />
          <div className="h-12 lg:h-16 w-8/12 rounded-xl bg-blue-500/10" />
          <div className="pt-6 space-y-2.5">
            <div className="h-4 w-11/12 rounded bg-white/[0.04]" />
            <div className="h-4 w-9/12 rounded bg-white/[0.04]" />
          </div>
          <div className="pt-6 flex gap-3.5">
            <div className="h-14 w-52 rounded-2xl bg-blue-500/20" />
            <div className="h-14 w-48 rounded-2xl bg-white/[0.05]" />
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="mb-3 flex justify-center gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-7 w-24 rounded-full bg-white/[0.05]" />
            ))}
          </div>
          <div className="h-[26rem] rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Racine publique — la landing, servie sur deux chemins.
 *
 * `/` sert le parcours perso, `/entreprise-presentation` le parcours
 * entreprise. Les deux rendent le MÊME composant à la même profondeur : React
 * réconcilie par type, donc passer de l'un à l'autre ne remonte pas la page et
 * l'état de la landing (parcours affiché, transition en cours) survit à la
 * navigation. Un utilisateur connecté est redirigé dans l'app, dans les deux cas.
 */
const RootRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    // Rouvre l'app sur la dernière page quittée (mémorisée par Layout),
    // fallback dashboard si inconnue ou invalide.
    const last = getLastVisitedPage();
    const target = last && RESUMABLE_PAGES.includes(last) ? last : '/dashboard';
    return <Navigate to={target} replace />;
  }
  // Fallback dédié : la landing est sombre, le fallback par défaut est clair.
  return (
    <AppErrorBoundary>
      <Suspense fallback={<LandingSkeleton />}>
        <LandingPage />
      </Suspense>
    </AppErrorBoundary>
  );
};

/**
 * Abonnement Realtime aux partages de tâches — monté UNE SEULE FOIS ici.
 *
 * Un canal Realtime est une connexion WebSocket : le monter dans un composant
 * de page en ouvrirait une par écran affiché. Au niveau App, il suit la session
 * et se referme proprement au changement d'utilisateur.
 *
 * Composant vide (pas de rendu) : c'est uniquement un point d'ancrage de cycle
 * de vie. Cf. audit archi 2026-08-07, point C2.
 */
const SharedTasksRealtime: React.FC = () => {
  const { user, isDemo } = useAuth();
  useSharedTasksRealtime(isDemo ? undefined : user?.id);
  return null;
};

/**
 * Boîte de réception d'organisation en temps réel — même rôle et mêmes
 * contraintes que `SharedTasksRealtime` : point d'ancrage de cycle de vie, sans
 * rendu, monté UNE SEULE FOIS (un canal Realtime est un WebSocket).
 *
 * Remplace trois `refetchInterval` de 20 s montés en permanence par `InboxMenu`
 * (invitations, avis de retrait, demande d'adhésion), soit 9 requêtes par
 * minute et par utilisateur connecté avant toute interaction.
 * Cf. `docs/SCALABILITY.md` §3 et mig. 118.
 */
const OrgInboxRealtime: React.FC = () => {
  const { user, isDemo } = useAuth();
  // L'organisation active sert au filtre ADMIN (`org_id`) : sans elle, les
  // demandes d'adhésion resteraient sondées sur toutes les pages.
  const { activeOrg } = useActiveOrganization();
  useOrgInboxRealtime(isDemo ? undefined : user?.id, isDemo ? undefined : activeOrg?.id);
  return null;
};

/**
 * Demandes d'amis et listes partagées en temps réel — mêmes contraintes que
 * les deux hooks ci-dessus : point d'ancrage sans rendu, monté UNE SEULE FOIS.
 *
 * Remplace les trois DERNIERS `refetchInterval` permanents (15 s ×2, 20 s),
 * soit ~15 requêtes par minute et par utilisateur connecté avant toute
 * interaction. Cf. `docs/SCALABILITY.md` §3 et mig. 120.
 */
const FriendsInboxRealtime: React.FC = () => {
  const { user, isDemo } = useAuth();
  useFriendsInboxRealtime(isDemo ? undefined : user?.id);
  return null;
};

const AppRoutes = () => {
  // Locale servie pour ce montage. `basename` étant figé au montage du routeur,
  // elle ne change pas sans rechargement complet (cf. src/i18n/bootstrap.ts) —
  // il n'y a donc jamais de désynchronisation entre le préfixe de l'URL et les
  // slugs déclarés ici.
  const activeLocale = useLocale();

  return (
  <Routes>
    {/* Racine — LandingPage publique, redirect /dashboard si connecté */}
    <Route index element={<RootRoute />} />

    {/* Public pages — accessibles sans authentification */}
    <Route path="welcome" element={<Navigate to="/" replace />} />
    <Route path="login" element={<PageWithSuspense><LoginPage /></PageWithSuspense>} />
    <Route path="signup" element={<PageWithSuspense><SignupPage /></PageWithSuspense>} />
    <Route path="forgot-password" element={<PageWithSuspense><ForgotPasswordPage /></PageWithSuspense>} />
    <Route path="reset-password" element={<PageWithSuspense><ResetPasswordPage /></PageWithSuspense>} />
    <Route path="guide" element={<PageWithSuspense><GuidePage /></PageWithSuspense>} />
    <Route path="blog" element={<PageWithSuspense><BlogIndexPage /></PageWithSuspense>} />
    <Route path="blog/:slug" element={<PageWithSuspense><BlogArticlePage /></PageWithSuspense>} />
    {/* Slugs publics localisés — cf. src/i18n/routes.ts.
        `basename` retire déjà le préfixe de locale, donc ces chemins restent
        relatifs ; seul le SLUG change selon la langue servie. Conséquence
        voulue : `/en/about` répond, `/en/a-propos` tombe en 404 — une seule URL
        canonique par langue et par page. */}
    <Route
      path={routeSlug('enterprisePresentation', activeLocale)}
      element={<RootRoute />}
    />
    <Route path={routeSlug('about', activeLocale)} element={<PageWithSuspense><AProposPage /></PageWithSuspense>} />
    <Route path={routeSlug('freelancers', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('students', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('managers', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('teams', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('legalNotice', activeLocale)} element={<PageWithSuspense><MentionsLegalesPage /></PageWithSuspense>} />
    <Route path={routeSlug('privacy', activeLocale)} element={<PageWithSuspense><PolitiqueConfidentialitePage /></PageWithSuspense>} />
    <Route path={routeSlug('terms', activeLocale)} element={<PageWithSuspense><CGUPage /></PageWithSuspense>} />
    {/* Lien d'invitation de partage — public : pose le token puis redirige
        (login/signup si déconnecté) ; ShareInviteClaimer fait le claim. */}
    <Route path="invite/:token" element={<PageWithSuspense><InvitePage /></PageWithSuspense>} />
    {/* Lien d'invitation entreprise placé (v2) — public : la page gère
        elle-même l'état connecté/déconnecté + consentement RGPD. */}
    <Route path="org-invite/:token" element={<PageWithSuspense><ClaimOrgInvitePage /></PageWithSuspense>} />

    {/* Protected routes — require authentication */}
    <Route element={<ProtectedRoute />}>
      {/* Onboarding entreprise — plein écran, hors Layout (pas de nav) */}
      <Route path="entreprise/onboarding" element={<PageWithSuspense><OrganizationOnboardingPage /></PageWithSuspense>} />
      <Route element={<LayoutWithSuspense />}>
        <Route path="dashboard" element={<PageWithSuspense><DashboardPage /></PageWithSuspense>} />
        <Route path="tasks" element={<PageWithSuspense><TasksPage /></PageWithSuspense>} />
        <Route path="agenda" element={<PageWithSuspense><AgendaPage /></PageWithSuspense>} />
        <Route path="habits" element={<PageWithSuspense><HabitsPage /></PageWithSuspense>} />
        <Route path="okr" element={<PageWithSuspense><OKRPage /></PageWithSuspense>} />
        <Route path="statistics" element={<PageWithSuspense><StatisticsPage /></PageWithSuspense>} />
        <Route path="settings" element={<PageWithSuspense><SettingsPage /></PageWithSuspense>} />
        {/* Espace entreprise — visible pour les membres d'une organisation */}
        <Route path="entreprise" element={<PageWithSuspense><OrganizationPage /></PageWithSuspense>} />
        {/* Admin — URL non référencée (aucun lien dans l'UI), gating réel
            côté serveur : la RPC get_admin_stats rejette les non-admins. */}
        <Route path="admin" element={<PageWithSuspense><AdminPage /></PageWithSuspense>} />
        {/* Premium masqué tant que PREMIUM_ENFORCED=false : la route redirige
            vers le dashboard. Page + import conservés (réactivation via le flag). */}
        <Route path="premium" element={PREMIUM_ENFORCED ? <PageWithSuspense><PremiumPage /></PageWithSuspense> : <Navigate to="/" replace />} />
      </Route>
    </Route>

    {/* Fallback */}
    <Route path="*" element={<PageWithSuspense><NotFoundPage /></PageWithSuspense>} />
  </Routes>
  );
};

/**
 * Mesure d'audience Vercel — montée UNIQUEMENT après acceptation explicite.
 *
 * `<Analytics />` était monté inconditionnellement, alors que le bandeau
 * proposait de refuser. C'est le même manquement que celui corrigé dans
 * `src/lib/audience.ts` : deux traceurs, une seule promesse, non tenue.
 *
 * Le composant réagit au store, donc accepter le monte sans rechargement.
 * Refuser ne le monte jamais : on ne charge pas pour démonter ensuite, car on
 * ne décharge pas du JavaScript déjà évalué.
 */
function ConsentedAnalytics() {
  const consent = useCookieConsent();
  return consent === 'accepted' ? <Analytics /> : null;
}

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActiveOrgProvider>
        <BillingProvider>
          {/* ⚠️ Plus de <TooltipProvider> ici, et ce n'est PAS un oubli.
              Le composant `Tooltip` de `ui/tooltip.tsx` fournit déjà son propre
              provider (motif shadcn v4), avec le MÊME `delayDuration = 0` :
              celui-ci était redondant, et il traînait tout `@radix-ui/react-tooltip`
              + `floating-ui` — 113 ko bruts — dans le chunk d'entrée, pour un
              seul consommateur réel (`OrgTabBadge`, dans l'espace entreprise,
              déjà lazy).
              🔴 Ne pas le remettre « par sécurité » : un tooltip sans provider
              lève à l'affichage, ça se voit tout de suite. */}
          <>
            {/* reducedMotion="user" : respecte `prefers-reduced-motion` du système
                pour TOUTES les animations Framer Motion (transforms réduits, pas
                de mouvement décoratif). Exigence WCAG 2.3.3 / EAA. */}
            <MotionConfig reducedMotion="user">
            <Toaster
              position="top-right"
              richColors
              closeButton
              theme="system"
              toastOptions={{
                duration: 3000,
              }}
            />
            {/* Défense en profondeur autour des SATELLITES de l'app.
                Ces trois-là sont montés au niveau App, donc au-dessus de tout
                boundary de page : un throw dans l'un d'eux emportait
                l'application entière.
                C'est exactement ce qui est arrivé avec le canal Realtime — le
                constructeur `WebSocket` lève « The operation is insecure » dans
                un navigateur qui bloque les WebSockets, et l'écran devenait
                noir à chaque visite. La cause est traitée dans
                `useSharedTasksRealtime`, mais aucun de ces composants ne mérite
                de pouvoir tuer l'app : `fallback={null}` les fait disparaître
                en silence.
                `AppRoutes` reste HORS de ce boundary — c'est l'application. */}
            <AppErrorBoundary fallback={null}>
              <SharedTasksRealtime />
            </AppErrorBoundary>
            <AppErrorBoundary fallback={null}>
              <OrgInboxRealtime />
            </AppErrorBoundary>
            <AppErrorBoundary fallback={null}>
              <FriendsInboxRealtime />
            </AppErrorBoundary>
            <AppRoutes />
            <AppErrorBoundary fallback={null}>
              <CookieBanner />
              {/* Onglet resté ouvert sur un bundle périmé — 91,5 % du trafic
                  Supabase du 2026-08-26 venait de deux onglets dans ce cas.
                  Monté ici, une seule fois : c'est une propriété de
                  l'application, pas d'un écran. */}
              <NewVersionBanner />
              {/* Popup d'invitation de partage — niveau App pour survivre aux
                  changements de route (claim après login OU fin d'inscription). */}
              <ShareInviteClaimer />
            </AppErrorBoundary>
            {/* AppErrorBoundary ici, PAS seulement le Suspense : un chunk périmé
                (déploiement récent, vieil index.html en cache) fait échouer ce
                lazy() en dehors de toute route — sans boundary à ce niveau,
                l'erreur remonte jusqu'à la racine et blanchit TOUTE l'app,
                alors que la palette de commandes n'est qu'un raccourci
                secondaire (Ctrl/Cmd+K). */}
            <AppErrorBoundary fallback={null}>
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
            </AppErrorBoundary>
            <ConsentedAnalytics />
            </MotionConfig>
          </>
        </BillingProvider>
        </ActiveOrgProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
