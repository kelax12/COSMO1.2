-- ═══════════════════════════════════════════════════════════════════
-- 208, l'URL d'un webhook d'entreprise est un NOM de domaine, en 443
--
-- Audit de sécurité du 2026-09-30. La contrainte `org_webhooks_url` de la
-- mig. 199 filtrait par liste noire textuelle (`localhost`, `127.`, `10.`,
-- `192.168.`, `169.254.`, `0.`, `[`). Elle laissait passer `172.16.0.0/12`,
-- `100.64.0.0/10`, et les IPv4 écrites en entier ou en hexadécimal, que le
-- parseur d'URL de `fetch` normalise ensuite en adresse pointée.
--
-- Nouvelle forme, par liste BLANCHE : `https://`, un nom dont le dernier
-- label commence par une lettre (donc jamais une IPv4, ni une IPv6 entre
-- crochets, ni un entier), port absent ou 443, et aucun suffixe réservé aux
-- réseaux internes.
--
-- ⚠️ Ce n'est PAS la frontière : un nom public peut résoudre vers une adresse
--    privée. La décision qui fait foi est prise à l'envoi, sur les adresses
--    RÉSOLUES (`supabase/functions/_shared/webhook-destination.ts`). Cette
--    contrainte refuse tôt ce qui ne partira jamais, pour que l'écran le dise.
--
-- `org_webhooks` portait 0 ligne en production le 2026-09-30 : la contrainte
-- se pose VALIDÉE, sans risque de refus sur l'existant. Si des lignes ont été
-- créées depuis, la pose échoue et le dit (aucune donnée n'est modifiée).
--
-- Miroir client : `webhookUrlIsAllowed` (`src/modules/org-config/local.repository.ts`).
--
-- Retour arrière : la contrainte de la mig. 199, recopiée ci-dessous.
--   CHECK (char_length(url) <= 500
--     AND url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$'
--     AND url !~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)')
--
-- ⚠️ NON APPLIQUÉE au 2026-09-30.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.org_webhooks
  DROP CONSTRAINT IF EXISTS org_webhooks_url;

ALTER TABLE public.org_webhooks
  ADD CONSTRAINT org_webhooks_url CHECK (
    char_length(url) <= 500
    AND url ~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](:443)?(/.*)?$'
    AND url !~* '^https://[^/:]+\.(localhost|local|internal|home\.arpa|lan|intranet|corp)(:443)?(/|$)'
  );

-- ── Vérification après application (lecture seule) ─────────────────
--
--   SELECT pg_get_constraintdef(c.oid)
--     FROM pg_constraint c
--    WHERE c.conrelid = 'public.org_webhooks'::regclass AND c.conname = 'org_webhooks_url';
--   -- attendu : la forme ci-dessus, avec `(:443)?`
