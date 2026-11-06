-- Preuve de la mig. 244 (une seule policy SELECT permissive sur sept tables).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/244.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info … avant … | ok … »
--
-- Pour chaque table, AVANT : la liste des policies SELECT permissives et le
-- prédicat de celle qui doit rester (`info`, c'est le relevé de la
-- production qu'Axel lit avant d'appliquer). APRÈS :
--   · exactement UNE policy SELECT permissive, du nom attendu ;
--   · son prédicat est, au caractère près (`pg_get_expr`), celui qu'avait la
--     policy restante avant : le périmètre effectif ne change pas, puisque la
--     policy retirée (`auth.uid() = user_id`, ou `= friend_id`) en est une
--     branche. Si la policy restante MANQUAIT avant (dérive de la prod), son
--     prédicat est comparé à l'attendu écrit ici, et la ligne le dit ;
--   · comportement : un propriétaire lit sa catégorie, un tiers ne la lit pas.
-- Passe témoin : jouée SANS la migration (retirer l'EXECUTE), la production
-- d'avant doit échouer sur le compte « 1 policy » de chaque table.

DO $proof$
DECLARE
  r      text[] := '{}';
  ko     int := 0;
  U1 constant uuid := '00000000-0000-0000-0000-0000000a0244';
  U2 constant uuid := '00000000-0000-0000-0000-0000000b0244';
  CAT constant uuid := '50000000-0000-0000-0000-000000000244';
  tabs   text[] := ARRAY['habits', 'okrs', 'events', 'categories', 'lists', 'friends', 'shared_tasks'];
  gardes text[] := ARRAY['Users can view own habits', 'Users can view own okrs', 'Users can view own events',
                         'Users can view own categories', 'Users can view own lists', 'Users can view own friends',
                         'shared_tasks_select'];
  attendus text[] := ARRAY[
    '(( SELECT auth.uid() AS uid) = user_id)',
    '(( SELECT auth.uid() AS uid) = user_id)',
    '((( SELECT auth.uid() AS uid) = user_id) OR ((NOT is_private) AND (user_id = ANY (my_managed_user_ids()))))',
    '(( SELECT auth.uid() AS uid) = user_id)',
    '(( SELECT auth.uid() AS uid) = user_id)',
    '(( SELECT auth.uid() AS uid) = user_id)',
    '((( SELECT auth.uid() AS uid) = shared_by) OR (( SELECT auth.uid() AS uid) = friend_id))'];
  avant  text[] := '{}';
  i      int;
  nb     int;
  liste  text;
  expr   text;
BEGIN
  -- ── Relevé AVANT ──────────────────────────────────────────────────
  FOR i IN 1 .. array_length(tabs, 1) LOOP
    SELECT count(*), coalesce(string_agg(p.polname, ' + ' ORDER BY p.polname), '-')
      INTO nb, liste
      FROM pg_policy p
     WHERE p.polrelid = ('public.' || tabs[i])::regclass AND p.polcmd = 'r' AND p.polpermissive;
    SELECT pg_get_expr(p.polqual, p.polrelid) INTO expr
      FROM pg_policy p WHERE p.polrelid = ('public.' || tabs[i])::regclass AND p.polname = gardes[i];
    avant := avant || coalesce(expr, '');
    r := r || format('info %s avant : %s SELECT permissive(s) [%s]', tabs[i], nb, liste);
  END LOOP;

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 244 · Une seule policy SELECT permissive sur sept tables personnelles
--       (règle de la mig. 049, relevé de la matrice RLS du 2026-11-06)
--
-- Six relevées par la matrice ; la septième, `shared_tasks`, par une relecture
-- de l'état final de TOUT l'historique (cliquet de `check:rls` compris) :
-- c'était la seule autre table, toutes actions confondues, à en porter deux.
--
-- LE DÉFAUT. `categories`, `events`, `habits`, `lists`, `okrs` et `friends`
-- portent chacune DEUX policies `FOR SELECT` permissives, pour le même rôle
-- (`public`, donc `anon` et `authenticated`) :
--
--   · « Users can read own <table> »  créée par les mig. 002 à 007,
--     `USING (auth.uid() = user_id)` : `auth.uid()` NU, réévalué par ligne ;
--   · « Users can view own <table> »  créée par la mig. 043 (et 128 pour
--     `events`), `USING ((select auth.uid()) = user_id …)`.
--
-- La 043 a recréé la seconde sans retirer la première. Postgres évalue les
-- deux et les combine par OR, à chaque ligne : la première annule le gain de
-- la 043 (auth.uid() une fois par requête) et contredit la règle « une seule
-- policy PERMISSIVE par rôle et par action » (mig. 049). `check:rls` ne la
-- voyait pas : son cliquet commence à la 043.
--
-- LE CORRECTIF. Pour chaque table, retirer les deux, puis recréer la seule
-- « view own » avec le prédicat en vigueur. On ne se contente pas de retirer
-- « read own » : la production a divergé des fichiers 001 à 007 (des
-- policies y manquent sans DROP au dépôt, cf. `check-rls-advisors.mjs`), et
-- retirer « read own » là où « view own » manquerait fermerait la lecture à
-- son propre propriétaire. Recréer garantit l'état, quel qu'il soit avant.
--
-- PÉRIMÈTRE EFFECTIF INCHANGÉ. « read own » est incluse dans « view own » :
-- même prédicat pour cinq tables, et pour `events` un OR plus large (le
-- propriétaire OU son manager sur un événement non privé, mig. 128). De même
-- `friend_id` est une branche de `shared_tasks_select`. L'union des deux vaut
-- donc exactement la policy qui reste. La matrice RLS
-- (`e2e/rls/matrice.test.ts`) le vérifie : son invariant « une seule policy
-- permissive par rôle et par action » est ajouté avec cette migration.
--
-- Une seule transaction : le script entier part en une requête (éditeur SQL,
-- `apply_migration`, replay CI). Aucun instant sans policy de lecture.
-- Idempotente. Preuve : `supabase/proofs/244.proof.sql`.
--
-- ── RETOUR ARRIÈRE : policies retirées, corps de 002 à 007 ───────────
--   CREATE POLICY "Users can read own habits"     ON habits     FOR SELECT USING (auth.uid() = user_id);
--   CREATE POLICY "Users can read own okrs"       ON okrs       FOR SELECT USING (auth.uid() = user_id);
--   CREATE POLICY "Users can read own events"     ON events     FOR SELECT USING (auth.uid() = user_id);
--   CREATE POLICY "Users can read own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
--   CREATE POLICY "Users can read own lists"      ON lists      FOR SELECT USING (auth.uid() = user_id);
--   CREATE POLICY "Users can read own friends"    ON friends    FOR SELECT USING (auth.uid() = user_id);
--   CREATE POLICY "Friends can read their shared tasks" ON shared_tasks FOR SELECT USING (auth.uid() = friend_id);
-- (« view own » et `shared_tasks_select` sont recréées à l'identique de 043 /
-- 128 : rien à restaurer.)
--
-- Relecture au catalogue après application (une ligne par table, n = 1) :
--   SELECT c.relname, count(*) AS n, string_agg(p.polname, ', ')
--     FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--    WHERE c.relnamespace = 'public'::regnamespace
--      AND c.relname IN ('categories','events','habits','lists','okrs','friends','shared_tasks')
--      AND p.polcmd = 'r' AND p.polpermissive
--    GROUP BY c.relname ORDER BY 1;
-- ═══════════════════════════════════════════════════════════════════

-- habits
DROP POLICY IF EXISTS "Users can read own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can view own habits" ON public.habits;
CREATE POLICY "Users can view own habits"
  ON public.habits FOR SELECT
  USING ((select auth.uid()) = user_id);

-- okrs
DROP POLICY IF EXISTS "Users can read own okrs" ON public.okrs;
DROP POLICY IF EXISTS "Users can view own okrs" ON public.okrs;
CREATE POLICY "Users can view own okrs"
  ON public.okrs FOR SELECT
  USING ((select auth.uid()) = user_id);

-- events : le prédicat de la mig. 128, inchangé.
DROP POLICY IF EXISTS "Users can read own events" ON public.events;
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events"
  ON public.events FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR (NOT is_private AND user_id = ANY (public.my_managed_user_ids()))
  );

-- categories
DROP POLICY IF EXISTS "Users can read own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING ((select auth.uid()) = user_id);

-- lists
DROP POLICY IF EXISTS "Users can read own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can view own lists" ON public.lists;
CREATE POLICY "Users can view own lists"
  ON public.lists FOR SELECT
  USING ((select auth.uid()) = user_id);

-- friends
DROP POLICY IF EXISTS "Users can read own friends" ON public.friends;
DROP POLICY IF EXISTS "Users can view own friends" ON public.friends;
CREATE POLICY "Users can view own friends"
  ON public.friends FOR SELECT
  USING ((select auth.uid()) = user_id);

-- shared_tasks : la septième, même défaut, hors du relevé de la matrice.
-- « Friends can read their shared tasks » (007, `auth.uid() = friend_id`)
-- est incluse dans `shared_tasks_select` (043, `shared_by OR friend_id`).
DROP POLICY IF EXISTS "Friends can read their shared tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "shared_tasks_select" ON public.shared_tasks;
CREATE POLICY "shared_tasks_select"
  ON public.shared_tasks FOR SELECT
  USING ((select auth.uid()) = shared_by OR (select auth.uid()) = friend_id);
$mig$;

  -- ── APRÈS : une policy, même prédicat ─────────────────────────────
  FOR i IN 1 .. array_length(tabs, 1) LOOP
    SELECT count(*), coalesce(string_agg(p.polname, ' + ' ORDER BY p.polname), '-')
      INTO nb, liste
      FROM pg_policy p
     WHERE p.polrelid = ('public.' || tabs[i])::regclass AND p.polcmd = 'r' AND p.polpermissive;
    SELECT pg_get_expr(p.polqual, p.polrelid) INTO expr
      FROM pg_policy p WHERE p.polrelid = ('public.' || tabs[i])::regclass AND p.polname = gardes[i];
    IF nb = 1 AND liste = gardes[i] THEN
      r := r || format('ok %s : une seule SELECT permissive (%s)', tabs[i], liste);
    ELSE
      ko := ko + 1; r := r || format('ECHEC %s : %s SELECT permissive(s) [%s]', tabs[i], nb, liste);
    END IF;
    IF avant[i] <> '' AND expr = avant[i] THEN
      r := r || format('ok %s : predicat identique a celui d avant', tabs[i]);
    ELSIF avant[i] = '' AND expr = attendus[i] THEN
      r := r || format('ok %s : la policy restante MANQUAIT avant (derive), recreee avec le predicat attendu', tabs[i]);
    ELSE
      ko := ko + 1; r := r || format('ECHEC %s : predicat {%s}, avant {%s}', tabs[i], expr, avant[i]);
    END IF;
  END LOOP;

  -- ── Comportement : propriétaire et tiers, sur `categories` ────────
  INSERT INTO auth.users(id, email) VALUES (U1, 'u1244@proof.invalid'), (U2, 'u2244@proof.invalid');
  INSERT INTO public.profiles(id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%244@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.categories(id, user_id, name, color) VALUES (CAT, U1, 'Preuve 244', '#000000');
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', U1::text, true);
  SELECT count(*) INTO nb FROM public.categories WHERE id = CAT;
  IF nb = 1 THEN r := r || 'ok comportement : le proprietaire lit sa categorie'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC comportement : le proprietaire ne lit plus sa categorie'::text; END IF;
  PERFORM set_config('request.jwt.claim.sub', U2::text, true);
  SELECT count(*) INTO nb FROM public.categories WHERE id = CAT;
  IF nb = 0 THEN r := r || 'ok comportement : un tiers ne la lit pas'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC comportement : un tiers lit la categorie'::text; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
