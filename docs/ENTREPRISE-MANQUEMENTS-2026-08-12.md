# Mode entreprise — manquements constatés dans le code, et plan par manquement

> Complément opérationnel de [`RAPPORT-MODE-ENTREPRISE-2026-08-12.md`](../RAPPORT-MODE-ENTREPRISE-2026-08-12.md).
> Chaque point a été **revérifié dans le code le 2026-08-12** — plusieurs constats issus de notes antérieures étaient périmés (voir « Corrections » en fin de document).

## Vue d'ensemble

> **Mise à jour du 2026-08-12 (même jour)** : les trois P0 sont **livrés**. Voir la section [« Ce qui a été livré »](#ce-qui-a-été-livré-2026-08-12) en fin de document pour le détail et les décisions prises.

| # | Manquement | Gravité | Débloque |
|---|---|---|---|
| 1 | ~~Seeds de démo incomplets~~ ✅ **livré** | 🔴 P0 | #2, #3 — impossible de capturer ce que la démo ne montre pas |
| 2 | ~~Aucune page marketing du mode entreprise~~ ✅ **livré** | 🔴 P0 | Toute l'acquisition B2B |
| 3 | ~~Aucune page pricing entreprise~~ ✅ **livré** (sans montants, cf. décision) | 🔴 P0 | Conversion |
| 4 | i18n incomplet (~10 fichiers avec du FR en dur) | 🟠 P1 | Marché non francophone |
| 5 | Onboarding post-création partiel (checklist admin-only) | 🟠 P1 | Activation / rétention |
| 6 | Aucune page sécurité / confiance | 🟠 P1 | Vente aux orgs > 20 pers. |
| 7 | Plafond de sièges : gate serveur réel mais UI non préparée | 🟡 P2 | Activation de la facturation |
| 8 | Stripe entreprise inexistant | 🟡 P2 | Encaissement réel |
| 9 | Pas d'événements d'entreprise partagés | 🔵 P3 | Argument « agenda d'entreprise » |

L'ordre n'est pas anodin : **#1 conditionne #2 et #3**. Une fonctionnalité que la démo ne sait pas montrer ne peut ni être capturée pour une landing page, ni être testée par un prospect.

---

## #1 — Seeds de démo incomplets 🔴 P0

**Constat.** Dans `src/modules/team-projects/local.repository.ts`, quatre jeux de données sont seedés à vide :

| Donnée | Ligne | État |
|---|---|---|
| Sous-tâches | ~331 | `readOrSeed(..., [])` — aucune |
| Associations tâche ↔ label | ~384 | `readOrSeed(..., [])` — les 4 labels existent mais ne sont posés sur **aucune** tâche |
| Historique d'activité | ~455, ~462 | vide |
| Notifications org | `src/modules/organizations/notifications.ts` ~58 | renvoie `[]` en démo (choix assumé) |

Conséquence directe : quatre fonctionnalités réelles (sous-tâches, labels, historique, cloche de notifications) sont **invisibles** pour quiconque teste la démo — donc invisibles en démo commerciale, en capture d'écran et en vidéo.

**Plan.**
1. Seeder 5-8 sous-tâches réparties sur 3 tâches représentatives des projets « Nova Studio », dont une partiellement cochée (montre la barre de progression).
2. Poser les 4 labels existants (`DEMO_LABELS`) sur ~10 tâches, avec au moins une tâche portant 2 labels.
3. Seeder un historique d'activité déterministe sur 2-3 tâches (changement de statut, réassignation, changement d'échéance) — respecter la règle du projet : **pas de `Math.random()`**, utiliser les helpers de dates relatives existants.
4. Décider pour les notifications : soit seeder 3-4 notifications démo (assignation, mention, retard) pour rendre la cloche démontrable, soit assumer le vide — **je recommande de les seeder**, c'est aujourd'hui la seule brique du §3.11 du rapport qu'aucun prospect ne peut voir.

**Vérification.** `npm test`, puis en démo : ouvrir une tâche d'équipe (sous-tâches + labels + historique visibles), et la cloche de l'en-tête `/entreprise` (badge non nul).

---

## #2 — Aucune page marketing du mode entreprise 🔴 P0

**Constat.** Recherche exhaustive : le mode entreprise n'apparaît dans **aucune** page publique.
- `src/pages/landing/` : une seule occurrence du mot, dans `FeaturesSection.tsx`, sans rapport avec le mode entreprise.
- `src/content/use-cases.mjs` : trois pages (`pour-freelances`, `pour-etudiants`, `pour-managers`).
- **Nuance importante** : `pour-managers` existe, mais vend le produit **personnel** (partage de tâches 1-à-1, OKR perso, time-blocking). Elle ne mentionne ni la pyramide, ni l'agenda managérial, ni les statistiques d'équipe, ni les projets d'équipe. Un manager de PME qui atterrit dessus ne découvre pas le mode entreprise.

**Plan.**
1. **Nouvelle page use-case `pour-equipes`** (ou `logiciel-gestion-equipe`) dans `src/content/use-cases.mjs` — même structure que les 3 existantes (`slug`, `metaTitle`, `description`, `lead`, `html`), donc **aucun composant de page à écrire** : `UseCasePage.tsx` la sert et `prerender.mjs` la prérend. C'est le chemin le moins coûteux et le plus cohérent avec l'existant.

   > *Corrigé après coup (2026-08-12) : « zéro route à créer » était inexact, et ce raccourci a masqué le bug ci-dessous. Une nouvelle page use-case demande **trois** ajouts, pas un : l'entrée dans `use-cases.mjs`, le slug dans les trois langues dans `src/i18n/route-slugs.json`, et la `<Route>` dans `src/App.tsx`. La résolution du contenu passe désormais par `resolveUseCase()` (`src/content/use-cases.locale.ts`), pas par `getUseCase()`, qui a été supprimé.*
2. Contenu structuré sur les 4 briques les plus vendeuses (§3.1 pyramide, §3.6 agenda managérial, §3.7 statistiques, §3.8 revue hebdo), titrées sur la douleur, pas sur la fonctionnalité.
3. **Réécrire la section équipe de `pour-managers`** pour pointer vers la nouvelle page, au lieu de s'arrêter au partage de tâches 1-à-1.
4. Ajouter un bloc « Pour votre équipe » dans `SolutionsSection.tsx` ou `FeaturesSection.tsx` de la landing, avec CTA vers la nouvelle page.
5. Captures produit : réutiliser le pipeline `scripts/visual-audit*.mjs` déjà en place, **après #1** (sinon les captures montrent des écrans vides).

**Vérification.** `npm run build` (le prérendu doit produire le HTML de la nouvelle page), puis vérifier le nombre de mots prérendus — le seuil de référence du chantier SEO précédent est ~639 mots.

---

## #3 — Aucune page pricing entreprise 🔴 P0

**Constat.** `ENTERPRISE_TIER_1_EUR` (20) et `ENTERPRISE_TIER_2_EUR` (100) sont définis dans `src/modules/billing/premium-config.ts` et **utilisés nulle part dans `src/`**. Aucun prospect ne peut connaître le tarif. `PremiumPage.tsx` ne parle que de l'offre personnelle (3,50 €/mois).

**Plan.**
1. Section pricing entreprise dans la nouvelle page use-case (#2) plutôt qu'une page séparée dans un premier temps — moins de surface à maintenir, et le prix se lit au moment où la valeur vient d'être expliquée.
2. Afficher les montants via `formatCurrency()` (`src/i18n/format.ts`), **jamais en dur** — la règle est déjà posée dans `premium-config.ts`.
3. Message : « Gratuit jusqu'à 5 personnes · 20 €/mois de 5 à 50 · 100 €/mois au-delà — un prix par organisation, pas par utilisateur. »
4. ⚠️ **Décision préalable requise d'Axel** : ces montants sont aujourd'hui des valeurs de configuration, pas un engagement commercial. Les publier les rend difficiles à changer. À trancher avant d'écrire la section.

---

## #4 — i18n incomplet 🟠 P1

**Constat.** 46 des 47 `.tsx` de `src/components/organization/` importent bien `useT`, mais ~10 fichiers gardent des chaînes françaises en dur, principalement des libellés de rôle et des placeholders :
- `OrganizationSettingsCard.tsx` (~8-10) : `'Administrateur'`, `'Manager'`, `'Membre'`
- `MemberDirectory.tsx` (~55-56) : `label: 'Manager' / 'Membre'`
- `CreateOrJoinOrganization.tsx` (~193, 218, 230) : `placeholder="Nova Studio"`, `'Envoyer la demande'`
- Également : `DeleteOrganizationDialog.tsx`, `NewTeamProjectModal.tsx`, `OrgProfileSheet.tsx`, `AssigneesPicker.tsx`, `ReassignManagerSheet.tsx`, `TeamTaskRow.tsx`
- Hors dossier : `src/pages/OrganizationOnboardingPage.tsx` (~30, ~42)

**Plan.**
1. Extraire ces chaînes vers les catalogues `src/i18n/` (fr + en), en priorisant les **libellés de rôle**, qui sont les plus visibles (annuaire, réglages, pyramide).
2. Ne pas se fier au rapport de `npm run i18n:scan` seul : le scan a historiquement laissé passer le français sans accent. **Relire les écrans en `/en/entreprise`** — le préfixe d'URL fait loi, `cosmo_locale` seul ne suffit pas hors racine.

---

## #5 — Onboarding post-création partiel 🟠 P1

**Constat.** `src/pages/OrganizationOnboardingPage.tsx` (72 lignes) s'arrête à la création ou à l'adhésion : logo, `CreateOrJoinOrganization`, bouton « plus tard ». Aucun guidage ensuite. Le vrai guidage existe mais ailleurs et sous conditions : `MyWorkTab.tsx` (~173-192) affiche une checklist `StartChecklist` à 4 étapes (projet, invitation, pyramide, OKR), **visible pour les admins uniquement** et masquée dès que tout est fait.

Deux trous :
- **Pas d'étape « créer une équipe »** dans la checklist, alors que le rapport (§3.3) recommande explicitement de créer les équipes *avant* les projets — la checklist guide donc dans le mauvais ordre.
- **Un membre non-admin n'est pas guidé du tout** : il arrive dans `/entreprise` sans savoir quoi y faire.

**Plan.**
1. Ajouter une 5ᵉ étape `stepTeam` à `StartChecklist`, positionnée **avant** `stepProject`.
2. Ajouter un état d'accueil léger pour les non-admins (3 puces : voir mes tâches d'équipe, consulter l'annuaire, suivre les OKR de mon équipe), affiché tant que la personne n'a aucune tâche assignée.
3. Ne pas déclencher ces guidages en mode démo (règle projet : la démo ne voit jamais l'onboarding).

---

## #6 — Aucune page sécurité / confiance 🟠 P1

**Constat.** Le cloisonnement RLS, les droits distincts agenda/statistiques et le consentement RGPD à l'adhésion sont implémentés et solides (§3.13 du rapport), mais **aucune page publique ne les explique**. C'est un critère d'achat décisif dès qu'une organisation dépasse 20-30 personnes, et l'objection est systématique en cycle B2B.

**Plan.**
1. Version légère d'abord : une section « Vos données restent cloisonnées » dans la page use-case (#2), en langage non technique — « même en cas de bug d'affichage, les données restent séparées ».
2. Insister sur la séparation vie perso / vie pro : le manager voit le créneau d'un événement personnel, jamais son contenu. C'est l'objection la plus fréquente **côté salariés**, et elle décide de l'adoption réelle après la vente.
3. Page dédiée complète seulement si un cycle de vente à grande organisation le réclame — ne pas l'écrire par anticipation.

---

## #7 — Plafond de sièges : gate serveur réel, UI non préparée 🟡 P2

**Constat.** Le blocage serveur existe vraiment : `org_seats_allowed(p_org)` (`supabase/migration/067_org_invite_links.sql`, ~87-110) est appelée par les RPC d'ajout de membre (067 ~181/~244, 084 ~152, 087 ~102) et lève `seat_limit_reached`. Mais si la ligne `enterprise_seat_limit` de `billing_flags` est absente ou `enabled != true`, la fonction retourne `true` → aucune limite. C'est l'état actuel.

Côté client, `ENTERPRISE_BILLING_ENFORCED` n'a **que 4 occurrences, toutes dans le bloc de bannière informative** de `OrganizationPage.tsx` (~193-210). **Aucun CTA d'ajout n'est désactivé.**

⚠️ **Risque concret** : le jour où le flag serveur est activé, l'utilisateur cliquera sur « Inviter », et le RPC lèvera `seat_limit_reached` — une erreur technique brute, sans message compréhensible ni proposition de passer au palier supérieur.

**Plan (à faire *avant* toute activation, pas après).**
1. Intercepter `seat_limit_reached` dans les mutations concernées (invitation, lien, acceptation de demande) et le traduire en message clair via `normalizeApiError` — rappel : **jamais de `toast` depuis un repository**.
2. Quand `ENTERPRISE_BILLING_ENFORCED === true` et le quota atteint : désactiver les CTA d'ajout avec une explication et un lien vers le pricing, plutôt que de laisser l'appel partir et échouer.
3. Tester le scénario en activant le flag sur une org de test avant de le faire en prod.

---

## #8 — Stripe entreprise inexistant 🟡 P2

**Constat.** Il n'existe aucun chemin de paiement pour une organisation.
- `supabase/functions/stripe-create-checkout` utilise un **unique** `STRIPE_PRICE_ID` (~115) et `plan: 'free'` (~106) : aucune notion d'`org_id`, de nombre de sièges, ni de palier.
- Ses trois appelants (`PremiumPage.tsx`, `PremiumGateModal.tsx`, `HabitsAdGate.tsx`) sont tous personnels.
- `src/modules/billing/` ne contient aucun fichier Stripe.
- La table `org_subscriptions` est annoncée « à venir » en commentaire dans la migration 067 (~105-107) — elle n'existe pas.

C'est le chantier le plus lourd de cette liste, et **le seul qui ne soit pas urgent** : tant que l'acquisition n'est pas amorcée, rien à encaisser.

**Plan (par étapes, à ne lancer qu'après traction mesurée).**
1. Migration : table `org_subscriptions` (org_id, tier, current_period_end, stripe_customer_id, stripe_subscription_id), RLS lecture membres / écriture serveur uniquement — suivre la checklist de `docs/SECURITY.md`.
2. Deux `PRICE_ID` supplémentaires côté Stripe (palier 20 € et 100 €), passés en paramètre de l'edge function au lieu du price unique en dur.
3. Étendre `stripe-webhook` pour écrire dans `org_subscriptions` et piloter `billing_flags.enterprise_seat_limit` automatiquement.
4. Écran de paiement org (réservé aux admins), qui calcule le palier depuis le nombre de sièges réel.
5. Puis seulement basculer `ENTERPRISE_BILLING_ENFORCED = true` — après #7.

**Prérequis bloquant** : le Stripe *personnel* n'est lui-même pas finalisé (cf. `faille.md` et `docs/POST-AUDIT-GUIDE.md`). Le finaliser d'abord, sinon on construit sur du sable.

---

## #9 — Pas d'événements d'entreprise partagés 🔵 P3

**Constat.** Aucune table `org_events` / `team_events`. Les événements sont strictement personnels (`src/modules/events/`, migration 004). L'agenda d'entreprise est **dérivé** : `MemberAgendaBody.tsx` convertit des tâches d'équipe en pseudo-événements, et `MyWorkTab.tsx` (~151-171) affiche un bloc « Prochaines échéances de l'entreprise » construit à partir des deadlines de tâches d'équipe et des échéances OKR.

**Correction du rapport** : ce bloc dérivé (« Option A » de la note du 2026-07-18) **est bien implémenté**. Ce qui manque, c'est uniquement l'« Option B » : un vrai modèle d'événement partagé (réunion d'équipe, offsite, jalon d'entreprise visible par tous).

**Plan.** Ne rien coder pour l'instant. Décider d'abord si l'argument « agenda d'entreprise » est nécessaire à la vente. Si oui : nouvelle table org-scopée avec cloisonnement par équipe calqué sur `can_access_team_project`, publication Realtime + `REPLICA IDENTITY FULL` si écoutée. Chantier lourd, à cadrer séparément — ne pas le glisser dans un lot de finitions.

---

## Corrections apportées au rapport initial

Trois constats du rapport, hérités de notes plus anciennes, sont **périmés** :

1. **« Sous-tâches et labels : chantier de schéma non fait »** → **FAUX**. Les deux existent en base (mig. 092 et 093), dans les repositories, et sont câblés à l'UI (`TeamSubtasksSection.tsx`, `TeamTaskLabelsSection.tsx`, montés dans `TeamTaskModal.tsx`). Le vrai problème est ailleurs : **les seeds de démo ne les montrent pas** (#1).
2. **« Événements d'entreprise : rien n'existe »** → **PARTIELLEMENT FAUX**. Le bloc dérivé « Prochaines échéances de l'entreprise » est en place (#9).
3. **« 0 mention du mode entreprise côté marketing »** → **exact au sens strict**, mais à nuancer : la page `/pour-managers` existe et cible le bon persona — elle vend simplement les mauvaises fonctionnalités (#2).

Ces trois corrections doivent être reportées dans le rapport principal avant toute diffusion externe.

---

## Séquence recommandée

```
#1 seeds démo  ──►  #2 page marketing  ──►  #3 pricing
                         │
                         ├──►  #6 section sécurité
                         └──►  #4 i18n  ·  #5 onboarding
                                              │
                     (après traction mesurée) ▼
                                    #7 garde UI sièges  ──►  #8 Stripe org
                                                                  │
                                          (si la vente le réclame) ▼  #9 org_events
```

Le premier lot (#1 → #2 → #3) est celui qui transforme un produit invisible en produit vendable. Les autres améliorent un chemin qui, aujourd'hui, n'existe pas encore.

---

## Ce qui a été livré (2026-08-12)

Les trois P0 sont faits, vérifiés au navigateur en mode démo.

### #1 — Seeds de démo

`src/modules/team-projects/local.repository.ts` et `src/modules/organizations/notifications.ts`.

| Jeu | Avant | Après |
|---|---|---|
| Sous-tâches | 0 | 10, sur 3 tâches — un cas vide, un partiel (2/4), un complet (3/3) |
| Associations tâche ↔ label | 0 | 12, sur 10 tâches, dont 2 tâches à double label |
| Historique d'activité | 0 | 9 entrées sur 6 jours |
| Notifications org | `[]` en dur | 4 (3 non lues), avec un vrai store localStorage |

Trois points qui ne se lisent pas dans le diff :

- **Le journal d'activité reprend le format exact du trigger** de la mig. 094 : statut brut, priorité en texte, assignés joints par virgules, `name` sans valeurs. Reformater côté démo aurait fait diverger le seul écran censé prouver que le journal est fidèle. *Effet de bord constaté : la production affiche donc des UUID bruts pour les assignés et les projets — défaut de rendu réel, signalé séparément.*
- **L'entrée de deadline devait repousser la date, pas l'avancer.** `isPostponement` (`weekly-review.helpers.ts`) teste `newValue > oldValue` ; ma première version avançait l'échéance et l'étape « ce qui a dérapé » de la revue hebdo restait vide. Corrigé en déplaçant le glissement sur une tâche dont l'échéance réelle est future.
- **Les notifications ne sont plus une liste vide mais un store réel** : `useMarkNotificationsRead` écrit maintenant en démo, avec la même sémantique qu'en prod (ne réécrit que les non-lues). Sans ça la cloche se serait ouverte sans jamais se vider. Les 4 seeds pointent toutes vers des tâches qui existent, et un 4ᵉ commentaire a été ajouté pour que la notification « mention » renvoie à un vrai commentaire.

### #2 + #3 — Page marketing `/pour-equipes`

Ajoutée dans `src/content/use-cases.mjs` — donc **zéro route à inventer** : `UseCasePage`, `prerender.mjs`, le sitemap et `llms.txt` la prennent en charge automatiquement.

- **966 mots prérendus** (référence du chantier SEO précédent : 639), 7 sections, 4 liens internes.
- `metaTitle` 60 caractères, description 156, canonical correct, présente au sitemap (17 URLs) et à `llms.txt`.
- Slug déclaré en trois langues dans `route-slugs.json` (`pour-equipes` / `for-teams` / `para-equipos`), route ajoutée dans `App.tsx`, lien ajouté aux deux footers (React et prérendu) avec la clé `footer.teams` en FR et EN.
- La section « équipe » de `/pour-managers` pointe désormais vers cette page au lieu de s'arrêter au partage 1-à-1.

**Décisions prises avec Axel :**

1. **Pas de montants publiés.** La page met en avant « gratuit jusqu'à cinq personnes, sans fonctionnalité bridée » et s'arrête là. Les paliers 20 €/100 € restent internes tant que la date d'activation n'est pas tranchée — un prix indexé par Google est difficile à reprendre.
2. **Slug `pour-equipes`**, par symétrie avec les trois pages existantes.

### Défauts pré-existants découverts en vérifiant

Aucun des deux n'est causé par ce lot ; les deux sont signalés séparément.

- **Historique de tâche : valeurs brutes à l'écran.** Statuts en anglais technique, UUID d'assignés et de projets. Le journal en base est correct, c'est le rendu qui ne résout rien. — *ouvert*
- ~~**Pages use-case cassées hors français.**~~ **Corrigé le 2026-08-12** — voir ci-dessous.

#### Correctif : pages use-case hors français (2026-08-12)

`UseCasePage` résolvait son contenu en comparant le pathname au slug FR de `use-cases.mjs`. Le `basename` du routeur ayant déjà retiré le préfixe de locale, le pathname vaut `/for-teams` sous `/en/` : `getUseCase` renvoyait `undefined` et la page faisait `<Navigate to="/" replace />`. Les quatre pages étaient inaccessibles dans toute langue autre que le français.

- **Résolution du slug** — nouveau `resolveUseCase(slug)` dans `src/content/use-cases.locale.ts`, qui passe des deux côtés par `routeIdFromSlug` (`src/i18n/routes.ts`) : `for-teams` et `pour-equipes` se réduisent tous deux à `teams`. Le module est **séparé du registre** parce que `use-cases.mjs` doit rester importable par `prerender.mjs` sous Node brut, sans bundler — il ne peut pas importer du TypeScript.
- **`getUseCase` supprimé** de `use-cases.mjs` et de `use-cases.d.mts`. Plus aucun appelant, et c'était l'API qui invitait à refaire l'erreur : une recherche par égalité de slug ne peut pas être correcte tant que les entrées ne portent que le slug FR.
- **Canonical localisé** — `canonicalUrl(\`/${useCase.slug}\`, locale)` au lieu de la chaîne `https://thecosmo.app/${useCase.slug}` codée en dur, qui pointait vers l'URL française depuis toute langue.
- **Tests** — `src/content/use-cases.locale.test.ts` : résolution des 4 use-cases × `ALL_LOCALES` (l'espagnol inclus, pour que l'ouverture de la langue ne rouvre pas le bug), `undefined` sur un slug inconnu **et** sur `a-propos` (slug traduit connu mais servi par une autre page), et les trois canonicals de `teams`.

**Le contenu reste français** : décision prise avec Axel de ne pas traduire maintenant. Traduire les quatre corps (~1200-1500 mots chacun, en + es) n'ouvrirait pas l'indexation pour autant, puisque `INDEXABLE_LOCALES` couvre toute la surface publique et pas seulement les use-cases. `/en/` et `/es/` gardent donc leur `noindex` dans `vercel.json` — pas de duplicate content — et la traduction reste groupée dans la phase 5 du chantier i18n. Quand elle arrivera, c'est `use-cases.mjs` qui devra porter son contenu par locale ; le routage, lui, n'aura plus rien à changer.

> `/es/…` répond toujours 404 : l'espagnol n'est pas dans `SUPPORTED_LOCALES` (`['fr','en']`). C'est indépendant de ce bug, et `resolveUseCase` est déjà prêt pour le jour où la langue s'ouvre.

Vérifié : les quatre `/en/for-*` rendent leur page avec le bon canonical et `lang="en"`, `/pour-managers` inchangé, `lint`/`tsc`/`i18n:check` à 0 erreur, suite 1285/1285.

---

*Rédigé le 2026-08-12 · tous les constats revérifiés dans le code à cette date · les chemins et numéros de ligne sont indicatifs et peuvent bouger.*
