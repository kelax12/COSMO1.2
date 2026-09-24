<!-- note-audit: couvert-par=LEGAL.md -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Couvert par [`LEGAL.md`](./LEGAL.md) — qui n'est lui-même pas noté, cf. sa déclaration.

# Journal des documents contractuels

> **Vivant.** Une entrée par modification de `src/locales/{fr,en}/legal*.json`.
> Gardé par `npm run check:legal-journal` (C-107).
> Obligations et tableau de conformité : [`LEGAL.md`](./LEGAL.md).

---

## 🔴 Pourquoi ce fichier existe

Les CGU, la politique de confidentialité et les mentions légales vivent dans
`src/locales/{fr,en}/legal*.json` (un fichier par document depuis le 2026-09-24). Pour la chaîne
d'intégration, ce sont des catalogues i18n comme les autres : `i18n:check` vérifie la parité des clés, `i18n:identical` les valeurs non traduites.
**Aucune des deux ne sait qu'une de ces clés porte un engagement contractuel.**

Or une modification de fond y déclenche le **préavis de 30 jours** de l'article 11 des CGU
(Conso. art. L212-1 et suivants pour l'encadrement des clauses). Ce préavis ne se déclenche pas
tout seul, et rien ne reliait le commit au geste.

Ce journal est ce lien. Il ne remplace pas l'envoi du préavis, qui reste un geste
([`a-faire-manuel.md`](../a-faire-manuel.md)) et laisse sa trace dans `renewal_notices` — une
table qui est une **preuve**, et qu'on ne purge jamais.

---

## Comment écrire une entrée

1. Modifier le document dans `src/locales/{fr,en}/legalTerms.json`, `legalPrivacy.json` ou
   `legalNotice.json`.
2. Relever la nouvelle empreinte : `npm run check:legal-journal` la nomme dans son message.
3. Écrire l'entrée ci-dessous : la **date**, ce qui a changé, **FOND ou FORME**, et si le
   **préavis est dû**.
4. `npm run check:legal-journal -- --update` vérifie que l'entrée est bien là.

❌ **Ne jamais recopier une empreinte sans avoir écrit ce qui a changé.** L'empreinte n'est qu'une
clé de recherche ; c'est la phrase à côté qui vaut quelque chose en cas de litige.

⚠️ **La garde ne distingue pas le fond de la forme, et c'est voulu.** Corriger une faute de frappe
la fait rougir comme changer une clause. Ce tri est exactement le jugement qu'on veut voir écrit
par un humain, pas deviné par une expression régulière. Une entrée « typographie, pas de préavis »
coûte trente secondes et vaut une trace.

⚠️ **L'empreinte est calculée sur le JSON re-sérialisé, clés triées.** Un reformatage
(indentation, ordre des clés, CRLF/LF) ne la change donc pas : la garde rougit sur le CONTENU,
jamais sur la mise en forme.

⚠️ **Une empreinte par LOCALE, pas par fichier.** Elle porte sur la réunion de tous les
`legal*.json` de la locale. Découper ou regrouper les fichiers sans toucher au texte ne la change
pas : c'est ce qui garde les entrées d'avant le 2026-09-24 comparables à celles d'après.

---

## Entrées

### 2026-09-20 · pose du journal · **aucun changement de contenu**

| Catalogue | Empreinte |
|---|---|
| `src/locales/fr/legal.json` | `2b72b680072ffe35` |
| `src/locales/en/legal.json` | `01d51a2cb852f86d` |

**Ce qui a changé : RIEN.** Cette entrée fige l'état existant au jour où la garde est posée
(C-107). Aucune clause n'a été touchée, aucun préavis n'est dû.

⚠️ **Ce que cette première entrée ne dit pas, et qu'il ne faut pas lui faire dire :** elle ne
certifie pas que le contenu actuel des CGU est conforme. Elle dit seulement qu'à partir
d'aujourd'hui, toute modification devra s'écrire ici. La conformité du contenu, elle, est la
ligne `A2` du tableau de [`LEGAL.md`](./LEGAL.md) — et elle se vérifie à la main.

🔴 **Les empreintes ci-dessus ne sont pas à recopier d'un tableau.** Elles viennent de
`node scripts/check-legal-journal.mjs`, exécuté le 2026-09-20. C'est la règle du dépôt : un
« avant » se reconstruit à sa source, jamais depuis un tableau plus ancien.

### 2026-09-24 · passe de conformité · **FOND** · préavis **dû pour trois clauses**

| Catalogue | Empreinte |
|---|---|
| `src/locales/fr/legal.json` | `40a849b623af87e4` |
| `src/locales/en/legal.json` | `477a96cee124c558` |

Empreintes relevées par `node scripts/check-legal-journal.mjs` le 2026-09-24, pas recopiées.
Analyse qui l'a motivée : [`LEGAL.md`](./LEGAL.md) § « Audit du 2026-09-24 ».

**CGU**

| Clause | Ce qui a changé | Sens pour l'utilisateur |
|---|---|---|
| 2 | « mode Premium » (inexistant) remplacé par l'espace entreprise, gratuit à ce jour | forme, exactitude |
| 3.2 | suspension « sans préavis ni indemnité » remplacée par : manquement grave, information préalable avec motif, contestation, récupération des données. Supprime la contradiction avec 10.2 | **plus favorable** |
| 3.3 | **nouvelle** : âge minimum 15 ans, accord parental en dessous | 🔴 **nouvelle condition, préavis dû** |
| 4 bis | **nouvelle** : signalement de contenu illicite et point de contact DSA (art. 11, 12, 16, 17) | nouveau droit |
| 5 bis.2 | renonciation à la rétractation réécrite selon L221-25 / L221-28 (prorata, perte du droit à exécution complète) | plus exact, plus favorable |
| 5 bis.4 | **nouvelle** : modèle de formulaire de rétractation (L221-5) | nouveau droit |
| 6.3 | **nouvelle** : clause de sous-traitance RGPD art. 28 pour l'espace entreprise | 🔴 **nouvelle répartition des rôles, préavis dû** aux organisations |
| 6.4 | **nouvelle** : export sans frais pour changer de service | nouveau droit |
| 8 | « décline toute responsabilité » retiré | **plus favorable** |
| 9 | plafond de responsabilité réservé aux **professionnels** (dommages directs + 12 mois), consommateurs hors de toute limitation au-delà de la loi (R212-1 6°) | plus favorable aux consommateurs, 🔴 **plus restrictif pour un professionnel (dommages directs), préavis dû** |
| 11 | « en vigueur dès publication » contradictoire remplacé par : préavis de 30 jours pour une modification substantielle, droit de partir sans frais | **plus favorable** |

**Politique de confidentialité** : Premium et tokens retirés ; données de l'espace entreprise et
signalements de bug ajoutés ; Resend et Cloudflare Turnstile ajoutés aux destinataires et aux
transferts ; directives post mortem (loi I&L art. 85) ; âge de 15 ans pour la mesure d'audience ;
conservation du choix six mois et retrait par « Gérer les cookies ». Information, **pas de
préavis** (art. 13 et 14 RGPD : l'information doit être exacte tout de suite).

**Mentions légales** : localisation AWS Irlande de la base ; lien vers les notices des licences
open source (s3, ligne F9 de `LEGAL.md`) ; juridiction du consommateur
préservée (s5, qui contredisait l'art. 12 des CGU). Forme.

🔴 **Préavis à envoyer par Axel** (CGU art. 11, `a-faire-manuel.md`) : un e-mail aux comptes
existants qui annonce les clauses 3.3, 6.3 et 9. Ces trois clauses ne sont opposables aux comptes
existants que 30 jours après cet envoi. Les autres changements sont plus favorables ou informatifs
et valent dès publication.

⚠️ **Rédigé par un assistant, pas par un juriste.** La clause 6.3 en particulier tient lieu de
contrat art. 28 : elle couvre les huit éléments de l'art. 28.3, mais un acheteur B2B peut exiger
un DPA séparé et signé.

### 2026-09-24 · découpage en un fichier par document · **FORME** · **aucun préavis**

| Documents réunis | Empreinte |
|---|---|
| `src/locales/fr/legal*.json` | `40a849b623af87e4` |
| `src/locales/en/legal*.json` | `477a96cee124c558` |

**Ce qui a changé : l'emplacement, pas le texte.** `legal.json` est découpé en quatre fichiers par
locale : `legalTerms.json` (CGU), `legalPrivacy.json` (politique de confidentialité),
`legalNotice.json` (mentions légales) et `legalShared.json` (« Retour », « Dernière mise à
jour »). Aucune clause n'a été modifiée, ajoutée ni retirée, et les chemins de clés sont restés
identiques (`terms.s3.p3`, `notice.s1.li1`...). **Aucun préavis n'est dû.**

**La preuve que rien n'a bougé :** les empreintes ci-dessus sont celles de l'entrée précédente,
au caractère près. `node scripts/check-legal-journal.mjs` empreinte désormais la réunion des
fichiers d'une locale, clés triées ; si une seule chaîne avait changé pendant le découpage,
l'empreinte aurait changé avec elle.

**Pourquoi :** la passe de conformité du même jour a fait passer le chunk `legal` à 18,5 ko gzip
pour un plafond de 15,5 ko (`npm run check:bundle`). Chaque page contractuelle téléchargeait les
trois documents pour en afficher un ; elle ne télécharge plus que le sien. Le plafond n'a pas été
relevé (`scripts/check-bundle-budget.mjs`).
