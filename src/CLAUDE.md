# `src/` · providers, routing, type User

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../CLAUDE.md) à la racine.

---

## Hiérarchie des providers (`src/App.tsx`)

```
QueryClientProvider
  AuthProvider
    ActiveOrgProvider        ← organisation courante (mode entreprise)
      BillingProvider        ← dépend de useAuth
        TooltipProvider
          MotionConfig reducedMotion="user"   ← WCAG 2.3.3 pour tout Framer Motion
            Toaster (Sonner, theme="system", monte en lazy) + Routes
```

React Query : 5 min stale, 30 min gc, retry 1, pas de `refetchOnWindowFocus`.

`useSharedTasksRealtime` est monté **une seule fois** ici (composant `SharedTasksRealtime`).

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
| `/entreprise` · `/entreprise/onboarding` | Mode entreprise (onboarding hors Layout) | protégé |
| `/admin` | Console admin — URL non référencée, gating **serveur** (`get_admin_stats` rejette les non-admins) | protégé |
| `/premium` | Redirige `/` tant que `PREMIUM_ENFORCED = false` | protégé |
| `/welcome` | Redirection permanente vers `/` (ancienne URL) | public |
| `*` | **NotFoundPage** (pas de redirect) | — |

Toutes les pages sont lazy-loadées (`React.lazy`) et enveloppées dans `AppErrorBoundary`.

