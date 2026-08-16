// Pages use-case (landing commerciales) — contenu partagé entre React
// (UseCasePage) et prerender.mjs. ESM pur, aucun import.
export const USE_CASES = [
  {
    slug: 'pour-freelances',
    audience: 'freelances',
    title: "L'application de productivité pensée pour les freelances",
    metaTitle: 'App de productivité freelance : tâches et objectifs',
    description:
      'Freelance : gérez clients, deadlines, prospection et objectifs trimestriels dans une seule app gratuite. Time-blocking natif, démo sans inscription.',
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
  {
    slug: 'pour-etudiants',
    audience: 'étudiants',
    title: "L'application de productivité gratuite pour les étudiants",
    metaTitle: 'App de productivité étudiant : révisions et deadlines',
    description:
      "Étudiant : organisez cours, révisions et deadlines avec le time-blocking, construisez des habitudes de travail durables. 100 % gratuit, sans carte bancaire.",
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
  {
    slug: 'pour-managers',
    audience: 'managers',
    title: "L'application de productivité pour managers et chefs d'équipe",
    metaTitle: 'App de productivité manager : OKR et priorités',
    description:
      "Manager : pilotez vos OKR, protégez votre temps de travail profond entre les réunions et suivez les tâches partagées avec votre équipe. Gratuit.",
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
  {
    slug: 'pour-equipes',
    audience: 'équipes',
    title: "L'application de gestion d'équipe pour les PME et les studios",
    metaTitle: "App de gestion d'équipe : projets, OKR et pilotage",
    description:
      "Organigramme automatique, projets d'équipe, OKR pondérés et statistiques de pilotage dans une seule app. Gratuit jusqu'à 5 personnes, démo sans inscription.",
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
];

export const getUseCase = (slug) => USE_CASES.find((u) => u.slug === slug);
