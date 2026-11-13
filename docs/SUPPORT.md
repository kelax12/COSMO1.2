# Support

Lire avant de répondre à un utilisateur ou de toucher `report-bug`, `check:mail`, `support_reports`. Fait foi : `supabase/functions/report-bug/`, `scripts/check-mail-reception.mjs`.

Axel répond seul : ni second niveau, ni astreinte, ni rotation.

## Canaux

- ✅ Formulaire « Signaler un bug » (icône insecte) : Edge Function `report-bug`, email vers `contact@thecosmo.app`, contexte technique joint (page, navigateur, version). Plafond de débit : le 11ᵉ appel rend `429`. Repli : `mailto:`.
- ✅ Email direct : `contact@thecosmo.app` (boîte IONOS).
- ✅ Adresse de l'éditeur : celle publiée dans les mentions légales et la politique de confidentialité.
- ⬜ Aucun réseau social produit.
- ⚠️ Aucun canal in-app pour une question, seulement pour un bug. Manque assumé ; il coûte à l'ouverture de l'acquisition.
- ⚠️ Toute modification de `report-bug` se redéploie ; `npm run check:edge` signale sinon la dérive.

## Délais internes

Pas des engagements contractuels (aucune CGU ne promet de délai).

| Nature | Première réponse | Résolution visée |
|---|---|---|
| Accès au compte impossible (connexion, mot de passe, email non reçu) | le jour même | 48 h |
| Perte ou corruption de données | le jour même, incident ouvert avant de répondre | selon diagnostic |
| Bug bloquant un usage | 2 jours ouvrés | selon diagnostic |
| Bug cosmétique, gêne | 5 jours ouvrés | aucun |
| Question d'usage, demande de fonctionnalité | 5 jours ouvrés | aucun |
| Demande RGPD (accès, effacement, portabilité) | accusé sous 72 h | un mois, prolongeable de deux ([`RGPD.md`](./RGPD.md)) |
| Résiliation | le jour même | immédiat |

- 🔴 Le délai RGPD est celui de l'article 12 et il est annoncé dans la politique de confidentialité : le dépasser est un manquement.

## Avant de répondre, dans cet ordre

1. Incident général ou individuel ? Regarder `/admin` et le canal d'alerte (`OPS_ALERT_WEBHOOK_URL`) : au moins deux signalements du même symptôme, ou une donnée perdue, bascule en incident (§ Bascule).
2. Compte en mode démo ? Ses données vivent dans le navigateur et disparaissent au nettoyage : pas une panne.
3. Quelle version ? Un onglet resté ouvert exécute un ancien bundle. Si la version du rapport diffère de `/version.json`, répondre « rechargez la page ».

## Comment répondre

- ✅ En français, comme le produit.
- ✅ Dire ce qu'on sait et ce qu'on ne sait pas ; jamais de correction promise sans date tenue.
- ❌ Ne jamais demander ni proposer de mot de passe.
- ❌ Ne jamais coller un journal brut contenant un email ou un identifiant de compte (minimisation).
- ✅ Si la demande révèle un bug, créer la tâche avant de répondre.

## Bascule en incident

- Panne, régression, rollback : [`DEPLOYMENT.md`](./DEPLOYMENT.md) § « Réponse incident ».
- Donnée personnelle exposée, perdue ou altérée : `RGPD-VIOLATION.md` (hors dépôt) ; le chronomètre de 72 h part à la prise de connaissance.
- Paiement ou facturation : `payment_records` fait foi et est inaltérable ; une erreur se corrige par une ligne compensatoire, jamais par modification.

## Mesure

- Compter à la main, dans la boîte mail, les demandes du mois et celles portant sur le même sujet (deux demandes identiques valent un correctif ou une phrase d'aide) et le délai médian de première réponse.
- ❌ Pas d'outil de ticketing avant le signal « une demande se perd ».
- ⚠️ La table `support_reports` (`record_support_report`, `get_support_stats`, encart « Support » de `/admin`) distingue `null`, `0` et n. Tant que `report-bug` n'appelle pas `record_support_report`, elle reste vide et « zéro » se lit « aucun rapport ». `first_response_at` et `resolved_at` se posent à la main.

## Ce que `check:mail` ne prouve pas

- ✅ `npm run check:mail` mesure l'envoi et la réception : MX valides (un MX nul RFC 7505 compte comme absent) et dialogue SMTP jusqu'à `RCPT TO`, jamais `DATA`. Témoin : `scripts/check-mail-reception.guard.test.mjs`.
- ⚠️ Le port 25 sortant est bloqué dans l'environnement de l'agent : le rapport dit « NON MESURÉ », jamais « refusé ». À lancer depuis une connexion qui le laisse sortir (geste d'Axel).
- ⚠️ Un `250` ne dit ni que la boîte n'est pas pleine, ni que le courrier évite le spam, ni qu'un humain lit la boîte : seul un envoi vers `contact@thecosmo.app` et sa réponse le prouvent.

## Ajouts prévus

- À environ 100 utilisateurs : FAQ ou page d'aide alimentée des questions réellement posées, pas avant.
- Aux premiers clients payants : adresse de facturation distincte et délai annoncé dans les CGV.
- Quand une demande se perd (environ 1 000 utilisateurs) : outil de suivi.
