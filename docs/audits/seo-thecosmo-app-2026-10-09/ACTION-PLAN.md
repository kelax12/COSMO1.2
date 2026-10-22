# Plan d'action SEO, thecosmo.app (2026-10-09, mis à jour le 2026-10-12)

Note actuelle : **81 / 100** (76 le 2026-10-09, 78 après `69a972d0`, 81 après `dc243383`).
Détail : [FULL-AUDIT-REPORT.md](./FULL-AUDIT-REPORT.md).

🔎 **Relu le 2026-10-15** : rien n'a bougé depuis le 10-12, les sept lignes ci-dessous sont
toujours à leur état. Seul fait neuf, sur la ligne 5 : le LCP mobile est à 3,3 s sur toutes les
URLs en CI, mais l'accueil reste à 65 de perf mobile (TBT 878 ms).

## Ce qui reste, et pourquoi

### Attend une information d'Axel

1. **Auteur humain sur le blog** : nom affiché, courte bio, un profil public. Ensuite : page
   auteur, `author: Person` + `sameAs`, encart en fin d'article. Premier levier E-E-A-T.
2. **`Organization.sameAs`** : les URLs des profils de la marque qui existent (LinkedIn, GitHub,
   Product Hunt…). Ne déclarer que des profils réels.

### Décision contraire documentée

3. ⏸️ **Slugs anglais des 11 articles `/en/blog/*`** : `docs/I18N.md`, à rouvrir quand l'anglais
   aura du trafic (coût : une table de 301).
4. ⏸️ **Statut HTTP 404 des URL inconnues** : limite SPA assumée (`docs/SEO.md`). Le HTML servi
   est en `noindex` depuis le 2026-10-09.

### Chantier à part

5. **Landing lente sur mobile** (perf 68-70 en CI, TBT ~600 ms) : travail des animations sur le
   fil principal. Suivi en T-51.

### Volontairement non fait

6. Redirection des variantes à slash final : le canonical les couvre, et la règle Vercel globale
   casserait `/en/`.
7. `dateModified` : ne bouge qu'avec une vraie révision du texte.

## Fait

| Quand | Commit | Quoi |
|---|---|---|
| 2026-10-09 | `69a972d0` | `app.html` en `noindex` sans canonical vers `/` · description `/entreprise-presentation` · title `/en/about` |
| 2026-10-12 | `dc243383` | canonical/titre/description de la page entreprise réécrits vers l'accueil par React (SEO 92 → 100) · lien cookies « Learn more » (`/en/` 92 → 100) · image OG par page (39) · une capture dans chacun des 11 articles · intertitre managers ≠ équipes |

## Hors technique, le vrai goulot

Position moyenne 88 et 0 clic hors marque (GSC, 2026-08-19) : le site est techniquement prêt,
il manque l'autorité. Les actions backlinks de `docs/ACQUISITION-BACKLINKS.md` restent le levier
n°1, au-dessus de tout ce qui précède.
