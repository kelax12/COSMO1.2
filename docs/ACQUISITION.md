# Acquisition — instrumentation, chiffres réels et runbook

**Audit du 2026-08-14**, mesuré directement en prod (`ykeugqfgklejcdbrmawy`) et dans le code.
Le [plan 30 jours](./archive/PLAN-ACQUISITION-30J-2026-08-13.md) date de la veille et reste
valable comme stratégie — ce document ne le refait pas. Il répond à une autre question :
**est-ce que la machine à mesurer fonctionne, et que dit-elle ?**

---

> ### 🔴 Remesure du 2026-09-14 (soir) · un mois plus tard, la machine marche et le funnel est vide
>
> L'audit du 2026-08-14 posait la bonne question : « est-ce que la machine à mesurer fonctionne, et
> que dit-elle ? » Un mois plus tard, les deux moitiés ont été revérifiées **contre la production**,
> et il faut les séparer, parce qu'elles ne disent pas la même chose.
>
> **La machine fonctionne, et ce n'est pas une déduction.** Le parcours d'entrée a été PARCOURU en
> production, dans un navigateur, sur un iPhone 12 émulé : clic sur « Essayer la démo gratuite » sur
> `/` → arrivée sur `/dashboard`, interface rendue, et **`POST record_demo_visit` part réellement**
> (observé dans le trafic réseau). Le compteur d'appareils n'est donc pas en panne.
>
> ⚠️ **Cette vérification a elle-même écrit une ligne en production** : un appareil de plus dans
> `demo_devices` (45 → 46, et septembre passe de 1 à 2). C'est une ligne anonyme, un UUID sans
> rattachement, mais elle est de moi et pas d'un visiteur. **Tout chiffre de septembre ci-dessous
> est donné hors cette ligne.**
>
> **Ce que la machine dit, elle, est mauvais :**
>
> | | Juillet 2026 | Août 2026 | **Sept. 2026** (1 au 14) |
> |---|---|---|---|
> | Appareils distincts ayant ouvert la démo | 19 | 25 | **1** |
> | Dont convertis en compte | 14 | 8 | **1** |
> | Inscriptions (`auth.users`) | 8 | · | **1 sur 30 jours glissants, 0 sur 7 jours** |
> | Comptes actifs sur 30 jours | · | 15 | **9** (58 jours-activité cumulés) |
> | Connexions sur 7 jours | · | 0 | **2** |
>
> 🔴 **Le chiffre à retenir n'est pas le taux de conversion, c'est le haut du funnel.** Un appareil
> qui ouvre la démo en deux semaines, contre 25 le mois précédent : ce n'est pas un problème de
> conversion, c'est une absence de visiteurs. Travailler la page, le CTA ou l'onboarding n'a aucune
> prise sur ce chiffre-là.
>
> ⚠️ **Deux précautions de lecture, parce que ce compteur est facile à mal lire** :
>
> - `demo_devices` compte des appareils **distincts et une seule fois** (la clé est préservée par
>   `clearDemoStorage`). Un visiteur d'août qui revient en septembre n'apparaît pas en septembre.
>   Le chiffre mesure donc l'arrivée de NOUVEAUX visiteurs, ce qui est précisément ce qu'on veut
>   ici, mais il ne dit rien de la rétention.
> - **Deux des 28 comptes ne sont pas des utilisateurs** : `demo@cosmo.app`
>   (`aaaaaaaa-aaaa-…`, créé le 2026-01-10, jamais connecté, et porteur de 120 tâches, 67 événements,
>   6 habitudes et 4 OKR **en production**) et `testemail@gmail.com`. La base compte donc **26
>   comptes réels**, et **16 % des tâches de la plateforme appartiennent au compte de
>   démonstration**. 🔴 `get_admin_stats` **ne les exclut ni l'un ni l'autre** (vérifié dans sa
>   définition en base) : la console `/admin` compte des fantômes, et toute décision prise sur ses
>   chiffres avant une campagne est biaisée d'autant.
>
> ✅ **Ce qui n'est pas en cause** : la délivrabilité (`npm run check:mail` vert, DKIM, SPF et MX du
> Return-Path en place, un seul avertissement DMARC `p=none`), la production (`/`,
> `/entreprise-presentation`, `/en`, `/blog`, `/sitemap.xml` répondent **200**), ni le SEO technique
> (40 URLs au sitemap, 80 `hreflang`, 0 page `noindex`, revérifiés sur un build neuf). **Tout est
> prêt et personne ne vient.** Le levier reste celui nommé le 2026-08-19, et il est hors du dépôt :
> [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md).

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> **Pourquoi cette section existe.** Demande d'Axel, après le constat qui a ouvert la journée :
> `CLAUDE.md` a pesé 150 ko sans qu'aucune note ne bouge, parce qu'il était **cité comme source**
> par les audits et **jamais mesuré par eux**. Il était le mètre, jamais l'objet.
>
> 🔴 **Ce document n'a PAS de note, et c'est son premier angle mort.** Les onze documents notés
> entrent dans le tableau de bord de [`README.md`](./README.md) et peuvent donc monter ou baisser.
> Celui-ci ne le peut pas : rien ne le pèse, donc rien ne signale qu'il a vieilli. Les angles morts
> ci-dessous ne sont **pas** des défauts du produit ; ce sont les endroits où **ce document affirme
> sans que rien ne vérifie**.
>
> Chaque ligne est vérifiée par une commande, jamais supposée. Elle se **referme** ou se
> **reconduit avec sa date**, jamais ne se recopie.

| # | Angle mort | Vérifié le 2026-09-16 | Outillable ? |
|---|---|---|---|
| AM-1 | 🔴 **Les chiffres datent du 2026-08-14 et ne sont rejoués par rien.** Un audit d'acquisition dont les mesures ont un mois décrit un marché qui a bougé, et il n'existe aucun job qui les remesure | mesures datées dans l'en-tête, aucun workflow d'acquisition | oui : un job planifié sur les compteurs de la base |
| AM-2 | **Aucune action n'est reliée à son résultat.** Ce document liste des leviers ; rien n'attribue une inscription à un levier. C'est le même motif que T-5 du tableau de bord : on mesure la conformité, pas le résultat | le tracking `?ref=` reste un développement ouvert | oui, et c'est peu coûteux |
| AM-3 | **Les comptes de TEST ne sont retranchés d'aucun chiffre.** `demo@cosmo.app` porte **120 tâches** en production, soit 16 % des tâches de la plateforme, et `get_admin_stats` les compte encore : la mig. `149` qui les retranche est **écrite et non appliquée** | 🔴 **Remesuré le 2026-09-20 : pire que « non appliquée », elle n'est pas COMMITÉE.** `supabase/migration/149_admin_stats_excludes_non_users.sql` est un fichier **non suivi** de l'arbre de travail, et `admin_stats_excluded_uids()` n'existe pas en base | oui, immédiatement · `a-faire-code.md` **C-100**, `a-faire-manuel.md` **M-46** |

---

## 1. Les chiffres réels · *état du 2026-08-14, conservé à sa date*

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

> ✅ **Fait.** La mig. `099` est appliquée en prod depuis le **2026-08-23** (ledger vérifié le
> 2026-08-24). Les stats admin v3 sont donc disponibles ; ce document n'a pas encore été relu à
> leur lumière.

## 3. 🔴 Aucune attribution n'a jamais été capturée

Les **27 comptes ont `acquisition_source` à NULL**. Ce n'est pas une panne : la mig. 097 est en
prod depuis le 2026-08-13 et **aucun compte n'a été créé depuis**. La machinerie est donc
**non éprouvée en conditions réelles** — elle n'a jamais eu une seule inscription à traiter.

> 🔴 **Toujours vrai le 2026-08-24, et c'est maintenant un fait, plus une hypothèse.** Remesuré
> en prod : **28 comptes** (+1 en onze jours), et **`acquisition_source` renseignée sur 0**. Un
> compte a donc bien été créé depuis la mig. `097` — sans passer par un `?ref=`, ou sans que la
> chaîne fonctionne. Le test de bout en bout ci-dessous n'est plus « à faire avant de lancer » :
> c'est le seul moyen de savoir laquelle des deux explications est la bonne.

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
