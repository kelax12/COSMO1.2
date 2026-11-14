<!-- chiffres-remesures: 2026-10-30 -->
<!-- Lu par `npm run check:acquisition` (échoue au-delà de 45 jours). ❌ Ne jamais avancer cette date sans rejouer : SUPABASE_ACCESS_TOKEN=… node scripts/check-acquisition.mjs --live -->

# Acquisition : instrumentation, chiffres, runbook

**Quand lire** : avant de toucher l'attribution `?ref=`, `demo_devices`, `scripts/check-acquisition.mjs` ou une campagne. **Fait foi** : le code et la production. Stratégie : [`archive/PLAN-ACQUISITION-30J-2026-08-13.md`](./archive/PLAN-ACQUISITION-30J-2026-08-13.md). Historique des chiffres : [`archive/ACQUISITION-chiffres-et-recits-2026-08-14-au-2026-10-30.md`](./archive/ACQUISITION-chiffres-et-recits-2026-08-14-au-2026-10-30.md). Levier hors dépôt : [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md).

## Compteurs

Le marqueur en tête date la dernière remesure en production (`SQL_COMPTEURS` de `scripts/check-acquisition.mjs`, mêmes comptes exclus que `get_admin_stats`, mig. `149`).

| Compteur | Valeur |
|---|---|
| Utilisateurs (hors comptes exclus) | 46 |
| Inscrits sur 30 jours | 18 |
| Actifs sur 7 jours | 9 |
| Inscriptions avec source `?ref=` | 1 |
| Organisations | 5 |

- ❌ Ne rejouer que par `--live` ; ne jamais avancer le marqueur de mémoire.
- 🔴 Le haut du funnel est la mesure qui compte : le goulot est l'absence de visiteurs (appareils distincts ouvrant la démo), pas la conversion. Travailler la page, le CTA ou l'onboarding n'a aucune prise dessus.
- ✅ Le meilleur taux du funnel est celui des invitations d'entreprise nominatives : une organisation est plus atteignable que mille comptes gratuits.
- ⚠️ La boucle de partage (gratuite par décision, aucun gate `isPremium()`) ne produit rien de mesurable : ce n'est pas le levier à travailler tant que personne n'est là pour partager.

## Chaîne d'attribution `?ref=`

1. ✅ Capture `?ref=` / `utm_source` : `src/lib/attribution.ts` (first-touch, TTL 30 j, whitelist `^[a-z0-9_-]+$`, clé dans `PRESERVE_KEYS`).
2. ✅ Transmission en metadata à `signUp`, recopiée sur `profiles.acquisition_source` par `handle_new_user_profile` (mig. `097`).
3. ✅ Inscription Google : `signInWithOAuth` ne porte aucune metadata, donc la RPC `claim_acquisition_source` (mig. `217`) est appelée à l'ouverture de session d'un compte de moins d'une heure (`src/modules/auth/acquisition-claim.ts`).
4. ✅ Restitution dans `/admin` : `get_admin_stats` (mig. `099`).

- ❌ Une source hors whitelist est rejetée en silence (`?ref=TikTok`, `?ref=tik tok` ne sont pas stockés) : écrire les liens en minuscules.
- 🔴 Avant toute campagne, jouer le test de bout en bout DEUX fois, par email ET par Google : ouvrir `https://thecosmo.app/?ref=test_manuel`, créer un compte jetable, vérifier `profiles.acquisition_source = 'test_manuel'`.

## Pièges de lecture

- ⚠️ `demo_devices` compte des appareils distincts, une seule fois (clé préservée par `clearDemoStorage`) : il mesure l'arrivée de nouveaux visiteurs, pas la rétention. Mobile puis desktop compte deux fois, une navigation privée recrée un appareil : les taux démo vers compte sont un plancher.
- ⚠️ Les comptes de test sont exclus des totaux par `admin_stats_excluded_uids()` (mig. `149`) ; `/admin` rend une clé `excluded_accounts` qui le dit. Tout total qui ne les exclut pas est faux.
- ⚠️ Toute vérification qui parcourt la démo en production écrit une ligne dans `demo_devices` : la retrancher de ses propres chiffres.
- ⚠️ La garde exige une remesure datée, pas que le marché n'ait pas bougé ; elle ne prouve pas qu'un backlink posé existe encore (voir `ACQUISITION-BACKLINKS.md`).
- ⚠️ La délivrabilité (`npm run check:mail`) et le SEO technique ne sont pas en cause : le levier est l'autorité de domaine.

## Runbook : remesurer

Lecture seule, à rejouer avant et après toute campagne.

```sql
-- Le funnel du mois
select 'demo' as etape, count(*) total, count(converted_user_id) convertis
from demo_devices where first_seen_at > date_trunc('month', now())
union all
select 'invitations org', count(*), count(claimed_by)
from org_invite_links where created_at > date_trunc('month', now());

-- Attribution par canal
select coalesce(acquisition_source,'(aucune)') as canal,
       coalesce(acquisition_campaign,'(aucune)') as campagne, count(*)
from profiles group by 1,2 order by 3 desc;

-- Inscriptions et activité
select date_trunc('month', created_at)::date as mois, count(*) from auth.users group by 1 order by 1;
select count(*) filter (where last_sign_in_at > now() - interval '7 days')  as actifs_7j,
       count(*) filter (where last_sign_in_at > now() - interval '30 days') as actifs_30j
from auth.users;
```

## Ordre de traitement

1. Valider la chaîne `?ref=` de bout en bout (deux fois).
2. Lancer la campagne du plan 30 jours, remesurer avec le runbook.
3. ❌ Ne pas investir sur la boucle de partage.
