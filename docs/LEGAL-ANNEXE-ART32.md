# LEGAL : annexe mesures techniques et organisationnelles (art. 32)

**Quand lire** : en touchant HSTS, CSP, RLS, le scrubbing Sentry ou les sauvegardes, ou pour répondre à un questionnaire d'achat B2B. **Fait foi** : le code et `vercel.json`. Tableau de conformité (ligne A9) : [`LEGAL.md`](./LEGAL.md).

Pièce réclamée en contrôle CNIL et dans les questionnaires d'achat B2B. Détail d'implémentation : [`SECURITY.md`](./SECURITY.md), non dupliqué ici.

### Mesures en place

| Mesure | Mise en œuvre | Source |
|---|---|---|
| Chiffrement en transit | HSTS `max-age=63072000`, `includeSubDomains`, `preload`. Aucun accès en clair. | `vercel.json` |
| Localisation des données | Supabase `eu-west-1` (Irlande). Aucun transfert hors UE pour la base. | console Supabase |
| Cloisonnement par utilisateur | RLS activée sur toutes les tables, une seule policy permissive par rôle et action (mig. `049`). Isolation prouvée par test d'intégration. | `supabase/migration/`, `e2e/rls/` |
| Contrôle d'accès | Supabase Auth. `ProtectedRoute` est une défense en profondeur, la frontière est la RLS. | `src/App.tsx` |
| Moindre privilège | `service_role` jamais exposé au navigateur. Helpers sensibles : `EXECUTE` révoqué à `authenticated` (mig. `100`). | `.env.example`, migrations |
| Maîtrise des écritures | Whitelist `mapToDb` côté repository ; `zod` est une garde UX, la whitelist est la barrière. | `src/lib/validation/` |
| Anti-XSS et injection | CSP stricte : `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. | `vercel.json` |
| Anti-clickjacking | `X-Frame-Options: DENY` et `frame-ancestors 'none'`. | `vercel.json` |
| Durcissement navigateur | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` fermant caméra, micro, géolocalisation. | `vercel.json` |
| Minimisation dans le monitoring | `sendDefaultPii: false` ; `beforeSend` retire emails et UUID des messages, exceptions et breadcrumbs. | `src/main.tsx` |
| Réduction de surface tierce | Aucun script tiers de mesure : audience maison, revérifiée avant chaque envoi (consentement, page publique, hors session), postée à la même origine. | `src/lib/traffic.ts`, `api/collect.ts` |
| Traçabilité des versions | `release` Sentry = SHA du commit. | `src/main.tsx` |
| Contrôle continu | Gates CI bloquantes : `check:rls`, `validate:migrations`, `test:rls`, `i18n:check`, `check:bundle`. | `package.json` |
| Effacement | Edge Function `delete-account`, export CSV au titre de la portabilité. | `supabase/functions/delete-account`, `src/lib/csv-export.ts` |

### Limites assumées

Un document art. 32 qui ne recense que ses forces ne vaut rien en contrôle.

- ⚠️ `style-src 'unsafe-inline'` reste nécessaire à la chaîne de styles : assouplissement conscient de la CSP.
- ❌ Réintroduire un script publicitaire rouvrirait la question du consentement (A4) : la publicité n'en est JAMAIS exemptée. Les origines publicitaires sont retirées de la CSP.
- ⚠️ Aucun exercice de restauration n'a été conduit : les sauvegardes dépendent du plan Supabase souscrit, leur existence et leur délai de restauration restent à vérifier.
- ⚠️ Pas de journal d'accès applicatif distinct des logs d'infrastructure.
- ✅ Sauvegardes chez GitHub : chiffrées (AES-256) avant dépôt, phrase secrète en secret GitHub et copie hors dépôt chez Axel. Elles ont été publiques et en clair : violation consignée au registre privé.
