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

> **Vivant.** Une entrée par modification de `src/locales/{fr,en}/legal.json`.
> Gardé par `npm run check:legal-journal` (C-107).
> Obligations et tableau de conformité : [`LEGAL.md`](./LEGAL.md).

---

## 🔴 Pourquoi ce fichier existe

Les CGU, la politique de confidentialité et les mentions légales vivent dans
`src/locales/{fr,en}/legal.json`. Pour la chaîne d'intégration, c'est un catalogue i18n comme un
autre : `i18n:check` vérifie la parité des clés, `i18n:identical` les valeurs non traduites.
**Aucune des deux ne sait qu'une de ces clés porte un engagement contractuel.**

Or une modification de fond y déclenche le **préavis de 30 jours** de l'article 11 des CGU
(Conso. art. L212-1 et suivants pour l'encadrement des clauses). Ce préavis ne se déclenche pas
tout seul, et rien ne reliait le commit au geste.

Ce journal est ce lien. Il ne remplace pas l'envoi du préavis, qui reste un geste
([`a-faire-manuel.md`](../a-faire-manuel.md)) et laisse sa trace dans `renewal_notices` — une
table qui est une **preuve**, et qu'on ne purge jamais.

---

## Comment écrire une entrée

1. Modifier le catalogue du document : `legalTerms.json` (CGU), `legalPrivacy.json`
   (confidentialité) ou `legal.json` (mentions légales, libellés communs), en `fr` et en `en`.
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

### 2026-10-01 · découpage des catalogues · **aucun changement de contenu** · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `40a849b623af87e4` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `477a96cee124c558` |

**Ce qui a changé : l'emplacement, pas un mot.** Les CGU et la politique de confidentialité
quittent `legal.json` pour `legalTerms.json` et `legalPrivacy.json`, chacune chargée par sa seule
page (budget de bundle : le catalogue unique faisait 18,5 ko gzip pour un plafond de 15,5).
L'empreinte porte désormais sur la RÉUNION des trois catalogues d'une langue, et elle est
**identique** à celle du 2026-09-24 : c'est la preuve qu'aucune clause n'a bougé. Relevée par
`node scripts/check-legal-journal.mjs` le 2026-10-01, témoin `scripts/check-legal-journal.guard.test.mjs`.

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

### 2026-10-10 · identité de l'éditeur · **FOND (identification)** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `7b98a53c54266c40` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `227b1e35354d1039` |

**Ce qui a changé** (ligne `M-62` d'[`a-faire-manuel.md`](../a-faire-manuel.md), lignes `A2` et
`A3` de [`LEGAL.md`](./LEGAL.md)) :

- **Mentions légales**, s1 : « Dénomination : Cosmo » devient « Éditeur : Axel Longatte, personne
  physique », et le directeur de la publication n'est plus « L'équipe Cosmo » mais Axel Longatte
  (LCEN 6-III, loi de 1982 art. 93-2 : une personne physique).
- **Politique de confidentialité**, s1 : le responsable de traitement est Axel Longatte, et non
  plus « l'équipe Cosmo », qui n'identifiait personne (RGPD art. 13.1.a). Le registre art. 30 le
  nommait déjà.
- Dates de mise à jour des deux documents portées au 10 octobre 2026.

**Aucun préavis** : aucune clause des CGU ne bouge. C'est une information exacte due tout de suite,
pas une condition nouvelle opposée à l'utilisateur.

⚠️ **Ce qui reste ouvert sur `A3`** : SIREN, RCS, TVA et adresse attendent l'immatriculation et la
domiciliation (`M-01`, `M-02`, `M-05`), et le téléphone des hébergeurs (`M-65`).

### 2026-10-12 · adresse de contact · **FORME** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `26976cb9601f5f41` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `c28a46c4cd194d75` |

**Ce qui a changé** : l'adresse `axellongattepro@gmail.com` devient `contact@thecosmo.app`
partout où elle figure (mentions légales s1 et contact, politique de confidentialité s1 et
exercice des droits, CGU : rétractation 5 bis, modèle de formulaire, données 6, contact).
C'est l'adresse déjà publiée comme point de contact DSA (CGU 4 bis). Dates de mise à jour des
trois documents portées au 12 octobre 2026. Empreintes relevées par
`node scripts/check-legal-journal.mjs` le 2026-10-12.

**Aucun préavis** : aucune clause ne bouge, seul le canal pour joindre l'éditeur change.
⚠️ La boîte `contact@thecosmo.app` doit être relevée : une rétractation ou une demande RGPD
envoyée là fait courir les délais légaux (14 jours, un mois).

### 2026-10-13 · audit juridique avant déploiement · **FOND (information) et FORME** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `b11060a6dc7f99c9` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `64df04e46c848228` |

Empreintes relevées par `node scripts/check-legal-journal.mjs` le 2026-10-13, pas recopiées.
Analyse qui l'a motivée : audit juridique du 2026-10-13 (constats repris dans [`LEGAL.md`](./LEGAL.md) § « Audit du 2026-10-13 »).

**CGU**

| Clause | Ce qui a changé | Sens pour l'utilisateur |
|---|---|---|
| 1 (nouveau §3) | l'éditeur est **nommé** (Axel Longatte) : « Cosmo » ne désignait personne (C. conso L111-1, L221-5) | information |
| 7 | « propriété exclusive de Cosmo » devient « de son éditeur », sous réserve des licences open source | forme |
| 9.p1 | l'exonération « du fait d'un tiers » est restreinte au fait **imprévisible et insurmontable** d'un tiers **étranger** à la fourniture du service (C. conso L221-15) | **plus favorable** |
| 9 (nouveau §4) | la **garantie légale de conformité** du service numérique et ses modalités (C. conso L224-25-1 s.) | information, plus favorable |
| 12.p3 | la clause attributive de juridiction ne vaut que « dans la mesure où la loi le permet » | plus favorable |

**Politique de confidentialité** : origine des inscriptions et comptage des essais de la
démonstration décrits, désormais **sous consentement** (ils étaient posés sans) ; jours de
connexion rattachés à une finalité (statistiques internes) et à une base légale (intérêt
légitime) ; invitations par e-mail (durée : 7 jours + 30 jours) ; Sentry décrit exactement
(l'identifiant technique du compte EST joint aux rapports, ce que le texte niait ; jetons retirés
des adresses de page ; hébergement UE) ;
GitHub ajouté (sauvegardes chiffrées) ; transferts complétés (Stripe, Google, GitHub, Supabase
Inc.) ; sécurité : accès d'administration de l'éditeur dit, sauvegardes chiffrées ; durées
ajoutées : comptes inactifs **3 ans** avec avertissement 30 jours avant, signalements de bug 12
mois, sauvegardes 30 jours ; retrait du consentement par « Gérer les cookies ». Information,
**pas de préavis** (art. 13 et 14 RGPD : l'information doit être exacte tout de suite).

⚠️ **La suppression des comptes inactifs depuis 3 ans est une règle nouvelle**, mais aucun compte
ne peut l'atteindre avant 2029 (premier compte : 2026), et elle s'annonce 30 jours avant par
e-mail. La glisser dans le préavis de `M-63` reste la forme la plus propre. Le traitement qui
l'applique n'existe pas encore : `a-faire-manuel.md`.

**Mentions légales** : adresse de Vercel mise à jour (440 N Barranca Avenue, Covina, relue sur
vercel.com le 2026-10-13) ; propriété des contenus attribuée à l'éditeur et non aux données des
utilisateurs ; **suppression de la clause « ne saurait être tenu responsable des dommages directs
ou indirects »** (clause noire R212-1 6°, contraire à l'art. 9 des CGU), remplacée par un renvoi
à l'art. 9. Forme, plus favorable.

❌ **Ce qui reste ouvert sur les mentions** : adresse et téléphone de l'éditeur (LCEN art. 1-1),
téléphone des hébergeurs. Gestes d'Axel (`a-faire-manuel.md`).

### 2026-10-18 · mesure d'audience internalisée · **FOND (information)** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `d10728a3fde91ac2` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `dc7fab7e40f1de4e` |

**Ce qui a changé** (politique de confidentialité uniquement) : le fournisseur tiers de mesure
d'audience est débranché et retiré de la politique (§2 p1 à p3, base légale §5, destinataires §7,
traceurs §10). Reste Vercel Analytics, sous consentement ; les statistiques d'usage de
l'application sont calculées en interne. Le périmètre de la mesure est décrit tel qu'il est :
Vercel Analytics, une fois accepté, couvre tout le site.

**Aucun préavis** : un destinataire et un traceur en moins, information plus favorable
(art. 13 et 14 RGPD : l'information doit être exacte tout de suite).

### 2026-10-18 · mesure d'audience maison (mig. 222) · **FOND (information)** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `a44ecb55e4be7d94` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `e3d741991fd75d93` |

**Ce qui a changé** (politique de confidentialité, §2 p1) : Cosmo mesure lui-même la
fréquentation des pages publiques, sous le **même consentement** que Vercel Analytics et pour la
**même finalité** (mesure d'audience). Données ajoutées : pays et ville approximatifs, navigateur
et appareil, temps passé, défilement, clics sur les principaux boutons. L'adresse IP n'est pas
conservée (identifiant du jour, lien détruit le lendemain) ; conservation 13 mois. Registre :
`docs/RGPD-REGISTRE.md` T8.

**Aucun préavis** : rien n'est collecté sans « Accepter », et l'information est exacte dès la
mise en service. ⚠️ **Question ouverte, à trancher par Axel** : un accord donné AVANT ce jour
couvrait une mesure plus étroite (pages vues et référent). La finalité est identique, mais les
catégories de données s'élargissent ; redemander le consentement lèverait le doute.

### 2026-10-21 · immatriculation de l'éditeur, section Prospection · **FOND (identification, information)** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `831aab907b40374b` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `7b4ef7f726b92f39` |

**Ce qui a changé** (commits `e2e7679f` et `899f707f`, entrée écrite le 2026-10-22 : les deux
commits avaient été poussés sans elle, et la garde a tenu `lint-test-build` rouge entre-temps) :

- **Mentions légales**, s1 : « personne physique » devient « entrepreneur individuel (EI), nom
  commercial COSMO » ; ajout de l'immatriculation (RNE depuis le 20 octobre 2026, SIREN, SIRET, code
  APE), de la mention « TVA non applicable, article 293 B du CGI » et du **téléphone** de
  l'éditeur ; code postal de l'adresse corrigé (75116). Ferme `M-05` et `M-72` (LCEN art. 1-1).
- **CGU**, s1 p3 : même identification de l'éditeur (EI, SIREN, adresse, téléphone, 293 B).
  Aucune clause ne bouge.
- **Politique de confidentialité**, s1 : le responsable de traitement porte son statut, son SIREN
  et son adresse (RGPD art. 13.1.a). **Nouvelle section 7 ter « Prospection commerciale auprès
  des professionnels »** : données, finalité, base légale (6.1.f RGPD, L34-5 CPCE), destinataires
  (Supabase, IONOS, Anthropic), durée de trois ans, droit d'opposition et liste d'opposition.
  Registre : `docs/RGPD-REGISTRE.md` T11.
- Dates de mise à jour des trois documents portées au 21 octobre 2026.

**Aucun préavis** : aucune condition nouvelle n'est opposée à l'utilisateur. L'identification est
une information exacte due tout de suite ; la section 7 ter s'adresse à des personnes prospectées,
qui ne sont pas forcément utilisatrices, et l'article 14 RGPD exige qu'elle soit en ligne AVANT le
premier envoi.

### 2026-10-25 · médiateur de la consommation (SMP) · **FOND (information)** · **aucun préavis**

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `56f0531541fd571a` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `f2b0645e65f7b36a` |

**Ce qui a changé** (commit `bff7f874`, poussé sur `main` sans cette entrée ; écrite le même jour,
la garde tenait `lint-test-build` rouge entre-temps) :

- **CGU**, nouvel article **12 bis « Litige et médiation de la consommation »** : réclamation
  écrite d'abord (`contact@thecosmo.app`), puis, à défaut d'accord ou de réponse sous un mois,
  saisine gratuite de la Société Médiation Professionnelle par le consommateur (Conso.
  art. L612-1 et L612-2). Texte imposé par le médiateur, courrier du 2026-10-25 archivé dans
  [`LEGAL.md`](./LEGAL.md).
- **Mentions légales**, s5 p2 : coordonnées du médiateur et renvoi à l'article 12 bis.
- Dates de mise à jour des deux documents portées au 25 octobre 2026, en `fr` et en `en`.
- **Forme**, même jour : dans la version anglaise de l'article 12 bis, l'article français « La » resté
  devant la raison sociale du médiateur est retiré. Les noms propres (raison sociale, adresse, nom de
  la Commission d'évaluation et de contrôle de la médiation de la consommation) restent en français.

**Aucun préavis**, décision d'Axel du 2026-10-25 : ces ajouts informent le consommateur d'une voie
de recours que la loi lui ouvre déjà et que le professionnel doit lui indiquer (Conso. art. L616-1).
Ils ne créent aucune obligation pour le client et ne lui retirent aucun droit.
