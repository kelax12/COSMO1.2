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
      + 'en `vendor`, et les exemptions ne matchaient plus rien.',
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
];
