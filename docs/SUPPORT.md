# Support — qui répond, sous quel délai, et avec quoi

**Créé le 2026-08-28** (T-31 de [`ROADMAP-60J.md`](./archive/ROADMAP-60J-2026-08-28-au-10-26.md)). Document **vivant**.

> **Pourquoi maintenant, alors qu'il n'y a presque personne.** Un canal de support sans procédure
> devient un canal ignoré : le premier message arrive un soir, on se dit qu'on répondra demain, et
> la règle implicite devient « quand j'y pense ». À 28 comptes ça ne coûte rien ; au premier
> utilisateur payant, ça coûte le client. Cette page existe pour que la règle soit écrite avant
> d'être testée, pas après.

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> Ce document affirme des choses que rien ne pèse : chaque ligne nomme une affirmation qui n'était vérifiée
> par rien, et la garde qui la vérifie depuis. 🔴 **Une garde posée n'est pas un angle mort fermé** : la
> dernière colonne dit ce que son vert ne prouve pas. L'énoncé du 2026-09-16, la colonne « État » du
> 2026-09-21 et les mesures datées sont archivés sans une coupe :
> [`archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md`](./archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce qu'elle ne prouve pas |
|---|---|---|---|
| AM-1 | **Aucune mesure du support lui-même** (volume, délai de première réponse, taux de résolution) | mig. `150` : `support_reports` + `record_support_report` + `get_support_stats`, appliquée le 2026-09-21 (`C-110`) ; encart « Support » de `/admin` à **trois états distincts** (`null` ≠ `0` ≠ n) | 🔴 **Que le compteur compte** : tant que `report-bug` n'appelle pas `record_support_report` (`M-61`), la table reste vide et « zéro » se lit « aucun rapport », le plus trompeur des trois états. `first_response_at` et `resolved_at` restent **NULL** : ils se posent à la main |
| AM-2 | **Rien ne vérifiait que l'adresse de contact publiée reçoit vraiment** (`check:mail` ne mesurait que l'envoi) | `check:mail` mesure aussi la **réception** (`scripts/check-mail-reception.mjs`, `M-53`) : adresses publiées relues dans `src/locales`, `src/pages`, `src/components`, `contact.mjs`, `index.html` (JSON-LD) et `prerender/` ; pour chaque domaine, MX valides (un MX nul RFC 7505 compte comme absent) ; pour chaque adresse, dialogue jusqu'à `RCPT TO` et `QUIT`, **jamais `DATA`**. Témoin `check-mail-reception.guard.test.mjs` (18 cas, 3 sabotages rejoués par `check:sabotages`) | (1) Le `RCPT TO` n'a jamais été joué en vrai : le port 25 sortant est bloqué dans l'environnement de l'agent (rapport « NON MESURÉ », jamais « refusé ») ; à lancer depuis une connexion qui le laisse sortir (geste d'Axel). (2) Même un `250` ne dit ni que la boîte n'est pas pleine, ni que le courrier évite le spam, ni **qu'un humain lise la boîte** : seul un envoi daté vers `contact@thecosmo.app` et sa réponse le prouvent |
| AM-3 | **Ce que deviennent les rapports de `report-bug` n'est mesuré par rien** (la fonction est en ligne, aucun compteur ne dit si un rapport a été lu) | encart « Support » de `/admin` (`C-110`) | Idem AM-1 |

---

## 1. Par où arrivent les demandes

| Canal | Comment | État |
|---|---|---|
| **Formulaire « Signaler un bug »** | Icône insecte dans la navigation → Edge Function `report-bug` → email vers `contact@thecosmo.app`. Le contexte technique (page, navigateur, version) est joint automatiquement | ✅ **En service.** 🔴 **Cette case disait « la fonction n'est pas déployée » — c'était faux depuis le 2026-09-12**, corrigé le 09-21 : `report-bug` est en ligne en **v11** (2026-09-12, 23:08 UTC), avec son plafond de débit prouvé sur la fonction en ligne (le 11ᵉ appel rend `429`, `C-31`). Le repli `mailto:` reste le filet, il n'est plus le chemin normal. ⚠️ **Mais elle doit être REDÉPLOYÉE** : sa source a changé le 09-21 (compteur de `C-110`), donc `check:edge` signale une dérive **légitime** — `M-61` |
| **Email direct** | `contact@thecosmo.app`, boîte IONOS | ✅ En service |
| **Adresse de l'éditeur** | `axellongattepro@gmail.com`, publiée dans les mentions légales et la politique de confidentialité | ✅ En service |
| Réseaux sociaux | Aucun compte produit à ce jour | ⬜ |

> ⚠️ **Il n'existe aucun canal in-app pour une question** — seulement pour un bug. Quelqu'un qui ne
> comprend pas les OKR n'a pas de bouton : il doit trouver l'adresse email. C'est un manque connu
> et assumé au stade actuel ; il devient coûteux le jour où l'acquisition démarre.

## 2. Qui répond

**Axel, seul.** Il n'y a pas de second niveau, pas d'astreinte, pas de rotation. C'est écrit ici
parce que c'est un fait à assumer, pas une lacune à cacher : `RGPD-VIOLATION.md` le recense déjà
comme un manque pour la procédure des 72 heures.

## 3. Délais qu'on se donne

Ce ne sont pas des engagements contractuels — aucune CGU ne promet de délai de support — mais des
règles internes. Les tenir vaut mieux que les afficher.

| Nature | Première réponse | Résolution visée |
|---|---|---|
| **L'utilisateur ne peut pas accéder à son compte** (connexion, mot de passe, email non reçu) | **le jour même** | 48 h |
| **Perte ou corruption de données** | **le jour même**, et on ouvre l'incident avant de répondre | selon le diagnostic |
| Bug bloquant un usage (une page ne charge pas, une action échoue) | 2 jours ouvrés | selon le diagnostic |
| Bug cosmétique, gêne | 5 jours ouvrés | pas d'engagement |
| Question d'usage, demande de fonctionnalité | 5 jours ouvrés | — |
| **Demande RGPD** (accès, effacement, portabilité) | **accusé de réception sous 72 h** | **un mois**, prolongeable de deux — cf. [`RGPD.md`](./RGPD.md) |
| Demande de résiliation | le jour même | immédiat |

> 🔴 **La ligne RGPD n'est pas une convenance.** Le délai d'un mois est celui de l'article 12 du
> RGPD, et il est annoncé dans la politique de confidentialité. Le dépasser est un manquement, pas
> un retard.

## 4. Ce qu'il faut avoir sous la main avant de répondre

Trois vérifications qui évitent de répondre à côté, dans cet ordre :

1. **L'incident est-il général ou individuel ?** Un coup d'œil à `/admin` et au canal
   d'alerte (`OPS_ALERT_WEBHOOK_URL`) : si plusieurs signalements arrivent en même temps, ce n'est
   pas un problème d'utilisateur, c'est un incident — passer au §6.
2. **Le compte est-il en mode démo ?** Beaucoup de « j'ai perdu mes données » sont en réalité une
   session de démonstration, dont les données vivent dans le navigateur et disparaissent au
   nettoyage. Ce n'est pas une panne, et le dire clairement évite d'inquiéter.
3. **Quelle version l'utilisateur exécute-t-il ?** Un onglet resté ouvert exécute un ancien
   bundle. Le rapport de bug joint la version ; si elle diffère de `/version.json`, la première
   réponse est « rechargez la page », et elle suffit souvent.

## 5. Comment on répond

- **En français**, comme le produit.
- **Dire ce qu'on sait, et ce qu'on ne sait pas.** Ne jamais promettre une correction sans date
  qu'on tienne. « Je ne sais pas encore, je regarde et je reviens vendredi » est une bonne réponse.
- **Ne jamais demander de mot de passe**, ni en proposer un. Aucun support légitime ne le fait, et
  un utilisateur qui s'y habitue devient une cible.
- **Ne jamais coller de journal brut** contenant une adresse email ou un identifiant de compte : la
  minimisation vaut aussi dans un email de réponse.
- Si la demande révèle un bug, **créer la tâche avant de répondre** — sinon la réponse promet
  quelque chose que rien ne suit.

## 6. Quand ce n'est plus du support mais un incident

Bascule dès qu'**au moins deux** signalements portent sur le même symptôme, ou qu'une donnée est
perdue. La marche à suivre n'est pas ici :

- **Panne, régression, rollback** → [`DEPLOYMENT.md`](./DEPLOYMENT.md) §4 « Réponse incident ».
- **Donnée personnelle exposée, perdue ou altérée** → `RGPD-VIOLATION.md` (hors dépôt),
  et le chronomètre des **72 heures** part au moment où on en prend connaissance.
- **Échec de paiement ou de facturation** → le journal `payment_records` fait foi, et il est
  inaltérable : une erreur se corrige par une ligne compensatoire, jamais par une modification.

## 7. Ce qu'on mesure

Deux chiffres suffisent à ce stade, à relever au même moment que les autres :

- **Nombre de demandes reçues** dans le mois, et combien portaient sur le même sujet. Deux
  demandes identiques valent un correctif produit ou une phrase d'aide, pas deux réponses.
- **Délai médian de première réponse.** S'il dépasse les valeurs du §3 deux mois de suite, ce
  n'est pas la procédure qu'il faut réécrire, c'est le temps qu'il faut y consacrer.

> Ces chiffres ne sont **pas** instrumentés : il n'existe aucun outil de ticketing, et en installer
> un aujourd'hui serait du sur-engineering — cf. `archive/ROADMAP-60J-2026-08-28-au-10-26.md` §4. Un décompte à la main dans la
> boîte mail suffit tant que le volume tient sur une main.

## 8. Ce qu'il faudra ajouter, et quand

| Quand | Quoi |
|---|---|
| ~~**Avant d'ouvrir l'acquisition**~~ ✅ | ~~Déployer `report-bug` (T-12)~~ — **fait le 2026-09-12** (v11). ⚠️ Ce qui reste : **la redéployer** pour que le compteur de la mig. `150` reçoive quelque chose (`M-61`), et **vérifier que `contact@thecosmo.app` REÇOIT** (`M-53`) — un canal qui part sans arriver est pire qu'un canal absent |
| À ~100 utilisateurs | Une FAQ ou une page d'aide, alimentée par les questions réellement posées. **Pas avant** : écrire une FAQ sans demandes réelles, c'est deviner |
| Aux premiers clients payants | Une adresse de facturation distincte, et un délai annoncé dans les CGV |
| À ~1 000 utilisateurs | Un outil de suivi. Le signal n'est pas le nombre d'utilisateurs mais le moment où une demande se perd |
