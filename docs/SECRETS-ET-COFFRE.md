# Secrets : rotation, registre, coffre

Sorti de [`SECURITY.md`](./SECURITY.md) le 2026-11-13 (DOC-02). Règles générales de sécurité : `SECURITY.md`.
Relevé daté retiré : [`archive/SECURITY-journal-2026-11-13.md`](./archive/SECURITY-journal-2026-11-13.md).
## Rotation des secrets

### Quand (échéances)

Le registre `.github/secrets-registry.json` porte, pour chaque secret, son **propriétaire**, sa **criticité**, son **échéance** (`maxAgeDays`) et sa **dernière rotation** (`lastRotated`). **Noms seulement, jamais une valeur.** Échéances posées le 2026-10-24 :

| Criticité | Échéance | Secrets |
|---|---|---|
| `critical` | 180 j (365 j pour `BACKUP_PASSPHRASE`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`) | clés Stripe, `SUPABASE_DB_URL`, clés service |
| `high` | 90 j (jetons d'accès) à 180 j | `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `DRILL_DB_URL` |
| `medium` | 180 à 365 j | webhook ops, sel de limitation de débit, jeton d'audit |

Les identifiants et URLs (`kind: config`) ne tournent pas, mais leur existence est vérifiée.

**La garde** : `npm run check:secrets-age` (workflow `Secrets age`, chaque lundi, relié à `ci-alert.yml`). Elle lit GitHub Actions (`updated_at`), les secrets Edge (API Management, noms) et Vercel (`updatedAt`, jamais `decrypt`), puis échoue sur :

- un secret plus vieux que son échéance ;
- un secret de **date inconnue**, réputé échu ;
- un secret vivant **sans entrée** au registre, ou une entrée **sans secret** ;
- un jeton de lecture absent (exit 1, jamais un saut).

Quand elle est rouge : faire tourner le secret (procédure ci-dessous), puis, pour les stores que l'API ne date pas (Edge, `SUPABASE_SERVICE_ROLE_KEY`), écrire la date du jour dans `lastRotated`. ❌ Ne jamais écrire une date sans avoir tourné le secret, ni relever une échéance pour faire taire la garde.

**État** : rouge depuis sa pose, aucun secret connu échu ; deux gestes d'Axel restent (poser `SECRETS_AUDIT_TOKEN`, dater la
rotation de la `service_role` de la plateforme), décision jusqu'au **2026-11-21** dans `.github/gardes-rouges-decisions.json`.
### Comment (secret compromis ou échu)
Si une clé fuite (commit accidentel, compromission soupçonnée, etc.) :

1. **Rotater immédiatement** :
   - Supabase : `Dashboard → Project Settings → API → Reset anon/service_role`
   - Stripe : `Dashboard → Developers → API keys → Roll`
   - Webhook signing secret Stripe : recréer l'endpoint
2. **Invalider les sessions actives** : `auth.admin.signOut()` côté Edge Function ou requête manuelle SQL `delete from auth.refresh_tokens`
3. **Mettre à jour** : Vercel env vars + `.env` local + Edge Function secrets (`supabase secrets set ...`)
4. **Re-deploy** Vercel + redéployer les Edge Functions
5. **Audit** : vérifier les logs Supabase pour activité suspecte avant la rotation

Variables sensibles **jamais côté client** : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY` (si utilisé).

### Le registre est UNIQUE et COMPLET (V4.3, 2026-11-08)

`.github/secrets-registry.json` est le seul registre : celui que lit `check:secrets-age`, il n'y en a
pas de second. Chaque entrée porte son **nom**, son **store** (GitHub, Edge, Vercel, plateforme
Supabase, `.env.example`), **qui le lit** (`readers`), son **âge maximal** (`maxAgeDays`), l'**effet
d'une fuite** (`leak`) et sa **rotation pas à pas** (`rotation`, un id du bloc `procedures` du même
fichier : générer, poser, vérifier, révoquer l'ancien, dater). **Les noms et les procédures seulement.**
❌ Jamais une valeur, ni un indice de valeur : la garde refuse une chaîne de connexion, une clé PEM,
un préfixe de clé connu ou une longue suite opaque, dans le registre comme dans ses procédures
(témoin `check-secrets-age.guard.test.mjs`).

- Une entrée incomplète est un écart : le registre est rouge, pas seulement l'âge.
- Un secret que rien ne lit n'est admis qu'avec une procédure de retrait (`variable-orpheline`,
  `secret-sans-lecteur`, admise par la garde, sans entrée depuis que `SECURITY_ALERTS_TOKEN` a son
  lecteur, vague 6.1) : on le supprime, ou on écrit pourquoi il reste.
- `coffre: true` marque ce qui **ne se régénère pas** et que le coffre doit donc porter
  (aujourd'hui `BACKUP_PASSPHRASE`). Tout le reste se **fait tourner** : un jeton perdu se remplace,
  il ne se garde pas.
- Pour faire tourner un secret : ouvrir son entrée, lire `rotation`, suivre les étapes. Les écritures
  (`gh secret set`, `supabase secrets set`, console Vercel) restent des gestes humains : la CI ne
  porte que des jetons de lecture.

## Coffre et accès d'urgence (V4.2, SEC-04)

**Ce que le coffre répond** : « si la personne qui détient tout est injoignable, ou si un second
facteur est perdu, par où rentre-t-on ? ». Sans lui, la phrase qui déchiffre les sauvegardes et les
codes de récupération n'existent qu'à un seul endroit, et une sauvegarde sans sa phrase ne se
restaure pas.

### Ce qui doit y aller

Des **identifiants d'éléments**, vérifiés un à un par `check:coffre` (`scripts/check-coffre.mjs`) :

| Élément | Ce qu'il contient | Pourquoi ici |
|---|---|---|
| `BACKUP_PASSPHRASE` | la phrase de chiffrement des sauvegardes, et l'étiquette de chaque phrase précédente tant qu'un dump chiffré avec elle existe | un secret Actions ne se relit pas ; sans la phrase, aucune sauvegarde ne se restaure |
| `mfa-github` | codes de récupération du second facteur du compte GitHub qui administre le dépôt | sans eux, plus de secrets Actions, plus de dépôt |
| `mfa-supabase` | idem, compte Supabase | projet de production |
| `mfa-vercel` | idem, compte Vercel | déploiement et variables |
| `mfa-stripe` | idem, compte Stripe | facturation entreprise, clés |
| `mfa-hebergeur-courrier` | idem, compte de l'hébergeur de la messagerie | la boîte de contact est le chemin de récupération de tous les autres comptes |
| `admin-aal2` | le facteur TOTP de la console `/admin` (mig. `131`) : un second authentificateur enrôlé sur un autre appareil, ou la graine rangée au coffre | `is_admin()` exige `aal2` ; sans facteur, la console ne rend rien |
| `admin-aal2-sortie` | la sortie de secours : qui peut ouvrir le SQL editor du projet et jouer la suppression du facteur (`docs/MISES-EN-SERVICE.md` § 2quinquies, « Téléphone perdu »), et la fiche pas à pas | la porte de sortie doit avoir un second gardien |
| `acces-urgence` | la fiche de l'accès d'urgence : qui, comment on le déclenche, quel délai | voir ci-dessous |

❌ **Jamais au coffre, ni nulle part ailleurs** : un jeton d'API, une clé Stripe ou Supabase (ils se
font tourner, `rotation` du registre), un mot de passe de compte tiers partagé (un compte par
personne). ❌ Jamais dans le dépôt, un message, un courriel, une capture ou une photo : le dépôt est
PUBLIC et GitHub n'est pas un coffre.

### Où, et qui

- Un **gestionnaire de mots de passe** qui sait délivrer un **accès d'urgence avec délai** (la
  personne de confiance demande l'accès ; le propriétaire peut refuser pendant le délai ; passé le
  délai sans refus, l'accès s'ouvre). Hors du poste de travail, protégé par son propre second facteur,
  dont le code de récupération est **sur papier**, rangé ailleurs que l'appareil habituel.
- Une **personne de confiance** désignée, dont le nom figure dans la fiche `acces-urgence` du coffre
  et **nulle part dans le dépôt**. Elle sait que le coffre existe, ce qu'il permet et la première
  chose à lire (la fiche), jamais ce qu'il contient avant l'ouverture.
- **Délai** : assez long pour qu'une demande abusive soit vue et refusée (sept jours est un point de
  départ), assez court pour qu'une vraie urgence ne soit pas bloquée. À arbitrer par le propriétaire.
- À terme, un **second administrateur** (`docs/CONTINUITE.md`) : le coffre est le filet, pas la voie
  normale.

### Mise en place, une fois

1. Créer le coffre et la collection « continuité », partagée avec la seule personne de confiance, en
   accès d'urgence avec délai.
2. Pour chacun des cinq services : régénérer un jeu neuf de codes de récupération, le ranger au coffre,
   puis seulement détruire l'ancien jeu. Une copie papier du jeu du gestionnaire lui-même, ailleurs.
3. `BACKUP_PASSPHRASE` : si la phrase actuelle n'a jamais été rangée hors GitHub, appliquer la
   procédure `phrase-sauvegardes` du registre (nouvelle phrase d'abord au coffre, puis posée) plutôt
   que de tenter de relire un secret qui ne se relit pas.
4. `admin-aal2` et `admin-aal2-sortie` : enrôler un second authentificateur, et **parcourir** la sortie
   de secours une fois, à froid, sur un compte de test ou sur le compte du second administrateur
   (la leçon de la mig. `131` : un chemin de récupération se parcourt, il ne se raisonne pas).
5. Rédiger la fiche `acces-urgence`, la faire lire à la personne de confiance.
6. Consigner la première vérification dans `.github/coffre-verifications.json` (voir ci-dessous).

### Vérification trimestrielle

À faire **avant l'échéance de 92 jours**, depuis un autre appareil que l'habituel :

1. Ouvrir le coffre avec le seul accès normal. Chaque élément du tableau est présent et daté.
2. Pour chaque service : le jeu de codes de récupération est lisible et non barré. Ne **consommer** un
   code que pour de vrai ; en régénérer un jeu dès qu'il en reste moins de deux, ranger le neuf, puis
   détruire l'ancien.
3. `BACKUP_PASSPHRASE` : sur une machine de confiance, déchiffrer le dernier dump (artefact `db-backup`)
   avec la phrase **du coffre** (`gpg --batch --passphrase-file <fichier> -d`), vérifier qu'il sort un
   fichier non vide, puis effacer le clair. C'est la seule façon de prouver que la copie du coffre est
   la bonne : `restore-drill` prouve la phrase de GitHub, pas celle du coffre.
4. Joindre la personne de confiance : elle a toujours son accès, connaît le délai et sait où est la fiche.
5. Consigner : ajouter une ligne à `verifications` de `.github/coffre-verifications.json` (date, prénom,
   liste des éléments vérifiés), puis pousser. **Noms d'éléments et dates seulement.**

**Le rappel est automatique, pas la vérification.** `check:coffre` joue chaque jour dans
`gardes-calendrier.yml` et rougit (issue `calendrier-red`, `ci-alert.yml` ensuite) quand la dernière
vérification a plus de 92 jours, quand elle oublie un élément, ou, tant qu'aucune n'est consignée,
après la première échéance (**2026-12-08**). ❌ Ne jamais dater une vérification qui n'a pas eu lieu,
ni relever la période : la garde prouve qu'on l'a dit, pas que le coffre est plein.
