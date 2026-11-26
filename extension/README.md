# Extension « Ajouter à Cosmo » (plan SEO P2)

Ouvre `https://thecosmo.app/tasks?ajouter=<titre>&source=<adresse>` ; la page Tâches ouvre
la création pré-remplie (`src/pages/TasksPage.tsx`, `lirePrefill`), l'utilisateur valide.
Aucun accès à la base, aucun jeton : la session est celle de l'app.

- Tester : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → ce dossier.
- Publier : zipper le contenu du dossier, compte développeur Chrome Web Store (payant, à ouvrir par Axel).
- ⚠️ Sans session, `/tasks` renvoie à l'accueil et les paramètres sont perdus : se connecter puis recliquer.
