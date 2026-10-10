# Plan d'action SEO, thecosmo.app (2026-10-09)

Note actuelle : 78 / 100 (76 avant les correctifs du 2026-10-09, commit `69a972d0`). Détail : [FULL-AUDIT-REPORT.md](./FULL-AUDIT-REPORT.md).

## Élevé (semaine 1)

1. ⏳ (attend nom, bio, profil d'Axel) **Auteur humain sur le blog** : page auteur, `author: Person` + `sameAs`, encart en fin
   d'article. Premier levier E-E-A-T.
2. ⏳ (attend les URLs des profils) **Remplir `Organization.sameAs`** avec les profils existants (LinkedIn, GitHub, Product Hunt…).
   Ne déclarer que des profils qui existent.

## Moyen (semaines 2-4)

3. ⏸️ (décision contraire dans docs/I18N.md, à rouvrir quand l'anglais aura du trafic) **Slugs anglais pour les 11 articles `/en/blog/*`**, 301 depuis les slugs français, sitemap et
   hreflang régénérés.
4. ✅ ~~**Vrai 404**~~ (HTML serveur en noindex, fait ; statut 200 restant) : statut HTTP 404 et `noindex` dans le HTML serveur, pas seulement après JS.
5. **Images dans les articles** : 1 à 3 visuels par article (captures annotées, schémas).
6. **Image OG par page** générée au build.
7. **Mesurer la perf mobile** (PSI avec clé API) puis alléger le JS de la landing (516 Ko, 41
   fichiers) ; différer Supabase et Sentry sur les pages publiques.

## Bas (backlog)

8. Redirection 308 des variantes à slash final (`/guide/`, `/en`).
9. ✅ ~~Raccourcir la description de `/entreprise-presentation` (177 caractères) et celle de `/blog/cosmo-vs-todoist` (160 pile).~~ Fait pour `/entreprise-presentation`.
10. ✅ ~~Allonger le title de `/en/about`.~~ Fait.
11. Différencier `/pour-managers` et `/pour-equipes` pour éviter la cannibalisation.

## Hors technique, le vrai goulot

Position moyenne 88 et 0 clic hors marque (GSC, 2026-08-19) : le site est techniquement prêt,
il manque l'autorité. Les actions backlinks de `docs/ACQUISITION-BACKLINKS.md` restent le levier
n°1, au-dessus de tout ce qui précède.
