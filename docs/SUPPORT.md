# Support — qui répond, sous quel délai, et avec quoi

**Créé le 2026-08-28** (T-31 de [`ROADMAP-60J.md`](./ROADMAP-60J.md)). Document **vivant**.

> **Pourquoi maintenant, alors qu'il n'y a presque personne.** Un canal de support sans procédure
> devient un canal ignoré : le premier message arrive un soir, on se dit qu'on répondra demain, et
> la règle implicite devient « quand j'y pense ». À 28 comptes ça ne coûte rien ; au premier
> utilisateur payant, ça coûte le client. Cette page existe pour que la règle soit écrite avant
> d'être testée, pas après.

---

## 1. Par où arrivent les demandes

| Canal | Comment | État |
|---|---|---|
| **Formulaire « Signaler un bug »** | Icône insecte dans la navigation → Edge Function `report-bug` → email vers `contact@thecosmo.app`. Le contexte technique (page, navigateur, version) est joint automatiquement | 🔴 **La fonction n'est pas déployée** (T-12). Le formulaire bascule sur un `mailto:` pré-rempli : rien n'est perdu, mais l'utilisateur voit d'abord une erreur |
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
- **Donnée personnelle exposée, perdue ou altérée** → [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md),
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
> un aujourd'hui serait du sur-engineering — cf. `ROADMAP-60J.md` §4. Un décompte à la main dans la
> boîte mail suffit tant que le volume tient sur une main.

## 8. Ce qu'il faudra ajouter, et quand

| Quand | Quoi |
|---|---|
| **Avant d'ouvrir l'acquisition** | Déployer `report-bug` (T-12) — c'est le seul canal *dans* le produit |
| À ~100 utilisateurs | Une FAQ ou une page d'aide, alimentée par les questions réellement posées. **Pas avant** : écrire une FAQ sans demandes réelles, c'est deviner |
| Aux premiers clients payants | Une adresse de facturation distincte, et un délai annoncé dans les CGV |
| À ~1 000 utilisateurs | Un outil de suivi. Le signal n'est pas le nombre d'utilisateurs mais le moment où une demande se perd |
