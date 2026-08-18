-- ═══════════════════════════════════════════════════════════════════
-- 102 — `seed_default_categories` : search_path figé + table qualifiée
--
-- La fonction est SECURITY DEFINER (mig. 005) et n'a JAMAIS eu de
-- `SET search_path`. C'est la derniere du dépôt dans ce cas : les autres ont
-- ete durcies par la mig. 024, qui a simplement oublie celle-ci — sans doute
-- parce qu'elle declare `SECURITY DEFINER` APRES son corps (`$$ language
-- 'plpgsql' SECURITY DEFINER;`), une forme que l'oeil et les greps ratent.
--
-- Deux problemes, un seul correctif :
--
-- 1. SECURITY : une fonction SECURITY DEFINER sans search_path fige s'execute
--    avec le search_path de SON APPELANT. Un role qui controle son search_path
--    peut donc faire pointer `categories` vers une table a lui et detourner
--    une fonction qui tourne avec les droits du proprietaire. C'est le finding
--    `function_search_path_mutable` de l'advisor Supabase.
--
-- 2. DISPONIBILITE : la fonction est attachee a `AFTER INSERT ON auth.users`.
--    Si le role qui insere (GoTrue) n'a pas `public` dans son search_path,
--    `INSERT INTO categories` echoue, le trigger leve, et TOUTE creation de
--    compte echoue avec le message opaque « Database error creating new user ».
--    C'est ce qui bloquait les tests du job CI `rls-integration` une fois le
--    replay des migrations debloque.
--
-- `public, pg_temp` (et non `''`) : meme convention que la mig. 024, et
-- `pg_temp` en dernier est la position recommandee pour eviter qu'un objet
-- temporaire ne masque un objet reel.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Table qualifiee : ceinture ET bretelles avec le search_path fige.
  INSERT INTO public.categories (user_id, name, color) VALUES
    (NEW.id, 'Personnel',  '#3B82F6'),
    (NEW.id, 'Travail',    '#EF4444'),
    (NEW.id, 'Santé',      '#10B981'),
    (NEW.id, 'Loisirs',    '#F59E0B'),
    (NEW.id, 'Finance',    '#8B5CF6');
  RETURN NEW;
END;
$$;
