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

1. Modifier `legal.json`.
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
