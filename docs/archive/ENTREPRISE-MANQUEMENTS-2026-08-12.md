> ⚠️ **ARCHIVE — instantané daté du 2026-08-13, non maintenu.**
> Ce document décrit l'état du projet **à cette date**. Il n'a pas été mis à jour depuis
> et ne doit **pas** être lu comme l'état courant du code.
> Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) · [`faille.md`](../../faille.md) · [`docs/`](../../docs/README.md).

# Mode entreprise — manquements constatés dans le code, et plan par manquement

> Complément opérationnel de [`RAPPORT-MODE-ENTREPRISE-2026-08-12.md`](./RAPPORT-MODE-ENTREPRISE-2026-08-12.md).
> Chaque point a été **revérifié dans le code le 2026-08-12** — plusieurs constats issus de notes antérieures étaient périmés (voir « Corrections » en fin de document).

## Vue d'ensemble

> **Mise à jour du 2026-08-12 (même jour)** : les trois P0 sont **livrés**. Voir la section [« Ce qui a été livré »](#ce-qui-a-été-livré-2026-08-12) en fin de document pour le détail et les décisions prises.

| # | Manquement | Gravité | Débloque |
|---|---|---|---|
| 1 | ~~Seeds de démo incomplets~~ ✅ **livré** | 🔴 P0 | #2, #3 — impossible de capturer ce que la démo ne montre pas |
| 2 | ~~Aucune page marketing du mode entreprise~~ ✅ **livré** | 🔴 P0 | Toute l'acquisition B2B |
| 3 | ~~Aucune page pricing entreprise~~ ✅ **livré** (sans montants, cf. décision) | 🔴 P0 | Conversion |
| 4 | ~~i18n incomplet~~ ✅ **livré** (~30 chaînes, pas ~10) | 🟠 P1 | Marché non francophone |
| 5 | ~~Onboarding post-création partiel~~ ✅ **livré** | 🟠 P1 | Activation / rétention |
| 6 | ~~Aucune surface publique sur la confidentialité~~ ✅ **livré** | 🟠 P1 | Vente aux orgs > 20 pers. |
| 7 | ~~Plafond de sièges : UI non préparée~~ ✅ **livré** (+ 6 autres erreurs métier) | 🟡 P2 | Activation de la facturation |
| 8 | Stripe entreprise inexistant — **laissé ouvert volontairement** | 🟡 P2 | Encaissement réel |
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
1. **Nouvelle page use-case `pour-equipes`** (ou `logiciel-gestion-equipe`) dans `src/content/use-cases.mjs` — même structure que les 3 existantes (`slug`, `metaTitle`, `description`, `lead`, `html`), donc **zéro nouvelle route à créer** : `UseCasePage.tsx` + `getUseCase()` la servent automatiquement, et `prerender.mjs` la prérend. C'est le chemin le moins coûteux et le plus cohérent avec l'existant.
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

## Ce qui a été livré — P1 (2026-08-13)

### #4 — i18n : ~30 chaînes, pas ~10

L'estimation initiale venait d'un scan qui ne regardait que le texte JSX sur une seule ligne. Un scan complet (texte JSX multiligne **et** littéraux de chaîne : `aria-label`, `title`, messages d'erreur, `placeholder`) en a trouvé **près de trois fois plus**, réparties sur 20 fichiers.

Deux catégories, et la seconde était invisible :

1. **Libellés visibles** — rôles (`Administrateur` / `Manager` / `Membre`), `Enregistrer`, `Vous`, `En cours`, `En retard`, `Aucune tâche.`, boutons de confirmation.
2. **Chaînes d'accessibilité et tooltips** — `aria-label={\`Modifier la tâche ${task.name}\`}`, `title={\`${overdue} tâche(s) en retard\`}`, messages de validation. Invisibles à l'œil, mais ce sont exactement celles que lit un lecteur d'écran : un utilisateur anglophone non-voyant recevait l'interface en français.

**Deux bugs de rendu trouvés au passage** — des phrases coupées en deux lors d'une extraction précédente, dont la moitié était restée en dur dans le JSX :

- `TransferOwnershipDialog` affichait « …pourra transférer **à nouveau. nouveau ou supprimer** l'entreprise. » — mot dupliqué, phrase cassée, visible par tout admin ouvrant le dialogue de transfert. Corrigé et vérifié au navigateur.
- `PyramidTab` assemblait sa phrase d'introduction à partir du catalogue + une queue en dur. Le rendu français était juste par chance ; toute autre langue produisait une phrase tronquée.

**Un piège de code** : dans `NewTeamProjectModal`, la variable de boucle `tasks.map((t, i) => …)` masquait le traducteur `t`. Aucune traduction n'était possible dans ce bloc — et rien n'échouait, le code compilait. Paramètre renommé en `draft`.

Toutes les phrases contenant une valeur mise en forme (nom d'entreprise en gras) passent désormais par `src/i18n/name-slot.ts` : le message reste **entier** dans le catalogue et n'est coupé qu'à l'affichage. Assembler une phrase à partir de fragments la rend intraduisible — l'ordre des mots change d'une langue à l'autre.

Résultat : `npm run i18n:check` passe à **0 erreur, 0 avertissement** (les 8 formes plurielles `_many` manquantes ont été ajoutées, conformément à la convention du projet pour le français des grands nombres).

### #5 — Onboarding

- **5ᵉ étape « Créer une première équipe »**, placée **avant** « créer un projet » : un projet rattaché après coup demande un geste de plus, et c'est le rattachement qui porte tout le cloisonnement de visibilité.
- **Bloc d'accueil pour les non-admins** (`NewcomerHints` dans `MyWorkTab`) : la checklist existante est réservée aux admins, un membre simple arrivait donc sur un écran vide. Trois portes d'entrée — projets de l'équipe, annuaire, objectifs — affichées tant qu'aucune tâche ne lui est assignée.

### #6 — Confidentialité : deux entrées FAQ plutôt qu'une page

Le document recommandait de **ne pas** écrire une page « Sécurité » par anticipation, et la section « Suivre l'équipe sans la surveiller » de `/pour-equipes` couvrait déjà le sujet côté marketing. L'apport ici est ailleurs : deux entrées ajoutées à la FAQ de la landing (FR + EN), qui alimentent aussi le **JSON-LD `FAQPage`** — donc éligibles aux résultats enrichis Google.

- « Mes collaborateurs vont-ils se sentir surveillés ? »
- « Comment les données sont-elles cloisonnées entre les équipes ? »

Ce sont les deux objections systématiques en cycle de vente B2B, et elles n'avaient jusqu'ici **aucune** surface publique.

---

## Ce qui a été livré — P2 (2026-08-13)

### #7 — Le problème était plus large que le quota

En cherchant comment traduire `seat_limit_reached`, j'ai trouvé la vraie cause : nos fonctions SQL signalent tous leurs refus par `RAISE EXCEPTION 'identifiant'`. PostgREST renvoie alors **toujours le même code** (`P0001`) et met l'identifiant dans le champ message. Comme la whitelist de `normalizeApiError` est indexée par code, **les sept erreurs métier** tombaient sur « une erreur inattendue est survenue » :

`seat_limit_reached` · `expired_link` · `invalid_link` · `own_link` · `not_org_admin` · `not_authenticated` · `forbidden`

Les deux plus coûteuses n'ont rien à voir avec la facturation : **`expired_link` et `invalid_link` sont sur le flux de lien d'invitation**, c'est-à-dire la porte d'entrée principale de l'onboarding. Quelqu'un qui cliquait sur un lien périmé recevait un message générique, sans savoir qu'il lui suffisait d'en redemander un.

`normalizeApiError` promeut désormais l'identifiant en code **quand il est whitelisté**. Le texte serveur ne sert **que de clé de recherche**, jamais d'affichage : la garantie V7/N1 (ne jamais rendre `error.message`) tient, et un test le prouve avec une vraie phrase Postgres (`duplicate key value violates unique constraint "org_members_pkey"`) qui ne doit ni être promue ni fuir à l'écran. 7 clés ajoutées dans `errors.json` FR + EN, 6 tests.

**La garde UI.** Le gate serveur `org_seats_allowed` (mig. 067) est réel mais dort tant que `billing_flags.enterprise_seat_limit` n'est pas activé. Le jour où il passe à `true`, un clic sur « générer un lien » partait vers un `seat_limit_reached` — et pour un lien, **l'échec ne tombe pas chez l'admin mais chez l'invité**, qui n'a aucun moyen de comprendre ni d'y remédier. Les deux portes d'entrée (code permanent et lien) annoncent maintenant le quota et désactivent le CTA.

Vérifié au navigateur **dans les deux états**, en basculant temporairement le drapeau : quota atteint → messages affichés et bouton désactivé ; drapeau remis à `false` → aucun avertissement, bouton actif, bannière informative. `premium-config.ts` est inchangé (vérifié identique à `HEAD` avant commit).

### #8 — Laissé ouvert, volontairement

Trois dépendances que je ne peux pas satisfaire : les price IDs à créer dans le compte Stripe, les secrets Supabase/Vercel, et la migration à appliquer. À quoi s'ajoute le prérequis déjà identifié — **le Stripe personnel lui-même n'est pas finalisé** (`PREMIUM_ENFORCED = false`, cf. `docs/POST-AUDIT-GUIDE.md` option C).

Tout construire maintenant produirait du code non testable de bout en bout, sur une fonctionnalité qui n'a rien à encaisser tant que l'acquisition n'a pas commencé. Décision prise avec Axel le 2026-08-13 : **on s'arrête là**. Le plan de la section #8 reste valable tel quel le jour où la traction le justifie.

---

### Défauts pré-existants découverts en vérifiant

Aucun des deux n'est causé par ce lot ; les deux sont signalés séparément.

- **Historique de tâche : valeurs brutes à l'écran.** Statuts en anglais technique, UUID d'assignés et de projets. Le journal en base est correct, c'est le rendu qui ne résout rien.
- **Pages use-case cassées hors français.** `UseCasePage` compare le pathname au slug FR ; sous `/en/`, `getUseCase` renvoie `undefined` et la page redirige silencieusement vers l'accueil. Vaut pour les quatre pages, pas seulement la nouvelle.

---

*Rédigé le 2026-08-12 · tous les constats revérifiés dans le code à cette date · les chemins et numéros de ligne sont indicatifs et peuvent bouger.*
