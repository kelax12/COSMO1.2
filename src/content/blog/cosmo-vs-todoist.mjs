// Article de blog, contenu partagé React + prerender. ESM pur.
//
// Deux dimensions, à ne jamais confondre :
//   - la colonne vertébrale (`slug`, dates, `related`) est COMMUNE à toutes
//     les langues : c'est une seule publication traduite, pas deux articles ;
//   - `locales` porte tout ce qui se traduit, `readingMinutes` compris (un
//     texte anglais n'a aucune raison de se lire dans le même temps que le
//     français).
//
// Une locale absente n'est jamais repliée en silence sur le français côté SEO :
// `articlesFor()` ne la publie pas, donc le prérendu ne peut pas produire une
// page anglaise au corps français. Voir src/content/blog/index.mjs.
export const article = {
  slug: "cosmo-vs-todoist",
  datePublished: "2026-07-18",
  dateModified: "2026-07-18",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["gestion-du-temps-efficace","methode-okr-exemples","time-blocking-guide"],
  locales: {
    fr: {
      title: "Cosmo vs Todoist : lequel choisir en 2026 ?",
      metaTitle: "Cosmo vs Todoist (2026) : comparatif honnête et complet",
      description: "Todoist est un excellent gestionnaire de tâches. Cosmo ajoute habitudes, agenda time-blocking et OKR dans une app gratuite. Comparatif honnête, point par point.",
      readingMinutes: 7,
      html: `
<p class="lead">Todoist est probablement le gestionnaire de tâches le plus abouti du marché : 18 ans d'existence, des applications natives partout, une saisie en langage naturel redoutable. Alors pourquoi comparer ? Parce que la question n'est pas « quelle est la meilleure todo-list ? » mais « <strong>de quoi votre organisation a-t-elle besoin ?</strong> ». Si la réponse inclut le suivi d'habitudes, le time-blocking ou des objectifs mesurables, le match devient intéressant. Comparatif honnête, point par point.</p>

<h2 id="resume">Le verdict en 30 secondes</h2>
<ul>
<li><strong>Choisissez Todoist</strong> si vous voulez uniquement gérer des tâches, avec des apps natives (Windows, macOS, mobile), des intégrations à tout votre écosystème (Gmail, Slack, calendriers) et une saisie ultra-rapide.</li>
<li><strong>Choisissez Cosmo</strong> si vous voulez connecter tâches, <strong>habitudes</strong>, <strong>agenda avec time-blocking</strong> et <strong>OKR</strong> dans un seul outil gratuit, en français, plutôt que de jongler entre 3 ou 4 applications.</li>
</ul>

<h2 id="tableau">Tableau comparatif</h2>
<div class="table-wrap"><table>
<thead><tr><th>Critère</th><th>Todoist</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Gestion de tâches</td><td>Excellente (référence du marché)</td><td>Complète : priorités 1-5, catégories, listes, filtres</td></tr>
<tr><td>Saisie en langage naturel</td><td>Oui, remarquable (« demain 14h »)</td><td>Non (formulaire structuré)</td></tr>
<tr><td>Suivi d'habitudes</td><td>Non natif (contournement par tâches récurrentes)</td><td>Natif : heatmap 26 semaines, streaks, taux de complétion</td></tr>
<tr><td>Agenda / time-blocking</td><td>Vue calendrier (payante), pas de vrai time-blocking</td><td>Natif : glisser une tâche dans le calendrier crée l'événement lié</td></tr>
<tr><td>OKR / objectifs</td><td>Absent</td><td>Natif : progression calculée automatiquement</td></tr>
<tr><td>Statistiques</td><td>Karma (points de gamification)</td><td>Multi-modules : temps investi par tâches, habitudes, agenda, OKR</td></tr>
<tr><td>Collaboration</td><td>Oui, mature (projets partagés)</td><td>Partage de tâches avec rôles Lecteur/Éditeur</td></tr>
<tr><td>Applications natives</td><td>Windows, macOS, iOS, Android, extensions</td><td>Web app mobile-first (aucune installation)</td></tr>
<tr><td>Intégrations tierces</td><td>Très nombreuses (calendriers, Slack, e-mail…)</td><td>Aucune à ce jour</td></tr>
<tr><td>Langue</td><td>Interface traduite</td><td>Conçu en français</td></tr>
<tr><td>Prix</td><td>Gratuit limité (5 projets) ; Pro ≈ 4-5 €/mois</td><td>Gratuit, fonctionnalités principales sans limite</td></tr>
<tr><td>Essai sans compte</td><td>Non</td><td>Oui : démo instantanée pré-remplie, sans inscription</td></tr>
</tbody>
</table></div>

<h2 id="todoist-fort">Là où Todoist reste devant</h2>
<p>Soyons directs : sur la <strong>pure gestion de tâches</strong>, Todoist a 18 ans d'avance et ça se sent.</p>
<ul>
<li><strong>La saisie en langage naturel.</strong> Taper « Rapport tous les lundis 9h #Travail » et voir la récurrence, l'heure et le projet se remplir seuls, c'est le meilleur du marché.</li>
<li><strong>Les applications natives.</strong> Raccourcis clavier système, widget, capture depuis n'importe où : si vous capturez 30 tâches par jour, ce confort compte.</li>
<li><strong>L'écosystème.</strong> Todoist se branche sur Gmail, Outlook, Slack, votre calendrier. Cosmo, à ce stade, ne propose pas d'intégrations tierces.</li>
<li><strong>La maturité collaborative.</strong> Les projets partagés Todoist sont éprouvés pour gérer une équipe entière.</li>
</ul>

<h2 id="cosmo-fort">Là où Cosmo change la donne</h2>
<p>La limite de Todoist n'est pas ce qu'il fait, c'est ce qu'il ne fait pas. Une organisation personnelle complète repose sur quatre piliers, et Todoist n'en couvre qu'un.</p>
<ul>
<li><strong>Les habitudes sont natives.</strong> Dans Todoist, une habitude est une tâche récurrente qui culpabilise quand elle est en retard. Dans Cosmo, c'est un objet à part : heatmap 26 semaines style GitHub, streaks, taux de complétion : la régularité se construit visuellement.</li>
<li><strong>Le time-blocking est réel.</strong> Vous glissez une tâche dans un créneau du calendrier : l'événement est créé et lié à la tâche. Planifier sa journée prend deux minutes, sans synchronisation externe.</li>
<li><strong>Les OKR donnent une direction.</strong> Une todo-list dit ce qu'il faut faire aujourd'hui ; elle ne dit jamais si vous avancez vers ce qui compte. Les OKR de Cosmo relient vos actions quotidiennes à des objectifs mesurables (<a href="/blog/methode-okr-exemples">voir notre guide de la méthode OKR avec 15 exemples</a>).</li>
<li><strong>Le prix.</strong> Les fonctionnalités principales de Cosmo sont gratuites sans limite de projets. Todoist gratuit plafonne à 5 projets, et la vue calendrier est payante.</li>
<li><strong>L'essai sans friction.</strong> La <a href="/">démo de Cosmo</a> s'ouvre sans compte, pré-remplie avec 12 mois de données réalistes : vous jugez sur pièce en deux minutes.</li>
</ul>

<h2 id="profils">Quel outil pour quel profil ?</h2>
<h3>Vous capturez énormément de tâches, partout, tout le temps</h3>
<p><strong>Todoist.</strong> Sa capture éclair et ses apps natives sont faites pour ça.</p>
<h3>Vous voulez construire des habitudes en plus de gérer vos tâches</h3>
<p><strong>Cosmo.</strong> C'est la différence structurelle : les habitudes y sont un pilier, pas un contournement.</p>
<h3>Vous planifiez vos journées en time-blocking</h3>
<p><strong>Cosmo</strong>, sauf si vous avez déjà un flux Todoist + Google Calendar qui vous convient.</p>
<h3>Vous fixez des objectifs trimestriels (perso ou pro)</h3>
<p><strong>Cosmo.</strong> Todoist n'a tout simplement pas cette brique.</p>
<h3>Votre équipe entière doit collaborer sur des projets</h3>
<p><strong>Todoist</strong> pour la collaboration lourde et les intégrations ; Cosmo suffit pour du partage de tâches à deux ou trois, et va plus loin dès qu'il s'agit d'objectifs partagés, comme le montre la page <a href="/pour-equipes">Cosmo pour les équipes</a>.</p>

<h2 id="migration">Passer de Todoist à Cosmo</h2>
<p>Pas d'import automatique à ce jour, mais c'est l'occasion de faire le tri : recopiez uniquement vos tâches réellement actives (rarement plus de 20), recréez vos projets en catégories colorées, puis ajoutez ce que Todoist ne portait pas : 2-3 habitudes et un premier OKR de trimestre. Le <a href="/guide">guide d'utilisation</a> couvre la prise en main complète en dix minutes. Si vous travaillez à votre compte, la page <a href="/pour-freelances">Cosmo pour les freelances</a> montre ce même flux appliqué à un portefeuille de clients.</p>

<h2 id="conclusion">Conclusion</h2>
<p>Todoist est un excellent outil, et si votre besoin s'arrête aux tâches, gardez-le. Mais si votre organisation ressemble à « une todo-list + une app d'habitudes + un agenda + un tableur d'objectifs », alors le vrai sujet n'est pas de choisir la meilleure todo-list : c'est d'arrêter de payer la friction entre quatre outils. C'est exactement le pari de Cosmo, et vous pouvez le vérifier en deux minutes, <a href="/signup">gratuitement et sans carte bancaire</a>.</p>
`,
    },
    en: {
      title: "Cosmo vs Todoist: which one should you choose in 2026?",
      metaTitle: "Cosmo vs Todoist (2026): an honest, complete comparison",
      description: "Todoist is an excellent task manager. Cosmo adds habits, a time-blocking calendar and OKRs in a free app. An honest comparison, point by point.",
      readingMinutes: 7,
      html: `
<p class="lead">Todoist is probably the most accomplished task manager on the market: 18 years of existence, native apps everywhere, formidable natural-language input. So why compare at all? Because the question is not "which is the best to-do list?" but "<strong>what does your system actually need?</strong>". If the answer includes habit tracking, time-blocking or measurable goals, the match gets interesting. An honest comparison, point by point.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose Todoist</strong> if you only want to manage tasks, with native apps (Windows, macOS, mobile), integrations across your whole ecosystem (Gmail, Slack, calendars) and extremely fast capture.</li>
<li><strong>Choose Cosmo</strong> if you want to connect tasks, <strong>habits</strong>, a <strong>time-blocking calendar</strong> and <strong>OKRs</strong> in a single free tool, rather than juggling three or four applications.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Todoist</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Task management</td><td>Excellent, the market reference</td><td>Complete: priorities 1 to 5, categories, lists, filters</td></tr>
<tr><td>Natural-language input</td><td>Yes, remarkable ("tomorrow 2pm")</td><td>No, a structured form</td></tr>
<tr><td>Habit tracking</td><td>Not native, worked around with recurring tasks</td><td>Native: 26-week heatmap, streaks, completion rate</td></tr>
<tr><td>Calendar and time-blocking</td><td>Calendar view (paid), no true time-blocking</td><td>Native: drag a task into the calendar and the linked event is created</td></tr>
<tr><td>OKRs and goals</td><td>Absent</td><td>Native, with progress computed for you</td></tr>
<tr><td>Statistics</td><td>Karma, a gamification score</td><td>Across modules: time invested in tasks, habits, calendar, OKRs</td></tr>
<tr><td>Collaboration</td><td>Yes, mature (shared projects)</td><td>Task sharing with Viewer and Editor roles</td></tr>
<tr><td>Native apps</td><td>Windows, macOS, iOS, Android, extensions</td><td>A mobile-first web app, nothing to install</td></tr>
<tr><td>Third-party integrations</td><td>Very many (calendars, Slack, email)</td><td>None to date</td></tr>
<tr><td>Price</td><td>Limited free tier (5 projects), Pro around 4 to 5 € a month</td><td>Free, with the main features unlimited</td></tr>
<tr><td>Try without an account</td><td>No</td><td>Yes, an instant pre-filled demo with no sign-up</td></tr>
</tbody>
</table></div>

<h2 id="todoist-fort">Where Todoist is still ahead</h2>
<p>Let us be direct: on <strong>pure task management</strong>, Todoist has an 18-year head start and it shows.</p>
<ul>
<li><strong>Natural-language input.</strong> Typing "Report every Monday 9am #Work" and watching the recurrence, the time and the project fill themselves in is the best on the market.</li>
<li><strong>Native apps.</strong> System-wide keyboard shortcuts, a widget, capture from anywhere: if you capture 30 tasks a day, that comfort matters.</li>
<li><strong>The ecosystem.</strong> Todoist plugs into Gmail, Outlook, Slack and your calendar. Cosmo, at this stage, offers no third-party integrations.</li>
<li><strong>Collaborative maturity.</strong> Todoist's shared projects are battle-tested for running a whole team.</li>
</ul>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>Todoist's limit is not what it does, it is what it does not do. A complete personal system rests on four pillars, and Todoist covers one.</p>
<ul>
<li><strong>Habits are native.</strong> In Todoist a habit is a recurring task that makes you feel guilty when it is overdue. In Cosmo it is its own object: a 26-week GitHub-style heatmap, streaks, completion rate. Consistency gets built visually.</li>
<li><strong>Time-blocking is real.</strong> You drag a task onto a calendar slot and the event is created and linked to the task. Planning your day takes two minutes, with no external sync.</li>
<li><strong>OKRs give a direction.</strong> A to-do list tells you what to do today, it never tells you whether you are moving towards what matters. Cosmo's OKRs connect your daily actions to measurable goals (<a href="/en/blog/methode-okr-exemples">see our guide to the OKR method with 15 examples</a>).</li>
<li><strong>The price.</strong> Cosmo's main features are free with no project limit. Free Todoist caps at 5 projects, and the calendar view is paid.</li>
<li><strong>Frictionless trial.</strong> The <a href="/en/">Cosmo demo</a> opens with no account, pre-filled with 12 months of realistic data, so you can judge it loaded in two minutes.</li>
</ul>

<h2 id="profils">Which tool for which profile?</h2>
<h3>You capture a great many tasks, everywhere, all the time</h3>
<p><strong>Todoist.</strong> Its lightning capture and native apps are built for exactly that.</p>
<h3>You want to build habits as well as manage tasks</h3>
<p><strong>Cosmo.</strong> That is the structural difference: habits are a pillar here, not a workaround.</p>
<h3>You plan your days with time-blocking</h3>
<p><strong>Cosmo</strong>, unless you already have a Todoist plus Google Calendar flow that suits you.</p>
<h3>You set quarterly goals, personal or professional</h3>
<p><strong>Cosmo.</strong> Todoist simply does not have that building block.</p>
<h3>Your whole team has to collaborate on projects</h3>
<p><strong>Todoist</strong> for heavy collaboration and integrations. Cosmo is enough for sharing tasks between two or three people, and goes further as soon as shared goals are involved, as the <a href="/en/for-teams">Cosmo for teams</a> page shows.</p>

<h2 id="migration">Moving from Todoist to Cosmo</h2>
<p>There is no automatic import today, but that is an opportunity to clear house: copy across only the tasks that are genuinely active (rarely more than 20), recreate your projects as coloured categories, then add what Todoist was not carrying: two or three habits and a first quarterly OKR. The <a href="/en/guide">user guide</a> covers the full setup in ten minutes. If you work for yourself, the <a href="/en/for-freelancers">Cosmo for freelancers</a> page shows the same flow applied to a client portfolio.</p>

<h2 id="conclusion">Conclusion</h2>
<p>Todoist is an excellent tool, and if your need stops at tasks, keep it. But if your system looks like "a to-do list plus a habit app plus a calendar plus a goals spreadsheet", then the real question is not which to-do list is best: it is how to stop paying the friction between four tools. That is precisely Cosmo's bet, and you can check it in two minutes, <a href="/en/signup">free and with no credit card</a>.</p>
`,
    },
  },
};
