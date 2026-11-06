-- Preuve de la mig. 242 (SEC-10, fermé par défaut pour `anon`).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. L'annulation est la seule issue ; le verdict est le
-- texte de l'exception. La migration est EMBARQUÉE (`EXECUTE $mig$ … $mig$`,
-- texte identique au fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) :
-- la preuve se joue donc AVANT application, et s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/242.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info 00 … | ok 01 … »
--
-- Ce qu'elle établit, sous le rôle qui applique les migrations (`postgres`) :
--   01 aucune ACL existante de `public` ne bouge (empreinte de toutes les relacl) ;
--   02 plus aucun privilège par défaut de ce rôle n'accorde quoi que ce soit à anon ;
--   03-06 une table et une séquence créées APRÈS : rien pour anon, tout pour
--      authenticated et service_role (inchangés) ;
--   07 témoin : la sonde voit un privilège anon quand il existe (GRANT explicite) ;
--   08 le chemin réel : sous `SET ROLE anon`, lire la table neuve est refusé (42501).
-- Passe témoin : jouée SANS la migration (retirer l'EXECUTE) sur la production
-- d'avant, 02, 03 et 08 doivent échouer, et 00 dire « true ».

DO $proof$
DECLARE
  r          text[] := '{}';
  ko         int := 0;
  acl_avant  text;
  acl_apres  text;
  anon_avant boolean;
  nb         int;
  tab        regclass;
  seq        regclass;
BEGIN
  SELECT md5(coalesce(string_agg(c.oid::regclass::text || '=' || coalesce(c.relacl::text, '-'), ',' ORDER BY c.oid::regclass::text), ''))
    INTO acl_avant
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');
  SELECT EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
     WHERE d.defaclrole = current_user::regrole
       AND d.defaclnamespace IN (0, 'public'::regnamespace)
       AND d.defaclobjtype IN ('r', 'S')
       AND a.grantee = 'anon'::regrole
  ) INTO anon_avant;
  r := r || ('info 00 avant : anon dans les privileges par defaut de ' || current_user || ' = ' || anon_avant);

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 242 · Fermé par défaut : plus aucun privilège implicite pour `anon`
--       sur les tables et séquences FUTURES de `public` (SEC-10, V7.1)
--
-- LE DÉFAUT. `000_default_privileges.sql` (et, en production, la plateforme
-- Supabase elle-même) pose :
--
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT ALL ON TABLES    TO anon, authenticated, service_role;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
--
-- Toute table créée ensuite naît donc lisible ET écrivable par un visiteur
-- anonyme. La seule barrière est la RLS : une table créée sans
-- `ENABLE ROW LEVEL SECURITY` (oubli, migration écrite vite, table de
-- travail) est ouverte à Internet par PostgREST, sans qu'aucun écran change.
--
-- LE CORRECTIF. Retirer `anon` des privilèges PAR DÉFAUT, pour les tables et
-- les séquences. `authenticated` et `service_role` gardent les leurs : le
-- modèle reste « la RLS est la frontière » pour les comptes connectés, et la
-- garde statique de `validate-migrations.mjs` (règle 9, même fichier) refuse
-- désormais une table créée sans sa RLS dans le même fichier.
--
-- 🔴 AUCUN ACCÈS ACTUEL NE CHANGE, et c'est pour ça qu'il n'y a aucun GRANT ici.
--   · Un privilège par défaut ne s'applique qu'à la CRÉATION d'un objet.
--     Les tables existantes gardent leur ACL telle quelle : `anon` conserve
--     sur elles exactement ce qu'il avait (la preuve compare l'empreinte de
--     toutes les ACL de `public` avant et après).
--   · Un `GRANT … ON ALL TABLES IN SCHEMA public TO anon` « pour être sûr »
--     ROUVRIRAIT ce que les mig. 055, 083, 084, 101 et suivantes ont retiré à
--     `anon` table par table. C'est exactement l'erreur à ne pas faire.
--
-- 🔴 CONSÉQUENCE POUR LES MIGRATIONS SUIVANTES. Une table nouvelle qu'un
--    visiteur anonyme doit pouvoir lire (rare : aujourd'hui, aucune) porte son
--    `GRANT SELECT ON public.<table> TO anon` explicite, à côté de sa policy.
--    Une séquence d'une table qu'`anon` alimente, de même (`GRANT USAGE`).
--
-- PORTÉE. `ALTER DEFAULT PRIVILEGES` sans `FOR ROLE` vise le rôle COURANT :
-- c'est celui qui applique les migrations (`postgres`, en production comme
-- dans le replay CI), donc celui qui crée les tables. Les objets créés par
-- un autre rôle (`supabase_admin` : schémas `auth`, `storage`) ne sont pas
-- concernés, et `postgres` ne peut pas modifier les défauts d'un autre rôle.
-- Les FONCTIONS ne sont pas traitées ici : leur `EXECUTE` par défaut vient
-- de `PUBLIC` (Postgres) autant que de Supabase, et chaque migration le
-- retire nommément (règle 16 de `validate-migrations.mjs`).
--
-- RETOUR ARRIÈRE (rouvre le défaut, à ne faire qu'en connaissance de cause) :
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
--
-- Relecture au catalogue après application (aucune ligne attendue) :
--   SELECT d.defaclrole::regrole, d.defaclobjtype, a.privilege_type
--     FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
--    WHERE d.defaclnamespace = 'public'::regnamespace
--      AND d.defaclrole = 'postgres'::regrole
--      AND d.defaclobjtype IN ('r', 'S')
--      AND a.grantee = 'anon'::regrole;
--
-- Idempotente : rejouée, elle ne retire rien de plus.
-- Preuve : `supabase/proofs/242.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
$mig$;

  -- 01 · rien d'existant ne bouge
  SELECT md5(coalesce(string_agg(c.oid::regclass::text || '=' || coalesce(c.relacl::text, '-'), ',' ORDER BY c.oid::regclass::text), ''))
    INTO acl_apres
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');
  IF acl_apres = acl_avant THEN r := r || 'ok 01 ACL des relations existantes de public inchangees'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 01 une ACL existante a change'::text; END IF;

  -- 02 · les défauts du rôle courant ne donnent plus rien à anon
  SELECT count(*) INTO nb
    FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = current_user::regrole
     AND d.defaclnamespace IN (0, 'public'::regnamespace)
     AND d.defaclobjtype IN ('r', 'S')
     AND a.grantee = 'anon'::regrole;
  IF nb = 0 THEN r := r || 'ok 02 pg_default_acl : aucun privilege par defaut pour anon (tables, sequences)'::text;
  ELSE ko := ko + 1; r := r || ('ECHEC 02 anon garde ' || nb || ' privilege(s) par defaut'); END IF;

  -- 03 à 06 · un objet créé après
  CREATE TABLE public.preuve_242_ferme (id bigserial PRIMARY KEY, x text);
  tab := 'public.preuve_242_ferme'::regclass;
  seq := pg_get_serial_sequence('public.preuve_242_ferme', 'id')::regclass;
  IF NOT has_table_privilege('anon', tab, 'SELECT') AND NOT has_table_privilege('anon', tab, 'INSERT')
     AND NOT has_table_privilege('anon', tab, 'UPDATE') AND NOT has_table_privilege('anon', tab, 'DELETE') THEN
    r := r || 'ok 03 table neuve : anon sans SELECT, INSERT, UPDATE ni DELETE'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 03 table neuve : anon a encore un privilege'::text; END IF;
  IF has_table_privilege('authenticated', tab, 'SELECT') AND has_table_privilege('authenticated', tab, 'INSERT')
     AND has_table_privilege('authenticated', tab, 'UPDATE') AND has_table_privilege('authenticated', tab, 'DELETE') THEN
    r := r || 'ok 04 table neuve : authenticated garde ses quatre privileges'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 04 table neuve : authenticated a perdu un privilege'::text; END IF;
  IF has_table_privilege('service_role', tab, 'SELECT') AND has_table_privilege('service_role', tab, 'INSERT') THEN
    r := r || 'ok 05 table neuve : service_role inchange'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 05 table neuve : service_role a perdu un privilege'::text; END IF;
  IF NOT has_sequence_privilege('anon', seq, 'USAGE') AND has_sequence_privilege('authenticated', seq, 'USAGE') THEN
    r := r || 'ok 06 sequence neuve : anon sans USAGE, authenticated avec'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 06 sequence neuve : privileges inattendus'::text; END IF;

  -- 07 · témoin : la sonde n'est pas aveugle
  EXECUTE 'GRANT SELECT ON public.preuve_242_ferme TO anon';
  IF has_table_privilege('anon', tab, 'SELECT') THEN r := r || 'ok 07 temoin : un GRANT explicite a anon est bien vu'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 07 temoin : la sonde ne voit pas un GRANT explicite'::text; END IF;
  EXECUTE 'REVOKE SELECT ON public.preuve_242_ferme FROM anon';

  -- 08 · le chemin réel, sous le rôle anon
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    SELECT count(*) INTO nb FROM public.preuve_242_ferme;
    ko := ko + 1; r := r || 'ECHEC 08 anon lit la table neuve'::text;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'ok 08 anon : lecture de la table neuve refusee (42501)'::text;
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
