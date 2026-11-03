# Plan · Facturation lot 3, alerte 80 % des sièges

Spec : `docs/superpowers/specs/2026-11-02-facturation-experience-design.md` § 6.3 (gabarit § 6.1).

## Tâches

1. **Texte pur, tests d'abord** : `supabase/functions/_shared/seat-alert-text.ts`
   (`shouldAlert(memberCount, quota)` ≥ 80 %, illimité exclu, gratuit compris ;
   `effectiveSeatQuota(status, maxMembers)` miroir de `org_seats_allowed` ;
   `seatAlertMail(...)` sur `renderBillingMail`). Tests :
   `src/modules/billing/seat-alert-text.test.ts` (bornes, palier suivant, échappement SV-5,
   liens `https://` seuls, aucun tiret cadratin).
2. **Migration `240_org_seat_alerts.sql`** : table `org_seat_alerts (id, org_id, tier_key,
   sent_at)`, UNIQUE `(org_id, tier_key)`, RLS sans policy, `REVOKE` ; RPC
   `orgs_for_seat_alert()` (DEFINER, `search_path = ''`, `EXECUTE` refusé à `anon` et
   `authenticated`) qui rend effectif, quota effectif et propriétaire, rien si
   `billing_flags.enterprise_seat_limit` n'est pas vrai. Non appliquée.
3. **Edge Function `seat-alert`** : modèle `renewal-notice` (échec fermé sans `CRON_SECRET`,
   égalité stricte, `sendBillingMail`, trace APRÈS l'envoi, `23505` absorbé, plafond par
   exécution, `opsAlert`). Section `[functions.seat-alert] verify_jwt = false`.
4. **Déclenchement** : second job dans `.github/workflows/renewal-notice.yml`.
5. **Gardes** : `src/edge-seat-alert.guard.test.ts` (secret, idempotence, ordre envoi/trace),
   `seat-alert` ajoutée à `src/edge-mail-functions.guard.test.ts` ; `.github/edge-deploy.json`
   `notDeployed` tant qu'elle n'est pas en ligne ; `docs/MODULES.md`.
6. **Vérification** : vitest des fichiers touchés, `check:edge-coverage`, `check:docs`,
   `lint`, `typecheck`. Commit local seulement : ni push, ni déploiement, ni migration appliquée.
