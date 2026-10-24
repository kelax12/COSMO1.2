# `src/` · providers, routing, type User

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu'un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../CLAUDE.md) à la racine.

---

## Hiérarchie des providers (`src/App.tsx`)

```
QueryClientProvider
  AuthProvider
    ActiveOrgProvider        ← organisation courante (mode entreprise)
      BillingProvider        ← dépend de useAuth
        MotionConfig reducedMotion="user"   ← WCAG 2.3.3 pour tout Framer Motion
          Toaster (Sonner, theme="system", monte en lazy) + Routes
```

🔴 **Il n'y a PLUS de `TooltipProvider` ici, et ce n'est pas un oubli** (ce schéma en a montré un
jusqu'au 2026-09-20). `ui/tooltip.tsx` fournit déjà le sien, avec le même `delayDuration = 0` :
celui de la racine était redondant et traînait tout `@radix-ui/react-tooltip` + `floating-ui`,
113 ko bruts, dans le **chunk d'entrée**, pour un seul consommateur réel (`OrgTabBadge`, déjà lazy).
❌ **Ne pas le remettre « par sécurité »** : un tooltip sans provider lève à l'affichage, ça se voit
tout de suite.

React Query : 5 min stale, 30 min gc, pas de `refetchOnWindowFocus`.
⚠️ **`retry` n'est plus `1` sur les requêtes** : c'est le prédicat `shouldRetryQuery`
(`@/lib/query-retry`, testé), plus un `retryDelay` exponentiel plafonné à 3 s. On ne retente
qu'**une** fois, et seulement quand on ignore la cause : un échec **nommé** par le serveur
(`42501`, `PGRST116`, `seat_limit_reached`…) rendra le même nom, et un dépassement de délai
enchaînerait 8 s + 1 s + 8 s avant d'afficher quoi que ce soit.
❌ **Ne jamais identifier une erreur par une sous-chaîne de son message** : il vient du catalogue
i18n, il est traduit. Le code vit dans `.code`. C'est ce bug-là qui a fait vivre le prédicat
d'origine sans qu'il puisse matcher une seule fois.
`retry: 1` ne vaut plus que pour les **mutations**, et `useCancelAndRefundOrg` y met `retry: 0` :
on ne rejoue jamais une mutation qui déplace de l'argent.

**Trois canaux Realtime**, chacun monté **une seule fois** ici et isolé dans son propre
`AppErrorBoundary fallback={null}` : `SharedTasksRealtime`, `OrgInboxRealtime`,
`FriendsInboxRealtime` (un canal est un WebSocket : jamais dans un composant d'écran).
Montés aussi une seule fois au niveau App : `CookieBanner`, `NewVersionBanner` (onglet resté sur un
bundle périmé), `ShareInviteClaimer`, `CommandPalette` (lazy) et `ConsentedAnalytics` (Vercel
Analytics, rendu seulement si `useCookieConsent() === 'accepted'`).

**Mesure d'audience maison** (mig. `222`, depuis le 2026-10-18) : démarrée dans `src/main.tsx`
(`startTrafficMeasurement`), pas dans un composant. `src/lib/traffic.ts` revérifie **avant chaque
envoi** consentement, page publique, absence de formulaire d'identifiants et absence de session,
puis poste à `/api/collect` (même origine). ❌ Aucun appel direct à `track_hit` depuis le client :
depuis la mig. `223` seule la clé secrète du collecteur peut l'exécuter → [`api/CLAUDE.md`](../api/CLAUDE.md).

### Type User — source de vérité

Défini **uniquement** dans `src/modules/auth/AuthContext.tsx` (`src/modules/user/types.ts` le
ré-exporte sans le redéfinir) :

```typescript
export type User = {
  id: string; name: string; email: string;
  avatar?: string; provider?: string; autoValidation?: boolean;
};
```

### Routing (`src/App.tsx`)

| Route | Page | Accès |
|---|---|---|
| `/` | LandingPage — **parcours perso**, redirige `/dashboard` si connecté | public |
| `/entreprise-presentation` (slug localisé) | **même composant `LandingPage`**, parcours entreprise | public |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` | Auth | public |
| `/guide` · `/blog` · `/blog/:slug` | Contenu SEO | public |
| slugs localisés (à-propos, freelances, étudiants, managers, équipes, mentions légales, confidentialité, CGU) | via `routeSlug(key, locale)` — cf. `src/i18n/routes.ts` | public |
| `/invite/:token` · `/org-invite/:token` | Claim d'invitation (partage / entreprise) | public |
| `/dashboard` · `/tasks` · `/settings` | Socle | protégé |
| `/agenda` · `/habits` · `/okr` · `/statistics` | **Toujours visibles pour tout le monde** depuis le 2026-08-23, plus aucun réglage ne les masque | protégé |
| `/entreprise/:section?/:entityId?` · `/entreprise/onboarding` | Mode entreprise, une route par section, plus un identifiant d'entité pour les liens profonds ; `?tab=` redirigé (onboarding hors Layout) | protégé |
| `/admin` | Console admin — URL non référencée, gating **serveur** (`get_admin_stats` rejette les non-admins) | protégé |
| `/premium` | Redirige `/` tant que `PREMIUM_ENFORCED = false` | protégé |
| `/welcome` | Redirection permanente vers `/` (ancienne URL) | public |
| `*` | **NotFoundPage** (pas de redirect) | — |

Toutes les pages passent par `lazyWithRetry(import, [namespaces])` (`@/lib/lazy-with-retry`) et
sont enveloppées dans `AppErrorBoundary` : un chunk périmé après déploiement est retenté puis
recharge la page, et la liste de catalogues i18n de chaque route est **attendue avant le rendu**.
⚠️ Une page qui utilise un nouveau namespace doit l'ajouter à SA liste dans `App.tsx` :
`lazy-namespaces.guard.test.ts` lit ces appels.

