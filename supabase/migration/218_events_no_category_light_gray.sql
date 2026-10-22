-- 218 · Événements « sans catégorie » : gris foncé → gris clair (2026-10-11)
--
-- La couleur d'un élément sans catégorie est passée de #6B7280 à #CBD5E1
-- (`NO_CATEGORY_COLOR`, src/lib/category-colors.ts). Les événements déjà
-- enregistrés en gris foncé suivent. Exclus : ceux dont l'utilisateur a une
-- catégorie de cette couleur (le gris serait alors un choix, pas une absence).
-- Mesuré avant application : 16 événements, 0 exclu ; 0 habitude concernée.
UPDATE public.events e
   SET color = '#CBD5E1'
 WHERE upper(e.color) = '#6B7280'
   AND NOT EXISTS (
     SELECT 1 FROM public.categories c
      WHERE c.user_id = e.user_id AND upper(c.color) = '#6B7280'
   );
