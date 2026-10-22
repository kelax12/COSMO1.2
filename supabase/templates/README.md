# Templates d'emails Auth — COSMO

Les quatre emails que **Supabase Auth** envoie aux utilisateurs. Ils remplacent les gabarits
anglais par défaut, qui portent le nom de Supabase et pas celui du produit.

| Fichier | Template Supabase | Déclenché par |
|---|---|---|
| `confirmation.html` | *Confirm signup* | `supabase.auth.signUp` — **inactif tant que les confirmations sont désactivées** |
| `recovery.html` | *Reset password* | `resetPasswordForEmail`, page `/mot-de-passe-oublie` |
| `email_change.html` | *Change email address* | `updateUser({ email })`, onglet Profil des Paramètres |
| `magic_link.html` | *Magic Link* | `signInWithOtp` — utilisé par le **CLI agent** (`npm run cosmo:login`), qui saisit le code à 8 chiffres |

Non couverts, parce qu'aucun code ne les déclenche : *Invite user* et *Reauthentication*.

## 🔴 Ces fichiers ne se déploient pas tout seuls

Ce dépôt n'utilise pas `supabase db push` ni `supabase config push` : le layout des migrations
(`supabase/migration/NNN_*.sql`) n'est pas celui que la CLI reconnaît, et `config.toml` ne
gouverne que la stack **locale**. Ces gabarits se collent donc **à la main** dans
Dashboard → Authentication → Emails, un onglet par fichier.

**Conséquence à ne pas oublier** : modifier un fichier ici ne change rien en production. La
procédure complète, l'ordre des opérations et la vérification sont dans
[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) § « Emails d'authentification ».

## Contraintes de rédaction

- **HTML compatible client mail** : tableaux, styles *inline*, aucune feuille de style, aucune
  ressource externe. Pas d'image : elle serait bloquée par défaut chez la plupart des
  destinataires, et un email dont le sens dépend d'une image bloquée ne veut plus rien dire.
- **Le lien est doublé en texte brut** sous le bouton. Certains clients réécrivent ou neutralisent
  les boutons ; un lien copiable est la seule sortie de secours.
- **Aucune couleur de thème COSMO** (`rgb(var(--color-…))`) : ces variables n'existent pas dans un
  email. Les valeurs sont écrites en dur, et volontairement en mode clair — un email lu en mode
  sombre reste lisible, l'inverse n'est pas vrai.
- **Français uniquement.** Supabase ne sert qu'un jeu de gabarits, il n'y a pas de sélection par
  locale. Le français est le catalogue de référence du produit, c'est le même arbitrage.
- Toujours dire **ce qui se passe si on ignore l'email**. C'est la phrase qui distingue un email
  légitime d'un email de phishing aux yeux du destinataire.
