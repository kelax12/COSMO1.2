// Pages cas d'usage (landing commerciales), contenu partagé entre React
// (UseCasePage) et prerender.mjs. ESM pur, aucun import.
//
// ⚠️ Le registre est keyé par `routeId`, PAS par slug. Il l'était par slug
// français, et c'est ce qui faisait redirriger les quatre pages anglaises vers
// l'accueil : sous `en`, App.tsx déclare la route `for-freelancers`, que
// `getUseCase()` ne trouvait pas. La table des slugs reste src/i18n/
// route-slugs.json, seule et unique : la recopier ici rouvrirait la
// possibilité qu'une URL servie diverge de l'URL déclarée canonique.
//
// `locales` porte tout ce qui se traduit. Une locale absente ici est une
// locale que le prérendu ne publiera pas pour cette page (cf. prerender.mjs,
// `availableLocales`) : impossible de sortir une page anglaise au corps
// français.
export const USE_CASES = [
  {
    routeId: "freelancers",
    // `lastmod` du sitemap : à bouger quand la copie de cette page change.
    dateModified: "2026-08-16",
    locales: {
      fr: {
        audience: "freelances",
        title: "L'application de productivité pensée pour les freelances",
        metaTitle: "App de productivité freelance : tâches et objectifs",
        description: "Freelance : gérez clients, deadlines, prospection et objectifs trimestriels dans une seule app gratuite. Time-blocking natif, démo sans inscription.",
        lead: "Être freelance, c'est porter tous les rôles à la fois : la production, la prospection, l'administratif, la stratégie. Votre outil d'organisation doit suivre, sans vous coûter un abonnement de plus.",
        html: `
<h2>Le problème du freelance organisé</h2>
<p>Vous avez probablement déjà un système : une todo-list pour les livrables, un agenda pour les rendez-vous clients, peut-être un tableur pour vos objectifs de chiffre d'affaires… et une résolution abandonnée de prospecter « plus régulièrement ». Quatre outils, zéro vision d'ensemble, et la prospection, seule garante de votre pipeline dans trois mois, passe toujours après l'urgence du jour.</p>
<h2>Ce que Cosmo change, concrètement</h2>
<ul>
<li><strong>Une catégorie par client.</strong> Chaque tâche porte la couleur de son client ; les statistiques vous montrent ensuite où part réellement votre temps, ce qui réserve souvent une surprise, et la base d'une meilleure tarification.</li>
<li><strong>Le time-blocking protège la production.</strong> Glissez vos tâches dans l'agenda pour réserver vos blocs de travail facturable, et découvrez ce qui tient vraiment dans une semaine avant de dire oui au prochain projet.</li>
<li><strong>La prospection devient une habitude, pas une résolution.</strong> « 3 prises de contact par semaine » suivie avec heatmap et streak : la régularité qui remplit le pipeline se construit comme une habitude sportive.</li>
<li><strong>Des OKR trimestriels pour piloter l'activité.</strong> « Atteindre X € de CA récurrent », « signer 2 clients dans le nouveau créneau » : vos objectifs de gérant vivent à côté de vos tâches de producteur, et la progression se calcule seule.</li>
</ul>
<h2>Une semaine type, organisée dans Cosmo</h2>
<p>Le lundi matin, quinze minutes suffisent : vous passez en revue les livrables de la semaine, vous leur donnez une priorité de 1 à 5, puis vous les glissez dans l'agenda. Ce dernier geste est le plus important, c'est lui qui vous dit, avant de vous engager auprès d'un client, si la semaine tient réellement. Un vendredi de livraison qui compte déjà onze heures de travail bloqué n'accueillera pas la « petite retouche urgente » sans casser autre chose.</p>
<p>En cours de semaine, les demandes entrantes deviennent des tâches datées plutôt que des messages qu'on garde en tête. Le vendredi, la revue prend un quart d'heure : ce qui a été livré, où est parti le temps par client, et où en sont vos objectifs du trimestre. C'est aussi le moment où la <a href="/blog/tableau-de-bord-productivite">lecture du tableau de bord</a> vous évite de découvrir en fin de trimestre que la prospection n'a jamais eu lieu.</p>

<h2>Le piège de la facturation au forfait</h2>
<p>La plupart des freelances sous-estiment leurs projets au forfait, non par manque d'expérience mais par absence de données : sans mesure du temps réellement passé, on tarifie sur une impression, et l'impression oublie systématiquement les allers-retours, les réunions de cadrage et les reprises. Une catégorie par client, plus quelques semaines de time-blocking, suffisent à révéler l'écart entre le temps facturé et le temps vécu. C'est souvent la donnée qui justifie la première vraie augmentation de tarif, et elle se lit dans les statistiques, pas dans un tableur tenu à la main.</p>

<h2>Et la partie « chef d'entreprise » ?</h2>
<p>C'est celle qui saute en premier quand la production déborde, alors qu'elle décide de votre activité dans six mois. Deux leviers concrets : une <strong>habitude de prospection</strong> (« 3 prises de contact par semaine ») qui se suit avec une heatmap plutôt qu'avec de la bonne volonté, et des <a href="/blog/methode-okr-exemples">OKR trimestriels</a> qui écrivent noir sur blanc ce que vous visez, chiffre d'affaires récurrent, diversification, montée en gamme. Le simple fait qu'ils soient visibles sur le même écran que vos tâches du jour change la façon dont vous arbitrez.</p>

<h2>Pourquoi gratuit ?</h2>
<p>Les fonctionnalités principales de Cosmo sont gratuites, sans limite de projets ni de clients. Pour un indépendant, c'est un poste de dépense en moins, et la <a href="/">démo s'essaie sans créer de compte</a>, avec 12 mois de données réalistes pour juger sur pièce en deux minutes. Si vous partez d'un système éclaté entre trois outils, l'article sur la <a href="/blog/gestion-du-temps-efficace">gestion du temps efficace</a> décrit l'ordre dans lequel les regrouper sans tout casser.</p>`,
      },
      en: {
        audience: "freelancers",
        title: "The productivity app built for freelancers",
        metaTitle: "Freelance productivity app: tasks and goals",
        description: "Freelancing: manage clients, deadlines, prospecting and quarterly goals in one free app. Native time-blocking, demo with no sign-up.",
        lead: "Being freelance means carrying every role at once: delivery, prospecting, admin, strategy. Your organisation tool has to keep up, without costing you another subscription.",
        html: `
<h2>The organised freelancer's problem</h2>
<p>You probably already have a system: a to-do list for deliverables, a calendar for client meetings, perhaps a spreadsheet for revenue goals, and an abandoned resolution to prospect "more regularly". Four tools, no overall view, and prospecting, the only guarantee of a pipeline in three months, always comes after today's emergency.</p>
<h2>What Cosmo changes, concretely</h2>
<ul>
<li><strong>One category per client.</strong> Every task carries its client's colour, and the statistics then show you where your time actually goes, which is often a surprise, and the basis for better pricing.</li>
<li><strong>Time-blocking protects delivery.</strong> Drag your tasks into the calendar to reserve your billable working blocks, and find out what genuinely fits in a week before saying yes to the next project.</li>
<li><strong>Prospecting becomes a habit, not a resolution.</strong> "3 outreach contacts a week", tracked with a heatmap and a streak: the consistency that fills a pipeline gets built like a training habit.</li>
<li><strong>Quarterly OKRs to steer the business.</strong> "Reach X in recurring revenue", "sign 2 clients in the new segment": your goals as a business owner live next to your tasks as a producer, and progress computes itself.</li>
</ul>
<h2>A typical week, organised in Cosmo</h2>
<p>On Monday morning, fifteen minutes is enough: you review the week's deliverables, give them a priority from 1 to 5, then drag them into the calendar. That last move is the most important one, because it tells you, before you commit to a client, whether the week genuinely holds. A Friday delivery day that already counts eleven hours of blocked work will not absorb the "small urgent tweak" without breaking something else.</p>
<p>During the week, incoming requests become dated tasks rather than messages you keep in your head. On Friday the review takes a quarter of an hour: what was delivered, where the time went per client, and where your quarterly goals stand. It is also the moment when <a href="/en/blog/tableau-de-bord-productivite">reading the dashboard</a> saves you from discovering at the end of the quarter that prospecting never happened.</p>

<h2>The fixed-price trap</h2>
<p>Most freelancers underestimate fixed-price projects, not through lack of experience but through lack of data: with no measure of the time actually spent, you price on an impression, and the impression systematically forgets the back and forth, the scoping calls and the reworks. One category per client, plus a few weeks of time-blocking, is enough to reveal the gap between billed time and lived time. It is often the data that justifies the first real rate increase, and it is read in the statistics, not in a hand-kept spreadsheet.</p>

<h2>What about the "business owner" side?</h2>
<p>It is the part that goes first when delivery overflows, even though it decides what your business looks like in six months. Two concrete levers: a <strong>prospecting habit</strong> ("3 outreach contacts a week") tracked with a heatmap rather than with good intentions, and <a href="/en/blog/methode-okr-exemples">quarterly OKRs</a> that write down in black and white what you are aiming at, recurring revenue, diversification, moving upmarket. The mere fact that they are visible on the same screen as today's tasks changes how you make trade-offs.</p>

<h2>Why free?</h2>
<p>Cosmo's main features are free, with no limit on projects or clients. For someone self-employed that is one expense line fewer, and the <a href="/en/">demo can be tried without creating an account</a>, with 12 months of realistic data so you can judge it in two minutes. If you are starting from a system split across three tools, the article on <a href="/en/blog/gestion-du-temps-efficace">effective time management</a> describes the order in which to consolidate them without breaking everything.</p>`,
      },
    },
  },
  {
    routeId: "students",
    // `lastmod` du sitemap : à bouger quand la copie de cette page change.
    dateModified: "2026-08-16",
    locales: {
      fr: {
        audience: "étudiants",
        title: "L'application de productivité gratuite pour les étudiants",
        metaTitle: "App de productivité étudiant : révisions et deadlines",
        description: "Étudiant : organisez cours, révisions et deadlines avec le time-blocking, construisez des habitudes de travail durables. 100 % gratuit, sans carte bancaire.",
        lead: "Entre les cours, les partiels, les projets de groupe et un job à côté, le problème n'est pas le manque de motivation, c'est l'absence de système. Et un budget étudiant n'a pas de place pour un abonnement productivité.",
        html: `
<h2>Le semestre type, sans système</h2>
<p>Tout va bien jusqu'à mi-octobre. Puis les deadlines s'empilent, les révisions se compressent dans les dix derniers jours, et chaque partiel se prépare dans l'urgence. Le problème n'est pas l'intelligence ni la volonté : c'est qu'un semestre est un projet de 4 mois géré sans plan.</p>
<h2>Le système Cosmo pour un semestre</h2>
<ul>
<li><strong>Une catégorie par matière.</strong> Chaque cours a sa couleur ; les deadlines (rendus, exposés, partiels) deviennent des tâches datées et priorisées de 1 à 5, fini le post-it mental permanent.</li>
<li><strong>Le time-blocking rend les révisions réelles.</strong> « Réviser la macro » n'existe pas tant que ce n'est pas un créneau de 2 h mardi à 14 h. Glissez vos tâches de révision dans l'agenda : la semaine se remplit, le retard devient visible avant qu'il ne soit critique.</li>
<li><strong>Les habitudes portent le long terme.</strong> 30 minutes d'anglais, relire ses notes le soir même, 3 séances de sport : la heatmap 26 semaines, soit la durée exacte d'un semestre, montre votre régularité mieux que n'importe quelle bonne intention.</li>
<li><strong>Un OKR par semestre.</strong> « Valider le semestre proprement » avec des résultats clés mesurables (moyenne cible, zéro rattrapage, mémoire rendu en avance) : vous savez en semaine 6 si vous êtes sur la trajectoire, pas en semaine 15.</li>
</ul>
<h2>Organiser une semaine de cours</h2>
<p>Le dimanche soir, dix minutes : vous listez ce qui doit avancer cette semaine (un TD, un chapitre à revoir, un dossier de groupe), vous datez, puis vous placez les créneaux de travail dans l'agenda entre les cours. L'intérêt n'est pas la beauté du planning, c'est de constater tout de suite qu'il reste six heures libres, pas quinze. Mieux vaut le savoir dimanche que jeudi soir.</p>
<p>Le reste de la semaine, vous cochez. Et à la fin, vous regardez deux choses : ce qui a été fait, et ce que vous aviez planifié sans le faire. Ce second chiffre est le plus instructif, il vous apprend, en trois ou quatre semaines, combien d'heures de travail personnel vous tenez réellement. Toute la planification suivante devient réaliste à partir de là.</p>

<h2>Préparer un partiel sans tout compresser</h2>
<p>La révision de dernière minute échoue pour une raison mécanique : la mémoire a besoin de répétitions espacées, pas d'une longue session. Concrètement, un partiel dans cinq semaines se prépare en plaçant dès maintenant des créneaux de révision courts et récurrents, une matière par créneau : le <a href="/blog/time-blocking-guide">time-blocking</a> sert exactement à ça. La différence avec « je réviserai régulièrement » est qu'un créneau existe dans l'agenda et se défend contre les sollicitations, alors qu'une intention n'existe nulle part.</p>
<p>Pour les projets de groupe, le partage de tâches évite le fil de discussion où personne ne sait qui fait quoi : une tâche, un responsable, une échéance visible par tous. C'est gratuit, et ça n'impose à personne de créer un compte sur un outil de plus.</p>

<h2>Les habitudes qui font la différence sur un semestre</h2>
<p>Un semestre est un projet de quatre mois, et ce sont les comportements répétés qui l'emportent sur les coups d'accélérateur. Relire ses notes le soir même du cours, trente minutes de langue, deux ou trois séances de sport : ces routines pèsent plus lourd sur la moyenne finale qu'une semaine de bachotage. La heatmap sur 26 semaines, soit la durée exacte d'un semestre, montre votre régularité réelle, et le <a href="/blog/suivi-des-habitudes">taux de complétion</a> vous dit en semaine 4 si une habitude était trop ambitieuse, pendant qu'il est encore temps de la réduire.</p>

<h2>Vraiment gratuit, vraiment sans friction</h2>
<p>Pas de carte bancaire, pas d'essai de 14 jours : les fonctionnalités principales sont gratuites, point. Cosmo fonctionne dans le navigateur de votre téléphone comme sur l'ordi de la BU, sans installation. <a href="/">Testez la démo sans inscription</a>, deux minutes suffisent pour voir si le système vous parle.</p>`,
      },
      en: {
        audience: "students",
        title: "The free productivity app for students",
        metaTitle: "Student productivity app: revision and deadlines",
        description: "Students: organise lectures, revision and deadlines with time-blocking, and build working habits that last. 100 % free, no credit card.",
        lead: "Between lectures, exams, group projects and a job on the side, the problem is not a lack of motivation, it is the absence of a system. And a student budget has no room for a productivity subscription.",
        html: `
<h2>A typical semester, with no system</h2>
<p>Everything is fine until mid-October. Then the deadlines pile up, revision gets compressed into the last ten days, and every exam is prepared in a rush. The problem is neither intelligence nor willpower: it is that a semester is a four-month project run without a plan.</p>
<h2>The Cosmo system for a semester</h2>
<ul>
<li><strong>One category per subject.</strong> Each course has its colour, and deadlines (essays, presentations, exams) become dated tasks prioritised from 1 to 5. No more permanent mental sticky note.</li>
<li><strong>Time-blocking makes revision real.</strong> "Revise macroeconomics" does not exist until it is a 2-hour slot on Tuesday at 2 pm. Drag your revision tasks into the calendar: the week fills up, and falling behind becomes visible before it turns critical.</li>
<li><strong>Habits carry the long term.</strong> Thirty minutes of English, rereading your notes the same evening, 3 training sessions: the 26-week heatmap, exactly the length of a semester, shows your consistency better than any good intention.</li>
<li><strong>One OKR per semester.</strong> "Pass the semester properly", with measurable key results (a target average, zero resits, dissertation handed in early): you know in week 6 whether you are on trajectory, not in week 15.</li>
</ul>
<h2>Organising a week of lectures</h2>
<p>On Sunday evening, ten minutes: you list what has to move this week (a problem set, a chapter to review, a group report), you date it, then you place the working slots in the calendar between lectures. The point is not a beautiful timetable, it is realising straight away that you have six free hours left, not fifteen. Better to know that on Sunday than on Thursday night.</p>
<p>The rest of the week, you tick things off. And at the end you look at two things: what got done, and what you had planned without doing. That second number is the more instructive one, because in three or four weeks it teaches you how many hours of personal study you actually sustain. All subsequent planning becomes realistic from there.</p>

<h2>Preparing for an exam without cramming everything</h2>
<p>Last-minute revision fails for a mechanical reason: memory needs spaced repetition, not one long session. Concretely, an exam five weeks away is prepared by placing short recurring revision slots starting now, one subject per slot: that is exactly what <a href="/en/blog/time-blocking-guide">time-blocking</a> is for. The difference from "I will revise regularly" is that a slot exists in the calendar and defends itself against other demands, whereas an intention exists nowhere.</p>
<p>For group projects, task sharing avoids the chat thread where nobody knows who is doing what: one task, one owner, one deadline visible to everyone. It is free, and it does not force anybody to create an account on yet another tool.</p>

<h2>The habits that make the difference over a semester</h2>
<p>A semester is a four-month project, and repeated behaviours beat bursts of speed. Rereading your notes the evening of the lecture, thirty minutes of a language, two or three training sessions: these routines weigh more on the final average than a week of cramming. The 26-week heatmap, exactly the length of a semester, shows your real consistency, and the <a href="/en/blog/suivi-des-habitudes">completion rate</a> tells you in week 4 whether a habit was too ambitious, while there is still time to shrink it.</p>

<h2>Genuinely free, genuinely frictionless</h2>
<p>No credit card, no 14-day trial: the main features are free, full stop. Cosmo runs in your phone's browser as well as on a library computer, with nothing to install. <a href="/en/">Try the demo without signing up</a>, two minutes is enough to see whether the system speaks to you.</p>`,
      },
    },
  },
  {
    routeId: "managers",
    // `lastmod` du sitemap : à bouger quand la copie de cette page change.
    dateModified: "2026-08-16",
    locales: {
      fr: {
        audience: "managers",
        title: "L'application de productivité pour managers et chefs d'équipe",
        metaTitle: "App de productivité manager : OKR et priorités",
        description: "Manager : pilotez vos OKR, protégez votre temps de travail profond entre les réunions et suivez les tâches partagées avec votre équipe. Gratuit.",
        lead: "Le paradoxe du manager : plus vous êtes sollicité, moins il reste de temps pour le travail qui justifie votre poste : la stratégie, les décisions, les gens. Reprendre ce temps est un problème d'outillage autant que de discipline.",
        html: `
<h2>L'agenda d'un manager est un champ de bataille</h2>
<p>Des réunions posées par d'autres, des sollicitations continues, et en fin de semaine cette question : « qu'ai-je vraiment fait avancer ? ». Les objectifs annuels de l'équipe, eux, vivent dans un slide revu deux fois par an. Ce n'est pas un défaut personnel, c'est ce qui arrive quand l'important n'a pas d'outil face à l'urgent.</p>
<h2>Ce que Cosmo apporte à un manager</h2>
<ul>
<li><strong>Les OKR sortent du slide.</strong> Objectifs du trimestre et résultats clés mesurables, progression calculée automatiquement, graphique d'avancement sur le dashboard : le point OKR du lundi se prépare en 5 minutes, avec des chiffres réels.</li>
<li><strong>Le time-blocking défend votre travail profond.</strong> Bloquez vos créneaux de réflexion avant que les réunions ne dévorent la semaine, un agenda déjà occupé par vos priorités est votre meilleure ligne de défense.</li>
<li><strong>Le partage de tâches, sans usine à gaz.</strong> Partagez une tâche avec un collaborateur en rôle Lecteur ou Éditeur, suivez l'avancement depuis votre dashboard, discutez dans le contexte de la tâche, sans déployer un outil de gestion de projet de plus.</li>
<li><strong>Les statistiques révèlent votre vraie semaine.</strong> Temps passé par catégorie (réunions, 1:1, production, stratégie) : la donnée qui manque à chaque conversation sur « la charge ».</li>
</ul>
<h2>Reprendre le contrôle de sa semaine</h2>
<p>Un agenda de manager se remplit par défaut : si vous ne posez rien, d'autres le font. La contre-mesure est simple et impopulaire : bloquer d'abord vos créneaux de travail non interruptible, avant que la semaine ne se remplisse, et les traiter comme des rendez-vous réels. Deux blocs de deux heures protégés valent mieux que dix intentions dispersées entre deux réunions.</p>
<p>Le second levier est la revue hebdomadaire : vingt minutes le vendredi pour regarder ce qui a avancé, où est parti le temps par catégorie, et où en sont les objectifs. C'est court, et c'est ce qui vous évite d'arriver au point trimestriel en reconstituant l'histoire de mémoire. Le <a href="/blog/tableau-de-bord-productivite">tableau de bord</a> fournit les chiffres sans ressaisie.</p>

<h2>Faire vivre les OKR entre deux revues</h2>
<p>Le problème des OKR en entreprise n'est presque jamais leur formulation, c'est qu'ils sont rédigés en début de trimestre puis rouverts la veille de la revue. Entre les deux, les décisions quotidiennes se prennent sans eux, et l'écart se découvre trop tard pour être corrigé.</p>
<p>Y remédier demande une seule chose : que les objectifs soient visibles au même endroit que les tâches. Quand la progression de chaque résultat clé se met à jour au fil de l'eau et s'affiche sur le dashboard, le point du lundi se prépare en cinq minutes avec des chiffres réels, et un objectif en dérive se repère à mi-parcours, au moment où il est encore possible d'arbitrer entre accélérer et renoncer explicitement. Si la méthode est nouvelle pour votre équipe, l'article <a href="/blog/okr-vs-smart-vs-kpi">OKR, SMART ou KPI</a> clarifie ce que chaque cadre sait faire et ne sait pas faire.</p>

<h2>Suivre l'équipe sans surveiller</h2>
<p>Le partage de tâches en rôle Lecteur ou Éditeur donne la visibilité nécessaire sans transformer l'outil en dispositif de contrôle : vous voyez l'avancement de ce qui a été explicitement partagé, pas l'activité de chacun. La distinction compte, un outil vécu comme une surveillance est renseigné a minima, et cesse rapidement d'être fiable. Cette collaboration est gratuite chez Cosmo, ce qui évite d'avoir à justifier des licences pour tester une méthode sur un trimestre.</p>

<h2>Commencez par vous</h2>
<p>Le meilleur argument pour diffuser une méthode à son équipe, c'est de l'incarner un trimestre. <a href="/">Essayez la démo sans inscription</a>, posez vos OKR du trimestre en 15 minutes, et jugez sur vos propres résultats, c'est gratuit. Quand la méthode est validée et que vous voulez embarquer tout le monde, le <a href="/pour-equipes">mode entreprise</a> prend le relais : organigramme, projets d'équipe et statistiques de pilotage.</p>`,
      },
      en: {
        audience: "managers",
        title: "The productivity app for managers and team leads",
        metaTitle: "Manager productivity app: OKRs and priorities",
        description: "Managers: steer your OKRs, protect your deep-work time between meetings and follow the tasks shared with your team. Free.",
        lead: "The manager's paradox: the more people need you, the less time is left for the work that justifies the role, namely strategy, decisions and people. Getting that time back is a tooling problem as much as a discipline one.",
        html: `
<h2>A manager's calendar is a battlefield</h2>
<p>Meetings booked by other people, continuous demands, and at the end of the week that question: "what did I actually move forward?". The team's annual goals, meanwhile, live in a slide reviewed twice a year. That is not a personal failing, it is what happens when the important has no tool to face the urgent.</p>
<h2>What Cosmo brings a manager</h2>
<ul>
<li><strong>OKRs come out of the slide deck.</strong> Quarterly objectives and measurable key results, progress computed automatically, a progress chart on the dashboard: the Monday OKR check-in gets prepared in 5 minutes, with real numbers.</li>
<li><strong>Time-blocking defends your deep work.</strong> Block your thinking slots before meetings devour the week, because a calendar already occupied by your priorities is your best line of defence.</li>
<li><strong>Task sharing, without the machinery.</strong> Share a task with a colleague as Viewer or Editor, follow progress from your dashboard, discuss in the context of the task, without deploying yet another project-management tool.</li>
<li><strong>Statistics reveal your real week.</strong> Time spent per category (meetings, one-to-ones, delivery, strategy): the data missing from every conversation about workload.</li>
</ul>
<h2>Taking back control of your week</h2>
<p>A manager's calendar fills itself by default: if you put nothing in it, other people will. The countermeasure is simple and unpopular: block your uninterruptible working slots first, before the week fills up, and treat them as real appointments. Two protected two-hour blocks beat ten intentions scattered between meetings.</p>
<p>The second lever is the weekly review: twenty minutes on Friday to look at what moved, where the time went by category, and where the goals stand. It is short, and it is what saves you from arriving at the quarterly check-in reconstructing the story from memory. The <a href="/en/blog/tableau-de-bord-productivite">dashboard</a> supplies the numbers with no re-entry.</p>

<h2>Keeping OKRs alive between reviews</h2>
<p>The problem with OKRs in companies is almost never how they are worded, it is that they are written at the start of the quarter and reopened the day before the review. In between, daily decisions get made without them, and the gap is discovered too late to correct.</p>
<p>Fixing that takes one thing: the goals have to be visible in the same place as the tasks. When each key result's progress updates as you go and shows on the dashboard, the Monday check-in gets prepared in five minutes with real numbers, and a drifting objective is spotted halfway through, while it is still possible to choose between accelerating and giving up explicitly. If the method is new to your team, the article <a href="/en/blog/okr-vs-smart-vs-kpi">OKRs vs SMART vs KPIs</a> clarifies what each framework can and cannot do.</p>

<h2>Following the team without watching over them</h2>
<p>Task sharing as Viewer or Editor gives the visibility you need without turning the tool into a surveillance device: you see the progress of what has been explicitly shared, not everybody's activity. The distinction matters, because a tool experienced as monitoring gets filled in as little as possible, and quickly stops being reliable. This collaboration is free in Cosmo, which spares you having to justify licences to test a method for a quarter.</p>

<h2>Start with yourself</h2>
<p>The best argument for spreading a method to your team is to embody it for a quarter. <a href="/en/">Try the demo without signing up</a>, set your quarterly OKRs in 15 minutes, and judge on your own results, for free. Once the method is proven and you want to bring everybody on board, <a href="/en/for-teams">company mode</a> takes over: org chart, team projects and steering statistics.</p>`,
      },
    },
  },
  {
    routeId: "teams",
    // `lastmod` du sitemap : à bouger quand la copie de cette page change.
    dateModified: "2026-08-16",
    locales: {
      fr: {
        audience: "équipes",
        title: "L'application de gestion d'équipe pour les PME et les studios",
        metaTitle: "App de gestion d'équipe : projets, OKR et pilotage",
        description: "Organigramme automatique, projets d'équipe, OKR pondérés et statistiques de pilotage dans une seule app. Gratuit jusqu'à 5 personnes, démo sans inscription.",
        lead: "Dans la plupart des équipes, le travail vit dans un outil et le pilotage dans un autre : les tâches d'un côté, un tableur d'objectifs et un organigramme oublié de l'autre. Cosmo réunit les deux, sans imposer un déploiement de six mois.",
        html: `
<h2>Deux outils, deux vérités</h2>
<p>Le scénario est presque toujours le même. Chacun gère ses tâches dans son coin : une app perso, un carnet, une liste dans la messagerie. L'équipe, elle, a un outil de gestion de projet où l'on note ce qui doit être partagé. Résultat : personne n'a sa journée complète sur un seul écran, et le manager reconstitue l'état d'avancement en posant la question à cinq personnes.</p>
<p>Le coût de cette double saisie ne se voit pas dans un budget, mais il se paie tous les jours : des tâches oubliées parce qu'elles étaient dans l'autre outil, un point hebdomadaire qui sert à collecter de l'information plutôt qu'à décider, et des objectifs trimestriels qui vivent dans un slide revu deux fois par an.</p>
<h2>Ce que Cosmo apporte à une équipe</h2>
<ul>
<li><strong>Un organigramme qui se dessine tout seul.</strong> Chaque personne est rattachée à un responsable au moment de son arrivée, et la structure se construit d'elle-même. Pas de fiche RH à remplir, pas de tableau à tenir à jour, et c'est cette même structure qui détermine ensuite qui voit quoi.</li>
<li><strong>Les tâches d'équipe arrivent dans la to-do de chacun.</strong> Une tâche assignée depuis le tableau de l'équipe apparaît directement dans la liste personnelle de la personne concernée. Une seule app à ouvrir le matin, pas deux.</li>
<li><strong>Des OKR d'équipe qui ne mentent pas.</strong> Chaque résultat clé porte un poids : trois objectifs faciles atteints ne font plus passer un trimestre pour réussi quand le quatrième, le seul qui comptait, n'a pas bougé.</li>
<li><strong>Le pilotage sans reporting à préparer.</strong> Charge par personne, taux de complétion, vélocité hebdomadaire, retards, avancement des objectifs : les chiffres sont là en permanence, et s'exportent quand il faut les présenter ailleurs.</li>
</ul>
<h2>L'organigramme sert enfin à quelque chose</h2>
<p>Dans la plupart des outils, l'organigramme est une image : joli sur l'intranet, sans effet sur le travail réel. Ici, il est le mécanisme central. Rattacher quelqu'un à un responsable ouvre à ce dernier ce qu'il lui faut pour l'accompagner (la charge de la personne, ses tâches en retard, son planning), et rien d'autre. Un responsable intermédiaire voit son périmètre, jamais celui du voisin, sans qu'aucune permission n'ait été configurée à la main.</p>
<p>À côté de cette ligne hiérarchique, des équipes transverses regroupent les gens par projet ou par pôle, indépendamment de qui reporte à qui. C'est ce qui permet à un chef de projet de piloter un chantier avec des personnes qui ne sont pas dans son équipe, sans dupliquer l'organisation ni créer un espace de travail par département.</p>
<h2>Voir le planning de son équipe sans le demander</h2>
<p>« Tu es dispo jeudi ? » reste l'une des questions les plus coûteuses d'une semaine de travail, surtout à distance. Un responsable accède directement à l'agenda de son équipe et y cale ce qui doit l'être, sans aller-retour. Le contenu des évènements marqués comme personnels reste privé : seul le créneau apparaît. Cette limite n'est pas un détail, un outil vécu comme une surveillance est renseigné a minima, et cesse très vite d'être fiable.</p>
<h2>La revue du lundi, préparée avant la réunion</h2>
<p>Un parcours guidé reprend ce qui s'est passé la semaine écoulée (ce qui a avancé, ce qui a glissé, qui est surchargé) et se termine par des décisions à prendre plutôt que par un tableau à interpréter. Trois minutes seul devant l'écran remplacent une bonne partie de la demi-heure passée à collecter l'information en réunion. Le temps récupéré ne disparaît pas : il retourne à la conversation qui justifiait la réunion au départ.</p>
<p>Pour les objectifs, le principe est le même que pour les tâches : ils ne survivent que s'ils sont visibles au même endroit que le travail quotidien. Si la méthode est nouvelle pour votre équipe, l'article <a href="/blog/okr-vs-smart-vs-kpi">OKR, SMART ou KPI</a> clarifie ce que chaque cadre sait faire, et le <a href="/blog/template-okr-gratuit">modèle d'OKR gratuit</a> donne une base à adapter.</p>
<h2>Suivre l'équipe sans la surveiller</h2>
<p>La séparation entre ce qui est partagé et ce qui reste privé est posée dans le produit, pas laissée à la bonne volonté de chacun. Les projets rattachés à une équipe restent invisibles aux autres, le contenu des agendas personnels ne remonte jamais, et chaque personne qui rejoint une organisation voit, avant de valider, ce que celle-ci pourra observer de son travail. Le cloisonnement est appliqué au niveau des données elles-mêmes : ce n'est pas l'affichage qui masque, c'est l'accès qui est refusé.</p>
<h2>Gratuit jusqu'à cinq personnes</h2>
<p>Une équipe de moins de cinq personnes utilise le mode entreprise gratuitement, sans fonctionnalité bridée ni période d'essai à surveiller : l'organigramme, les projets, les OKR et les statistiques sont tous inclus. C'est assez pour qu'une équipe fondatrice, un pôle ou un premier projet pilote juge sur pièce avant d'embarquer le reste de l'entreprise.</p>
<p><a href="/">La démo s'essaie sans créer de compte</a> : une organisation fictive de six personnes, avec ses projets, ses objectifs et son organigramme déjà remplis, pour se faire une idée en deux minutes. Si vous êtes seul responsable pour l'instant, la page <a href="/pour-managers">pour les managers</a> décrit le même produit du point de vue individuel.</p>`,
      },
      en: {
        audience: "teams",
        title: "The team management app for small companies and studios",
        metaTitle: "Team management app: projects, OKRs and steering",
        description: "An org chart that draws itself, team projects, weighted OKRs and steering statistics in one app. Free up to 5 people, demo with no sign-up.",
        lead: "In most teams the work lives in one tool and the steering in another: tasks on one side, a goals spreadsheet and a forgotten org chart on the other. Cosmo brings the two together, without imposing a six-month rollout.",
        html: `
<h2>Two tools, two versions of the truth</h2>
<p>The scenario is almost always the same. Everybody manages their own tasks in their own corner: a personal app, a notebook, a list in the messaging tool. The team, meanwhile, has a project-management tool where people record what has to be shared. The result: nobody has their full day on one screen, and the manager reconstructs the state of play by asking five people.</p>
<p>The cost of that double entry does not show up in a budget, but it is paid every day: tasks forgotten because they were in the other tool, a weekly meeting spent collecting information rather than deciding, and quarterly goals living in a slide reviewed twice a year.</p>
<h2>What Cosmo brings a team</h2>
<ul>
<li><strong>An org chart that draws itself.</strong> Each person is attached to a manager when they arrive, and the structure builds itself. No HR form to fill in, no table to keep up to date, and that same structure then determines who sees what.</li>
<li><strong>Team tasks land in each person's own to-do list.</strong> A task assigned from the team board appears directly in the personal list of the person concerned. One app to open in the morning, not two.</li>
<li><strong>Team OKRs that do not lie.</strong> Each key result carries a weight, so three easy objectives reached no longer make a quarter look successful when the fourth, the only one that mattered, has not moved.</li>
<li><strong>Steering with no reporting to prepare.</strong> Load per person, completion rate, weekly velocity, delays, goal progress: the numbers are there permanently, and export when they have to be presented elsewhere.</li>
</ul>
<h2>The org chart finally does something</h2>
<p>In most tools the org chart is a picture: nice on the intranet, with no effect on the actual work. Here it is the central mechanism. Attaching somebody to a manager gives that manager what they need to support them (the person's load, their overdue tasks, their schedule) and nothing else. A middle manager sees their own scope, never their neighbour's, without a single permission being configured by hand.</p>
<p>Alongside that reporting line, cross-functional teams group people by project or by area, independently of who reports to whom. That is what lets a project lead run a piece of work with people who are not in their team, without duplicating the organisation or creating one workspace per department.</p>
<h2>Seeing your team's schedule without asking</h2>
<p>"Are you free on Thursday?" is still one of the most expensive questions of a working week, especially remotely. A manager reaches their team's calendar directly and places what needs placing, with no back and forth. The content of events marked as personal stays private, only the slot appears. That limit is not a detail: a tool experienced as surveillance gets filled in as little as possible, and very quickly stops being reliable.</p>
<h2>The Monday review, prepared before the meeting</h2>
<p>A guided walkthrough goes back over the past week (what moved, what slipped, who is overloaded) and ends with decisions to take rather than a table to interpret. Three minutes alone in front of the screen replace a good part of the half hour spent collecting information in the meeting. The time recovered does not vanish: it goes back to the conversation that justified the meeting in the first place.</p>
<p>For goals the principle is the same as for tasks: they only survive if they are visible in the same place as the daily work. If the method is new to your team, the article <a href="/en/blog/okr-vs-smart-vs-kpi">OKRs vs SMART vs KPIs</a> clarifies what each framework can do, and the <a href="/en/blog/template-okr-gratuit">free OKR template</a> gives you a base to adapt.</p>
<h2>Following the team without watching over them</h2>
<p>The separation between what is shared and what stays private is built into the product, not left to everybody's goodwill. Projects attached to a team stay invisible to the others, the content of personal calendars never surfaces, and every person joining an organisation sees, before confirming, what it will be able to observe of their work. The separation is enforced at the level of the data itself: it is not the display that hides things, it is the access that is refused.</p>
<h2>Free up to five people</h2>
<p>A team of fewer than five people uses company mode for free, with no crippled features and no trial period to watch: the org chart, projects, OKRs and statistics are all included. That is enough for a founding team, a department or a first pilot project to judge on the evidence before bringing the rest of the company on board.</p>
<p><a href="/en/">The demo can be tried without creating an account</a>: a fictional organisation of six people, with its projects, goals and org chart already filled in, so you can form a view in two minutes. If you are the only manager for now, the <a href="/en/for-managers">for managers</a> page describes the same product from an individual point of view.</p>`,
      },
    },
  },
];

/** Fiche d'un cas d'usage par son identifiant de route (jamais par slug). */
export const getUseCase = (routeId) => USE_CASES.find((u) => u.routeId === routeId);
