-- ═══════════════════════════════════════════════════════════════════
-- 249 · Échéance et priorité facultatives sur les tâches PERSO
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Décision d'Axel du 2026-11-09 : « le champ échéance d'une tâche doit
-- rester facultatif, comme le champ priorité ». La fiche (`useTaskModal`)
-- crée par défaut une tâche SANS priorité (0) et SANS échéance (`''`, que
-- `mapTaskToDb` traduit en NULL), et `createTaskSchema` admet les deux.
--
-- La mig. 001 disait le contraire : `deadline TIMESTAMPTZ NOT NULL` et
-- `CHECK (priority BETWEEN 1 AND 5)`. Les tests de parité (V12.2) l'ont vu
-- sur la base reconstruite depuis le dépôt : PAR-01 et PAR-02.
--
-- ⚠️ La PRODUCTION, elle, acceptait déjà les deux, relu au catalogue le
-- 2026-11-09 : `deadline` nullable, AUCUN CHECK sur `priority`, et des
-- centaines de tâches réelles à 0 ou sans échéance. Une dérive hors dépôt,
-- jamais versionnée. Ce fichier écrit la règle dans le dépôt, et rend à la
-- production la borne haute qu'elle avait perdue : sans CHECK, une priorité
-- de 99 ou de -4 y passait.
--
-- ── REPRÉSENTATION RETENUE ─────────────────────────────────────────
--
--   · priorité « aucune » = 0, pas NULL : c'est la valeur du front
--     (`createTaskSchema`, `withinPriorityRange`, `priorityRank`), de la démo,
--     et des lignes déjà en production. NULL ajouterait un second marqueur
--     d'absence à vérifier partout. La colonne reste NOT NULL, défaut 3
--     inchangé (une écriture qui omet la priorité garde son comportement).
--   · échéance absente = NULL en base, `''` côté TypeScript, conversion dans
--     `mapTaskToDb` / `mapTaskFromDb` seulement.
--
-- ── EFFET SUR LES LECTEURS SERVEUR ─────────────────────────────────
--
--   · `toggle_task_complete_v2` (mig. 086, 133, 215) recopie `priority` dans
--     l'occurrence suivante : sous le CHECK de la 001 (base reconstruite depuis
--     le dépôt), cocher une tâche récurrente sans priorité levait 23514 et la
--     tâche ne se cochait pas. Sans échéance,
--     le client n'envoie pas `p_next_deadline` et rien n'est engendré (règle
--     inchangée, `nextOccurrenceDeadline`).
--   · `get_my_tasks`, `get_pending_shared_tasks` : `SELECT t.*`, rien à faire.
--   · Les agrégats d'échéance (`t.deadline < p_today`, mig. 096, 152, 204)
--     portent sur `team_tasks`, dont l'échéance est déjà facultative.
--
-- Idempotente / rejouable. Verrou ACCESS EXCLUSIVE le temps de vérifier le
-- CHECK sur les lignes existantes (moins d'un millier en production).
-- Preuve : `supabase/proofs/249.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks ALTER COLUMN deadline DROP NOT NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check CHECK (priority >= 0 AND priority <= 5);

COMMENT ON COLUMN public.tasks.deadline IS
  'Échéance FACULTATIVE (mig. 249) : instant de minuit du jour choisi, dans le fuseau de la personne (src/lib/deadline.ts). NULL = aucune échéance.';
COMMENT ON COLUMN public.tasks.priority IS
  'Priorité FACULTATIVE (mig. 249) : 1 (P1, la plus urgente) à 5, 0 = aucune. Rangée après P5 dans tous les tris (src/lib/task-ordering.ts).';
