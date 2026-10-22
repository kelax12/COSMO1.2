-- ═══════════════════════════════════════════════════════════════════
-- Migration 146 — « Ignorer » un créneau de tâche à passer en revue
--
-- Quand une tâche a été planifiée dans l'agenda (événement portant `task_id`)
-- et que son créneau se termine sans que la tâche soit validée, le produit
-- demandait une décision dans une popup qui s'ouvrait SEULE, par-dessus ce que
-- la personne était en train de faire. Cette popup disparaît : la demande est
-- désormais portée par une pastille sur le bloc d'événement lui-même, et son
-- menu propose valider / reporter / ignorer / supprimer.
--
-- « Ignorer » est la seule des quatre actions qui ne laisse AUCUNE trace
-- ailleurs. Valider coche la tâche, reporter déplace le créneau, supprimer
-- supprime : ces trois-là se relisent depuis la donnée existante. Ignorer, lui,
-- ne dit rien d'autre que « je ne veux plus qu'on me le demande ».
--
-- ── POURQUOI UNE COLONNE, ET PAS UN ÉTAT DE SESSION ────────────────
--
-- L'état d'avant vivait dans un `useState` de la page : la pastille revenait au
-- premier rechargement. C'était tolérable pour une popup qu'on chasse d'un
-- geste, ça ne l'est plus pour un marqueur qui reste affiché sur le calendrier.
-- Un `localStorage` aurait tenu au rechargement mais pas d'un appareil à
-- l'autre, et quelqu'un qui ignore un créneau depuis son téléphone le
-- retrouverait sur son ordinateur, ce qui fait exactement de la pastille le
-- bruit qu'elle est censée éteindre.
--
-- ── PORTÉE ─────────────────────────────────────────────────────────
--
-- Colonne NULLable sur une table que la personne possède déjà. AUCUNE policy
-- n'est touchée : les policies d'`events` (mig. 128) portent sur la LIGNE, pas
-- sur ses colonnes, et un propriétaire qui peut déjà réécrire le titre et les
-- horaires de son événement peut écrire celle-ci. Il n'y a donc pas non plus de
-- trigger de garde : cette valeur n'autorise rien, elle n'est lue que par
-- l'affichage.
--
-- `NULL` = jamais ignoré, c'est-à-dire l'état de toutes les lignes existantes
-- et le comportement d'aujourd'hui. Aucune donnée n'est migrée.
--
-- ⚠️ Le front la relit et l'écrit via `mapEventToDb` : cette migration doit
-- être appliquée AVANT le déploiement du front, sinon chaque mise à jour
-- d'événement émet une colonne inexistante et échoue. Même ordre que la
-- mig. 113.
--
-- ⚠️ Un report REMET la valeur à NULL (côté client, dans la même mise à jour
-- que les nouveaux horaires) : sans ça, un créneau ignoré puis reporté, puis
-- raté une seconde fois, ne redemanderait plus jamais rien.
--
-- Aucun index : la colonne n'est jamais un critère de recherche. Le filtrage se
-- fait côté client, sur les événements de la fenêtre déjà chargée.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS review_dismissed_at timestamptz;

COMMENT ON COLUMN public.events.review_dismissed_at IS
  'Instant où la personne a demandé de ne plus être relancée sur ce créneau de tâche terminé (bouton « Ignorer »). NULL = jamais ignoré. Remis à NULL par un report. Purement informatif : aucune policy et aucun quota n''en dépendent.';
