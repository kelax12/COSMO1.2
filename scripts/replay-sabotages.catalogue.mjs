// ═══════════════════════════════════════════════════════════════════
// C-81 · le catalogue des sabotages rejoués par `npm run check:sabotages`
// ═══════════════════════════════════════════════════════════════════
//
// Chaque entrée casse UNE chose, dans une COPIE de l'arbre (jamais l'arbre
// de travail), et nomme ce qui doit rougir.
//
//   `famille`  · `produit`   : le défaut réel que la garde existe pour voir,
//                              introduit dans le produit (migration, Edge
//                              Function, catalogue, composant) ;
//              · `detecteur` : la garde elle-même désarmée (une expression qui
//                              ne voit plus rien, une somme devenue un maximum).
//                              C'est le défaut qu'un TÉMOIN existe pour voir.
//   `garde`    : un fichier de test, OU `{ commande, args?, env?, precharger? }`
//                pour une garde lancée comme en CI (`node scripts/….mjs`).
//   `modifs`   : `{ fichier, chercher, remplacer }` (le motif doit apparaître
//                EXACTEMENT une fois), ou `{ fichier, creer }`.
//   `attendu`  : (fichier de test) les cas qui DOIVENT passer du vert au rouge,
//                par leur titre, ou par `describe > … > titre` s'il est ambigu.
//   `raison`   : (commande) ce que la sortie DOIT dire, et que la copie propre
//                ne dit pas. Elle nomme l'objet saboté : un rouge sans elle est
//                un rouge pour une autre raison.
//   `pourquoi` : ce que la garde cesserait de protéger si elle ne voyait plus.
//
// ❌ Ne jamais affaiblir un `attendu` ou une `raison` pour faire passer le
//    rejeu : un sabotage qui ne rougit plus dit qu'une garde ne voit plus.
// ═══════════════════════════════════════════════════════════════════

/** Un remplacement littéral, unique dans son fichier. */
const r = (fichier, chercher, remplacer) => ({ fichier, chercher, remplacer });
/** Un fichier créé par le sabotage (il ne doit pas exister). */
const c = (fichier, creer) => ({ fichier, creer });

/** Une expression qui ne voit plus rien : le défaut type d'un détecteur. */
const AVEUGLE = '(?!)';

// ── Décor de `check:retention` : la production SIMULÉE ──────────────
//
// 🔴 Cette garde LIT la base de production. Le rejeu ne la touche jamais : un
// module préchargé remplace `fetch` AVANT le script, rend des lignes
// fabriquées, et REFUSE toute autre adresse. Le jeton est factice. Le sabotage
// écrit l'anomalie dans `base-simulee.json` : une ligne orpheline, une ligne
// trop vieille. Ce qu'on rejoue est donc le JUGEMENT de la garde sur la
// donnée, pas son SQL — que `gardes-posture.guard.test.mjs` garde à part.
const BASE_SIMULEE = {
  fichier: '.sabotages/base-simulee.mjs',
  contenu: `// Production SIMULÉE pour le rejeu de check:retention. Aucun appel réseau.
import { readFileSync, existsSync } from 'node:fs';
const ANOMALIES = new URL('./base-simulee.json', import.meta.url);
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://api.supabase.com/v1/projects/projet-simule/')) {
    throw new Error('base simulee : appel reseau refuse vers ' + url);
  }
  const anomalies = existsSync(ANOMALIES) ? JSON.parse(readFileSync(ANOMALIES, 'utf8')) : {};
  const { query } = JSON.parse(init.body);
  const orphelines = query.includes('LEFT JOIN auth.users');
  const lignes = [...query.matchAll(/SELECT '([^']+)' AS t/g)].map(([, t]) => (orphelines
    ? { t, n: anomalies.orphelines?.[t] ?? 0 }
    : { t, n: 1, age: anomalies.ages?.[t] ?? 1 }));
  return new Response(JSON.stringify(lignes), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
`,
};
const RETENTION = {
  commande: 'scripts/check-retention.mjs',
  env: { SUPABASE_ACCESS_TOKEN: 'jeton-factice-du-rejeu', SUPABASE_PROJECT_REF: 'projet-simule' },
  precharger: BASE_SIMULEE,
};

export const CATALOGUE = [
  // ═════════════════════════════════════════════════════════════════
  // SÉCURITÉ — en-têtes, Edge Functions, migrations
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'csp-wss',
    famille: 'produit',
    garde: 'src/csp.guard.test.ts',
    modifs: [r('vercel.json', ' wss://*.supabase.co', '')],
    attendu: ['autorise le WebSocket Realtime de Supabase (schéma wss, pas seulement https)'],
    pourquoi:
      'Sans `wss:` dans connect-src, le navigateur bloque TOUTES les connexions '
      + 'Realtime en production, en silence. Trois canaux d`App.tsx` coupés, et '
      + 'ils avaient remplacé huit sondages : une tâche partagée n`arrive jamais.',
  },
  {
    id: 'csp-unsafe-eval',
    famille: 'produit',
    garde: 'src/csp.guard.test.ts',
    modifs: [r('vercel.json', "script-src 'self'", "script-src 'self' 'unsafe-eval'")],
    attendu: ["n'autorise pas 'unsafe-eval' ni un joker total dans les scripts"],
    pourquoi:
      "`'unsafe-eval'` rouvre l'exécution de chaînes arbitraires : la CSP cesse "
      + "d'être une défense contre le XSS et devient une décoration.",
  },
  {
    id: 'rate-limit-borne',
    famille: 'produit',
    garde: 'src/rate-limit.guard.test.ts',
    modifs: [r('supabase/migration/139_rate_limits.sql', 'rl.hits > p_limit', 'rl.hits >= p_limit')],
    attendu: ['la borne est `> p_limit`, jamais `>= p_limit`'],
    pourquoi:
      'Avec `>=` et un plafond de 3, le 4ᵉ appel est ACCEPTÉ : le plafond de '
      + "débit de `report-bug` n'a jamais rien refusé, tout en ayant l'air "
      + "d'exister. C'est le défaut exact qui a failli partir.",
  },
  {
    id: 'rate-limit-sonde-aveugle',
    famille: 'detecteur',
    garde: 'scripts/migration-guards.test.mjs',
    modifs: [r('scripts/migration-guards.test.mjs', String.raw`/WHEN\s+rl\.hits\s*(>=?)\s*p_limit`, String.raw`/WHEN\s+rl\.hits\s*(>)\s*p_limit`)],
    attendu: ['TEMOIN — la sonde refuse bien la variante `>=`'],
    pourquoi:
      "Une sonde qui ne sait plus LIRE la variante `>=` rend « introuvable » au "
      + 'lieu de « fautif » : la borne du plafond de débit ne serait plus gardée '
      + 'que par un cas qui ne peut plus échouer.',
  },
  {
    id: 'stripe-checkout-cors',
    famille: 'produit',
    garde: 'src/stripe-create-checkout.guard.test.ts',
    modifs: [r(
      'supabase/functions/stripe-create-checkout/index.ts',
      "if (allow) headers['Access-Control-Allow-Origin'] = allow",
      "headers['Access-Control-Allow-Origin'] = '*'",
    )],
    attendu: ["l'origine CORS est une ALLOWLIST, jamais le joker"],
    pourquoi:
      "Le joker CORS amplifie la portée d'un JWT qui fuit : rejeu depuis "
      + "n'importe quelle origine (faille N7).",
  },
  {
    id: 'stripe-checkout-upsert',
    famille: 'produit',
    garde: 'src/stripe-create-checkout.guard.test.ts',
    modifs: [r('supabase/functions/stripe-create-checkout/index.ts', '.upsert(', '.update(')],
    attendu: ["l'identifiant client Stripe est persiste par UPSERT, pas par UPDATE (faille U1)"],
    pourquoi:
      "Un `UPDATE` seul ne matche aucune ligne tant que `subscriptions` n'existe "
      + "pas : l'identifiant du client Stripe est perdu en silence et chaque "
      + 'reprise crée un client orphelin de plus (faille U1).',
  },
  {
    id: 'cron-garde-conditionnelle',
    famille: 'produit',
    garde: 'src/edge-mail-functions.guard.test.ts',
    modifs: [r(
      'supabase/functions/renewal-notice/index.ts',
      "  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {",
      "  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {",
    )],
    attendu: ['garde — report-bug et renewal-notice (C-36) > renewal-notice > echoue FERME quand un secret manque'],
    pourquoi:
      "C'est LE motif « on ne se protège que quand on est déjà protégé » : "
      + "tant que le secret n'est pas posé, la garde laisse passer tout le monde. "
      + 'Introduit puis corrigé le 2026-08-26 dans cette fonction même.',
  },
  {
    id: 'edge-mail-detecteur-secret',
    famille: 'detecteur',
    garde: 'src/edge-mail-functions.guard.test.ts',
    modifs: [r('src/edge-mail-functions.guard.test.ts', String.raw`const GUARD_ON_OWN_SECRET = /if\s*[(]\s*[A-Z_]*SECRET\s*&&/;`, String.raw`const GUARD_ON_OWN_SECRET = /${AVEUGLE}if\s*[(]\s*[A-Z_]*SECRET\s*&&/;`)],
    attendu: ['TEMOIN : les trois detecteurs voient le defaut qu ils cherchent'],
    pourquoi:
      'Un détecteur de « garde conditionnelle à son propre secret » qui ne voit '
      + 'plus rien rend les quatre fonctions d`envoi « fermées » sans les avoir lues.',
  },
  {
    id: 'edge-mail-detecteur-expediteur',
    famille: 'detecteur',
    garde: 'src/edge-mail-functions.guard.test.ts',
    modifs: [r('src/edge-mail-functions.guard.test.ts', "const SENDER_WITH_DEFAULT = /Deno[.]env[.]get[(]'[A-Z_]*FROM'[)]\\s*[?][?]/;", `const SENDER_WITH_DEFAULT = /${AVEUGLE}Deno[.]env[.]get[(]'[A-Z_]*FROM'[)]\\s*[?][?]/;`)],
    attendu: ['TEMOIN : les trois detecteurs voient le defaut qu ils cherchent'],
    pourquoi:
      "Le défaut S-4 (un expéditeur par défaut sur un domaine que Resend ne "
      + 'signera jamais) rendait l`envoi IMPOSSIBLE. Un détecteur aveugle le laisserait revenir.',
  },
  {
    id: 'rgpd-friends-symetrie',
    famille: 'produit',
    garde: 'src/rgpd-erasure.guard.test.ts',
    modifs: [r('supabase/functions/delete-account/index.ts', 'friend_user_id.eq.', 'user_id.eq.')],
    attendu: ['purge `friends` sur ses DEUX colonnes (user_id + friend_user_id)'],
    pourquoi:
      '`friends` est symétrique : un compte y apparaît aussi en '
      + '`friend_user_id`. Purger une seule colonne laisse des lignes portant '
      + 'les données personnelles du compte supprimé (RGPD art. 17).',
  },
  {
    id: 'org-deletion-preuve-append-only',
    famille: 'produit',
    garde: 'src/org-deletion.guard.test.ts',
    modifs: [r('supabase/migration/138_evidence_survives_org_deletion.sql', 'NEW.org_id IS NULL', 'NEW.org_id IS NOT NULL')],
    attendu: ['la mig. 138 conserve l immuabilite : SEUL le detachement est permis'],
    pourquoi:
      '`withdrawal_consents` est une preuve append-only (Conso. L221-28). '
      + "Inverser ce test rend le trigger inopérant : la suppression d'une "
      + "organisation emporte les preuves qu'on produit en litige.",
  },

  // ── check:rls · invariants RLS, sur une migration NEUVE ─────────────
  {
    id: 'rls-auth-uid-nu',
    famille: 'produit',
    garde: { commande: 'scripts/check-rls-advisors.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_rls_uid.sql',
      'CREATE POLICY "sabotage_select" ON public.sabotage_uid FOR SELECT\n  USING (user_id = auth.uid());\n',
    )],
    raison: /policy "sabotage_select" sur sabotage_uid utilise auth\.uid\(\) NU/,
    pourquoi:
      '`auth.uid()` nu est ré-évalué PAR LIGNE scannée (advisor auth_rls_initplan, '
      + 'mig. 043). La règle a déjà régressé deux fois (mig. 059, 082).',
  },
  {
    id: 'rls-deux-permissives',
    famille: 'produit',
    garde: { commande: 'scripts/check-rls-advisors.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_rls_or.sql',
      'CREATE POLICY "sabotage_a" ON public.sabotage_or FOR SELECT USING (user_id = (select auth.uid()));\n'
        + 'CREATE POLICY "sabotage_b" ON public.sabotage_or FOR SELECT USING (shared = true);\n',
    )],
    raison: /sabotage_or a 2 policies PERMISSIVE pour SELECT/,
    pourquoi:
      'Deux policies PERMISSIVE sur le même couple rôle+action sont évaluées '
      + 'séparément puis OR-ées à chaque requête (mig. 049) ; la mig. 077 en a ajouté deux sur `events`.',
  },
  {
    id: 'rls-fonction-revoquee',
    famille: 'produit',
    garde: { commande: 'scripts/check-rls-advisors.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_rls_subtree.sql',
      'CREATE POLICY "sabotage_subtree" ON public.sabotage_t FOR UPDATE\n'
        + '  USING (true)\n'
        + '  WITH CHECK (user_id IN (SELECT public.get_subtree(org_id, (select auth.uid()))));\n',
    )],
    raison: /policy "sabotage_subtree" sur sabotage_t appelle get_subtree\(\)/,
    pourquoi:
      "`get_subtree` est révoqué à `authenticated` (mig. 100) : une policy qui l'appelle "
      + 'échoue en « permission denied » pour un sous-ensemble d utilisateurs, en production (B-1).',
  },
  {
    id: 'rls-detecteur-regle-3',
    famille: 'detecteur',
    garde: 'scripts/migration-guards.test.mjs',
    modifs: [r('scripts/check-rls-advisors.mjs', '    if (!called.test(p.body)) continue;', '    continue;')],
    attendu: ['ÉCHOUE quand une policy appelle une fonction révoquée à authenticated'],
    pourquoi:
      'Une règle 3 qui ne compare plus rien laisse revenir la policy de la mig. 107, '
      + 'qui rappelait `get_subtree` sept jours après sa révocation.',
  },

  // ── validate:migrations · garde statique des `.sql` ────────────────
  {
    id: 'migration-trigger-non-revoque',
    famille: 'produit',
    garde: { commande: 'scripts/validate-migrations.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_trigger.sql',
      'CREATE OR REPLACE FUNCTION public.sabotage_touch()\nRETURNS TRIGGER\nLANGUAGE plpgsql\n'
        + "SECURITY INVOKER\nSET search_path = ''\nAS $fn$\nBEGIN\n  RETURN NEW;\nEND;\n$fn$;\n",
    )],
    raison: /fonction de trigger sabotage_touch\(\) jamais REVOKE-ee pour anon/,
    pourquoi:
      'Une fonction de trigger restée exécutable par `anon` / `authenticated` noie les '
      + 'advisors (B-3) : c`est ce bruit qui a masqué la vraie anomalie de la mig. 108.',
  },
  {
    id: 'migration-validateur-definer',
    famille: 'produit',
    garde: { commande: 'scripts/validate-migrations.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_definer.sql',
      'CREATE OR REPLACE FUNCTION public.validate_sabotage()\nRETURNS TRIGGER\nLANGUAGE plpgsql\n'
        + 'SECURITY DEFINER\nAS $$ BEGIN RETURN NEW; END; $$;\n'
        + 'REVOKE ALL ON FUNCTION public.validate_sabotage() FROM PUBLIC, anon, authenticated;\n',
    )],
    raison: /validate_sabotage\(\) en SECURITY DEFINER — une garde qui ne fait que VALIDER/,
    pourquoi:
      "Un trigger de validation en DEFINER s'exécute avant le WITH CHECK de la RLS : "
      + 'ses messages d`erreur deviennent un oracle sur des lignes non lisibles (B-3, mig. 143).',
  },
  {
    id: 'migration-nom-invalide',
    famille: 'produit',
    garde: { commande: 'scripts/validate-migrations.mjs' },
    modifs: [c('supabase/migration/999-Sabotage.sql', 'SELECT 1;\n')],
    raison: /999-Sabotage\.sql: nom invalide/,
    pourquoi:
      'Le dossier est un changelog MANUEL : un nom hors `NNN_snake_case.sql` casse '
      + "l'ordre déterministe d'application, donc la reconstruction de la base.",
  },
  {
    id: 'migration-detecteur-public',
    famille: 'detecteur',
    garde: 'scripts/migration-guards.test.mjs',
    modifs: [
      r('scripts/validate-migrations.mjs', String.raw`    if (/\banon\b/i.test(roles)) revokedAnon.add(fn);`, String.raw`    if (/\b(anon|public)\b/i.test(roles)) revokedAnon.add(fn);`),
      r('scripts/validate-migrations.mjs', String.raw`    if (/\bauthenticated\b/i.test(roles)) revokedAuth.add(fn);`, String.raw`    if (/\b(authenticated|public)\b/i.test(roles)) revokedAuth.add(fn);`),
    ],
    attendu: ['ÉCHOUE si seul PUBLIC est révoqué'],
    pourquoi:
      '`REVOKE … FROM PUBLIC` ne retire pas le GRANT par défaut de Supabase (leçon de la '
      + 'mig. 094b) : un détecteur qui le compte déclarerait fermées des fonctions ouvertes.',
  },

  // ═════════════════════════════════════════════════════════════════
  // RGPD — effacement, portabilité, conservation
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'effacement-table-sans-decision',
    famille: 'produit',
    garde: { commande: 'scripts/check-erasure-coverage.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_erasure.sql',
      'CREATE TABLE IF NOT EXISTS public.sabotage_notes (\n'
        + '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n'
        + '  user_id UUID NOT NULL REFERENCES auth.users(id),\n'
        + '  contenu TEXT\n);\n',
    )],
    raison: /`sabotage_notes` porte une colonne `user_id` \(999_sabotage_erasure\.sql\) et AUCUNE décision/,
    pourquoi:
      "Une table neuve de données personnelles sans décision d'effacement : la suppression "
      + 'de compte réussit, la personne reçoit sa confirmation, et ses lignes restent (art. 17).',
  },
  {
    id: 'effacement-cascade-retiree',
    famille: 'produit',
    garde: { commande: 'scripts/check-erasure-coverage.mjs' },
    modifs: [r(
      'supabase/migration/192_org_saved_views.sql',
      'DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,',
      'DEFAULT auth.uid() REFERENCES auth.users(id),',
    )],
    raison: /`org_saved_views` est déclarée `cascade` mais sa colonne ne porte PAS/,
    pourquoi:
      "La déclaration `cascade` affirme que Postgres efface ces lignes : sans la clause, "
      + "il ne le fait pas, et c'est cette déclaration-là qu'on produirait en contrôle.",
  },
  {
    id: 'effacement-purge-oubliee',
    famille: 'produit',
    garde: { commande: 'scripts/check-erasure-coverage.mjs' },
    modifs: [r('supabase/functions/delete-account/index.ts', "'tasks',", '')],
    raison: /`tasks` est déclarée `purge` mais n'est pas dans `USER_OWNED_TABLES`/,
    pourquoi:
      'La décision écrite et le code de `delete-account` ne disent plus la même chose : '
      + 'les tâches ne seraient plus purgées explicitement avant la suppression du compte.',
  },
  {
    id: 'portabilite-colonne-neuve',
    famille: 'produit',
    garde: { commande: 'scripts/check-portability-export.mjs' },
    modifs: [c('supabase/migration/999_sabotage_portability.sql', 'ALTER TABLE public.tasks ADD COLUMN sabotage_note TEXT;\n')],
    raison: /`tasks\.sabotage_note` n'est NI exportée NI déclarée exclue/,
    pourquoi:
      "Une colonne saisie qui n'entre pas dans l'export : le fichier se télécharge, "
      + "s'ouvre, et il lui manque ce que la personne a fourni (art. 20, C-94).",
  },
  {
    id: 'portabilite-entete-retire',
    famille: 'produit',
    garde: { commande: 'scripts/check-portability-export.mjs' },
    modifs: [r('src/lib/csv-export.ts', "'color', 'icon', 'completions'", "'color', 'completions'")],
    raison: /`habits\.icon` est déclarée exportée sous l'en-tête `icon`/,
    pourquoi:
      "L'icône d'habitude a manqué à l'export depuis sa création jusqu'au 2026-09-20 : "
      + 'la confrontation au schéma est ce qui l`a nommée, pas une relecture.',
  },
  {
    id: 'portabilite-table-neuve',
    famille: 'produit',
    garde: { commande: 'scripts/check-portability-export.mjs' },
    modifs: [c(
      'supabase/migration/999_sabotage_portability_table.sql',
      'CREATE TABLE IF NOT EXISTS public.sabotage_journal (\n'
        + '  id UUID PRIMARY KEY,\n'
        + '  user_id UUID NOT NULL,\n'
        + '  texte TEXT\n);\n',
    )],
    raison: /La table `sabotage_journal` porte `user_id` et n'est NI exportée NI déclarée/,
    pourquoi:
      "Une table entière absente de l'export est le plus gros trou possible de l'article 20.",
  },
  {
    id: 'conservation-ligne-orpheline',
    famille: 'produit',
    garde: RETENTION,
    modifs: [c('.sabotages/base-simulee.json', '{ "orphelines": { "tasks.user_id": 3 } }\n')],
    raison: /`tasks` : 3 ligne\(s\) dont le compte n'existe plus/,
    pourquoi:
      'Une ligne qui survit à son compte est une donnée personnelle conservée SANS BASE '
      + 'LÉGALE : la forme exacte du défaut RGPD réel de ce dépôt (`shared_tasks`, `friends`).',
  },
  {
    id: 'conservation-duree-depassee',
    famille: 'produit',
    garde: RETENTION,
    modifs: [c('.sabotages/base-simulee.json', '{ "ages": { "team_tasks": 45 } }\n')],
    raison: /`team_tasks` : une ligne de 45 jours, au-delà des 31 déclarés/,
    pourquoi:
      'Le registre art. 30 déclare 30 jours de corbeille : une ligne de 45 jours fait du '
      + "registre une pièce fausse, et un registre faux atteste qu'on savait.",
  },

  // ═════════════════════════════════════════════════════════════════
  // BUDGET — architecture et bundle
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'architecture-from-hors-repository',
    famille: 'produit',
    garde: 'src/architecture.guard.test.ts',
    modifs: [c(
      'src/components/SabotageLectureDirecte.tsx',
      "import { supabase } from '@/lib/supabase';\n\n"
        + "export async function lire() {\n  return supabase.from('tasks').select('*');\n}\n",
    )],
    attendu: ['aucune page ni composant ne lit une table en direct'],
    pourquoi:
      'Le pattern repository est la frontière de données UNIQUE : c`est lui qui rend une '
      + 'sortie de Supabase envisageable en jours plutôt qu`en mois.',
  },
  {
    id: 'architecture-balayage-vide',
    famille: 'detecteur',
    garde: 'src/architecture.guard.test.ts',
    modifs: [r('src/architecture.guard.test.ts', "const SCAN_ROOTS = ['src'];", "const SCAN_ROOTS = ['src/nexistepas'];")],
    attendu: ['TEMOIN : le balayage voit reellement des fichiers'],
    pourquoi:
      'Un balayage qui ne trouve plus rien rend toutes les gardes d`architecture vertes '
      + 'en ne regardant rien : le défaut trouvé par mutation le 2026-09-04.',
  },
  {
    id: 'bundle-sans-dist',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', 'if (!existsSync(ASSETS)) {', 'if (!existsSync(ASSETS) && false) {')],
    attendu: ['TEMOIN DU TEMOIN : sans `dist`, la garde ECHOUE au lieu de se taire'],
    pourquoi:
      '`dist/` n`existe pas dans un checkout frais : une garde qui ne le dit plus '
      + 'explicitement finit par imprimer « respecté » sur zéro chunk mesuré.',
  },
  {
    id: 'bundle-plafond-propre-ignore',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', 'const plafond = propre ?? BUDGETS.page;', 'const plafond = BUDGETS.page;')],
    attendu: ['un chunk qui DEPASSE son plafond propre fait rougir la garde'],
    pourquoi:
      'Avant C-85, `TasksPage` pouvait passer de 35 à 69 ko sans qu`un seul job '
      + 'bronche : seul le plafond PAR CHUNK l`en empêche.',
  },
  {
    id: 'bundle-maximum-au-lieu-de-somme',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', '  e.gzip += m.gzip;', '  e.gzip = Math.max(e.gzip, m.gzip);')],
    attendu: ['LA SOMME par nom de base, pas le plus gros fichier'],
    pourquoi:
      'Vite émet plusieurs fichiers sous un même nom de base : juger le plus gros '
      + 'laisserait un baril de plus arriver gratuitement.',
  },
  {
    id: 'bundle-hash-gourmand',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', "name.replace(/-[A-Za-z0-9_-]{8}\\.js$/, '')", "name.replace(/-[A-Za-z0-9_-]{8,}\\.js$/, '')")],
    attendu: ['le decoupage du hash ne mange pas le nom de base'],
    pourquoi:
      'Le défaut réel documenté dans la garde : `{8,}` transformait `vendor-charts-DMeWk7Ji.js` '
      + 'en `vendor`, et les exemptions ne matchaient plus rien. Témoin trouvé MORT sur ce '
      + 'sabotage au premier rejeu du 2026-10-15, et réparé le jour même.',
  },
  {
    id: 'bundle-hash-sans-tiret',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', "name.replace(/-[A-Za-z0-9_-]{8}\\.js$/, '')", "name.replace(/-[A-Za-z0-9_]{8}\\.js$/, '')")],
    attendu: ['le decoupage du hash ne mange pas le nom de base'],
    pourquoi:
      'Le hash Vite est en base64url et peut contenir un tiret (`C-bIaeYw`) : un découpage qui '
      + 'ne l`admet pas laisse le nom ENTIER, et le chunk échappe à son plafond.',
  },
  {
    id: 'bundle-plafond-perime-tolere',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', '  if (!basesPresentes.has(base)) {', '  if (false) {')],
    attendu: ['un plafond PERIME (chunk disparu) fait rougir la garde'],
    pourquoi:
      'Une table de plafonds qui décrit des chunks morts cesse d`être relue, et une '
      + 'liste qu`on ne relit plus est une liste qu`on cesse de croire.',
  },
  {
    id: 'bundle-entree-comptee-deux-fois',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', '  if (entry && m.name === entry.name) continue; // budget propre : `BUDGETS.entry`', '')],
    attendu: ["le chunk d'ENTREE n'est pas compte deux fois"],
    pourquoi:
      "Compter l'entrée dans la somme `index` ferait échouer la garde sur une ADDITION : "
      + 'un rouge qu`on finirait par « corriger » en remontant le plafond.',
  },
  {
    id: 'bundle-page-sans-borne',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', 'const plafond = propre ?? BUDGETS.page;', 'const plafond = propre ?? Infinity;')],
    attendu: ['un chunk SANS plafond propre reste juge par le budget de page'],
    pourquoi:
      'Un écran neuf n`a pas à être déclaré pour exister, mais il doit rester sous la '
      + 'borne générique : sans elle, il est sans borne du tout.',
  },
  {
    id: 'bundle-rapport-muet',
    famille: 'detecteur',
    garde: 'scripts/check-bundle-budget.guard.test.mjs',
    modifs: [r('scripts/check-bundle-budget.mjs', '  if (propre && gzip >= 12_000) {', '  if (false) {')],
    attendu: ['un build sain passe, et la garde dit combien de chunks elle a mesures'],
    pourquoi:
      'Une garde qui sort 0 sans NOMMER ce qu`elle a mesuré ne se distingue pas d`une '
      + 'garde qui n`a rien lu.',
  },

  // ═════════════════════════════════════════════════════════════════
  // I18N
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'i18n-cle-manquante',
    famille: 'produit',
    garde: { commande: 'scripts/i18n-check.mjs' },
    modifs: [r('src/locales/en/csv.json', '"krWeight": "KR weight"', '"krWeigth": "KR weight"')],
    raison: /en\/csv: clé manquante : col\.krWeight/,
    pourquoi:
      'Une clé absente du catalogue `en` affiche la clé brute, ou retombe sur le '
      + 'français, sans que rien à l`écran ne le signale.',
  },
  {
    id: 'i18n-valeur-recopiee',
    famille: 'produit',
    garde: { commande: 'scripts/i18n-identical.mjs', args: ['--list'] },
    modifs: [r('src/locales/en/csv.json', '"krWeight": "KR weight"', '"krWeight": "KR Pondération"')],
    raison: /csv\.col\.krWeight = "KR Pondération"/,
    pourquoi:
      'Une valeur `en` recopiée du `fr` est une traduction manquante que le moteur '
      + 'ne signalera jamais : il affiche le français, et l`écran a l`air traduit.',
  },
  {
    id: 'i18n-chaine-en-dur',
    famille: 'produit',
    garde: { commande: 'scripts/i18n-scan.mjs', args: ['--list'] },
    modifs: [c(
      'src/components/SabotageChaineEnDur.tsx',
      'export function SabotageChaineEnDur() {\n  return <p>Votre tâche a été enregistrée avec succès</p>;\n}\n',
    )],
    raison: /src\/components\/SabotageChaineEnDur\.tsx[\s\S]*Votre tâche a été enregistrée avec succès/,
    pourquoi:
      'Le cliquet est à ZÉRO chaîne en dur : une phrase française écrite dans un '
      + 'composant reste en français pour tous les anglophones.',
  },

  // ═════════════════════════════════════════════════════════════════
  // RGPD — les témoins des deux gardes dérivées du schéma (C-92, C-94)
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['rgpd-alter-premiere-clause', r('scripts/check-erasure-coverage.mjs', String.raw`      for (const clause of m[2].split(/,\s*(?=(?:ADD|DROP|ALTER|RENAME|VALIDATE)\b)/i)) {`, '      for (const clause of [m[2]]) {'),
      '`tablesAvecUserId` lit CHAQUE clause d un `ALTER TABLE`, et rien que la sienne',
      "Le défaut du 2026-10-09 : un `user_id` ajouté en SECONDE clause d'un ALTER était invisible, donc sa table jamais exigée à l'effacement."],
    ['rgpd-alter-ignore', r('scripts/check-erasure-coverage.mjs', '      if (out.has(m[1])) continue;', '      continue;'),
      '`tablesAvecUserId` voit `CREATE TABLE` ET `ALTER TABLE ADD COLUMN`',
      "Un `user_id` ajouté par ALTER est la forme la plus courante d'une donnée personnelle qui arrive après coup : l'extracteur doit la voir."],
    ['rgpd-cascade-sur-parole', r('scripts/check-erasure-coverage.mjs', String.raw`  return /REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(ligne);`, String.raw`  return /REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i.test(ligne);`),
      '`cascadeProuvee` ne croit personne sur parole',
      'Une référence SANS cascade prise pour une cascade : la déclaration « Postgres efface ces lignes » deviendrait invérifiable.'],
    ['rgpd-cascade-indirecte-large', r('scripts/check-erasure-coverage.mjs', String.raw`    if (/\buser_id\b/i.test(m[1])) return true;`, '    return true;'),
      '`cascadeIndirecteProuvee` : une clé composite vers une table qui, elle, cascade',
      "Une clé qui ne porte pas `user_id` n'emporte pas la ligne au départ du compte : la tenir pour une cascade est une dispense déguisée."],
    ['porta-drop-ignore', r('scripts/check-portability-export.mjs', '        out.get(m[1])?.delete(dr[1]);', '        void dr;'),
      '`colonnesParTable` suit les ajouts ET les SUPPRESSIONS de colonnes',
      "Un extracteur qui ignore les `DROP COLUMN` décrit le schéma qu'on croit avoir : `collaborators` avait été déclarée exclue de mémoire, alors que la mig. 028 l'a supprimée."],
    ['porta-premiere-clause', r('scripts/check-portability-export.mjs', String.raw`      for (const a of m[2].matchAll(/\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/gi)) {`, String.raw`      for (const a of [/\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/i.exec(m[2])].filter(Boolean)) {`),
      '`colonnesParTable` voit CHAQUE clause d un `ALTER TABLE` a plusieurs `ADD COLUMN`',
      "`tasks.health` (mig. 214) n'existait pas pour la garde, qui n'aurait jamais réclamé son export : la seconde clause d'un ALTER était perdue."],
    ['porta-commentaires-lus', r('scripts/check-portability-export.mjs', "    .replace(/[/][*][^]*?[*][/]/g, ' ')", "    .replace(/(?!)/g, ' ')"),
      '`entetesDeclarees` lit a travers les COMMENTAIRES',
      "Une parenthèse dans un commentaire coupait la lecture d'un `cols(...)` : le détecteur accusait le code de ce dont il était lui-même coupable."],
  ].map(([id, modif, attendu, pourquoi]) => ({
    id, famille: 'detecteur', garde: 'scripts/check-rgpd-coverage.guard.test.mjs', modifs: [modif], attendu: [attendu], pourquoi,
  })),
  {
    id: 'rgpd-purge-renommee',
    famille: 'produit',
    garde: 'scripts/check-rgpd-coverage.guard.test.mjs',
    modifs: [r('supabase/functions/delete-account/index.ts', 'const USER_OWNED_TABLES = [', 'const TABLES_DU_COMPTE = [')],
    attendu: ['`tablesPurgees` lit le bloc de delete-account'],
    pourquoi:
      "`delete-account` restructurée : la garde ne saurait plus lire ce qu'elle purge, et "
      + 'toutes ses comparaisons `purge` se feraient contre un ensemble vide.',
  },
  {
    id: 'rgpd-preuve-qui-cascade',
    famille: 'produit',
    garde: 'scripts/check-rgpd-coverage.guard.test.mjs',
    modifs: [r('supabase/migration/125_payment_journal_inalterable.sql', '  user_id            UUID,', '  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,')],
    attendu: ['le VRAI depot : 22 tables portent `user_id`, toutes decidees'],
    pourquoi:
      'Le journal fiscal inaltérable (CGI art. 286-I-3° bis) qui cascade avec le compte : la '
      + 'conservation annoncée au contrôleur n`existerait pas.',
  },
  {
    id: 'porta-entete-krweight',
    famille: 'produit',
    garde: 'scripts/check-rgpd-coverage.guard.test.mjs',
    modifs: [r('src/lib/csv-export.ts', "    'krWeight',", '')],
    attendu: ['les quatre colonnes ajoutees le 2026-09-20 sont bien dans l export'],
    pourquoi:
      'La pondération des résultats clés, choisie par la personne, sortie de l`export : la '
      + 'progression réelle ne serait plus recalculable depuis le fichier (art. 20).',
  },

  // ═════════════════════════════════════════════════════════════════
  // LES GARDES QUI INTERROGENT LA PRODUCTION — leurs fonctions pures
  // (`gardes-posture.guard.test.mjs` : posture, Stripe, conservation,
  // coût serveur, sondes, environnement, acquisition, notes, pages i18n)
  // ═════════════════════════════════════════════════════════════════
  ...[
    // ── check:supabase-posture (C-88)
    ['posture-occurrences-ecrasees', 'detecteur', r('scripts/check-supabase-posture.mjs', '    out[l.name] = { niveau: l.level, compte: (out[l.name]?.compte ?? 0) + occurrences };', '    out[l.name] = { niveau: l.level, compte: occurrences };'),
      'TEMOIN : la forme de l API Management, une entrée PAR OCCURRENCE, se compte',
      'Du 2026-09-20 au 2026-10-02, chaque advisor comptait ZÉRO : la hausse 52 → 80 des fonctions DEFINER est passée sans un mot.'],
    ['posture-findings-ignores', 'detecteur', r('scripts/check-supabase-posture.mjs', '    const occurrences = l.count ?? l.findings?.length ?? 1;', '    const occurrences = l.count ?? 1;'),
      '`resumerAdvisors` réduit la réponse à ce qui se compare',
      'Un advisor qui change de forme compterait 1 au lieu de 3 : une hausse passerait pour une stabilité.'],
    ['posture-hausse-toleree', 'detecteur', r('scripts/check-supabase-posture.mjs', '    if (m.compte > r.compte) {', '    if (m.compte > r.compte + 1) {'),
      '`comparerAdvisors` voit une HAUSSE et un advisor NEUF',
      'Une fonction DEFINER de plus exposée à `authenticated` est exactement le +1 que la garde existe pour voir.'],
    ['posture-niveau-ignore', 'detecteur', r('scripts/check-supabase-posture.mjs', '    if (m.niveau !== r.niveau) {', '    if (false) {'),
      'une BAISSE n est pas un échec, et un changement de NIVEAU en est un',
      'Un advisor qui passe de WARN à ERROR au même compte est une aggravation, pas un statu quo.'],
    ['posture-reglage-retire', 'produit', r('scripts/check-supabase-posture.mjs', '  mfa_totp_enroll_enabled: "Enrôlement TOTP. La console `/admin` en dépend (mig. 131, exigence `aal2`).",', ''),
      'les réglages surveillés portent tous une raison',
      "L'enrôlement TOTP se coupe en deux clics dans le Dashboard, hors du dépôt : `/admin` (aal2) deviendrait inaccessible sans qu'aucune garde le lise."],
    // ── check:stripe-prices (C-106)
    ['stripe-grille-modifiee', 'produit', r('src/modules/billing/premium-config.ts', 'export const ENTERPRISE_YEARLY_DISCOUNT = 0.3;', 'export const ENTERPRISE_YEARLY_DISCOUNT = 0.25;'),
      'la grille est LUE dans premium-config.ts, pas recopiée',
      'La remise annuelle change dans le code : la grille lue doit le refléter, sinon la garde compare Stripe à une copie.'],
    ['stripe-grille-illisible', 'detecteur', r('scripts/check-stripe-prices.mjs', '  if (!bloc) {', '  if (false) {'),
      'une grille illisible fait JETER, pas rendre une liste vide',
      'Une grille vide rend « 0 palier comparé, 0 écart » : un vert sur rien.'],
    ['stripe-palier-produit-ignore', 'detecteur', r('scripts/check-stripe-prices.mjs', '  return prix.metadata?.cosmo_tier ?? prix.product?.metadata?.cosmo_tier ?? null;', '  return prix.metadata?.cosmo_tier ?? null;'),
      '`palierDe` lit le prix PUIS son produit',
      "Un palier porté par le produit Stripe et non par le prix deviendrait invisible : ses prix ne seraient jamais rapprochés."],
    ['stripe-doublon-tolere', 'detecteur', r('scripts/check-stripe-prices.mjs', '      if (candidats.length > 1) {', '      if (false) {'),
      'LE DOUBLON est vu — le défaut silencieux de C-106',
      'Deux prix actifs pour un palier font rendre `yearly_unavailable` : l`encaissement annuel s`arrête sans que rien ne casse.'],
    ['stripe-ttc-ignore', 'detecteur', r('scripts/check-stripe-prices.mjs', "      if (p.tax_behavior !== 'inclusive') {", '      if (false) {'),
      'un MONTANT, une DEVISE ou un `tax_behavior` faux sont vus',
      'Un prix `exclusive` ferait payer la TVA EN PLUS à un particulier (Conso. L112-1, décision du 2026-08-26).'],
    ['stripe-pagination-coupee', 'detecteur', r('scripts/check-stripe-prices.mjs', '    if (!j.has_more) return out;', '    return out;'),
      '`prixStripe` pagine, et refuse une réponse en erreur',
      'Une seule page lue : un doublon au-delà des cent premiers prix ne serait jamais vu.'],
    // ── check:retention (C-93)
    ['retention-sql-null', 'detecteur', r('scripts/check-retention.mjs', '        + ` WHERE x.${colonne} IS NOT NULL AND u.id IS NULL`,', '        + ` WHERE u.id IS NULL`,'),
      'le SQL des orphelines cite CHAQUE table, sans en sauter',
      "Sans `IS NOT NULL`, une invitation vers une adresse sans compte passe pour une orpheline : la garde rougit pour une fausse raison, et on apprend à l'ignorer."],
    ['retention-colonne-inexistante', 'detecteur', r('scripts/check-retention.mjs', "  { table: 'friend_requests', colonne: 'sender_id', traitement: 'T3' },", "  { table: 'friend_requests', colonne: 'user_id', traitement: 'T3' },"),
      'C-112 · chaque couple table/colonne a un libellé UNIQUE, et friend_requests est lue sur ses deux comptes',
      "`friend_requests.user_id` n'existe pas : l'UNION entière échouait en 42703, et AUCUNE table n'était contrôlée du 2026-09-20 au 09-24."],
    ['retention-age-created-at', 'detecteur', r('scripts/check-retention.mjs', '        + ` COALESCE(EXTRACT(DAY FROM now() - min(${colonne}))::int, 0) AS age`', '        + ` COALESCE(EXTRACT(DAY FROM now() - min(created_at))::int, 0) AS age`'),
      'le SQL des âges utilise la VRAIE colonne de date de chaque table',
      "`payment_records` n'a pas de `created_at` : la garde échouerait sur une erreur SQL, rouge pour la mauvaise raison."],
    ['retention-preuve-retiree', 'detecteur', r('scripts/check-retention.mjs', "export const PREUVES = new Set(['payment_records', 'payment_closures', 'withdrawal_consents', 'renewal_notices']);", "export const PREUVES = new Set(['payment_records', 'payment_closures', 'renewal_notices']);"),
      'les deux tables de PREUVE sont exemptées du contrôle d orphelines',
      "La preuve de consentement (Conso. L221-28) survit au compte par OBLIGATION : la tenir pour orpheline pousserait à la purger."],
    ['retention-duree-inventee', 'detecteur', r('scripts/check-retention.mjs', "    jours: null,\n    traitement: 'T7',", "    jours: 7,\n    traitement: 'T7',"),
      'une durée NON DÉCLARÉE au registre vaut `null`, jamais un chiffre inventé',
      "Un seuil de 7 jours « qui paraît raisonnable » écrirait le registre art. 30 depuis un script : la décision appartient à Axel."],
    // ── check:db-cost (C-87)
    ['dbcost-explain-superutilisateur', 'detecteur', r('scripts/check-db-cost.mjs', "    'SET LOCAL ROLE authenticated;',", ''),
      'l EXPLAIN tourne sous `authenticated`, avec des claims, et ROLLBACK',
      "Sans le rôle, l'API exécute en superutilisateur : la RLS ne s'applique pas, et le plan mesuré n'est pas celui d'un utilisateur."],
    ['dbcost-plan-racine-seule', 'detecteur', r('scripts/check-db-cost.mjs', '    for (const f of n.Plans ?? []) parcourir(f);', ''),
      '`extraire` lit les chiffres d un plan, et compte les Seq Scan',
      'Un plan lu à sa seule racine ne compte aucun Seq Scan : la dérive vers un parcours complet passerait inaperçue.'],
    ['dbcost-pente-un-point', 'detecteur', r('scripts/check-db-cost.mjs', '  if (propres.length < 2) return null;', '  if (propres.length < 1) return null;'),
      '`pente` compare le DERNIER point au PREMIER, et refuse d un seul point',
      "Une pente calculée sur un seul point vaut toujours 1 : « stable » sans avoir rien comparé."],
    ['dbcost-requete-qui-ecrit', 'produit', r('scripts/check-db-cost.mjs', "    sql: 'SELECT * FROM public.habits ORDER BY created_at',", "    sql: 'UPDATE public.habits SET name = name RETURNING *',"),
      'chaque requête de référence porte un plafond ET une raison',
      "Une requête de référence qui ÉCRIT, jouée chaque jour contre la production : la mesure deviendrait une modification."],
    // ── check:edge-smoke (C-91, C-114)
    ['smoke-cron-avec-jeton', 'detecteur', r('scripts/check-edge-smoke.mjs', '        ...(sonde.sansJeton ? {} : { Authorization: `Bearer ${anon}`, apikey: anon }),', '        ...{ Authorization: `Bearer ${anon}`, apikey: anon },'),
      'A-3 · une fonction cron se sonde SANS jeton, et un 401 de la passerelle échoue',
      'Sondée AVEC jeton, une fonction cron passe la passerelle : le `verify_jwt` oublié qui bloque tous les webhooks (A-3) devient invisible.'],
    ['smoke-sans-cle-anon', 'detecteur', r('scripts/check-edge-smoke.mjs', '        ...(sonde.sansJeton ? {} : { Authorization: `Bearer ${anon}`, apikey: anon }),', '        ...(sonde.sansJeton ? {} : { apikey: anon }),'),
      'la sonde envoie la clé anon — sinon elle mesure Supabase, pas la fonction',
      '`verify_jwt` refuse AVANT la fonction : la sonde vérifierait que Supabase est debout, pas notre code.'],
    ['smoke-marqueur-ignore', 'detecteur', r('scripts/check-edge-smoke.mjs', '  if (!re.test(texte)) {', '  if (false) {'),
      'un bon CODE avec un MAUVAIS corps est refusé',
      "Un 405 rendu par un proxy ou une version antérieure déployée n'est pas un 405 de notre fonction : c'est le cœur de C-91."],
    ['smoke-panne-confondue', 'detecteur', r('scripts/check-edge-smoke.mjs', "    return { ok: false, statut: 0, extrait: '', raison: `injoignable : ${e.message}` };", "    return { ok: false, statut: 0, extrait: '', raison: `statut 0 : ${e.message}` };"),
      'un statut inattendu et une panne réseau sont distingués',
      'Une fonction injoignable et une fonction qui répond mal ne se corrigent pas de la même façon : le rapport doit le dire.'],
    ['smoke-destructrice-en-post', 'produit', r('scripts/check-edge-smoke.mjs', "    fonction: 'delete-account',\n    methode: 'GET',", "    fonction: 'delete-account',\n    methode: 'POST',"),
      'les douze fonctions sont sondées, et aucune en écriture',
      "`delete-account` SUPPRIME un compte : sondée en POST chaque jour, la sonde deviendrait l'incident."],
    ['anon-mauvaise-cle', 'detecteur', r('scripts/check-edge-smoke.mjs', "  const anon = Array.isArray(cles) ? cles.find((c) => c.name === 'anon') : null;", '  const anon = Array.isArray(cles) ? cles[0] : null;'),
      'lit la clé nommée « anon » par l API Management',
      'La première clé rendue est la `service_role` : la sonde enverrait le secret qui contourne la RLS.'],
    ['anon-absente-toleree', 'detecteur', r('scripts/check-edge-smoke.mjs', '  if (!anon?.api_key) {', '  if (false) {'),
      'échoue plutôt que de sonder sans clé : refus de l API, ou aucune clé anon',
      'Sonder sans clé, c`est mesurer la passerelle et conclure sur la fonction.'],
    // ── check:env (C-105)
    ['env-sans-limite-de-mot', 'detecteur', r('scripts/check-env-contract.mjs', '/\\bVITE_[A-Z0-9_]+/g)) vues.add(m[0]);', '/VITE_[A-Z0-9_]+/g)) vues.add(m[0]);'),
      'TEMOIN : `INVITE_ROW` n est PAS une variable `VITE_ROW`',
      'Le faux positif du 2026-10-01 : la garde réclamait au contrat deux variables qui n`existent pas.'],
    ['env-exemple-vide', 'detecteur', r('scripts/check-env-contract.mjs', '  if (!existsSync(chemin)) return null;', '  if (!existsSync(chemin)) return new Set();'),
      'un arbre sans `.env.example` rend `null`, pas un ensemble vide',
      'Un ensemble vide se compare silencieusement à tout : l`absence du fichier passerait pour un contrat vide.'],
    ['env-exemple-sans-sentry', 'produit', r('.env.example', 'VITE_SENTRY_DSN=', '# VITE_SENTRY_DSN='),
      '`.env.example` est lu, et une variable REQUISE y figure',
      'Sans `VITE_SENTRY_DSN` au build, Rollup élimine tout le chargement de Sentry : le monitoring disparaît du bundle.'],
    ['env-arbre-oublie', 'detecteur', r('scripts/check-env-contract.mjs', "const ARBRES = ['src', 'prerender.mjs', 'vite.config.ts'];", "const ARBRES = ['prerender.mjs', 'vite.config.ts'];"),
      'toutes les `VITE_*` du code sont vues',
      'Une garde qui ne lit plus `src/` compare le contrat à presque rien, et le déclare tenu.'],
    // ── check:acquisition (C-101)
    ['acquisition-etat-sans-backticks', 'detecteur', r('scripts/check-acquisition.mjs', '\\s*`?([a-z-]+)`?\\s*', '\\s*([a-z-]+)\\s*'),
      'les lignes du tableau des annuaires sont lues avec leur état',
      'Les états sont écrits entre backticks : un lecteur qui ne les admet plus lit un tableau vide, donc aucune action en retard.'],
    ['acquisition-etat-oublie', 'detecteur', r('scripts/check-acquisition.mjs', "export const ETATS = ['a-faire', 'en-cours', 'fait', 'refuse', 'abandonne'];", "export const ETATS = ['a-faire', 'en-cours', 'fait', 'refuse'];"),
      'les cinq états sont les cinq, et pas un de plus',
      'Un état retiré de la liste fermée rendrait « inconnue » chaque action abandonnée.'],
    ['acquisition-premiere-date', 'detecteur', r('scripts/check-acquisition.mjs', '  return /<!--\\s*chiffres-remesures:\\s*(20\\d\\d-\\d\\d-\\d\\d)\\s*-->/.exec(texte)?.[1] ?? null;', '  return /(20\\d\\d-\\d\\d-\\d\\d)/.exec(texte)?.[1] ?? null;'),
      'la fraîcheur se lit sur un MARQUEUR, pas sur la première date venue',
      "La première écriture prenait la première date venue et déclarait frais des chiffres du 09-14 : n'importe quelle note rajeunissait les mesures."],
    // ── check:docs-scored (C-109)
    ['docs-forme-oubliee', 'detecteur', r('scripts/check-docs-scored.mjs', "  { re: /^tableau-de-bord$/, nom: 'tableau-de-bord' },", ''),
      'les quatre formes de marqueur sont reconnues',
      'Le tableau de bord des notes rendu « forme INCONNUE » : la garde rougirait sur le document qui porte les notes.'],
    ['docs-phrase-mal-lue', 'detecteur', r('scripts/check-docs-scored.mjs', "/^>\\s*\\*\\*Note d'audit\\*\\*\\s*—\\s*(.+)$/m", "/^>\\s*\\*\\*Note d'audit\\*\\*\\s*:\\s*(.+)$/m"),
      'la phrase lisible est lue, et exigée',
      'Une phrase jamais lue rend « non-note » sans raison écrite : un document sans note et sans explication.'],
    ['docs-mauvaise-extension', 'detecteur', r('scripts/check-docs-scored.mjs', "filter((f) => f.endsWith('.md')).sort();", "filter((f) => f.endsWith('.mdx')).sort();"),
      'les 28 documents de `docs/` sont vus',
      'Une garde qui ne voit aucun document déclare chacun d`eux en règle.'],
    // ── check:i18n-pages (C-99)
    ['pages-aplatir-tableaux', 'detecteur', r('scripts/check-i18n-pages.mjs', "    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, aplatir(v, cle));", "    if (v && typeof v === 'object') Object.assign(out, aplatir(v, cle));"),
      '`aplatir` descend les objets et laisse les tableaux entiers',
      'Un tableau éclaté en clés `0`, `1`, `2` multiplie les clés comparées entre locales et fausse la parité.'],
    ['pages-pluriels-ecrases', 'detecteur', r('scripts/check-i18n-pages.mjs', '    if (!out.has(m[1])) out.set(m[1], new Set());', '    out.set(m[1], new Set());'),
      '`grouperPluriels` regroupe par racine',
      'Chaque forme écrasant la précédente, un pluriel complet passerait pour incomplet, ou l`inverse.'],
    ['pages-cldr-de-tete', 'detecteur', r('scripts/check-i18n-pages.mjs', '  return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);', "  return new Set(['one', 'other']);"),
      'les catégories CLDR viennent d `Intl`, pas d une liste écrite de tête',
      'Le français a `many` : une liste écrite de tête ne réclamerait jamais la forme manquante.'],
    ['pages-html-entier', 'detecteur', r('scripts/check-i18n-pages.mjs', '  const source = bloc ? bloc[1] : html;', '  const source = html;'),
      '`volumeIndexable` compte le bloc prérendu, pas le HTML entier',
      'Compter le `<head>` et les scripts gonfle le volume indexable : une page vide pour Google passerait pour pleine.'],
    ['pages-slugs-non-apparies', 'detecteur', r('scripts/check-i18n-pages.mjs', '      if (trad[locale] === segment && trad.fr) {', '      if (false) {'),
      '`decouper` apparie les slugs LOCALISÉS',
      'Sans appariement, `/a-propos/` et `/en/about/` sont deux pages sans rapport : le ratio fr↔en des pages éditoriales ne se calcule jamais.'],
    ['pages-catalogue-absent', 'detecteur', r('scripts/check-i18n-pages.mjs', '  if (!existsSync(dossier)) return {};', ''),
      'un catalogue jetable se lit, et un dossier absent rend `{}`',
      'Une locale sans dossier ferait planter la garde au lieu d`être comptée vide.'],
    // ── le catalogue lui-même (C-81)
    ['catalogue-famille-inconnue', 'detecteur', r('scripts/replay-sabotages.catalogue.mjs', "    id: 'csp-wss',\n    famille: 'produit',", "    id: 'csp-wss',\n    famille: 'prod',"),
      'chaque sabotage nomme sa cible, sa garde, ce qui doit rougir et ce qu il protège',
      'Un catalogue mal formé est un rejeu qui ne sait plus ce qu`il prouve.'],
  ].map(([id, famille, modif, attendu, pourquoi]) => ({
    id, famille, garde: 'scripts/gardes-posture.guard.test.mjs', modifs: [modif], attendu: [attendu], pourquoi,
  })),

  // ═════════════════════════════════════════════════════════════════
  // COUVERTURE DE L'OUTILLAGE ET DES EDGE FUNCTIONS (C-82)
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['tooling-shebang-aveugle', 'detecteur', r('scripts/check-tooling-coverage.mjs', "  return contenu.startsWith('#!');", "  return contenu.startsWith('#!/usr/local');"),
      ['`porteUnShebang` voit un shebang, et seulement un shebang', 'TEMOIN : un shebang pose a blanc EST vu'],
      'Un shebang fait sortir un script du rapport de couverture EN SILENCE : le 2026-09-20, trois gardes avaient disparu du périmètre.'],
    ['tooling-shebang-revenu', 'produit', c('scripts/sabotage-outil.mjs', '#!/usr/bin/env node\nexport const sabotage = 1;\n'),
      ['AUCUN fichier du perimetre ne porte de shebang, aujourd hui'],
      'Un script neuf à shebang sort du rapport, et la couverture affichée MONTE : une mesure plus flatteuse que la réalité.'],
    ['tooling-lister-plat', 'detecteur', r('scripts/check-tooling-coverage.mjs', '      if (statSync(chemin).isDirectory()) marcher(chemin);', '      if (statSync(chemin).isDirectory()) continue;'),
      ['`lister` trouve reellement des fichiers, et filtre sur l extension'],
      'Un lister qui ne descend plus dans `scripts/cosmo/` retire le CLI du périmètre sans que rien le dise.'],
    ['tooling-tests-attendus', 'detecteur', r('scripts/check-tooling-coverage.mjs', '  /\\.(test|spec)\\.mjs$/,', ''),
      ['`fichiersAttendus` exclut les tests et garde les gardes'],
      'Des fichiers de test attendus dans le rapport le feraient échouer sur un « manquant » qui n`en est pas un.'],
    ['tooling-exclusions-divergentes', 'produit', r('vitest.tooling.config.ts', "        'scripts/optimize-images.mjs',", ''),
      ['les deux listes d exclusion decrivent le MEME perimetre'],
      'Deux listes d`exclusion qui divergent : un fichier exclu d`un côté et attendu de l`autre, et une garde qu`on finit par faire taire.'],
    ['edgecov-shared-compte', 'detecteur', r('scripts/edge-function-coverage.mjs', '    .filter((n) => !NON_FONCTIONS.has(n))', ''),
      ['les douze Edge Functions sont vues, et `_shared` n en est pas une', 'TEMOIN : une fonction sans temoin EST vue'],
      '`_shared` comptée comme une fonction fausse le plancher de témoins par fonction déployée.'],
    ['edgecov-une-seule-famille', 'detecteur', r('scripts/edge-function-coverage.mjs', "  for (const dossier of ['src', 'scripts', 'e2e']) {", "  for (const dossier of ['src']) {"),
      ['`listerTemoins` ramasse les trois familles de tests'],
      'Un ramasseur aveugle à `scripts/` et `e2e/` déclarerait « 0 témoin » une fonction pourtant couverte.'],
    ['edgecov-fonction-nue', 'produit', c('supabase/functions/sabotage-orpheline/index.ts', "Deno.serve(() => new Response('ok'));\n"),
      ['AUCUNE Edge Function n est sans temoin'],
      'Du code déployé sans un seul témoin : `stripe-create-checkout`, qui ouvre une session de paiement, était à ZÉRO le 2026-09-20.'],
    ['edgecov-tout-est-temoin', 'detecteur', r('scripts/edge-function-coverage.mjs', '      temoins.filter((t) => contenus.get(t).includes(f)),', '      temoins,'),
      ['TEMOIN : une fonction sans temoin EST vue'],
      'Si chaque test compte comme témoin de chaque fonction, aucune fonction n`est jamais nue.'],
    ['tooling-rapport-sans-total', 'produit', c('coverage-tooling/coverage-summary.json', '{ "total": {} }\n'),
      ['le rapport de couverture de l outillage existe apres un run'],
      'Un rapport de couverture sans chiffres jugé « présent » : le juge des seuils lirait des `undefined`.'],
  ].map(([id, famille, modif, attendu, pourquoi]) => ({
    id, famille, garde: 'scripts/check-tooling-coverage.guard.test.mjs', modifs: [modif], attendu, pourquoi,
  })),

  // ═════════════════════════════════════════════════════════════════
  // SEO — sitemap et pages prérendues (C-98)
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['seo-titre-aveugle', r('scripts/check-seo-pages.mjs', "  const title = /<title>([^<]*)<\\/title>/.exec(html)?.[1]?.trim() ?? '';", "  const title = /<titre>([^<]*)<\\/titre>/.exec(html)?.[1]?.trim() ?? '';"),
      'les fonctions de lecture lisent vraiment', 'Un extracteur qui rend toujours vide transforme chaque page en « sans titre » ou, trop laxiste, chaque page en conforme.'],
    ['seo-sanslocale-mutile', r('scripts/check-seo-pages.mjs', '    if (chemin.startsWith(`/${l}/`)) return chemin.slice(`/${l}`.length);', '    if (chemin.startsWith(`/${l}`)) return chemin.slice(`/${l}`.length);'),
      '`sansLocale` retire le prefixe, et seulement lui', '`/entreprise-presentation/` commence par « en » sans être une locale : un préfixe sans slash le mutile.'],
    ['seo-barre-finale', r('scripts/check-seo-pages.mjs', "  return u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;", '  return u.pathname;'),
      '`cheminDeLoc` normalise la barre finale', 'Sans normalisation, `/guide` et `/guide/` sont deux pages : chaque URL du sitemap deviendrait fantôme.'],
    ['seo-actifs-comptes', r('scripts/check-seo-pages.mjs', "      if (['assets', 'fonts', 'screenshots', 'downloads'].includes(entree)) continue;", "      if (['fonts', 'screenshots', 'downloads'].includes(entree)) continue;"),
      '`listerPages` trouve les pages et ignore les actifs', 'Un `index.html` d`artefact compté comme page : la garde exigerait des balises d`un fichier de build.'],
    ['seo-orphelines-tolerees', r('scripts/check-seo-pages.mjs', '    if (cheminsSitemap.has(page)) continue;', '    continue;'),
      'une page PRERENDUE hors sitemap et non declaree fait rougir', 'Une page prérendue que Google ne découvre jamais : le travail de prérendu perdu pour l`indexation.'],
    ['seo-fantomes-toleres', r('scripts/check-seo-pages.mjs', '  const fantomes = [...cheminsSitemap].filter((c) => !parChemin.has(c));', '  const fantomes = [];'),
      'une URL du sitemap SANS page prerendue fait rougir', 'Le défaut le plus coûteux des deux : Google reçoit la coquille SPA vide sur une URL qu`on lui annonce.'],
    ['seo-titre-non-exige', r('scripts/check-seo-pages.mjs', "    if (!b.title) manquantes.push('title');", ''),
      'une balise manquante fait rougir', 'Une page sans `<title>` s`affiche dans les résultats sous un titre que Google invente.'],
    ['seo-canonical-ailleurs', r('scripts/check-seo-pages.mjs', '    if (c !== page) canonMauvaises.push(`${page} → canonical ${c}`);', ''),
      'un `canonical` qui pointe ailleurs fait rougir', 'Un canonical qui pointe ailleurs demande à Google de NE PAS indexer la page où il se trouve.'],
    ['seo-hreflang-sens-unique', r('scripts/check-seo-pages.mjs', '      if (!retour) nonReciproques.push(`${page} annonce ${cible}, qui ne le lui rend pas`);', ''),
      'un `hreflang` NON RECIPROQUE fait rougir', 'Google ignore un groupe hreflang à sens unique EN ENTIER, et en silence : l`anglais n`est jamais servi.'],
    ['seo-noindex-au-sitemap', r('scripts/check-seo-pages.mjs', '    if (/noindex/i.test(b.robots) && cheminsSitemap.has(page)) noindexAuSitemap.push(page);', ''),
      'une page `noindex` AU SITEMAP fait rougir', 'Annoncer une URL qu`on demande par ailleurs de ne pas indexer : un signal contradictoire envoyé à Google.'],
    ['seo-build-incomplet', r('scripts/check-seo-pages.mjs', '  if (locs.length < 10) {', '  if (locs.length < 1) {'),
      'un build INCOMPLET fait rougir au lieu de conclure', 'Un build à deux pages où tout se correspond n`est pas ce site : conclure serait répondre sans mesurer.'],
    ['seo-sans-dist', r('scripts/check-seo-pages.mjs', "  if (!existsSync(DIST) || !existsSync(join(DIST, 'sitemap.xml'))) {", '  if (false) {'),
      'sans `dist`, la garde ECHOUE au lieu de se taire', '`dist/` n`existe pas dans un checkout frais : la garde doit le dire, pas planter ni se taire.'],
    ['seo-rapport-muet', r('scripts/check-seo-pages.mjs', '  console.log(`  pages prérendues     : ${pages.length}`);', '  console.log(`  pages : ${pages.length}`);'),
      'un site sain passe', 'Un vert qui ne dit pas combien de pages il a lues ne se distingue pas d`un vert sur rien.'],
  ].map(([id, modif, attendu, pourquoi]) => ({
    id, famille: 'detecteur', garde: 'scripts/check-seo-pages.guard.test.mjs', modifs: [modif], attendu: [attendu], pourquoi,
  })),

  // ═════════════════════════════════════════════════════════════════
  // CYCLES D'IMPORTS (C-103)
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['cycles-export-ignore', 'detecteur', r('scripts/check-import-cycles.mjs', "  const re = /(?:^|\\n)\\s*(import|export)(\\s[^;]*?)?\\sfrom\\s+['\"]([^'\"]+)['\"]/g;", "  const re = /(?:^|\\n)\\s*(import)(\\s[^;]*?)?\\sfrom\\s+['\"]([^'\"]+)['\"]/g;"),
      '`importsStatiques` voit les imports de VALEUR', 'Un `export … from` est une arête d`exécution : l`ignorer cache les cycles des barils de modules.'],
    ['cycles-types-comptes', 'detecteur', r('scripts/check-import-cycles.mjs', '    if (/^\\s+type\\s/.test(clause)) continue; // `import type … from`', ''),
      '`importsStatiques` IGNORE les types et les imports dynamiques', 'Compter `import type` interdirait de se référencer entre types : une garde qui refuse la bonne réponse finit désarmée.'],
    ['cycles-commentaires-lus', 'detecteur', r('scripts/check-import-cycles.mjs', "    .replace(/[/][*][^]*?[*][/]/g, ' ')", "    .replace(/(?!)/g, ' ')"),
      '`importsStatiques` ne lit pas les commentaires', 'Un import cité en commentaire inventerait une arête, et un cycle qui n`existe pas.'],
    ['cycles-index-ignore', 'detecteur', r('scripts/check-import-cycles.mjs', '    ...EXTENSIONS.map((e) => join(base, `index${e}`)),', ''),
      '`resoudre` gere `@/`, le relatif, les extensions et les index', 'Un baril `index.ts` non résolu retire du graphe tous les modules qui passent par lui.'],
    ['cycles-relatif-ignore', 'detecteur', r('scripts/check-import-cycles.mjs', "  else if (specificateur.startsWith('.')) base = resolve(dirname(depuis), specificateur);", "  else if (specificateur.startsWith('.')) return null;"),
      'un cycle pose A BLANC dans un arbre jetable EST vu', 'Un résolveur qui perd les imports relatifs rend un graphe troué, donc « 0 cycle ».'],
    ['cycles-boucle-ignoree', 'detecteur', r('scripts/check-import-cycles.mjs', '      else if (e === 1) {', '      else if (false) {'),
      '`trouverCycles` voit un cycle, et n en invente pas', 'Un parcours qui ne reconnaît plus un nœud en cours ne voit aucun cycle : un `undefined` à l`exécution, jamais signalé.'],
    ['cycles-tests-comptes', 'detecteur', r('scripts/check-import-cycles.mjs', '        && !/\\.(test|spec)\\.[a-z]+$/.test(entree)', ''),
      '`listerModules` ecarte les tests et les declarations', 'Un test qui importe son module crée une arête que le produit n`exécute jamais.'],
    ['cycles-graphe-minuscule', 'detecteur', r('scripts/check-import-cycles.mjs', '  if (modules.length < 100) {', '  if (modules.length < 1) {'),
      'la garde REFUSE de conclure sur un graphe minuscule', 'Deux fichiers sans cycle ne décrivent pas `src/` : « aucun cycle » serait un vert sur rien.'],
    ['cycles-cycle-reel', 'produit', null,
      'le VRAI depot n a aucun cycle, et son graphe est consequent', 'Un cycle ne casse ni le build ni un test : il rend un `undefined` à l`exécution, au moment où un module lit l`export d`un module pas encore évalué.'],
  ].map(([id, famille, modif, attendu, pourquoi]) => ({
    id,
    famille,
    garde: 'scripts/check-import-cycles.guard.test.mjs',
    modifs: modif ? [modif] : [
      c('src/lib/sabotage-cycle-a.ts', "import { b } from './sabotage-cycle-b';\nexport const a = () => b;\n"),
      c('src/lib/sabotage-cycle-b.ts', "import { a } from './sabotage-cycle-a';\nexport const b = () => a;\n"),
    ],
    attendu: [attendu],
    pourquoi,
  })),

  // ═════════════════════════════════════════════════════════════════
  // COUVERTURE DES MIGRATIONS PAR LA PRODUCTION (C-79)
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['mcov-tout-en-base', r('scripts/check-migration-coverage.mjs', '        if (catalogue[kind].has(nom)) { trouves.push(`${kind}: ${nom}`); continue; }', '        trouves.push(`${kind}: ${nom}`); continue;'),
      'TEMOIN : une migration dont l OBJET N EXISTE PAS est ABSENTE DES DEUX', 'Un classeur qui trouve tout en base rend tout vert : une migration jamais appliquée passerait pour faite (C-77, dix-sept jours).'],
    ['mcov-drop-emporte-tout', r('scripts/check-migration-coverage.mjs', '      if (table && sup.tables.includes(table)) return `${autre}, DROP TABLE ${table}`;', '      if (sup.tables.length > 0) return `${autre}, DROP TABLE`;'),
      "TEMOIN : un DROP TABLE n'emporte QUE les objets de CETTE table", "N'importe quel DROP TABLE excuserait l'absence de n'importe quel objet : une machine à fabriquer du vert."],
    ['mcov-ordre-ignore', r('scripts/check-migration-coverage.mjs', '      if (ordre.get(autre) <= ordre.get(name)) continue;', ''),
      "TEMOIN : l'ordre compte, un DROP ANTERIEUR n'excuse rien", 'Un objet supprimé AVANT sa création n`est pas supprimé : l`excuser cache une migration jamais appliquée.'],
    ['mcov-drop-recree', r('scripts/check-migration-coverage.mjs', '    for (const k of KINDS) sup[k] = sup[k].filter((n) => !cre[k].includes(n));', ''),
      "TEMOIN : un DROP suivi d'un CREATE dans le MEME fichier n'est pas une suppression", '`DROP … IF EXISTS` puis `CREATE` est le motif idempotent du dépôt : le compter comme suppression excuse un objet qui manque.'],
    ['mcov-suppression-crue', r('scripts/check-migration-coverage.mjs', '      const survivantes = ciblesSup.filter(([k, n]) => catalogue[k].has(n));', '      const survivantes = [];'),
      'TEMOIN : une suppression dont la CIBLE EST TOUJOURS LA echoue', '« Suppression vérifiée » rendu sans rien vérifier : la cible est toujours en base.'],
    ['mcov-dispense-eternelle', r('scripts/check-migration-coverage.mjs', '      if (auLedger || trouves.length > 0) {', '      if (false) {'),
      'TEMOIN : une dispense PERIMEE fait echouer la garde', 'Une dispense « non appliquée » qui survit à l`application cesse de décrire la base, et plus rien ne le dit.'],
    ['mcov-ledger-vide', r('scripts/check-migration-coverage.mjs', '  if ((intro.ledger ?? []).length === 0 && (intro.ledger_names ?? []).length === 0) {', '  if (false) {'),
      'TEMOIN : un LEDGER VIDE fait ECHOUER, il ne rend pas un verdict', 'La classe de défaut de `restore-drill.yml` : un contrôle qui ne pouvait pas échouer.'],
    ['mcov-catalogue-vide', r('scripts/check-migration-coverage.mjs', '  if ((intro.tables ?? []).length === 0) {', '  if (false) {'),
      'TEMOIN : un CATALOGUE VIDE fait ECHOUER aussi', 'Un catalogue vide rendrait « ABSENT » partout, ou un vert sur rien selon le ledger : aucun verdict ne vaut sans lecture.'],
  ].map(([id, modif, attendu, pourquoi]) => ({
    id, famille: 'detecteur', garde: 'scripts/check-migration-coverage.guard.test.mjs', modifs: [modif], attendu: [attendu], pourquoi,
  })),

  // ═════════════════════════════════════════════════════════════════
  // LES TÉMOINS DES GARDES DE `src/` — un détecteur rendu aveugle
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['src/date-picker.guard.test.ts', 'dp-detecteur-aveugle', 'detecteur',
      r('src/date-picker.guard.test.ts', `const NATIVE_DATE_INPUT = /type="date"|type={'date'}|type={"date"}/;`, `const NATIVE_DATE_INPUT = /${AVEUGLE}type="date"|${AVEUGLE}type={'date'}|${AVEUGLE}type={"date"}/;`),
      ['TEMOIN : le detecteur voit un champ de date natif', 'TEMOIN : les deux dispenses portent encore un picker natif'],
      'Un détecteur de `<input type="date">` aveugle laisse revenir le calendrier du navigateur, hors thème et hors locale.'],
    ['src/date-picker.guard.test.ts', 'dp-dispense-perimee', 'produit',
      r('src/components/event-modal/EventModalFormDesktop.tsx', 'type="date"', 'type="text"'),
      ['TEMOIN : les deux dispenses portent encore un picker natif'],
      'Une dispense qui ne couvre plus rien finit par en couvrir une vraie : elle doit tomber avec le motif qu`elle excusait.'],
    ['src/components/organization/org-confirm.guard.test.ts', 'oc-balayage-etroit', 'detecteur',
      r('src/components/organization/org-confirm.guard.test.ts', "const ROOTS = ['src/components/organization', 'src/pages/organization'];", "const ROOTS = ['src/pages/organization'];"),
      ['TÉMOIN : le balayage voit les fichiers du mode entreprise'],
      'Un balayage réduit à quelques fichiers déclare le mode entreprise exempt de `window.confirm` sans l`avoir lu.'],
    ['src/components/organization/org-confirm.guard.test.ts', 'oc-nettoyage-vorace', 'detecteur',
      r('src/components/organization/org-confirm.guard.test.ts', "const stripComments = (src: string) => src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\/\\/.*$/gm, '');", "const stripComments = (src: string) => src.replace(/[\\s\\S]*/, '');"),
      ['TÉMOIN : le détecteur voit un window.confirm'],
      'Un nettoyage de commentaires qui mange le code laisse passer un `window.confirm` nu : une suppression irréversible sans dialogue d`impact.'],
    ['src/components/organization/confirm-levels.guard.test.ts', 'cl-nettoyage-vorace', 'detecteur',
      r('src/components/organization/confirm-levels.guard.test.ts', "const code = (src: string) => src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\/\\/.*$/gm, '');", "const code = (src: string) => src.replace(/[\\s\\S]*/, '');"),
      ['témoin : la règle voit un confirm() nu'],
      'La même garde, côté niveaux de confirmation : un lecteur vide déclare chaque fichier conforme.'],
    ['src/components/organization/org-create.guard.test.ts', 'ocr-nettoyage-vorace', 'detecteur',
      r('src/components/organization/org-create.guard.test.ts', "const code = (src: string) => src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\/\\/.*$/gm, '');", "const code = (src: string) => src.replace(/[\\s\\S]*/, '');"),
      ['témoin : le détecteur voit une création en ligne'],
      'Une création d`équipe ou de projet hors du parcours unique redeviendrait invisible.'],
    ['src/edge-config.guard.test.ts', 'ec-toml-aveugle', 'detecteur',
      r('src/edge-config.guard.test.ts', '    const section = line.match(/^\\[functions\\.([a-z0-9-]+)\\]$/);', '    const section = line.match(/^\\[fonctions\\.([a-z0-9-]+)\\]$/);'),
      ['le lecteur de TOML voit ce qu il doit voir (témoin)'],
      'Un lecteur de `config.toml` qui ne voit aucune section rend la comparaison `verify_jwt` vide : le défaut A-3 (webhooks bloqués) redevient invisible.'],
    ['src/edge-swallowed-errors.guard.test.ts', 'es-erreur-toleree', 'detecteur',
      r('src/edge-swallowed-errors.guard.test.ts', "    .filter((binding) => binding.includes('data') && !binding.includes('error'));", "    .filter((binding) => binding.includes('data') && binding.includes('error'));"),
      ['TÉMOIN : le détecteur voit une lecture qui ignore son `error`'],
      'Une lecture qui avale son erreur dans `delete-account` : la suppression « réussit » sur une lecture vide (S-1, S-2).'],
    ['src/scroll-centering.guard.test.ts', 'sc-classes-coupees', 'detecteur',
      r('src/scroll-centering.guard.test.ts', '  const tokens = new Set(value.split(/[^A-Za-z0-9_:/.[\\]%-]+/));', "  const tokens = new Set(value.split(' '));"),
      ['TEMOIN : le detecteur voit le piege, dans les deux ordres'],
      'Le défaut exact de la première écriture : découpé par espaces, un `cn(...)` rend `items-center\',`, et la forme lui échappe.'],
    ['src/workflow-permissions.guard.test.ts', 'wp-tout-permis', 'detecteur',
      r('src/workflow-permissions.guard.test.ts', '  if (/^permissions:/m.test(yaml)) return true;', '  return true;'),
      ['le détecteur refuse un workflow sans permissions (témoin)'],
      'Un workflow sans bloc `permissions` hérite du jeton par défaut, en écriture sur tout le dépôt.'],
    ['src/restore-id.guard.test.ts', 'ri-detecteur-aveugle', 'detecteur',
      r('src/restore-id.guard.test.ts', 'const DISCARDS_ID = /\\{\\s*id\\s*:\\s*_[A-Za-z0-9]*\\s*[,}][^\\n]*\\.\\.\\./;', `const DISCARDS_ID = /${AVEUGLE}\\{\\s*id\\s*:\\s*_[A-Za-z0-9]*\\s*[,}][^\\n]*\\.\\.\\./;`),
      ['TEMOIN : le detecteur voit bien le motif fautif', 'TEMOIN : les deux duplications legitimes portent encore le motif'],
      'Un « Annuler » qui rend l`objet sous un NOUVEL identifiant (R-08) : les liens vers lui sont perdus.'],
    ['src/render-storage.guard.test.ts', 'rs-detecteur-muet', 'detecteur',
      r('src/render-storage.guard.test.ts', '    if (touchesStorage && !/\\btry\\b/.test(body)) found.push(', '    if (false) found.push('),
      ['TÉMOIN : le détecteur voit un initialiseur non protégé'],
      'Un `JSON.parse(localStorage…)` nu dans un initialiseur de rendu fait planter l`écran entier sur une valeur corrompue (A-7).'],
    ['src/render-storage.guard.test.ts', 'rs-try-ignore', 'detecteur',
      r('src/render-storage.guard.test.ts', '    if (touchesStorage && !/\\btry\\b/.test(body)) found.push(', '    if (touchesStorage) found.push('),
      ["TÉMOIN INVERSE : un initialiseur protégé n'est pas signalé"],
      'Une garde qui refuse la forme correcte finit désarmée : le `try` doit suffire.'],
    ['src/modules/capped-read-order.guard.test.ts', 'cr-limite-ignoree', 'detecteur',
      r('src/modules/capped-read-order.guard.test.ts', '    if (!/\\.limit\\(/.test(chain)) continue;', '    continue;'),
      ['témoin : le détecteur voit le motif fautif, et laisse passer la forme juste'],
      'Un tri croissant plafonné rend les PLUS VIEILLES lignes : au-delà du plafond, les récentes disparaissent de l`écran.'],
    ['src/components/modal-a11y.guard.test.ts', 'ma-surfaces-invisibles', 'detecteur',
      r('src/components/modal-a11y.guard.test.ts', '  return /fixed inset-0/.test(source) || /role="(dialog|alertdialog)"/.test(source);', '  return false;'),
      ['detecte bien des surfaces (temoin : une garde qui ne trouve rien passe toujours)'],
      'Une garde qui ne trouve aucune surface modale déclare les 53 câblées sans en avoir lu une.'],
    ['src/design-system.guard.test.ts', 'ds-feuille-aveugle', 'detecteur',
      r('src/design-system.guard.test.ts', `const SHEET_SLIDE = /y:\\s*['"]100%['"]/;`, `const SHEET_SLIDE = /${AVEUGLE}y:\\s*['"]100%['"]/;`),
      ['détecte réellement une feuille écrite à la main (témoin)', 'ne laisse pas un commentaire masquer le code voisin (témoin)'],
      'Une feuille écrite à la main s`ouvre à 0 px visible sous mouvement réduit : le seul accès mobile à OKR, Statistiques et Paramètres (mesuré le 2026-08-24).'],
    ['src/design-system.guard.test.ts', 'ds-commentaire-jusqu-au-bout', 'detecteur',
      r('src/design-system.guard.test.ts', "  src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/(^|[^:])\\/\\/[^\\n]*/g, '$1');", "  src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/(^|[^:])\\/\\/[\\s\\S]*/g, '$1');"),
      ['ne laisse pas un commentaire masquer le code voisin (témoin)'],
      'Un commentaire qui avale la suite du fichier cache le vrai code écrit après lui.'],
    ['src/design-system.guard.test.ts', 'ds-poignee-aveugle', 'detecteur',
      r('src/design-system.guard.test.ts', '    if (!HANDLE_IN_CLASS.some((r) => r.test(cls))) continue;', '    continue;'),
      ['détecte réellement une poignée sans geste (témoin)', 'ne rougit PAS sur une poignée correctement câblée (témoin)'],
      'Une poignée qu`on tire sans que rien ne bouge est pire que pas de poignée (C-07).'],
    ['src/design-system.guard.test.ts', 'ds-geste-aveugle', 'detecteur',
      r('src/design-system.guard.test.ts', `const HAS_DRAG = /useSheetDrag|sheetDragProps|drag=["'{]?y|drag="y"/;`, `const HAS_DRAG = /${AVEUGLE}/;`),
      ['ne rougit PAS sur une poignée correctement câblée (témoin)'],
      'Un détecteur de geste aveugle accuse une poignée correctement câblée : la garde rougit sur la bonne réponse et on la désarme.'],
    ['src/design-system.guard.test.ts', 'ds-barre-prise-pour-poignee', 'detecteur',
      r('src/design-system.guard.test.ts', '    if (isProgressBar(cls)) continue;', ''),
      ['ne confond pas une BARRE DE PROGRESSION avec une poignée (témoin)'],
      'Le cas exact qui a fait rougir la première écriture de cette garde, sur deux fichiers justes.'],
    ['src/design-system.guard.test.ts', 'ds-detecteur-par-fichier', 'detecteur',
      r('src/design-system.guard.test.ts', '    if (isProgressBar(cls)) continue;', '    if (isProgressBar(src)) continue;'),
      ['voit la poignée même quand la barre de progression est dans le MÊME fichier (témoin)'],
      'Un détecteur par FICHIER se tait dès qu`un `overflow-hidden` traîne : il dispenserait une vraie poignée par accident.'],
    ['src/loading-empty-state.guard.test.ts', 'les-detecteur-muet', 'detecteur',
      r('src/loading-empty-state.guard.test.ts', '  return names.filter((n) => new RegExp(String.raw`\\b${n}\\.length\\s*===\\s*0`).test(source));', '  return [];'),
      ['TEMOIN : le detecteur voit le motif fautif et epargne le motif correct', 'TEMOIN : chaque dispense est encore justifiee par une detection reelle'],
      '« Rien » affiché pendant le chargement : l`écran AFFIRME qu`il n`y a pas de données alors qu`il ne les a pas encore lues (C-40).'],
    ['src/loading-empty-state.guard.test.ts', 'les-corpus-vide', 'detecteur',
      r('src/loading-empty-state.guard.test.ts', '    else if (/\\.(ts|tsx)$/.test(entry) && !/\\.test\\./.test(entry)) out.push(rel);', '    else if (/\\.(js)$/.test(entry) && !/\\.test\\./.test(entry)) out.push(rel);'),
      ['TEMOIN : le corpus balaye est bien tout `src`, et pas un repertoire vide'],
      'Le défaut trouvé par mutation dans `architecture.guard` : un corpus vide rend « rien à signaler » pour « rien regardé ».'],
    ['src/modules/error-messages.guard.test.ts', 'em-detecteur-aveugle', 'detecteur',
      r('src/modules/error-messages.guard.test.ts', "const THROW_LITERAL = /throw new Error\\((['\"`])([^]*?)\\1\\)/g;", `const THROW_LITERAL = /${AVEUGLE}throw new Error\\((['"\`])([^]*?)\\1\\)/g;`),
      ['TEMOIN : le detecteur voit une phrase et epargne un code'],
      'Une phrase anglaise lancée par un repository atteint `{{message}}` et s`affiche telle quelle à un francophone (C-62).'],
    ['src/modules/error-messages.guard.test.ts', 'em-corpus-vide', 'detecteur',
      r('src/modules/error-messages.guard.test.ts', '    else if (/\\.(ts|tsx)$/.test(entry) && !/\\.test\\./.test(entry)) out.push(rel);', '    else if (/\\.(js)$/.test(entry) && !/\\.test\\./.test(entry)) out.push(rel);'),
      ['TEMOIN : le corpus balaye est bien `src/modules`'],
      'Une garde qui parcourt le mauvais répertoire rend une liste vide, donc le vert.'],
    ['src/modules/orphan-hooks.guard.test.ts', 'oh-tout-est-consomme', 'detecteur',
      r('src/modules/orphan-hooks.guard.test.ts', '    return word.test(code);', '    return true;'),
      ['TÉMOIN : le balayage voit des hooks, et sait les compter'],
      'Un `consumerCount` toujours positif rend la garde incapable de voir un hook mort (C-66).'],
    ['src/modules/tasks/dependency-errors.guard.test.ts', 'de-phrase-aveugle', 'detecteur',
      r('src/modules/tasks/dependency-errors.guard.test.ts', 'const LOOKS_LIKE_A_SENTENCE = /[A-Za-z]{2,}\\s+[A-Za-z]{2,}/;', `const LOOKS_LIKE_A_SENTENCE = /${AVEUGLE}/;`),
      ['TÉMOIN : le détecteur voit revenir une table de transition'],
      'La table de transition phrase → code retirée le 2026-09-12 pourrait revenir : le module reconnaîtrait une erreur à son TEXTE, qui est traduit.'],
    ['src/modules/tasks/dependency-errors.guard.test.ts', 'de-raise-commentaires-lus', 'detecteur',
      r('src/modules/tasks/dependency-errors.guard.test.ts', "  const code = sql.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' ').replace(/--.*$/gm, ' ');", '  const code = sql;'),
      ['TÉMOIN : un RAISE cité en COMMENTAIRE ne compte pas'],
      'L`en-tête de la mig. 137 cite la forme attendue pour l`expliquer : une garde qui lit les commentaires juge la documentation.'],
    ['src/modules/tasks/dependency-errors.guard.test.ts', 'de-raise-aveugle', 'detecteur',
      r('src/modules/tasks/dependency-errors.guard.test.ts', "  return [...code.matchAll(/RAISE\\s+EXCEPTION\\s+'([^']*)'/gi)].map((m) => m[1]);", '  return [];'),
      ['TÉMOIN : le détecteur voit un RAISE qui redeviendrait une phrase'],
      'Un `RAISE` redevenu phrase casse la reconnaissance de l`erreur côté client : le refus d`une dépendance circulaire s`afficherait en anglais.'],
    ['src/monitoring.guard.test.ts', 'mo-reexport-invisible', 'detecteur',
      r('src/monitoring.guard.test.ts', "const STATIC_SENTRY_IMPORT = /(?:^|\\n)\\s*(?:import|export)\\s[^;]*?from\\s+['\"]@sentry\\/react['\"]/;", "const STATIC_SENTRY_IMPORT = /(?:^|\\n)\\s*(?:import)\\s[^;]*?from\\s+['\"]@sentry\\/react['\"]/;"),
      ['TEMOIN : le detecteur voit un import statique, et epargne un import de type'],
      'Une RÉEXPORTATION crée la même dépendance statique : Sentry reviendrait dans le chunk d`entrée (C-13, C-14).'],
    ['src/monitoring.guard.test.ts', 'mo-porte-sans-sentry', 'produit',
      r('src/lib/sentry-client.ts', "} from '@sentry/react';", "} from '@sentry/browser';"),
      ['TEMOIN : la porte unique existe encore et importe bien Sentry'],
      'Si la porte unique cesse d`importer Sentry, la garde « personne n`importe Sentry hors de la porte » reste verte en ne protégeant plus rien.'],
    ['src/monitoring.guard.test.ts', 'mo-commentaire-demi-retire', 'detecteur',
      r('src/monitoring.guard.test.ts', '      return at === -1 ? line : line.slice(0, at);', '      return at === -1 ? line : line.slice(0, at) + line.slice(at + 2);'),
      ['TEMOIN : le detecteur des filets precoces voit un appel COMMENTE'],
      'Un appel COMMENTÉ pris pour un appel : la garde qui a déjà ne rien mesuré une fois (rejeu du 2026-09-20) le referait.'],
    ['src/org-deletion.guard.test.ts', 'od-cascade-aveugle', 'detecteur',
      r('src/org-deletion.guard.test.ts', '  /REFERENCES\\s+public\\.organizations\\s*\\(\\s*id\\s*\\)\\s+ON\\s+DELETE\\s+CASCADE/i;', '  /REFERENCES\\s+public\\.organisations\\s*\\(\\s*id\\s*\\)\\s+ON\\s+DELETE\\s+CASCADE/i;'),
      ['TEMOIN : le detecteur voit une cascade vers organizations', 'TEMOIN : le detecteur de cascade voit une vraie cascade'],
      'Une preuve qui cascade avec l`organisation part en litige avec elle : ce détecteur a DÉJÀ cessé de regarder une fois.'],
    ['src/org-deletion.guard.test.ts', 'od-garde-audit-laxiste', 'detecteur',
      r('src/org-deletion.guard.test.ts', 'WHERE\\s+id\\s*=\\s*p_org\\s*\\)/i.test(body);', 'WHERE\\s+id\\s*=\\s*p_org\\s*\\)|INSERT/i.test(body);'),
      ['TEMOIN : le detecteur refuse le corps fautif d avant la 216'],
      'Sans sa garde d`existence, `write_org_audit` fait échouer la suppression d`une entreprise en 23503.'],
    ['src/components/org-guide/guide-scenarios.guard.test.ts', 'gs-gabarits-ignores', 'detecteur',
      r('src/components/org-guide/guide-scenarios.guard.test.ts', '      for (const s of suffixes(source)) anchors.set(`${template[1]}${s}`, tag);', ''),
      ["témoin : la garde voit les trois formes d'ancrage, et seulement elles"],
      'Un ancrage écrit en gabarit (`nav-${id}`) invisible : le guide entreprise pointerait vers des boutons qui n`existent plus sans que la garde le dise.'],
    ['src/stripe-create-checkout.guard.test.ts', 'scc-nettoyage-vorace', 'detecteur',
      r('src/stripe-create-checkout.guard.test.ts', '      return at === -1 ? ligne : ligne.slice(0, at);', "      return '';"),
      ['TEMOIN : le nettoyage de commentaires ne mange pas le code'],
      'Un `codeOnly` qui vide la source rend vertes toutes les gardes `not.toMatch` de la fonction qui ouvre une session de paiement.'],
    ['src/stripe-create-checkout.guard.test.ts', 'scc-joker-aveugle', 'detecteur',
      r('src/stripe-create-checkout.guard.test.ts', "const JOKER_CORS = /Access-Control-Allow-Origin'\\]?\\s*[:=]\\s*'\\*'/;", `const JOKER_CORS = /${AVEUGLE}/;`),
      ['TEMOIN : chaque detecteur voit son defaut sur une source SABOTEE'],
      'Un détecteur de joker CORS aveugle laisse revenir la faille N7 sans un mot.'],
    ['src/hooks/use-modal-a11y.guard.test.tsx', 'modal-harnais-toujours-equipe', 'detecteur',
      r('src/hooks/use-modal-a11y.guard.test.tsx', '{open && (withHook ? <TrappedModal onClose={close} /> : <NaiveModal onClose={close} />)}', '{open && <TrappedModal onClose={close} />}'),
      ['TÉMOIN — la même modale sans le hook n’a ni rôle ni aria-modal', 'TÉMOIN — sans le hook, le focus reste sur le déclencheur', 'TÉMOIN — sans le hook, Échap est mort dès que le focus est sorti'],
      'Un harnais qui monte le hook dans les DEUX variantes prouve tout et ne compare rien : les mesures du piège de focus passeraient sur n`importe quelle modale.'],
  ].map(([garde, id, famille, modif, attendu, pourquoi]) => ({ id, famille, garde, modifs: [modif], attendu, pourquoi })),

  // ═════════════════════════════════════════════════════════════════
  // LES TÉMOINS DE LOGIQUE PRODUIT — la fonction gardée, cassée
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['src/components/color-settings-save-order.test.ts', 'cs-creations-non-triees',
      r('src/components/ColorSettingsModal.tsx', "  return orderByDepth(drafts.filter((c) => c.id.startsWith('temp-')));", "  return drafts.filter((c) => c.id.startsWith('temp-'));"),
      ['TÉMOIN : un lot déjà trié à l envers n est PAS rendu tel quel'],
      'Un enfant créé avant son parent référence un `temp-` qui n`existe pas encore : la sauvegarde de l`arbre échoue.'],
    ['src/components/color-settings-save-order.test.ts', 'cs-suppressions-racine-dabord',
      r('src/components/ColorSettingsModal.tsx', '  return [...orderByDepth(removed)].reverse();', '  return [...orderByDepth(removed)];'),
      ['TÉMOIN : ne rend JAMAIS un parent avant un de ses enfants du même lot'],
      '`ON DELETE NO ACTION` (mig. 143) refuse de supprimer un parent dont l`enfant pointe encore dessus : la suppression de branche échoue.'],
    ['src/components/color-settings-save-order.test.ts', 'cs-deux-issues-confondues',
      r('src/components/ColorSettingsModal.tsx', "  if (childrenMode === 'deleteBranch') {", '  if (true) {'),
      ['TÉMOIN : les deux issues ne rendent pas le même résultat'],
      '« Promouvoir les enfants » qui supprime toute la branche : le seul endroit du chantier où se tromper DÉTRUIT des données.'],
    ['src/components/reactbits/light-rays-budget.test.ts', 'rays-observateur-muet',
      r('src/components/reactbits/light-rays-budget.ts', '      if (etat.gele) return false;', '      return false;'),
      ['TÉMOIN — un détecteur qui ne détecterait plus rien fait ROUGIR ce fichier'],
      'Un shader qui ne descend jamais d`échelle sature le GPU sans que rien ne le freine (C-68 : 3 637 ms bloquées sur 4 000).'],
    ['src/lib/after-first-paint.test.ts', 'peinture-plafond-double',
      r('src/lib/after-first-paint.ts', '    }, capMs);', '    }, capMs * 2);'),
      ['TÉMOIN du plafond : sans peinture, rend la main au plafond, pas plus tard'],
      'Sans peinture observée, le travail différé (Sentry, toasts) attendrait au-delà du plafond promis.'],
    ['src/modules/billing/refund-replay.test.ts', 'remboursement-zero-constant',
      r('supabase/functions/_shared/refund-replay.ts', '  return Math.max(0, Math.min(Math.max(0, input.decidedCents), payable));', '  return 0;'),
      ['TEMOIN — la borne n’est pas un zéro constant'],
      'Une borne qui rend toujours zéro « empêche » le double remboursement en ne remboursant jamais personne.'],
    ['src/modules/tasks/dependency-errors.test.ts', 'dep-tout-est-refus',
      r('src/modules/tasks/dependency-errors.ts', '    if (known.has(raw)) return raw;', '    return raw;'),
      ['TEMOIN : une erreur quelconque n est PAS prise pour un refus de dependance'],
      'Une panne réseau affichée comme « dépendance circulaire » : la personne corrige un lien qui n`a rien de faux.'],
    ['src/modules/tasks/dependency-errors.test.ts', 'dep-rien-reconnu',
      r('src/modules/tasks/dependency-errors.ts', '    if (known.has(raw)) return raw;', ''),
      ['TEMOIN : les quatre identifiants, eux, sont bien reconnus'],
      'Un refus de dépendance jamais reconnu retombe sur le message générique : la personne ne sait pas pourquoi.'],
    ['src/pages/agenda/useAgendaMobileView.test.ts', 'agenda-jeton-horloge',
      r('src/pages/agenda/useAgendaMobileView.ts', '    setMobileZoom({ token: zoomSeq.current, x: point.x, y: point.y });', '    setMobileZoom({ token: Date.now(), x: point.x, y: point.y });'),
      ['TEMOIN : deux bascules dans la MÊME milliseconde changent quand même le token'],
      'Le défaut du 2026-10-01 : deux bascules dans la même milliseconde donnaient le même jeton, et l`animation ne rejouait pas.'],
    ['scripts/scalability-concurrency.stats.test.mjs', 'scal-lineaire-exigeant',
      r('scripts/scalability-concurrency.stats.mjs', 'export const LINEAR_EFFICIENCY = 0.8;', 'export const LINEAR_EFFICIENCY = 1.5;'),
      ['TEMOIN SAIN — une base qui absorbe la charge ressort « lineaire »'],
      'Un classeur qui ne reconnaît plus une base saine crie à la dégradation à chaque mesure, et on cesse de le lire.'],
    ['scripts/scalability-concurrency.stats.test.mjs', 'scal-jamais-sature',
      r('scripts/scalability-concurrency.stats.mjs', "    else regime = 'sature';", "    else regime = 'degrade';"),
      ['TEMOIN SATURE — un debit qui plafonne pendant que la latence enfle', 'accepte une charge qui sature au palier le plus charge'],
      'Un classeur qui ne dit jamais « saturé » rend « ça tient » sur une base en file d`attente.'],
    ['scripts/scalability-concurrency.stats.test.mjs', 'scal-temoin-complaisant',
      r('scripts/scalability-concurrency.stats.mjs', "  if (top.regime === 'sature') {", "  if (top.regime !== 'reference') {"),
      ['🔴 REFUSE une mesure ou le temoin ne sature pas — sinon le harnais rend toujours « ca tient »'],
      'Un témoin qui accepte une charge saine comme « saturée » : la sortie du harnais devient une constante.'],
    ['scripts/scalability-concurrency.stats.test.mjs', 'scal-un-seul-palier',
      r('scripts/scalability-concurrency.stats.mjs', '  if (levels.length < 2) {', '  if (levels.length < 1) {'),
      ['refuse un temoin a un seul palier : un plateau exige un « avant »'],
      'Un plateau mesuré sur un seul palier n`a pas d`« avant » : le verdict serait une hypothèse.'],
    ['scripts/check-legal-journal.guard.test.mjs', 'cgu-empreinte-aveugle',
      r('scripts/check-legal-journal.mjs', "  return createHash('sha256').update(JSON.stringify(trier(j))).digest('hex').slice(0, 16);", "  return createHash('sha256').update(Object.keys(j).sort().join('|')).digest('hex').slice(0, 16);"),
      ['TÉMOIN : un seul mot changé dans un seul catalogue change l empreinte'],
      'Une empreinte aveugle au contenu laisse modifier les CGU sans préavis de 30 jours (CGU art. 11) : un changement de contrat invisible.'],
    ['eslint-rules/exhaustive-deps-justified.guard.test.mjs', 'eslint-justification-mal-coupee',
      r('eslint-rules/exhaustive-deps-justified.js', '          const listed = cut === -1 ? text : text.slice(0, cut);', '          const listed = text;'),
      ['ne lit pas le nom de la regle APRES le `--` (temoin du decoupage)'],
      'Une règle qui lit le commentaire entier signale un désarmement qui ne la concerne pas, et finit désactivée.'],
  ].map(([garde, id, modif, attendu, pourquoi]) => ({
    id, famille: garde.includes('.guard.') ? 'detecteur' : 'produit', garde, modifs: [modif], attendu, pourquoi,
  })),

  // ═════════════════════════════════════════════════════════════════
  // BK-1 · AUCUNE DONNÉE DE PROD PUBLIÉE EN CLAIR PAR UN WORKFLOW
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['art-depot-tolere', r('scripts/artefacts-donnees-prod.guard.test.mjs', "      v.push(`${cle} : dépôt d'artefact absent de la liste ARTEFACTS.", "      [].push(`${cle} : dépôt d'artefact absent de la liste ARTEFACTS."),
      ['A · un dépôt non déclaré rougit', 'le parseur ne rate pas un dépôt écrit entre guillemets ; un upload hors job est signalé'],
      "Un artefact d'un dépôt PUBLIC se télécharge depuis n'importe quel compte : un dépôt non déclaré est exactement la porte de BK-1."],
    ['art-sans-prod-cru', r('scripts/artefacts-donnees-prod.guard.test.mjs', "    if (d.nature === 'sans-prod' && touche) {", '    if (false) {'),
      ['A · un export de la prod déclaré « sans-prod » rougit, trois fois'],
      'Une déclaration « sans-prod » crue sur parole, dans un job qui reçoit la base de production.'],
    ['art-chiffre-sur-parole', r('scripts/artefacts-donnees-prod.guard.test.mjs', '        else if (!chiffres.has(jet) && !chiffres.has(deploye)) v.push(', '        else if (false) v.push('),
      ['A · « chiffre » sans commande de chiffrement rougit'],
      'Un fichier en `.gpg` que rien n`a chiffré : l`extension rassure, le contenu est en clair.'],
    ['art-chiffrement-ignore', r('scripts/artefacts-donnees-prod.guard.test.mjs', '            if (sortie) chiffres.add(sortie);', '            void sortie;'),
      ['A · « chiffre » avec gpg --symmetric et le clair seul retiré passe'],
      'Une garde qui ne reconnaît plus le vrai chiffrement refuse la bonne réponse, et on la désarme.'],
    ['art-metadonnees-crues', r('scripts/artefacts-donnees-prod.guard.test.mjs', '      if (horsCatalogue.length) v.push(', '      if (false) v.push('),
      ['A · « metadonnees » dont la requête lit une table de données rougit'],
      'Des « métadonnées » qui lisent `public.profiles` : des adresses e-mail publiées sous un nom rassurant.'],
    ['art-contact-non-declare', r('scripts/artefacts-donnees-prod.guard.test.mjs', '    if (!decl.CONTACTS_PROD[cle]) {', '    if (false) {'),
      ['B · une étape au contact de la prod non déclarée rougit ; un secret inconnu aussi'],
      'Une étape qui reçoit l`URL de la base sans dire ce qu`elle imprime au journal, lequel est public.'],
    ['art-set-x-tolere', r('scripts/artefacts-donnees-prod.guard.test.mjs', String.raw`    if (/^\s*set\s+(?:-[a-zA-Z]*x|-o\s+xtrace)/m.test(e.run) || /(?:^|\s)-[a-z]*x\b/.test(e.shell)) {`, '    if (false) {'),
      ['B · set -x dans une étape au contact de la prod rougit'],
      '`set -x` imprime chaque commande DÉVELOPPÉE : l`URL de la base, secret compris, part au journal public.'],
    ['art-psql-au-journal', r('scripts/artefacts-donnees-prod.guard.test.mjs', '          if (!cible || seg.tubeApres) {', '          if (false) {'),
      ['C · psql sans fichier de sortie rougit, même dans une variable'],
      'Une requête sur la prod dont la sortie part au journal : les lignes elles-mêmes, publiées.'],
    ['art-donnees-affichees', r('scripts/artefacts-donnees-prod.guard.test.mjs', '              if (pb.length) v.push(', '              if (false) v.push('),
      ['C · un fichier de requête AFFICHÉ rougit si son SQL lit des données, passe si ce sont des comptes', 'C · un affichage dans un echo compte ; une capture affectée à une variable, non'],
      'Un `cat` du résultat d`une requête qui lit des données personnelles : elles partent au journal public.'],
    ['art-pgdump-stdout', r('scripts/artefacts-donnees-prod.guard.test.mjs', '          if (!cible || seg.tubeApres) v.push(', '          if (false) v.push('),
      ['C · pg_dump vers stdout, pg_restore sans destination, dump déchiffré affiché : rouge'],
      'Un `pg_dump` vers la sortie standard écrit la base entière au journal.'],
    ['art-journal-erreurs', r('scripts/artefacts-donnees-prod.guard.test.mjs', '            else v.push(`${ici}, écrit par un client SQL', '            else [].push(`${ici}, écrit par un client SQL'),
      ['C · un journal d erreurs de pg_restore affiché exige sa déclaration'],
      'Un journal d`erreurs de `pg_restore` peut citer des lignes : l`afficher sans l`avoir déclaré, c`est parier qu`il n`en cite pas.'],
    ['art-canal-public', r('scripts/artefacts-donnees-prod.guard.test.mjs', '        else v.push(`${cle} : canal public', '        else [].push(`${cle} : canal public'),
      ['D · git push depuis un job au contact de la prod rougit sans déclaration'],
      'Un `git push` ou un commentaire d`issue depuis un job qui tient la base : un canal public de plus.'],
    ['art-citation-lue', r('scripts/artefacts-donnees-prod.guard.test.mjs', "    .map((b) => b.replace(/«[^»]*»/g, ' ').replace(/\\s+/g, ' ').match(RE_NON_PUBLIC)?.[0])", "    .map((b) => b.replace(/\\s+/g, ' ').match(RE_NON_PUBLIC)?.[0])"),
      ['E · « artefact … non public » rougit ; la même phrase citée entre « » ne rougit pas'],
      'Une garde qui accuse la CITATION d`une croyance fausse interdit d`écrire pourquoi elle existe.'],
    ['art-declaration-perimee', r('scripts/artefacts-donnees-prod.guard.test.mjs', '  for (const k of Object.keys(decl.ARTEFACTS)) if (!vus.artefacts.has(k)) v.push(', '  for (const k of Object.keys(decl.ARTEFACTS)) if (!vus.artefacts.has(k)) [].push('),
      ['déclarations périmées : une entrée sans objet rougit'],
      'Une liste de dispenses mortes cesse d`être relue, et finit par couvrir un vrai dépôt.'],
    ['art-dump-en-clair', r('scripts/artefacts-donnees-prod.guard.test.mjs', "      if (s?.genre === 'dump') v.push(", '      if (false) v.push('),
      ['la garde ROUGIT dessus, et pour les bonnes raisons'],
      'Le défaut réel de BK-1 : des dumps de production déposés EN CLAIR en artefacts d`un dépôt public.'],
  ].map(([id, modif, attendu, pourquoi]) => ({
    id, famille: 'detecteur', garde: 'scripts/artefacts-donnees-prod.guard.test.mjs', modifs: [modif], attendu, pourquoi,
  })),
  {
    id: 'art-fixture-retouchee',
    famille: 'produit',
    garde: 'scripts/artefacts-donnees-prod.guard.test.mjs',
    modifs: [r('scripts/fixtures/db-backup.avant-8c6a971d.yml', '# Export QUOTIDIEN de la base, HORS du fournisseur.', '# Export quotidien de la base, hors du fournisseur.')],
    attendu: ['le fixture est octet pour octet le fichier du commit parent de 8c6a971d'],
    pourquoi:
      'Le témoin rejoue la garde sur le fichier fautif RÉEL : retouché, il deviendrait un exemple '
      + 'écrit pour passer, et ne prouverait plus que la garde voit BK-1.',
  },

  // ═════════════════════════════════════════════════════════════════
  // CI · CHAQUE GARDE JOUE APRÈS UN PREMIER ROUGE
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'citg-continue-tolere',
    famille: 'detecteur',
    garde: 'scripts/ci-toutes-les-gardes.guard.test.mjs',
    modifs: [r('scripts/ci-toutes-les-gardes.mjs', "    if (e['continue-on-error'] !== undefined) {", '    if (false) {')],
    attendu: ['un continue-on-error'],
    pourquoi:
      'Une garde en `continue-on-error` ne rougit plus le job : son rouge disparaît du verdict, '
      + 'la classe de défaut qui a masqué dix gardes pendant trois jours (2026-10-12).',
  },
  {
    id: 'citg-conforme-accuse',
    famille: 'detecteur',
    garde: 'scripts/ci-toutes-les-gardes.guard.test.mjs',
    modifs: [r('scripts/ci-toutes-les-gardes.mjs', '    if (e.if !== CONDITION) {', '    if (e.if === CONDITION) {')],
    attendu: ['le job conforme passe'],
    pourquoi:
      'Une garde qui refuse le job conforme est désarmée au premier rouge : on la fait taire, '
      + 'et avec elle la vérification de toutes les autres.',
  },

  // ═════════════════════════════════════════════════════════════════
  // LE REJEU LUI-MÊME (C-81) — qui garde la garde des gardes
  // ═════════════════════════════════════════════════════════════════
  ...[
    ['moteur-marque-minuscule', r('scripts/replay-sabotages.mjs', String.raw`    || /^\s*t[ée]moins?\b/i.test(titre)`, String.raw`    || /t[ée]moins?\b/i.test(titre)`),
      'ne compte PAS un titre qui PARLE des témoins sans en être un', 'Un compteur qui prend « aucune Edge Function n est sans témoin » pour un témoin gonfle le total, et le ratio publié ment.'],
    ['moteur-accent-oublie', r('scripts/replay-sabotages.mjs', '  return /T[ÉE]MOIN/.test(titre)', '  return /T[E]MOIN/.test(titre)'),
      'voit la marque en capitales, et l étiquette en tête ou entre parenthèses', 'Les témoins écrits `TÉMOIN` sortiraient du total : un dénominateur plus petit fait MONTER le ratio.'],
    ['moteur-describe-ignore', r('scripts/replay-sabotages.mjs', "      if (t && (qui === 'describe' || qui === 'suite')) {", '      if (false) {'),
      'lit l AST : describe porteur, it.each, regex.test et appel sans fonction', 'Les cas d`un `describe(\'témoin — …\')` disparaîtraient du total, sans un mot.'],
    ['moteur-gabarit-large', r('scripts/replay-sabotages.mjs', "  return new RegExp(`^${echappe.replace(/%[sdifjoO#]|\\\\\\$\\\\\\{.*?\\\\\\}/g, '.*')}$`);", '  return /.*/;'),
      'un titre construit ne s apparie qu aux cas de SON gabarit', 'Un témoin à gabarit compterait comme rejoué dès qu`un autre témoin de son fichier rougit.'],
    ['moteur-bascules-sans-reference', r('scripts/replay-sabotages.mjs', "    .filter((c) => c.statut === 'failed' && statutDeBase.get(c.cle) === 'passed')", "    .filter((c) => c.statut === 'failed')"),
      'rend VU un cas attendu passé du vert au rouge, et liste les bascules', 'Un cas déjà rouge sur la copie propre compterait comme vu : le ratio créditerait des rouges qui ne prouvent rien.'],
    ['moteur-absent-pris-pour-rouge', r('scripts/replay-sabotages.mjs', '    const apres = sabote.cas.find((c) => c.cle === cas.cle);', "    const apres = sabote.cas.find((c) => c.cle === cas.cle) ?? { statut: 'failed' };"),
      'REFUSE un fichier qui a planté : un cas ABSENT du rapport n est pas un rouge', 'Un témoin qui plante à l`import serait déclaré « rouge » : la garde répondrait sans mesurer.'],
    ['moteur-vert-accepte', r('scripts/replay-sabotages.mjs', "    } else if (apres.statut !== 'failed') {", '    } else if (false) {'),
      'REFUSE un cas resté vert', 'Le cas qui EXISTE pour attraper un témoin mort ne l`attraperait plus.'],
    ['moteur-deja-rouge-accepte', r('scripts/replay-sabotages.mjs', "    if (cas.statut !== 'passed') {", '    if (false) {'),
      'REFUSE un cas déjà rouge sur la copie propre', 'Une garde déjà rouge sur `main` « détecterait » chaque sabotage.'],
    ['moteur-nom-ambigu', r('scripts/replay-sabotages.mjs', '    if (trouves.length !== 1) {', '    if (trouves.length === 0) {'),
      'REFUSE un nom ambigu ou disparu, et un catalogue sans attendu', 'Un titre porté par quatre cas ferait juger l`un pour l`autre.'],
    ['moteur-raison-deja-la', r('scripts/replay-sabotages.mjs', '  if (raison.test(base.sortie)) {', '  if (false) {'),
      'une commande : rouge, raison nommée, et ABSENTE de la référence', 'Une raison déjà imprimée par la garde propre ne prouve pas qu`elle a vu le sabotage.'],
    ['moteur-rapport-multiple', r('scripts/replay-sabotages.mjs', '  if (resultats.length !== 1 || vises.length !== 1) {', '  if (vises.length === 0) {'),
      'le rapport doit porter le fichier visé, et lui seul', '« Ne jamais conclure d`une ligne de résumé » : un filtre qui ramasse deux fichiers juge le mauvais.'],
    ['moteur-remplacement-interprete', r('scripts/replay-sabotages.mjs', '      writeFileSync(chemin, texte.replace(selonLeFichier(texte, m.chercher), () => selonLeFichier(texte, m.remplacer)), \'utf8\');', "      writeFileSync(chemin, texte.replace(selonLeFichier(texte, m.chercher), selonLeFichier(texte, m.remplacer)), 'utf8');"),
      'refuse un motif ambigu ou absent, applique littéralement, restaure octet pour octet', 'Un `$&` interprété par `String.replace` saboterait autre chose que ce que le catalogue écrit.'],
    ['moteur-fins-de-ligne', r('scripts/replay-sabotages.mjs', "export const selonLeFichier = (texte, s) => (texte.includes('\\r\\n') ? s.replace(/\\r?\\n/g, '\\r\\n') : s);", 'export const selonLeFichier = (texte, s) => s;'),
      'un motif sur plusieurs lignes suit les fins de ligne du fichier (CRLF ici, LF sur le runner)', 'Un motif sur deux lignes ne se trouverait que sur un des deux arbres : le rejeu échouerait en local ou en CI.'],
    ['moteur-catalogue-sans-attendu', r('scripts/replay-sabotages.mjs', '      if (!Array.isArray(s.attendu) || s.attendu.length === 0) erreurs.push(', '      if (false) erreurs.push('),
      'refuse un sabotage sans attendu, sans raison, ou qui ne change rien', 'Un sabotage sans cas attendu est jugé sur « quelque chose a rougi », c`est-à-dire sur rien.'],
    ['moteur-catalogue-mal-forme', r('scripts/replay-sabotages.catalogue.mjs', "    id: 'csp-wss',\n    famille: 'produit',", "    id: 'csp-wss',\n    famille: 'prod',"),
      'le catalogue réel est bien formé', 'Un catalogue mal formé est un rejeu qui ne sait plus ce qu`il prouve.'],
  ].map(([id, modif, attendu, pourquoi]) => ({
    id, famille: 'detecteur', garde: 'scripts/replay-sabotages.guard.test.mjs', modifs: [modif], attendu: [attendu], pourquoi,
  })),
];
