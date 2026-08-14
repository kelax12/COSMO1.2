# Acquisition — instrumentation, chiffres réels et runbook

**Audit du 2026-08-14**, mesuré directement en prod (`ykeugqfgklejcdbrmawy`) et dans le code.
Le [plan 30 jours](./archive/PLAN-ACQUISITION-30J-2026-08-13.md) date de la veille et reste
valable comme stratégie — ce document ne le refait pas. Il répond à une autre question :
**est-ce que la machine à mesurer fonctionne, et que dit-elle ?**

---

## 1. Les chiffres réels

| Métrique | Valeur |
|---|---|
| Comptes au total | **27** |
| Inscriptions en août 2026 | **0** |
| Comptes actifs sur 7 jours | **0** |
| Comptes actifs sur 30 jours | 15 |
| Organisations / membres | 3 / 11 |

Inscriptions par mois : janvier 1, avril 5, mai 8, juin 5, **juillet 8, août 0**.
La dernière inscription date du **21 juillet** — trois semaines sans nouvel utilisateur.

### Le funnel, mois par mois

| | Juillet 2026 | Août 2026 |
|---|---|---|
| Visiteurs démo (`demo_devices`) | 19 | **5** |
| Conversions démo → compte | 14 (**74 %**) | **0** |
| Liens de partage créés | 9 | 0 |
| Invitations entreprise | 8, dont 7 acceptées (88 %) | 0 |

⚠️ **Le taux de 74 % de juillet n'est pas un signal de marché** : à ce volume, avec des
inscriptions concentrées sur quelques jours, c'est du test interne et de l'entourage. Le signal
exploitable est celui d'août : **5 visiteurs démo, 0 conversion**.

---

## 2. 🔴 La boucle de mesure n'est pas fermée

La chaîne d'attribution `?ref=` a quatre maillons. Trois sont en place :

| Maillon | État |
|---|---|
| Capture `?ref=` / `utm_source` côté client (`src/lib/attribution.ts`) | ✅ first-touch, TTL 30 j, whitelist stricte, clé dans `PRESERVE_KEYS` |
| Transmission en metadata à `signUp` | ✅ |
| Recopie sur `profiles.acquisition_source` par `handle_new_user_profile` | ✅ **mig. 097 appliquée en prod le 2026-08-13** (vérifié) |
| Restitution dans `/admin` | ❌ **mig. 099 `admin_stats_v3` n'est PAS appliquée** — la dernière en prod est la 098 |

Vérifié : `get_admin_stats` en prod ne référence pas `acquisition_source`.

**Conséquence concrète** : si un visiteur s'inscrivait demain via `?ref=tiktok`, la source serait
correctement enregistrée en base — et **invisible dans `/admin`**. Il faudrait une requête SQL
manuelle pour la voir. La campagne d'acquisition qui démarre ne serait donc pas mesurable là où on
va la regarder.

**Correction** : appliquer `supabase/migration/099_admin_stats_v3.sql`. C'est le geste à plus fort
levier de tout ce document — il conditionne la lecture de tout le reste.

## 3. 🔴 Aucune attribution n'a jamais été capturée

Les **27 comptes ont `acquisition_source` à NULL**. Ce n'est pas une panne : la mig. 097 est en
prod depuis le 2026-08-13 et **aucun compte n'a été créé depuis**. La machinerie est donc
**non éprouvée en conditions réelles** — elle n'a jamais eu une seule inscription à traiter.

**À faire avant de lancer quoi que ce soit** : un test de bout en bout — ouvrir
`https://thecosmo.app/?ref=test_manuel`, créer un compte jetable, vérifier que
`profiles.acquisition_source = 'test_manuel'`. Sans ça, on lancera une campagne sur une chaîne
jamais validée. La whitelist rejette silencieusement ce qui ne matche pas `^[a-z0-9_-]+$` : un
`?ref=TikTok` (majuscules) ou `?ref=tik tok` ne serait **pas** stocké.

## 4. 🟠 La boucle de partage ne produit rien

**15 liens de partage créés, 2 tâches effectivement partagées.** La collaboration est gratuite par
choix stratégique explicite — c'est le pari viral du produit (aucun gate `isPremium()` sur le
partage, règle inscrite dans `CLAUDE.md`). Or elle n'a produit **aucune entrée mesurable**.

Deux lectures possibles, et on ne peut pas trancher avec 27 comptes : soit le partage n'est pas
découvrable, soit il n'y a simplement personne pour partager. La seconde est plus probable, et
elle dit que ce n'est **pas** le levier à travailler maintenant.

## 5. ✅ Ce qui marche

**Les invitations d'entreprise : 7 acceptées sur 8 (88 %).** C'est, de loin, le meilleur taux de
tout le funnel. Cohérent avec la conclusion du plan 30 jours (10 organisations est plus atteignable
que 1 000 comptes gratuits) : quand quelqu'un est invité nommément dans une organisation, il entre.

---

## 6. Runbook — remesurer l'acquisition

Requêtes en lecture seule, à rejouer avant et après toute campagne.

```sql
-- Le funnel du mois
select 'demo' as etape, count(*) total, count(converted_user_id) convertis
from demo_devices where first_seen_at > date_trunc('month', now())
union all
select 'invitations org', count(*), count(claimed_by)
from org_invite_links where created_at > date_trunc('month', now());

-- Attribution par canal (vide tant que la chaîne n'a pas tourné)
select coalesce(acquisition_source,'(aucune)') as canal,
       coalesce(acquisition_campaign,'—') as campagne, count(*)
from profiles group by 1,2 order by 3 desc;

-- Inscriptions et activité
select date_trunc('month', created_at)::date as mois, count(*) from auth.users group by 1 order by 1;
select count(*) filter (where last_sign_in_at > now() - interval '7 days')  as actifs_7j,
       count(*) filter (where last_sign_in_at > now() - interval '30 days') as actifs_30j
from auth.users;
```

**Piège de lecture** : `demo_devices` compte des appareils, pas des personnes — un même visiteur
sur mobile puis desktop compte deux fois, et un navigateur en navigation privée recrée un device à
chaque session. Les taux de conversion démo → compte sont donc un **plancher**, pas une vérité.

## 7. Ordre de traitement

1. **Appliquer la mig. 099** — sans elle, rien de ce qui suit n'est observable.
2. **Valider la chaîne `?ref=` de bout en bout** avec un compte jetable.
3. **Lancer la campagne** du plan 30 jours, et remesurer avec le runbook ci-dessus.
4. Ne pas investir sur la boucle de partage tant qu'il n'y a personne pour partager.
