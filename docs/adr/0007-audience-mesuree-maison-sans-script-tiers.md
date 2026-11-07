# ADR 0007 · Audience mesurée par un collecteur maison, sans script tiers

- **Statut** : acceptée
- **Date** : 2026-10-18 (migration `222`), durcie par la migration `223`

## Contexte

COSMO veut savoir d'où viennent ses visiteurs et quelles pages elles voient, sans pister des personnes
et sans poser un script de mesure tiers. Une mesure qui dépose un traceur doit en outre être
conditionnée au consentement (`src/lib/cookie-consent.ts`) : `null` n'est pas une acceptation.

## Décision

- La mesure est **maison**, de bout en bout : `src/lib/traffic.ts` (démarré dans `src/main.tsx`) poste à
  `/api/collect` (fonction Vercel, runtime edge, même origine), qui appelle la RPC `track_hit` et
  écrit dans `traffic_hits`.
- **Avant chaque envoi**, le client revérifie le consentement, que la page est publique, qu'il n'y a ni
  formulaire d'identifiants ni session.
- **Le collecteur est le seul chemin d'écriture** : depuis la migration `223`, `track_hit` n'est
  exécutable que par la clé secrète du serveur. Elle n'a jamais le préfixe `VITE_` et n'est jamais
  renvoyée ni journalisée. Sans elle, le collecteur répond 503 : aucun repli sur la clé publique.
- **Aucune IP et aucun user-agent n'est stocké.** Ils ne servent qu'à une empreinte du jour, dont le
  sel est supprimé le lendemain. Tout ce qui n'est pas de même origine est refusé.
- **Aucun script tiers de mesure.** Vercel Analytics n'est rendu que si le consentement est `accepted`.

## Conséquences

- **Positives.** Aucune donnée d'audience ne part chez un tiers de mesure, aucun script tiers n'alourdit
  les pages, et la mesure se relie à des actions d'acquisition (`check:acquisition`).
- **Négatives.** Un endpoint public d'écriture à protéger et à dimensionner soi-même (taille,
  origine, robots, volume), et une analyse beaucoup plus pauvre que celle d'un outil du marché.
  Un collecteur en panne se voit mal : d'où le 503 et le 502 plutôt qu'un 204 silencieux.
- **À ne pas faire.** Ne jamais rendre `EXECUTE` de `track_hit` à `anon` ou `authenticated`, jamais
  stocker l'IP ni le user-agent, jamais lire `cosmo_cookie_consent` ailleurs que par
  `src/lib/cookie-consent.ts`.
- Règles de détail : [`api/CLAUDE.md`](../../api/CLAUDE.md), [`src/CLAUDE.md`](../../src/CLAUDE.md) et
  [`docs/RGPD-REGISTRE.md`](../RGPD-REGISTRE.md).
