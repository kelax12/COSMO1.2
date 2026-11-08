// Corps indexable de la home (fr, en).
// Gabarits HTML du prérendu, injectés tels quels dans #seo-fallback.

export const HOME_FR = `<h1>Cosmo – Gestionnaire de tâches, habitudes et OKR</h1>
        <p>Cosmo est une application de productivité gratuite qui réunit quatre outils habituellement séparés : la gestion de tâches, le suivi d'habitudes, l'agenda avec time-blocking et la méthode OKR (Objectives &amp; Key Results). L'idée de départ est simple : vos tâches du jour, vos routines et vos objectifs de fond décrivent la même vie, ils n'ont aucune raison de vivre dans trois applications qui s'ignorent.</p>
        <p>Tout fonctionne dans le navigateur, sur ordinateur comme sur mobile, sans installation. Vous pouvez <a href="/">essayer la démo sans créer de compte</a> : elle s'ouvre pré-remplie avec 12 mois de données réalistes (100 tâches, 100 habitudes, environ 150 événements d'agenda et 8 OKR) : de quoi juger le produit chargé plutôt que face à un écran vide.</p>

        <h2>Gérer ses tâches sans se noyer</h2>
        <p>Chaque tâche porte une priorité de 1 à 5, une catégorie colorée, une échéance et, si besoin, une liste. Les filtres croisent ces critères pour répondre à la seule question qui compte le matin : qu'est-ce que je fais maintenant ? Les tâches récurrentes se régénèrent automatiquement une fois cochées, les sous-tâches découpent ce qui est trop gros, et la recherche retrouve n'importe quel élément instantanément. Les tâches se partagent aussi avec d'autres utilisateurs, en lecture ou en édition, cette collaboration est gratuite et le restera.</p>

        <h2>Suivre ses habitudes et voir sa régularité</h2>
        <p>Une habitude se définit par sa fréquence : quotidienne, hebdomadaire, ou sur des jours précis. Vous cochez, Cosmo mesure. La heatmap sur 26 semaines, dans l'esprit du graphe de contributions GitHub, rend la régularité visible d'un coup d'œil, bien mieux qu'un chiffre isolé. Le streak compte vos jours consécutifs, le taux de complétion situe la période en cours par rapport aux précédentes. La règle qui marche : commencer par deux ou trois habitudes, pas quinze.</p>

        <h2>Le time-blocking, pour que le planning devienne réel</h2>
        <p>Une tâche sans créneau reste une intention. L'agenda de Cosmo accepte le glisser-déposer depuis le panneau des tâches : vous déposez « rédiger la proposition » mardi à 14 h, l'événement se crée et reste lié à la tâche. Vues jour, semaine et mois, gestion des événements récurrents. L'intérêt du time-blocking n'est pas cosmétique, il confronte votre liste à la seule ressource vraiment limitée, les heures disponibles dans la semaine.</p>

        <h2>Piloter ses objectifs avec la méthode OKR</h2>
        <p>La <a href="/blog/methode-okr-exemples">méthode OKR</a>, popularisée par Intel puis Google, structure un objectif ambitieux en 2 à 5 résultats clés mesurables. Cosmo calcule la progression de chaque résultat clé et de l'objectif global, et archive chaque complétion pour construire votre historique. Ce que la plupart des outils OKR ne font pas : ici, vos objectifs trimestriels cohabitent avec vos tâches quotidiennes, ce qui rend visible l'écart entre ce que vous visez et ce sur quoi vous passez réellement vos journées.</p>

        <h2>À quoi ça ressemble</h2>
        <p>Trois écrans de l'application, en mode démo :</p>
        <!-- loading=lazy n'est PAS une micro-optimisation ici, c'est le
             correctif d'un vrai gaspillage. Ce bloc vit dans #seo-fallback,
             qui est en display:none pour un navigateur : aucun visiteur n'a
             jamais VU ces captures. Il les telechargeait quand meme, parce que
             le scanner de prechargement lit le balisage avant le CSS. Mesure du
             2026-08-25 : 790 ko d'images peintes nulle part, sur la page la
             plus visitee du site.
             Avec lazy, une image d'un sous-arbre display:none n'entre jamais
             dans le viewport, donc n'est jamais demandee. Les crawlers sans JS,
             eux, lisent toujours src et alt dans le balisage : le SEO ne perd
             rien, et Google recommande explicitement cet attribut. -->

        <p>
          <img src="/screenshots/dashboard.webp" width="1280" height="800" loading="lazy" decoding="async" alt="Tableau de bord Cosmo : tâches complétées, événements d'agenda, résultats clés atteints et habitudes du jour réunis sur un seul écran" />
          <img src="/screenshots/taches.webp" width="1280" height="800" loading="lazy" decoding="async" alt="Gestionnaire de tâches Cosmo : listes d'accès rapide, filtres par priorité et catégorie, tâches en retard signalées" />
          <img src="/screenshots/habitudes.webp" width="1280" height="800" loading="lazy" decoding="async" alt="Suivi d'habitudes Cosmo : tableau hebdomadaire des habitudes cochées avec série de jours consécutifs pour chacune" />
        </p>

        <h2>Un tableau de bord qui relie les quatre</h2>
        <p>Le dashboard réunit l'avancement du jour, les habitudes à cocher, les prochains événements et la courbe des résultats clés atteints. La page Statistiques va plus loin : temps investi par catégorie, évolution sur la période, comparaison entre modules. C'est le tableau de bord de productivité qui manque quand chaque outil ne connaît qu'un quart de votre activité.</p>

        <h2>Combien ça coûte ?</h2>
        <p>Les fonctionnalités principales (tâches, habitudes, agenda, OKR, statistiques, partage) sont gratuites, sans carte bancaire ni essai limité dans le temps. Vos données sont stockées sur Supabase avec Row Level Security : personne d'autre que vous n'y accède. En mode démo, rien ne quitte votre navigateur.</p>
        <h2>Et pour une organisation ?</h2>
        <p>Cosmo existe aussi en mode entreprise : votre pyramide managériale y structure les projets, les OKR et les statistiques d'équipe, et le périmètre de chacun découle de la hiérarchie réelle plutôt que de partages faits à la main. Chaque collaborateur conserve le Cosmo personnel décrit ci-dessus. C'est gratuit jusqu'à 5 membres, <a href="/entreprise-presentation">découvrir Cosmo Entreprise</a>.</p>
        <p><a href="/signup">Créer un compte gratuit</a> · <a href="/guide">Guide d'utilisation</a> · <a href="/blog">Le blog Cosmo</a></p>`;

export const HOME_EN = `<h1>Cosmo, a task, habit and OKR manager</h1>
        <p>Cosmo is a free productivity application that brings together four tools normally kept apart: task management, habit tracking, a calendar with time-blocking, and the OKR method (Objectives &amp; Key Results). The starting idea is simple: your tasks for today, your routines and your underlying goals describe the same life, so they have no reason to live in three applications that ignore each other.</p>
        <p>Everything runs in the browser, on desktop and on mobile, with nothing to install. You can <a href="/en/">try the demo without creating an account</a>: it opens pre-filled with 12 months of realistic data (100 tasks, 100 habits, around 150 calendar events and 8 OKRs), which is enough to judge the product loaded rather than in front of an empty screen.</p>

        <h2>Managing tasks without drowning</h2>
        <p>Each task carries a priority from 1 to 5, a coloured category, a deadline and, if you need it, a list. Filters cross those criteria to answer the only question that counts in the morning: what do I do now? Recurring tasks regenerate themselves once ticked, subtasks break down whatever is too big, and search finds any item instantly. Tasks can also be shared with other users, to read or to edit, and that collaboration is free and will stay free.</p>

        <h2>Tracking habits and seeing your consistency</h2>
        <p>A habit is defined by its frequency: daily, weekly, or on specific days. You tick, Cosmo measures. The 26-week heatmap, in the spirit of the GitHub contribution graph, makes consistency visible at a glance, far better than an isolated number. The streak counts your consecutive days, and the completion rate situates the current period against previous ones. The rule that works: start with two or three habits, not fifteen.</p>

        <h2>Time-blocking, to make the plan real</h2>
        <p>A task without a slot stays an intention. Cosmo's calendar accepts drag and drop from the task panel: you drop "write the proposal" on Tuesday at 2 pm, the event is created and stays linked to the task. Day, week and month views, with recurring events. The point of time-blocking is not cosmetic, it confronts your list with the only genuinely limited resource, the hours available in the week.</p>

        <h2>Steering your goals with the OKR method</h2>
        <p>The <a href="/en/blog/methode-okr-exemples">OKR method</a>, popularised by Intel and then Google, structures an ambitious goal into 2 to 5 measurable key results. Cosmo computes the progress of each key result and of the overall objective, and archives each completion to build your history. What most OKR tools do not do: here your quarterly goals sit alongside your daily tasks, which makes visible the gap between what you are aiming at and what you actually spend your days on.</p>

        <h2>What it looks like</h2>
        <p>Three screens of the application, in demo mode:</p>

        <p>
          <img src="/screenshots/dashboard.webp" width="1280" height="800" loading="lazy" decoding="async" alt="The Cosmo dashboard: completed tasks, calendar events, key results achieved and the day's habits gathered on a single screen" />
          <img src="/screenshots/taches.webp" width="1280" height="800" loading="lazy" decoding="async" alt="The Cosmo task manager: quick-access lists, filters by priority and category, overdue tasks flagged" />
          <img src="/screenshots/habitudes.webp" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo habit tracking: a weekly table of ticked habits with the consecutive-day streak for each one" />
        </p>

        <h2>A dashboard that connects the four</h2>
        <p>The dashboard brings together the day's progress, the habits to tick, the next events and the curve of key results achieved. The Statistics page goes further: time invested per category, how it evolves over the period, comparison between modules. It is the productivity dashboard that is missing when each tool only knows a quarter of your activity.</p>

        <h2>What does it cost?</h2>
        <p>The main features (tasks, habits, calendar, OKRs, statistics, sharing) are free, with no credit card and no time-limited trial. Your data is stored on Supabase with Row Level Security: nobody but you can reach it. In demo mode, nothing leaves your browser.</p>
        <h2>And for an organisation?</h2>
        <p>Cosmo also exists in company mode: your management pyramid structures the projects, the OKRs and the team statistics, and everyone's scope follows from the real hierarchy rather than from shares made by hand. Each colleague keeps the personal Cosmo described above. It is free up to 5 members, <a href="/en/for-companies">discover Cosmo for companies</a>.</p>
        <p><a href="/en/signup">Create a free account</a> · <a href="/en/guide">User guide</a> · <a href="/en/blog">The Cosmo blog</a></p>`;
