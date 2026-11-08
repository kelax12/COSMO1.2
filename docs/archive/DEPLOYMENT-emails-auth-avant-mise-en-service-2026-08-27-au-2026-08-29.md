> ⚠️ **ARCHIVE : constat des emails d'authentification avant la mise en service, extrait de `docs/DEPLOYMENT.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

### Ce qui était vrai les 27-29 août au matin · *état conservé à sa date, cf. l'encadré ci-dessus*

> **Re-mesuré le 2026-08-29** : rien n'a changé. Même `28 / 1 / 3` en base, même DKIM absent.
> Le sous-domaine d'envoi `send.thecosmo.app` **n'existe pas encore du tout** : ni `MX`, ni `SPF`,
> ni `DKIM`, donc les trois `FAIL` de `npm run check:mail` sont **le même fait**, pas trois
> problèmes. La dernière inscription en prod date du 2026-08-21 : le compteur n'a pas bougé parce
> que personne ne s'est inscrit, pas parce que quelque chose a été réparé.

| Fait | Mesure du 2026-08-27, inchangée au 2026-08-29 |
|---|---|
| **Aucun SMTP applicatif n'est configuré.** GoTrue utilise donc l'expéditeur intégré de Supabase, plafonné à quelques envois par heure et explicitement présenté par Supabase comme non destiné à la production | Zéro occurrence de « SMTP » dans le dépôt et la doc |
| **Les confirmations d'inscription sont DÉSACTIVÉES** | 28 comptes, `confirmation_sent_at` renseigné sur **1** seul, délai création → confirmation de **15 ms** au minimum et < 10 min sur 27 comptes : c'est de l'auto-confirmation, pas un clic |
| **Les réinitialisations de mot de passe, elles, partent bien** par cet expéditeur | `recovery_sent_at` renseigné sur **3** comptes |
| **Le domaine n'est pas vérifié chez Resend** | `resend._domainkey.thecosmo.app` → **absent** |
| Le domaine reçoit du courrier chez IONOS | `MX` → `mx00/mx01.ionos.fr`, `SPF` → `include:_spf-eu.ionos.com`, `_dmarc` → CNAME vers `dmarc.ionos.fr` (`p=none`) |

**Les deux conséquences, dans l'ordre de gravité :**

1. **Personne ne vérifie qu'une adresse d'inscription existe.** N'importe qui peut créer un compte
   avec l'adresse d'un tiers, et une faute de frappe crée un compte définitivement injoignable —
   sans email valide, la réinitialisation de mot de passe ne peut plus rien pour lui.
2. **On ne peut pas corriger le point 1 sans SMTP.** Activer les confirmations aujourd'hui ferait
   passer chaque inscription par un expéditeur plafonné : au-delà de quelques inscriptions par
   heure, GoTrue répond `over_email_send_rate_limit`, que l'application traduit par
   « **Trop de tentatives. Réessayez dans quelques minutes.** » (`safeAuthError`). Le message est
   exact du point de vue du serveur et **trompeur** du point de vue de l'inscrit : il n'a rien
   fait de trop, c'est le quota du projet — éventuellement consommé par quelqu'un d'autre — qui
   est épuisé. Il réessaie, échoue encore, et part.

⚠️ **C'est un mode de défaillance corrélé** : il ne se déclenche que sous trafic, c'est-à-dire
exactement le jour d'une campagne, et il ressemble à « la campagne n'a pas converti ».
