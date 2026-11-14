# `src/` · providers, routing, type User

**Quand lire** : en touchant `src/App.tsx`, `src/main.tsx`, `src/modules/auth/AuthContext.tsx`. **Fait foi** : le code.
Règles transversales : [`CLAUDE.md`](../CLAUDE.md).

## Providers (`src/App.tsx`)

```
QueryClientProvider > AuthProvider > ActiveOrgProvider > BillingProvider
  > MotionConfig reducedMotion="user" > Toaster (Sonner, lazy) + Routes
```

- ❌ Remettre un `TooltipProvider` à la racine : `ui/tooltip.tsx` a le sien, et la racine traînait `@radix-ui/react-tooltip` dans le chunk d'entrée. Un tooltip sans provider lève à l'affichage, c'est visible.
- ✅ React Query : 5 min stale, 30 min gc, pas de `refetchOnWindowFocus`.
- ✅ Requêtes : `retry` = prédicat `shouldRetryQuery` (`@/lib/query-retry`), une reprise, seulement quand la cause est inconnue ; un échec nommé par le serveur (`42501`, `PGRST116`, `seat_limit_reached`) rend le même nom.
- ✅ Mutations : `shouldRetryMutation` (jamais sur un refus nommé, AM-4 de `docs/OBSERVABILITE.md`) ; `useOrgSubscriptionAction` met `retry: 0` : on ne rejoue jamais une mutation qui déplace de l'argent.
- ❌ Identifier une erreur par une sous-chaîne de son message : il vient du catalogue i18n, donc traduit. Le code vit dans `.code`.
- 🔴 Trois canaux Realtime (`SharedTasksRealtime`, `OrgInboxRealtime`, `FriendsInboxRealtime`), montés **une fois** ici, chacun dans son `AppErrorBoundary fallback={null}`. Un canal est un WebSocket : jamais dans un composant d'écran.
- ✅ Montés une fois au niveau App : `CookieBanner`, `NewVersionBanner`, `ShareInviteClaimer`, `CommandPalette` (lazy), `ConsentedAnalytics` (rendu si `useCookieConsent() === 'accepted'`).
- ✅ Audience maison : démarrée dans `src/main.tsx` (`startTrafficMeasurement`), pas dans un composant. `src/lib/traffic.ts` revérifie avant chaque envoi consentement, page publique, absence de formulaire d'identifiants et de session, puis poste à `/api/collect`.
- ❌ Appeler `track_hit` depuis le client : seule la clé secrète du collecteur l'exécute (mig. `223`) → [`api/CLAUDE.md`](../api/CLAUDE.md).

## Type `User`

✅ Défini **uniquement** dans `src/modules/auth/AuthContext.tsx` (`src/modules/user/types.ts` le ré-exporte) : `id, name, email, avatar?, provider?, autoValidation?`. ❌ Y ajouter un état d'abonnement.

## Routing (`src/App.tsx`)

| Route | Page | Accès |
|---|---|---|
| `/` | `LandingPage`, parcours perso ; redirige `/dashboard` si connecté | public |
| `/entreprise-presentation` (slug localisé) | même `LandingPage`, parcours entreprise | public |
| `/login` `/signup` `/forgot-password` `/reset-password` | Auth | public |
| `/guide` `/blog` `/blog/:slug` | contenu SEO | public |
| slugs localisés (à-propos, freelances, étudiants, managers, équipes, légal) | `routeSlug(key, locale)`, `src/i18n/routes.ts` | public |
| `/invite/:token` `/org-invite/:token` | claim d'invitation | public |
| `/dashboard` `/tasks` `/settings` `/agenda` `/habits` `/okr` `/statistics` | socle, toujours visibles | protégé |
| `/entreprise/:section?/:entityId?` `/entreprise/onboarding` | mode entreprise ; `?tab=` redirigé ; onboarding hors Layout | protégé |
| `/admin` | console admin, URL non référencée, garde **serveur** (`get_admin_stats`) | protégé |
| `/premium` | redirige `/` tant que `PREMIUM_ENFORCED = false` | protégé |
| `/welcome` | redirection permanente vers `/` | public |
| `*` | `NotFoundPage`, pas de redirect | |

- ✅ Toute page passe par `lazyWithRetry(import, [namespaces])` (`@/lib/lazy-with-retry`) sous `AppErrorBoundary` : un chunk périmé est retenté puis la page recharge ; les catalogues i18n de la route sont attendus avant le rendu.
- ⚠️ Une page qui utilise un nouveau namespace l'ajoute à SA liste dans `App.tsx` : `lazy-namespaces.guard.test.ts` lit ces appels.
