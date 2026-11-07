-- ═══════════════════════════════════════════════════════════════════
-- comptages-sauvegarde.sql · LE MANIFESTE DU DUMP, ET SA RELECTURE
--
-- Joue DEUX fois, mot pour mot :
--   · par `db-backup.yml`, sur la PRODUCTION, dans la transaction dont le
--     snapshot est exporte vers `pg_dump --snapshot` : les comptes decrivent
--     donc EXACTEMENT les lignes du dump, pas celles d'une seconde plus tard ;
--   · par `scripts/restore-drill.mjs`, sur le Postgres jetable ou ce dump
--     vient d'etre restaure. Ecart = echec du drill.
--
-- Ce qu'elle rend : des COMPTES, jamais une ligne. Format `genre|nom|valeur` :
--   table|public.<table>|<lignes>   chaque table de `public`, et auth.users
--   meta|policies_public|<n>        policies RLS du schema public
--   meta|tables_rls_public|<n>      tables de `public` sous RLS
--
-- Les tables membres d'une extension sont exclues : pg_dump n'en sort pas
-- les lignes, les compter fabriquerait un ecart qui ne dit rien du dump.
-- ⚠️ Toute modification de ce fichier change le manifeste ET sa relecture :
--    les deux restent alignes, c'est la raison d'un fichier unique.
-- Temoin : `scripts/restore-drill.guard.test.mjs`.
-- ═══════════════════════════════════════════════════════════════════
SELECT 'table' AS genre,
       n.nspname || '.' || c.relname AS nom,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text AS valeur
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p')
   AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))
   AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
UNION ALL
SELECT 'meta', 'policies_public', count(*)::text FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'meta', 'tables_rls_public', count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
   AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
ORDER BY 1, 2;
