# Secrets : rotation, registre, coffre

> **Quand lire** : avant de poser, faire tourner ou retirer un secret, de toucher `.github/secrets-registry.json` ou `.github/coffre-verifications.json`, ou de vérifier le coffre. **Fait foi** : `check:secrets-age` et `check:coffre`.
> Règles générales : [`SECURITY.md`](./SECURITY.md). Récits : [`archive/SECURITY-journal-2026-11-13.md`](./archive/SECURITY-journal-2026-11-13.md).

## Rotation des secrets

`.github/secrets-registry.json` est le registre UNIQUE : nom, store, `readers`, `maxAgeDays`, `lastRotated`, `leak`, `rotation` (id d'une procédure du bloc `procedures`). `coffre: true` = ne se régénère pas (`BACKUP_PASSPHRASE`).

- ❌ Jamais une valeur ni un indice de valeur dans le registre : la garde refuse chaîne de connexion, PEM, préfixe connu, suite opaque (`check-secrets-age.guard.test.mjs`).
- `npm run check:secrets-age` (workflow `Secrets age`, hebdomadaire, `ci-alert.yml`) échoue sur : secret échu, date inconnue (= échu), secret vivant sans entrée, entrée sans secret, entrée incomplète, jeton de lecture absent.
- Rouge : faire tourner (lire `rotation` de l'entrée), puis dater `lastRotated` pour les stores que l'API ne date pas.
- ❌ Jamais dater sans avoir tourné ; ❌ jamais relever `maxAgeDays` pour faire taire la garde.
- Un secret que rien ne lit : procédure `variable-orpheline` ou `secret-sans-lecteur` (le retirer, ou écrire pourquoi il reste).
- Les écritures (`gh secret set`, `supabase secrets set`, console Vercel) restent humaines : la CI ne porte que des jetons de lecture.
- ❌ Jamais côté client : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, toute clé d'API serveur.

Secret compromis, dans l'ordre :

1. Rotation : Supabase `Project Settings → API` ; Stripe `Developers → API keys → Roll` ; secret de webhook Stripe : recréer l'endpoint (`api_version` explicite, [`STRIPE-LIVE.md`](./STRIPE-LIVE.md)).
2. Sessions : `auth.admin.signOut()` depuis une Edge Function, ou `delete from auth.refresh_tokens` ciblé.
3. Reposer : variables Vercel, `.env` local, `supabase secrets set`, `gh secret set`, Vault si `CRON_SECRET`.
4. Redéployer Vercel et les Edge Functions. Vérifier : `npm run check:edge`, `npm run check:secrets-age`.
5. Lire les journaux Supabase d'avant la rotation.

## Coffre et accès d'urgence

Éléments exigés par `check:coffre` (`scripts/check-coffre.mjs`) :

| Élément | Contenu |
|---|---|
| `BACKUP_PASSPHRASE` | phrase des sauvegardes et étiquette de chaque phrase encore utile à un dump |
| `mfa-github`, `mfa-supabase`, `mfa-vercel`, `mfa-stripe`, `mfa-hebergeur-courrier` | codes de récupération du second facteur de chaque compte |
| `admin-aal2` | second authentificateur TOTP de `/admin`, ou sa graine |
| `admin-aal2-sortie` | qui ouvre le SQL editor et la fiche de suppression du facteur ([`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2quinquies) |
| `acces-urgence` | qui, comment, quel délai |

- ❌ Jamais au coffre : jeton d'API, clé Stripe ou Supabase (ils tournent), mot de passe partagé (un compte par personne).
- ❌ Jamais dans le dépôt, un message, un courriel, une capture : le dépôt est PUBLIC.
- ✅ Gestionnaire de mots de passe avec accès d'urgence à délai, hors du poste, second facteur dont le code de récupération est sur papier ailleurs.
- ✅ Personne de confiance nommée dans la fiche `acces-urgence`, **jamais** dans le dépôt ; elle sait que le coffre existe et quoi lire en premier, jamais son contenu avant ouverture.
- Délai d'urgence : assez long pour refuser une demande abusive (sept jours pour commencer), arbitré par le propriétaire.
- Le coffre est le filet ; la voie normale est un second administrateur ([`CONTINUITE.md`](./CONTINUITE.md)).

Mise en place, une fois :

1. Créer la collection « continuité », partagée en accès d'urgence avec délai.
2. Par service : régénérer les codes de récupération, les ranger, puis détruire l'ancien jeu.
3. `BACKUP_PASSPHRASE` jamais rangée : procédure `phrase-sauvegardes` du registre (nouvelle phrase au coffre d'abord).
4. Enrôler le second authentificateur et **parcourir** la sortie de secours à froid (leçon de la mig. `131`).
5. Rédiger `acces-urgence`, la faire lire à la personne de confiance.
6. Consigner dans `.github/coffre-verifications.json`.

Vérification trimestrielle (borne 92 jours), depuis un autre appareil :

1. Ouvrir le coffre par l'accès normal : chaque élément présent et daté.
2. Codes de récupération lisibles ; moins de deux restants : régénérer, ranger, détruire l'ancien.
3. Déchiffrer le dernier dump `db-backup` avec la phrase **du coffre** (`gpg --batch --passphrase-file <fichier> -d`) : fichier non vide, puis effacer le clair.
4. Joindre la personne de confiance.
5. Ajouter une ligne à `verifications` (date, prénom, éléments), pousser. Noms et dates seulement.

- `check:coffre` (quotidien, `gardes-calendrier.yml`, issue `calendrier-red`) rougit au-delà de 92 jours, sur un élément oublié, ou sans aucune vérification passé `premiereEcheance`.
- ❌ Jamais dater une vérification qui n'a pas eu lieu ; ❌ jamais relever la période.
