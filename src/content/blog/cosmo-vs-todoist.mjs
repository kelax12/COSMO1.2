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
  dateModified: "2026-10-13",
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
<figure><img src="/screenshots/taches.webp" srcset="/screenshots/taches-800.webp 800w, /screenshots/taches.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Le gestionnaire de tâches de Cosmo : listes d'accès rapide, filtres par priorité et par catégorie, tâches en retard signalées." /><figcaption>Le gestionnaire de tâches de Cosmo : listes d'accès rapide, filtres par priorité et par catégorie, tâches en retard signalées. Capture du mode démo, données fictives.</figcaption></figure>

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
<p><em>Comparatif établi le 18 juillet 2026 et relu le 13 octobre 2026, à partir des pages publiques de Todoist (fonctionnalités et tarifs). Les offres de Todoist évoluent : vérifiez-les sur todoist.com avant de choisir.</em></p>

<h2 id="todoist-fort">Là où Todoist reste devant</h2>
<p>Soyons directs : sur la <strong>pure gestion de tâches</strong>, Todoist a 18 ans d'avance et ça se sent.</p>
<ul>
<li><strong>La saisie en langage naturel.</strong> Taper « Rapport tous les lundis 9h #Travail » et voir la récurrence, l'heure et le projet se remplir seuls, c'est le meilleur du marché.</li>
<li><strong>Les applications natives.</strong> Raccourcis clavier système, widget, capture depuis n'importe où : si vous capturez 30 tâches par jour, ce confort compte.</li>
<li><strong>L'écosystème.</strong> Todoist se branche sur Gmail, Outlook, Slack, votre calendrier. Côté usage personnel, Cosmo ne propose pas encore d'intégrations tierces ; seul l'espace entreprise peut envoyer les événements de ses tâches vers Slack ou vers un service web.</li>
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
<figure><img src="/screenshots/taches.webp" srcset="/screenshots/taches-800.webp 800w, /screenshots/taches.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's task manager: quick-access lists, filters by priority and category, overdue tasks flagged." /><figcaption>Cosmo's task manager: quick-access lists, filters by priority and category, overdue tasks flagged. Screenshot of the demo mode, sample data.</figcaption></figure>

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
<p><em>Comparison written on 18 July 2026 and reviewed on 13 October 2026, based on Todoist's public pages (features and pricing). Todoist's plans change: check them on todoist.com before choosing.</em></p>

<h2 id="todoist-fort">Where Todoist is still ahead</h2>
<p>Let us be direct: on <strong>pure task management</strong>, Todoist has an 18-year head start and it shows.</p>
<ul>
<li><strong>Natural-language input.</strong> Typing "Report every Monday 9am #Work" and watching the recurrence, the time and the project fill themselves in is the best on the market.</li>
<li><strong>Native apps.</strong> System-wide keyboard shortcuts, a widget, capture from anywhere: if you capture 30 tasks a day, that comfort matters.</li>
<li><strong>The ecosystem.</strong> Todoist plugs into Gmail, Outlook, Slack and your calendar. For personal use, Cosmo does not offer third-party integrations yet; only the company workspace can send its task events to Slack or to a web service.</li>
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
    hr: {
      title: "Cosmo ili Todoist: koji odabrati u 2026.?",
      metaTitle: "Cosmo ili Todoist (2026.): iskrena i potpuna usporedba",
      description: "Todoist je izvrstan upravitelj zadataka. Cosmo dodaje navike, kalendar za time-blocking i OKR-ove u besplatnoj aplikaciji. Iskrena usporedba, točku po točku.",
      readingMinutes: 7,
      html: `
<p class="lead">Todoist je vjerojatno najdotjeraniji upravitelj zadataka na tržištu: 18 godina postojanja, izvorne aplikacije posvuda, izvanredan unos prirodnim jezikom. Zašto ga onda uopće uspoređivati? Zato što pitanje nije „koja je lista obaveza najbolja?“, nego „<strong>što vašem sustavu zapravo treba?</strong>“. Ako odgovor uključuje praćenje navika, time-blocking ili mjerljive ciljeve, usporedba postaje zanimljiva. Iskrena usporedba, točku po točku.</p>
<figure><img src="/screenshots/taches.webp" srcset="/screenshots/taches-800.webp 800w, /screenshots/taches.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Upravljanje zadacima u Cosmu: liste za brzi pristup, filtri po prioritetu i kategoriji, označeni zakašnjeli zadaci." /><figcaption>Upravljanje zadacima u Cosmu: liste za brzi pristup, filtri po prioritetu i kategoriji, označeni zakašnjeli zadaci. Snimka zaslona demo načina rada, primjeri podataka.</figcaption></figure>

<h2 id="resume">Presuda u 30 sekundi</h2>
<ul>
<li><strong>Odaberite Todoist</strong> ako želite upravljati samo zadacima, uz izvorne aplikacije (Windows, macOS, mobitel), integracije s cijelim vašim ekosustavom (Gmail, Slack, kalendari) i iznimno brz unos.</li>
<li><strong>Odaberite Cosmo</strong> ako želite povezati zadatke, <strong>navike</strong>, <strong>kalendar za time-blocking</strong> i <strong>OKR-ove</strong> u jednom besplatnom alatu, umjesto da žonglirate s tri ili četiri aplikacije.</li>
</ul>

<h2 id="tableau">Usporedba jedan uz drugi</h2>
<div class="table-wrap"><table>
<thead><tr><th>Kriterij</th><th>Todoist</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Upravljanje zadacima</td><td>Izvrsno, referenca na tržištu</td><td>Potpuno: prioriteti od 1 do 5, kategorije, liste, filtri</td></tr>
<tr><td>Unos prirodnim jezikom</td><td>Da, izvanredan („sutra u 14 h“)</td><td>Ne, strukturirani obrazac</td></tr>
<tr><td>Praćenje navika</td><td>Nije izvorno, zaobilazi se ponavljajućim zadacima</td><td>Izvorno: toplinska karta od 26 tjedana, nizovi, postotak izvršenja</td></tr>
<tr><td>Kalendar i time-blocking</td><td>Prikaz kalendara (plaćeno), bez pravog time-blockinga</td><td>Izvorno: povucite zadatak u kalendar i povezani događaj se stvara</td></tr>
<tr><td>OKR-ovi i ciljevi</td><td>Nema</td><td>Izvorno, s automatski izračunatim napretkom</td></tr>
<tr><td>Statistika</td><td>Karma, bodovanje u obliku igre</td><td>Kroz sve module: vrijeme uloženo u zadatke, navike, kalendar, OKR-ove</td></tr>
<tr><td>Suradnja</td><td>Da, zrela (zajednički projekti)</td><td>Dijeljenje zadataka s ulogama Preglednik i Urednik</td></tr>
<tr><td>Izvorne aplikacije</td><td>Windows, macOS, iOS, Android, proširenja</td><td>Web-aplikacija prilagođena mobitelu, ništa za instalirati</td></tr>
<tr><td>Integracije s drugim alatima</td><td>Vrlo mnogo (kalendari, Slack, e-pošta)</td><td>Zasad nijedna</td></tr>
<tr><td>Cijena</td><td>Ograničena besplatna razina (5 projekata), Pro oko 4 do 5 € mjesečno</td><td>Besplatno, glavne funkcije bez ograničenja</td></tr>
<tr><td>Isprobavanje bez računa</td><td>Ne</td><td>Da, trenutačni demo s ispunjenim podacima, bez registracije</td></tr>
</tbody>
</table></div>
<p><em>Usporedba napisana 18. srpnja 2026., revidirana 13. listopada 2026., na temelju javnih stranica Todoista (funkcije i cijene). Todoistovi paketi se mijenjaju: provjerite ih na todoist.com prije odluke.</em></p>

<h2 id="todoist-fort">Gdje je Todoist i dalje ispred</h2>
<p>Budimo izravni: u <strong>čistom upravljanju zadacima</strong> Todoist ima 18 godina prednosti i to se vidi.</p>
<ul>
<li><strong>Unos prirodnim jezikom.</strong> Upišete „Izvještaj svaki ponedjeljak u 9 h #Posao“ i ponavljanje, vrijeme i projekt sami se popune. Najbolje na tržištu.</li>
<li><strong>Izvorne aplikacije.</strong> Prečaci na razini sustava, widget, unos s bilo kojeg mjesta: ako dnevno zapisujete 30 zadataka, ta udobnost je važna.</li>
<li><strong>Ekosustav.</strong> Todoist se povezuje s Gmailom, Outlookom, Slackom i vašim kalendarom. Za osobnu upotrebu Cosmo zasad ne nudi integracije s drugim alatima; samo prostor za tvrtke može slati događaje zadataka u Slack ili na web-servis.</li>
<li><strong>Zrelost suradnje.</strong> Todoistovi zajednički projekti dokazani su u vođenju cijelog tima.</li>
</ul>

<h2 id="cosmo-fort">Gdje Cosmo mijenja pravila</h2>
<p>Todoistovo ograničenje nije u onome što radi, nego u onome što ne radi. Potpun osobni sustav počiva na četiri stupa, a Todoist pokriva jedan.</p>
<ul>
<li><strong>Navike su izvorne.</strong> U Todoistu je navika ponavljajući zadatak koji vas grize kad zakasni. U Cosmu je to zaseban objekt: toplinska karta od 26 tjedana u stilu GitHuba, nizovi, postotak izvršenja. Dosljednost se gradi vizualno.</li>
<li><strong>Time-blocking je stvaran.</strong> Povučete zadatak u termin u kalendaru i događaj se stvara, povezan sa zadatkom. Planiranje dana traje dvije minute, bez vanjske sinkronizacije.</li>
<li><strong>OKR-ovi daju smjer.</strong> Lista obaveza kaže vam što učiniti danas, ali nikad ne kaže idete li prema onome što je važno. OKR-ovi u Cosmu povezuju svakodnevne radnje s mjerljivim ciljevima (<a href="/hr/blog/methode-okr-exemples">pogledajte naš vodič kroz OKR metodu s 15 primjera</a>).</li>
<li><strong>Cijena.</strong> Glavne funkcije Cosma besplatne su i bez ograničenja broja projekata. Besplatni Todoist ograničen je na 5 projekata, a prikaz kalendara se plaća.</li>
<li><strong>Isprobavanje bez trenja.</strong> <a href="/hr/">Cosmo demo</a> otvara se bez računa, ispunjen s 12 mjeseci realističnih podataka, pa ga u dvije minute možete procijeniti pod opterećenjem.</li>
</ul>

<h2 id="profils">Koji alat za koji profil?</h2>
<h3>Zapisujete jako mnogo zadataka, posvuda, stalno</h3>
<p><strong>Todoist.</strong> Munjeviti unos i izvorne aplikacije stvoreni su upravo za to.</p>
<h3>Uz upravljanje zadacima želite graditi i navike</h3>
<p><strong>Cosmo.</strong> To je strukturna razlika: navike su ovdje stup, a ne zaobilazno rješenje.</p>
<h3>Dane planirate time-blockingom</h3>
<p><strong>Cosmo</strong>, osim ako vam već odgovara tijek rada Todoist plus Google kalendar.</p>
<h3>Postavljate tromjesečne ciljeve, osobne ili poslovne</h3>
<p><strong>Cosmo.</strong> Todoist taj element jednostavno nema.</p>
<h3>Cijeli tim mora surađivati na projektima</h3>
<p><strong>Todoist</strong> za intenzivnu suradnju i integracije. Cosmo je dovoljan za dijeljenje zadataka između dvije ili tri osobe, a ide dalje čim su u igri zajednički ciljevi, kao što pokazuje stranica <a href="/hr/za-timove">Cosmo za timove</a>.</p>

<h2 id="migration">Prelazak s Todoista na Cosmo</h2>
<p>Automatski uvoz zasad ne postoji, ali to je prilika za čišćenje: prenesite samo zadatke koji su stvarno aktivni (rijetko više od 20), ponovno stvorite projekte kao obojene kategorije, a zatim dodajte ono što Todoist nije nosio: dvije ili tri navike i prvi tromjesečni OKR. <a href="/hr/guide">Korisnički vodič</a> pokriva cijelo postavljanje u deset minuta. Ako radite za sebe, stranica <a href="/hr/za-freelancere">Cosmo za freelancere</a> pokazuje isti tijek primijenjen na portfelj klijenata.</p>

<h2 id="conclusion">Zaključak</h2>
<p>Todoist je izvrstan alat i, ako vam potrebe završavaju na zadacima, zadržite ga. No ako vaš sustav izgleda kao „lista obaveza plus aplikacija za navike plus kalendar plus tablica s ciljevima“, pravo pitanje nije koja je lista obaveza najbolja, nego kako prestati plaćati trenje između četiri alata. Upravo je to Cosmova oklada, a provjeriti je možete u dvije minute, <a href="/hr/signup">besplatno i bez kreditne kartice</a>.</p>
`,
    },
  },
};
