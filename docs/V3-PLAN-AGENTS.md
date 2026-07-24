# COSMO V3 — Plan d'implémentation autoportant (humains + agents IA)

> **But de ce document** : permettre à une session IA fraîche, ayant pour seul contexte la roadmap V3 et ce fichier, d'implémenter la V3 pas à pas. Tout le contexte nécessaire (conventions, primitives existantes à réutiliser, chemins de fichiers, patterns exacts) est embarqué ici. **Lis d'abord la PARTIE 0 en entier.** Ensuite exécute les phases dans l'ordre ; chaque tâche est numérotée, avec fichiers, critères d'acceptation et vérification.
>
> **Règle d'or transverse** : ne réécris JAMAIS le système de permissions existant. Un agent est un *sujet* du système déjà en place. Chaque fois que tu hésites, relis la PARTIE 0 §4 (garde-fous) et §3 (primitives à réutiliser).

---

# PARTIE 0 — Contexte autoportant (à lire avant tout)

## 0.1 Ce qu'est COSMO

App React 18 + TypeScript strict + Vite 7, backend Supabase (Postgres + RLS + Auth). Deux modes transparents :
- **Démo** : données en `localStorage` (aucun Supabase). Les agents sont un concept **production uniquement** → hors démo.
- **Production** : Supabase, sélectionné si `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` sont définis.

Le **mode entreprise** existe déjà (migrations 060→082) : organisations, pyramide hiérarchique, équipes transverses, projets/tâches/OKR d'équipe cloisonnés. **C'est la fondation que la V3 étend.**

## 0.2 La vision V3 (résumé)

COSMO devient un **substrat d'orchestration** où humains ET agents IA sont des **membres égaux** d'une organisation-pyramide. Les agents sont **externes** (le Claude/GPT/agent custom de l'utilisateur), COSMO **n'héberge aucun modèle**. Les agents se branchent via un **serveur MCP** et travaillent en **pull** (lire « mes tâches » → travailler dehors → écrire résultat + cocher). Un humain reste responsable au sommet de chaque org et peut tout voir / piloter.

## 0.3 L'INSIGHT FONDATEUR (ne jamais l'oublier)

> **Un agent = un utilisateur Supabase Auth « headless »**, marqué `profiles.is_agent = true`, possédé par un humain (`profiles.operator_id`), et **membre d'une org placé dans la pyramide** (`organization_members.manager_id`).

Conséquence : parce que l'agent a un vrai `auth.uid()`, **toute la RLS, la pyramide, l'anti-escalade, le cloisonnement, l'assignation de tâches et la cascade d'OKR s'appliquent à lui SANS modification**. On n'ajoute que : identité machine (clés API), échange clé→session, journal d'audit, portes d'approbation.

**Authentification programmatique (maillon clé)** : une clé API est échangée (Edge Function `agent-auth`) contre un **JWT court signé côté serveur avec `SUPABASE_JWT_SECRET`** (`{ sub: <id user-agent>, role: 'authenticated', exp: now+15min }`). Toutes les requêtes data suivantes utilisent ce JWT → la RLS s'applique *comme si l'agent était connecté*, sans jamais lui donner de login interactif (pas de mot de passe, pas d'OAuth, pas d'OTP). L'`auth.users` de l'agent existe uniquement pour être un `sub` valide et une cible de FK.

## 0.4 Garde-fous NON NÉGOCIABLES (repris de CLAUDE.md + docs/SECURITY.md)

1. **`mapToDb` = frontière de sécurité anti-mass-assignment.** Un whitelist qui n'émet JAMAIS `user_id`, `is_agent`, `operator_id`. Voir `src/modules/tasks/mappers.ts` (référence).
2. **Toute écriture sensible passe par une RPC `SECURITY DEFINER`** (jamais d'INSERT/UPDATE client sur les tables de membership/rôle/hiérarchie). Pattern imposé : `LANGUAGE plpgsql/sql`, `SECURITY DEFINER`, `SET search_path = ''`, préfixe schéma `public.` partout, puis `REVOKE ALL … FROM PUBLIC; REVOKE EXECUTE … FROM anon; GRANT EXECUTE … TO authenticated;` (ou `TO service_role` pour les fonctions internes).
3. **Anti-récursion RLS (42P17)** : une policy sur une table ne référence JAMAIS cette même table via un `EXISTS` direct — passer par un helper `SECURITY DEFINER` (ex. `is_org_member`, `can_access_team_task`).
4. **RLS activée sur toute nouvelle table** avec policies explicites. Aucune donnée d'un membre ne fuit hors de son périmètre.
5. **Jamais `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client.** Le `service_role` vit seulement dans les Edge Functions.
6. **Pas de `as any`** ; `interface` pour objets, `type` pour unions ; imports via alias `@/`.
7. **Lint + typecheck à 0 erreur** avant tout commit (`npm run lint`, `npm run typecheck`).
8. **`faille.md` = source de vérité sécurité** ; **`docs/SECURITY.md`** = patterns détaillés. Les mettre à jour à chaque ajout touchant la sécurité.
9. **Migrations** : fichiers `supabase/migration/NNN_<feature>.sql` numérotés en continu (prochain libre = **083**). En-tête `═══` documentant intention + modèle de menace. Passer `npm run validate:migrations`. **L'humain (Axel) applique les migrations en prod, l'IA vérifie** — ne jamais présumer qu'une migration est appliquée.

## 0.5 Primitives EXISTANTES à réutiliser (ne pas recréer)

### Tables (mode entreprise)
| Table | Colonnes clés |
|---|---|
| `organizations` | `id`, `name`, `join_code`, `owner_id`, `created_at` |
| `organization_members` | PK `(org_id, user_id)`, `role` (`admin`\|`member`), `joined_at`, `manager_id` (FK auth.users, ON DELETE SET NULL) |
| `profiles` | `id` (=auth.users.id), `email`, `display_name`, `avatar_url`, `account_type` (`personal`\|`business`) |
| `team_projects` | `id`, `org_id`, `name`, `color`, `created_by`, `team_id`, `archived_at` |
| `team_tasks` | `id`, `org_id`, `project_id`, `name`, `priority`, `deadline`, `estimated_time`, `assignee_ids UUID[]` (cap 20, GIN), `created_by`, `completed` |
| `team_task_comments` | `id`, `task_id`, `author_id`, `body`, `mentions UUID[]`, `created_at` |
| `team_okrs` / `team_key_results` / `team_okr_teams` | OKR d'équipe + cascade |
| `org_teams` / `org_team_members` | équipes transverses |

### Fonctions SQL `SECURITY DEFINER` (helpers de permission — les RÉUTILISER)
- `is_org_member(p_org)`, `is_org_admin(p_org)`, `is_org_manager(p_org)` (dérivé = admin OU a des subordonnés)
- `get_subtree(p_org, p_root)` → SETOF UUID (descendants stricts, cap 50 niveaux)
- `is_above(p_org, p_user)` → auth.uid() est ancêtre strict de p_user
- `has_subordinates(p_org, p_user)`
- `manages_user(p_user)` (mig. 077 — admin de l'org OU cible dans le sous-arbre de l'appelant)
- `can_access_team_project(p_project)`, `can_access_team_okr(p_okr)`, `can_access_team_task(p_task)` (helpers de cloisonnement)
- `org_admin_count(p_org)` (garde dernier admin)

### RPC de gestion des membres (les RÉUTILISER pour placer/retirer un agent)
- `set_member_manager(p_org, p_user, p_manager)` — placement pyramidal, respecte admin/sous-arbre (voir `066_org_hierarchy.sql:154`)
- `set_member_role(p_org, p_user, p_role)`, `remove_member(p_org, p_user)`, `leave_organization(p_org)` — gardes « dernier admin » incluses
- `validate_org_manager()` (trigger BEFORE INSERT/UPDATE OF manager_id) — anti-cycle + cohérence org. **S'applique aussi aux agents automatiquement.**
- `validate_team_task()` (trigger, mig. 072) — cap 20 assignés + assignés obligatoirement membres de l'org. **Assigner une tâche à un agent marche donc déjà, zéro code.**

### Côté client
- **Factory repositories** : `src/lib/repository.factory.ts` (`getTasksRepository()`, etc. + `resetRepositories()`). Ajouter `getAgentsRepository()`.
- **Binding RPC** : `supabase.rpc('nom_rpc', { p_x: … })` — voir `src/modules/organizations/supabase.repository.ts:196+`.
- **Binding Edge Function** : `supabase.functions.invoke('nom', { body })`.
- **Auth** : `useAuth()` depuis `@/modules/auth/AuthContext` (source unique). `useBilling()` depuis `@/modules/billing/billing.context` (premium NON appliqué actuellement, `PREMIUM_ENFORCED=false`).
- **Validation zod** : `src/lib/validation/validate.ts` (`validateOrThrow`/`safeValidate`) + un schéma par module.
- **Structure d'un module** : `types.ts`, `constants.ts` (clés React Query factory), `repository.ts` (interface), `supabase.repository.ts`, `local.repository.ts` (si démo), `hooks.ts`, `index.ts` (barrel).

### Edge Functions (pattern de référence)
`supabase/functions/delete-account/index.ts` montre le pattern complet : `Deno.serve`, CORS **allowlist** (`ALLOWED_ORIGINS` depuis `APP_URL`, jamais de wildcard sur un endpoint authentifié), client anon pour vérifier le JWT appelant (`supabaseUser.auth.getUser()`), client `service_role` pour les opérations privilégiées, `opsAlert` (`_shared/alert.ts`) pour les alertes ops. Config dans `supabase/config.toml` (`[functions.<nom>] verify_jwt = …`).

---

# PARTIE 1 — PHASE 1 : Identité agent (fondation)

**Objectif** : un agent devient un membre RLS-scopé d'une org, possédé par un humain, authentifié par clé API, avec journal d'audit — sans toucher la pyramide/RLS existante.
**Prérequis** : aucun (première brique).
**Livrables** : migration `083`, Edge Functions `create-agent` / `issue-agent-key` / `revoke-agent-key` / `agent-auth`, module client `src/modules/agents/`, UI admin minimale, tests, docs.

## 1.A — Migration `083_agent_principals.sql`

Fichier : `supabase/migration/083_agent_principals.sql`. En-tête `═══` obligatoire décrivant : agent = user headless, is_agent/operator_id immuables, clés hashées, audit append-only, réutilisation totale de la pyramide.

1.A.1 **Étendre `profiles`** :
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_agent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agent_paused BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_operator ON public.profiles(operator_id) WHERE is_agent;
```

1.A.2 **Trigger d'immuabilité** `prevent_profile_agent_flags` (BEFORE UPDATE) : rejette toute modification de `is_agent` ou `operator_id` si l'appelant n'est pas `service_role`. S'inspirer de `prevent_user_id_change`. `agent_paused` reste modifiable (voir 1.A.7 pour qui).
```sql
CREATE OR REPLACE FUNCTION public.prevent_profile_agent_flags() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.is_agent IS DISTINCT FROM OLD.is_agent OR NEW.operator_id IS DISTINCT FROM OLD.operator_id)
     AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'is_agent/operator_id are immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_prevent_profile_agent_flags ON public.profiles;
CREATE TRIGGER trg_prevent_profile_agent_flags BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_agent_flags();
```
> Note : `is_agent` n'est JAMAIS lu depuis `raw_user_meta_data` (client-contrôlé) — il est posé exclusivement par l'Edge Function `create-agent` via `service_role` (1.B.1). Un humain ne peut pas se déclarer agent.

1.A.3 **Helper `is_agent(p_user)`** (SECURITY DEFINER) :
```sql
CREATE OR REPLACE FUNCTION public.is_agent(p_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND is_agent);
$$;
```
+ REVOKE/GRANT `TO authenticated`.

1.A.4 **Table `agent_keys`** :
```sql
CREATE TABLE IF NOT EXISTS public.agent_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL,               -- SHA-256 de la clé, jamais la clé en clair
  key_prefix  TEXT NOT NULL,               -- ex. 'cosmo_ak_ab12' (affichage)
  scopes      TEXT[] NOT NULL DEFAULT '{}', -- vide = plein périmètre RLS de l'agent
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_keys_hash ON public.agent_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_keys_agent ON public.agent_keys(agent_id) WHERE revoked_at IS NULL;
ALTER TABLE public.agent_keys ENABLE ROW LEVEL SECURITY;
```
RLS : **SELECT** autorisé à l'opérateur de l'agent OU aux admins de l'org — MAIS **ne jamais exposer `key_hash`** (le repository client ne sélectionne que `id, agent_id, org_id, key_prefix, scopes, created_at, last_used_at, revoked_at`). Aucune policy INSERT/UPDATE/DELETE côté client → tout passe par Edge Functions (service_role). Helper de visibilité :
```sql
CREATE OR REPLACE FUNCTION public.can_see_agent(p_agent UUID, p_org UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_org_admin(p_org)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = p_agent AND operator_id = auth.uid());
$$;
```
Policy SELECT : `USING (public.can_see_agent(agent_id, org_id))`.

1.A.5 **Table `agent_audit_log`** (append-only) :
```sql
CREATE TABLE IF NOT EXISTS public.agent_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id      UUID NOT NULL,
  action        TEXT NOT NULL,        -- ex. 'task.update', 'task.create', 'comment.create'
  resource_type TEXT,                 -- ex. 'team_task'
  resource_id   UUID,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_audit_org_created ON public.agent_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_agent ON public.agent_audit_log(agent_id, created_at DESC);
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;
```
RLS : **AUCUNE** policy INSERT/UPDATE/DELETE côté client (écrit par triggers SECURITY DEFINER, 1.A.6). **SELECT** : opérateur de l'agent + admins + managers de l'agent (réutiliser `manages_user`) :
```sql
CREATE POLICY "agent_audit_select" ON public.agent_audit_log FOR SELECT
  USING (public.is_org_admin(org_id)
      OR public.manages_user(agent_id)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = agent_id AND operator_id = auth.uid()));
```

1.A.6 **Traçabilité automatique par trigger** (le cœur de l'audit — infalsifiable). Fonction générique + triggers AFTER sur les tables mutées par les agents :
```sql
CREATE OR REPLACE FUNCTION public.log_agent_action() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org UUID; v_action TEXT; v_id UUID;
BEGIN
  IF NOT public.is_agent(auth.uid()) THEN RETURN COALESCE(NEW, OLD); END IF;
  v_action := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_id := COALESCE(NEW.id, OLD.id);
  v_org := COALESCE(NEW.org_id, OLD.org_id);
  INSERT INTO public.agent_audit_log(org_id, agent_id, action, resource_type, resource_id, metadata)
  VALUES (v_org, auth.uid(), v_action, TG_TABLE_NAME, v_id,
          jsonb_build_object('op', TG_OP));
  RETURN COALESCE(NEW, OLD);
END; $$;
```
Attacher `AFTER INSERT OR UPDATE OR DELETE` sur : `team_tasks`, `team_task_comments`, `team_key_results` (au minimum). Chaque table ayant `org_id` et `id`, le helper marche tel quel. **Ainsi, toute action agent est tracée même si elle passe hors MCP.**

1.A.7 **Table `agent_approvals`** (scaffold, câblée en Phase 3) :
```sql
CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id     UUID NOT NULL,
  action       TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ
);
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;
```
RLS SELECT : `manages_user(agent_id)` OU opérateur. Pas d'écriture client (RPC en Phase 3).

1.A.8 **RPC `set_agent_paused(p_agent, p_paused)`** : autorise seulement un manager de l'agent (`manages_user`) ou l'opérateur à mettre en pause/reprendre. UPDATE `profiles.agent_paused`. (Le trigger 1.A.2 laisse passer `agent_paused` — vérifier que la condition ne bloque QUE `is_agent`/`operator_id`.)

1.A.9 **Étendre la purge RGPD** : dans `purge_user_from_team_assignments` (mig. 082) ou une nouvelle RPC, s'assurer que supprimer un humain retire aussi ses agents (voir 1.B.5) et purge `agent_keys`/`agent_audit_log`/`agent_approvals` de ces agents. `agent_keys.agent_id`/`org_id` sont ON DELETE CASCADE → la suppression de l'auth.users agent cascade. Documenter.

1.A.10 Passer `npm run validate:migrations` (garde statique). Corriger jusqu'à 0 erreur.

**Critères d'acceptation 1.A** : migration idempotente (`IF NOT EXISTS`/`CREATE OR REPLACE`/`DROP … IF EXISTS`), RLS activée partout, aucune fuite de `key_hash`, triggers d'audit posés, `validate:migrations` vert.

## 1.B — Edge Functions

Config `supabase/config.toml` : ajouter `[functions.create-agent] verify_jwt = true`, idem `issue-agent-key`, `revoke-agent-key` ; `[functions.agent-auth] verify_jwt = false` (authentifié par clé API, pas par JWT humain — comme stripe-webhook). Copier le squelette CORS/allowlist de `delete-account/index.ts`.

1.B.1 **`create-agent`** (`supabase/functions/create-agent/index.ts`, JWT humain) :
- Body attendu : `{ orgId, name, managerId }`.
- Vérifier via client anon que l'appelant est authentifié.
- Autorisation : appelant doit être **admin de l'org** OU **manager plaçant l'agent dans son propre sous-arbre**. Réutiliser la logique de `set_member_manager` : le plus simple = laisser la RPC `set_member_manager` faire l'arbitrage à l'étape de placement (elle rejette si hors droits).
- Via `service_role` : `auth.admin.createUser({ email: 'agent+'+uuid+'@agents.cosmo.app', email_confirm: true, user_metadata: { name, account_type: 'business' } })` (**sans password** → login mot de passe impossible).
- Le trigger `handle_new_user_profile` crée la ligne `profiles`. Ensuite **UPDATE service_role** : `profiles SET is_agent = true, operator_id = <appelant>, account_type='business' WHERE id = <agent>`.
- Insérer le membership : `INSERT organization_members(org_id, user_id, role, manager_id) VALUES(orgId, agentId, 'member', managerId)` — le trigger `validate_org_manager` garantit cohérence/anti-cycle. (Ou appeler `set_member_manager` après un insert `manager_id NULL`.)
- Émettre la **première clé API** (voir 1.B.2 logique partagée), retourner `{ agentId, apiKey }` — **la clé en clair n'est retournée qu'ICI, une seule fois**.
- Tracer un `agent_audit_log` 'agent.create'.

1.B.2 **`issue-agent-key`** (JWT humain, opérateur ou admin) :
- Body : `{ agentId, orgId }`. Vérifier `can_see_agent`.
- Générer une clé aléatoire : `cosmo_ak_` + 32 octets base64url (`crypto.getRandomValues`). Calculer `key_hash = SHA-256(clé)`. Stocker `{ agent_id, org_id, key_hash, key_prefix: clé.slice(0,16), created_by }`.
- Retourner `{ apiKey }` en clair (une seule fois).

1.B.3 **`revoke-agent-key`** (JWT humain, opérateur ou admin) : body `{ keyId }` → `UPDATE agent_keys SET revoked_at = NOW() WHERE id = keyId` (service_role, après contrôle `can_see_agent`).

1.B.4 **`agent-auth`** (clé API, `verify_jwt = false`) — **le maillon clé** :
- Header attendu : `Authorization: Bearer <apiKey>` (clé API, PAS un JWT).
- Calculer `SHA-256(apiKey)`, chercher `agent_keys` où `key_hash = …` ET `revoked_at IS NULL`. Sinon 401.
- Vérifier `profiles.agent_paused = false` pour cet agent (sinon 403 'agent_paused').
- `UPDATE agent_keys SET last_used_at = NOW()`.
- **Signer un JWT court** avec `Deno.env.get('SUPABASE_JWT_SECRET')` (HS256) : claims `{ sub: agent_id, role: 'authenticated', aud: 'authenticated', exp: now + 900, iat, iss: SUPABASE_URL/auth/v1 }`. Utiliser une lib JWT Deno (ex. `djwt`).
- Retourner `{ access_token: <jwt>, expires_in: 900, agent_id, org_id }`.
- **Ce JWT, utilisé comme `Authorization: Bearer` sur PostgREST, fait que `auth.uid()` = l'agent → la RLS s'applique nativement.** Aucune capacité de login interactif accordée.
- Rate-limit basique (ex. compteur en table ou header) — durcissement complet en Phase 6.

1.B.5 **Suppression d'un agent** : soit étendre `remove-agent` (nouvelle Edge Function) qui appelle `remove_member` puis `auth.admin.deleteUser(agentId)` (cascade agent_keys/audit), soit une RPC `remove_member` suffit + purge. Réserver au propriétaire/admin. Documenter.

**Critères d'acceptation 1.B** : un admin crée un agent placé sous un manager ; la clé n'est visible qu'à la création ; `agent-auth` échange la clé contre un JWT ; ce JWT permet à l'agent de lire/écrire UNIQUEMENT dans son périmètre RLS ; un agent en pause est refusé ; `key_hash` jamais exposé.

## 1.C — Module client `src/modules/agents/`

Créer le module (structure standard §0.5) : `types.ts`, `constants.ts`, `repository.ts` (interface `IAgentsRepository`), `supabase.repository.ts`, `hooks.ts`, `agent.schema.ts` (zod), `index.ts`.

1.C.1 `types.ts` : `Agent { id, name, operatorId, orgId, managerId, paused, createdAt }`, `AgentKey { id, keyPrefix, createdAt, lastUsedAt, revokedAt }`, `AgentAuditEntry { id, action, resourceType, resourceId, createdAt, metadata }`.
1.C.2 `constants.ts` : clés React Query factory (`agentKeys.list(orgId)`, `agentKeys.audit(agentId)`, etc.).
1.C.3 `supabase.repository.ts` : `listAgents(orgId)` (SELECT `profiles` where `is_agent` AND membership de l'org), `getKeys(agentId)`, `getAudit(agentId|orgId)`, et les mutations via `supabase.functions.invoke('create-agent'|'issue-agent-key'|'revoke-agent-key', { body })`. **Ne jamais sélectionner `key_hash`.**
1.C.4 `hooks.ts` : `useAgents(orgId)`, `useCreateAgent()`, `useIssueAgentKey()`, `useRevokeAgentKey()`, `useAgentAudit(...)`, `useSetAgentPaused()`.
1.C.5 Enregistrer dans `src/lib/repository.factory.ts` : `getAgentsRepository()` + reset dans `resetRepositories()`.
1.C.6 `agent.schema.ts` : zod pour `createAgent` (`name` 2..80, `managerId` uuid optionnel).
1.C.7 **Démo** : `local.repository.ts` = stub qui lève « Agents indisponibles en mode démo » (ou renvoie liste vide). Documenter le choix.

**Critères d'acceptation 1.C** : `npm run typecheck` + `npm run lint` à 0 ; aucun accès direct aux tables sensibles hors RPC/Edge Function ; barrel `index.ts` exporte l'API publique.

## 1.D — UI admin minimale (mode entreprise)

Dans la surface entreprise existante (chercher la page/onglet « Membres » de l'org) : ajouter une section **« Agents »**.
1.D.1 Liste des agents de l'org (nom, manager, statut pause, dernière activité).
1.D.2 Bouton « Créer un agent » → formulaire (nom + choix du manager parmi les membres) → `useCreateAgent` → **afficher la clé API une seule fois** dans un modal « copie maintenant, non ré-affichée ».
1.D.3 Par agent : gérer les clés (émettre/révoquer), pause/reprise, voir le journal d'audit (lecture seule).
1.D.4 Respecter le design system mobile (primitives `src/components/mobile/`, BottomSheet) — voir `docs/MOBILE.md` et `docs/UI-PATTERNS.md`.

**Critères d'acceptation 1.D** : un admin peut créer un agent, obtenir/copier sa clé, révoquer, mettre en pause, consulter l'audit — le tout responsive et thémé (clair/sombre).

## 1.E — Tests

1.E.1 **RLS** (`npm run test:rls`, config `vitest.integration.config.ts`) : ajouter des cas —
- un agent (JWT signé) ne voit que ses tâches assignées / son sous-arbre ;
- un agent ne peut pas s'auto-promouvoir (`set_member_role` rejette : pas admin) ;
- un agent ne peut pas être assigné à une tâche d'une autre org (trigger `validate_team_task` rejette) ;
- `key_hash` non lisible ; un non-opérateur/non-admin ne voit pas les clés d'un agent ;
- l'audit se remplit à chaque mutation agent.
1.E.2 **Unit** : mappers du module agents (`*.test.ts` à côté), schéma zod.
1.E.3 Non-régression : `npm test` + suite existante verte (⚠️ 3 tests pré-existants cassés sur `main` — lists + team-stats — NE PAS les imputer à cette phase, cf. mémoire projet).

## 1.F — Docs

1.F.1 `docs/SECURITY.md` : nouvelle section « Agents » — modèle de menace (agent = user headless, JWT signé, pourquoi pas de login interactif, immuabilité is_agent/operator_id, audit par trigger).
1.F.2 `faille.md` : consigner le nouveau périmètre (surface d'attaque clés API + endpoint `agent-auth`).
1.F.3 `CLAUDE.md` : ajouter le module `agents` au tableau des modules + règle « agents = production only ».

## Vérification Phase 1 (bout en bout)
1. `npm run validate:migrations && npm run lint && npm run typecheck && npm test`.
2. (Après application migration par Axel) créer un agent sous un manager via l'UI → récupérer la clé.
3. `curl` `agent-auth` avec la clé → obtenir un JWT → l'utiliser sur `/rest/v1/team_tasks?assignee_ids=cs.{<agentId>}` → ne voir que les tâches assignées.
4. Vérifier `agent_audit_log` se remplit quand l'agent (via le JWT) met à jour une tâche.
5. Confirmer que le mode entreprise **humain est inchangé** (aucune régression).

---

# PARTIE 2 — PHASE 2 : Serveur MCP COSMO

**Objectif** : le canal par lequel un agent externe (Claude, etc.) lit et écrit dans COSMO, en pull, sous RLS.
**Prérequis** : Phase 1 (identité + `agent-auth`).
**Emplacement** : dossier séparé `mcp-server/` à la racine (service Node/TS autonome, publié en npm ou lancé via `npx`). Ne PAS le mêler au bundle front Vite.

2.1 Scaffolder un serveur MCP TypeScript avec le SDK MCP officiel (`@modelcontextprotocol/sdk`). Transport stdio (usage local par l'agent) + option HTTP.
2.2 Config : l'agent fournit `COSMO_API_KEY` (sa clé) + `COSMO_URL`. Au démarrage, le serveur appelle `agent-auth` pour obtenir un JWT, le rafraîchit avant expiration (900 s).
2.3 Client Supabase interne configuré avec le JWT courant (header `Authorization: Bearer <jwt>`), régénéré à l'expiration. **Toutes les requêtes passent donc par la RLS de l'agent.**
2.4 **Outils MCP (pull)** — définir avec schémas d'entrée stricts :
- `list_my_tasks({ status?, projectId? })` → tâches où `assignee_ids @> [agentId]`.
- `get_task({ taskId })`.
- `create_task({ projectId, name, priority?, deadline?, estimatedTime? })`.
- `update_task({ taskId, patch })` (dont `completed`).
- `comment_task({ taskId, body, mentions? })`.
- `list_my_okrs()` / `update_key_result({ krId, currentValue })`.
- `get_org_tree()` (scopé à ce que l'agent peut voir).
- `request_approval({ action, payload })` (Phase 3 ; en Phase 2, renvoyer « non disponible »).
2.5 Chaque outil : validation d'entrée, appel Supabase, mapping erreur lisible pour l'agent (jamais de secret dans le message). Les écritures sont automatiquement tracées par les triggers d'audit (Phase 1) — enrichir éventuellement `metadata` via un header.
2.6 **Guide de connexion** (`docs/AGENTS-MCP-GUIDE.md`) : comment brancher le MCP dans Claude Desktop / Claude Code / un agent custom (bloc de config `mcpServers`), où mettre la clé, comment tester (`list_my_tasks`).
2.7 Tests : e2e du serveur MCP contre un projet Supabase de test (créer agent → connecter → lister → créer → cocher → vérifier audit).

**Critères d'acceptation** : depuis un client MCP réel, un agent liste ses tâches, en crée/coche une, commente ; tout apparaît dans COSMO et dans l'audit ; l'agent ne peut rien voir hors périmètre.

---

# PARTIE 3 — PHASE 3 : Portes d'approbation + audit visible

**Objectif** : human-in-the-loop sur les actions sensibles d'un agent + surface de consultation.
**Prérequis** : Phases 1–2.

3.1 Définir la liste des **actions sensibles** (config partagée) : suppression (`team_tasks`/projet), invitation/création d'un sous-agent, changement de hiérarchie, toute action « dépense » future.
3.2 **Guard côté RPC/MCP** : quand `is_agent(auth.uid())` ET action sensible → au lieu d'exécuter, `INSERT agent_approvals(status='pending', action, payload)` et renvoyer à l'agent « en attente d'approbation ». RPC `request_agent_approval(p_action, p_payload)` (SECURITY DEFINER).
3.3 **RPC `resolve_agent_approval(p_id, p_approve)`** : réservée à un humain qui `manages_user(agent_id)`. Si approuvé → exécuter l'action réelle (dans la même fonction, selon `action`) puis `status='approved'` ; sinon `status='rejected'`. Garder atomique.
3.4 **UI Inbox « Approbations »** : étendre `src/components/InboxMenu.tsx` (déjà un tray friend/task/list/org-request) avec un 5e type « approbation agent » (approuver/rejeter), visible aux managers/opérateurs. Réutiliser le pattern `accepted_at`/statut.
3.5 **Surface audit** : page/onglet listant `agent_audit_log` filtrable par agent, action, date (lecture seule).
3.6 Notifications : réutiliser le mécanisme d'inbox (polling, « sans realtime » comme le reste) ; realtime réservé à la Phase 5.
3.7 Tests RLS : un agent ne peut pas résoudre sa propre approbation ; seul un manager/opérateur le peut ; l'action approuvée s'exécute bien.

**Critères d'acceptation** : une action sensible d'agent crée une demande ; un humain de sa chaîne l'approuve/rejette ; l'exécution ne se produit qu'après approbation ; tout est tracé.

---

# PARTIE 4 — PHASE 4 : Kit décomposeur de référence (usage « co-pilote perso »)

**Objectif** : rendre l'usage 1 (chat → tâches) opérationnel SANS héberger d'IA — c'est l'agent externe de l'utilisateur, connecté au MCP, qui décompose.
**Prérequis** : Phases 1–2 (3 recommandée).

4.1 **Guide « Co-piloter un projet avec ton IA »** (`docs/AGENTS-COPILOTE-GUIDE.md`) : créer une org perso (ou réutiliser l'org existante), créer un agent par IA/projet, brancher le MCP, prompt-type « décompose ce projet en tâches et crée-les dans COSMO ».
4.2 **Template de skill/prompt** réutilisable (fichier versionné) : instructions pour que l'agent (a) lise le contexte projet, (b) crée des tâches bien formées (nom, priorité, estimation), (c) s'assigne / assigne à l'humain, (d) mette à jour l'avancement.
4.3 **UX d'onboarding** dans l'app : un écran « Ajouter une IA à ce projet » qui guide la création d'agent + affiche la config MCP prête à copier.
4.4 Vérifier la lisibilité croisée : l'humain voit les tâches créées par l'IA et inversement, sans se mélanger entre projets (cloisonnement par projet/équipe déjà en place).
4.5 (Option différée « hybride ») : évaluer un décomposeur hébergé clé-en-main payant — hors scope initial, à décider en Phase 6.

**Critères d'acceptation** : un utilisateur branche son Claude, lui demande de décomposer un projet, et les tâches apparaissent dans COSMO, réparties humain/IA, visibles des deux côtés.

---

# PARTIE 5 — PHASE 5 : Tour de contrôle / cockpit (usage « entreprise IA »)

**Objectif** : voir et piloter des dizaines/centaines d'agents en direct.
**Prérequis** : Phases 1–3.

5.1 **Realtime** : activer Supabase Realtime sur `agent_audit_log` (et statuts). Feed d'activité temps réel des agents (qui fait quoi, maintenant).
5.2 **Métriques** : par agent / équipe / org — tâches complétées, temps investi (réutiliser le module `stats` / RPC `get_work_time_stats`), taux d'approbation, latence.
5.3 **Pilotage** : pause/reprise d'un agent (`set_agent_paused`), révocation de clé (coupe l'accès immédiat), override d'une tâche, réassignation.
5.4 **Vue pyramide vivante** : arbre org avec agents + humains, statut en direct par nœud. Réutiliser `buildOrgTree()` (`src/modules/organizations/types.ts`).
5.5 **Alerting** : agent en boucle/erreur → `opsAlert` (`_shared/alert.ts`) + badge dans le cockpit.
5.6 Perf : paginer l'audit, indexer, ne charger que le sous-arbre visible.

**Critères d'acceptation** : un CEO humain voit l'activité de tous ses agents en direct, met un agent en pause, consulte les métriques, et reprend le contrôle d'une tâche.

---

# PARTIE 6 — PHASE 6 : Monétisation + durcissement

**Objectif** : rendre la V3 vendable et robuste à l'échelle.
**Prérequis** : Phases 1–5.

6.1 **Facturation par siège-agent** : compter les agents distinctement (ne PAS gonfler `org_admin_count`). Champ/vue de comptage prévu dès Phase 1. Intégrer au billing existant (Stripe, actuellement `PREMIUM_ENFORCED=false` — cf. `docs/POST-AUDIT-GUIDE.md`).
6.2 **Rate limits** sur `agent-auth` et les écritures agent (par clé, par org).
6.3 **Quotas** : nombre d'agents/org, actions/jour selon le plan.
6.4 **Scaling** : revoir les index, la pagination de l'audit, la charge Realtime (cf. `docs/SCALABILITY.md`).
6.5 **Rotation des clés**, expiration configurable, scopes fins (le champ `scopes` existe déjà).
6.6 **API REST fine** (complément au MCP) pour Zapier/n8n/scripts : réutiliser `agent-auth` + un sous-ensemble d'endpoints documentés.
6.7 Audit sécurité complet (skill `typescript-security-review` + revue RLS) avant lancement commercial.

**Critères d'acceptation** : un client paie par agent, les abus sont limités, la charge tient, la sécurité est auditée.

---

# ANNEXE A — Décisions actées (cadrage 2026-07-24)

| Sujet | Choix |
|---|---|
| Démarrage | Socle commun d'abord |
| Où vit l'IA | COSMO = infrastructure (agents externes) |
| Intégration | MCP d'abord (+ REST plus tard) |
| Exécution | Pull via MCP |
| Agents managers | Oui, humain au sommet |
| Garde-fous | Rôle existant + audit + approbations |
| Tour de contrôle | Oui, phase dédiée |

# ANNEXE B — Questions ouvertes (non bloquantes)
- Monétisation exacte (siège/quota/org) — Phase 6, prévoir le comptage dès Phase 1.
- Agent multi-org : Phase 1 = **un agent = une org**. Ré-évaluer si besoin.
- Décomposeur hébergé (option « hybride ») : à décider en Phase 6.

# ANNEXE C — Fichiers de référence (patterns à copier)
- Migration table+RLS+helper : `supabase/migration/082_team_task_comments.sql`
- Migration RPC+trigger+placement pyramidal : `supabase/migration/066_org_hierarchy.sql`
- Table membres + `handle_new_user_profile` : `supabase/migration/060_organizations.sql`
- Edge Function (CORS/allowlist/anon+service_role) : `supabase/functions/delete-account/index.ts`
- Config Edge Functions : `supabase/config.toml`
- `mapToDb` (frontière anti-mass-assignment) : `src/modules/tasks/mappers.ts`
- Binding RPC/Edge Function client : `src/modules/organizations/supabase.repository.ts`
- Arbre org client : `src/modules/organizations/types.ts` (`buildOrgTree`)
- Factory repositories : `src/lib/repository.factory.ts`
- Checklist sécurité/migration : `docs/SECURITY.md`
- Roadmap V3 (contexte haut niveau) : `C:\Users\Axel\.claude\plans\1-cosmo-c-est-twinkly-dijkstra.md`
