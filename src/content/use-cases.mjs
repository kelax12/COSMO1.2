// Pages use-case (landing commerciales) — contenu partagé entre React
// (UseCasePage) et prerender.mjs. ESM pur, aucun import.
export const USE_CASES = [
  {
    slug: 'pour-freelances',
    audience: 'freelances',
    title: "L'application de productivité pensée pour les freelances",
    metaTitle: 'App de productivité pour freelance : tâches, temps, objectifs',
    description:
      'Freelance : gérez clients, deadlines, habitudes de prospection et objectifs trimestriels dans une seule app gratuite. Time-blocking natif, démo sans inscription.',
    lead: "Être freelance, c'est porter tous les rôles à la fois : la production, la prospection, l'administratif, la stratégie. Votre outil d'organisation doit suivre — sans vous coûter un abonnement de plus.",
    html: `
<h2>Le problème du freelance organisé</h2>
<p>Vous avez probablement déjà un système : une todo-list pour les livrables, un agenda pour les rendez-vous clients, peut-être un tableur pour vos objectifs de chiffre d'affaires… et une résolution abandonnée de prospecter « plus régulièrement ». Quatre outils, zéro vision d'ensemble — et la prospection, seule garante de votre pipeline dans trois mois, passe toujours après l'urgence du jour.</p>
<h2>Ce que Cosmo change, concrètement</h2>
<ul>
<li><strong>Une catégorie par client.</strong> Chaque tâche porte la couleur de son client ; les statistiques vous montrent ensuite où part réellement votre temps — souvent la vraie surprise, et la base d'une meilleure tarification.</li>
<li><strong>Le time-blocking protège la production.</strong> Glissez vos tâches dans l'agenda pour réserver vos blocs de travail facturable, et découvrez ce qui tient vraiment dans une semaine avant de dire oui au prochain projet.</li>
<li><strong>La prospection devient une habitude, pas une résolution.</strong> « 3 prises de contact par semaine » suivie avec heatmap et streak : la régularité qui remplit le pipeline se construit comme une habitude sportive.</li>
<li><strong>Des OKR trimestriels pour piloter l'activité.</strong> « Atteindre X € de CA récurrent », « signer 2 clients dans le nouveau créneau » : vos objectifs de gérant vivent à côté de vos tâches de producteur, et la progression se calcule seule.</li>
</ul>
<h2>Pourquoi gratuit ?</h2>
<p>Les fonctionnalités principales de Cosmo sont gratuites, sans limite de projets ni de clients. Pour un indépendant, c'est un poste de dépense en moins — et la <a href="/">démo s'essaie sans créer de compte</a>, avec 12 mois de données réalistes pour juger sur pièce en deux minutes.</p>`,
  },
  {
    slug: 'pour-etudiants',
    audience: 'étudiants',
    title: "L'application de productivité gratuite pour les étudiants",
    metaTitle: 'App de productivité étudiant (gratuite) : révisions, deadlines',
    description:
      "Étudiant : organisez cours, révisions et deadlines avec le time-blocking, construisez des habitudes de travail durables. 100 % gratuit, sans carte bancaire.",
    lead: "Entre les cours, les partiels, les projets de groupe et un job à côté, le problème n'est pas le manque de motivation — c'est l'absence de système. Et un budget étudiant n'a pas de place pour un abonnement productivité.",
    html: `
<h2>Le semestre type, sans système</h2>
<p>Tout va bien jusqu'à mi-octobre. Puis les deadlines s'empilent, les révisions se compressent dans les dix derniers jours, et chaque partiel se prépare dans l'urgence. Le problème n'est pas l'intelligence ni la volonté : c'est qu'un semestre est un projet de 4 mois géré sans plan.</p>
<h2>Le système Cosmo pour un semestre</h2>
<ul>
<li><strong>Une catégorie par matière.</strong> Chaque cours a sa couleur ; les deadlines (rendus, exposés, partiels) deviennent des tâches datées et priorisées de 1 à 5 — fini le post-it mental permanent.</li>
<li><strong>Le time-blocking rend les révisions réelles.</strong> « Réviser la macro » n'existe pas tant que ce n'est pas un créneau de 2 h mardi à 14 h. Glissez vos tâches de révision dans l'agenda : la semaine se remplit, le retard devient visible avant qu'il ne soit critique.</li>
<li><strong>Les habitudes portent le long terme.</strong> 30 minutes d'anglais, relire ses notes le soir même, 3 séances de sport : la heatmap 26 semaines — la durée exacte d'un semestre — montre votre régularité mieux que n'importe quelle bonne intention.</li>
<li><strong>Un OKR par semestre.</strong> « Valider le semestre proprement » avec des résultats clés mesurables (moyenne cible, zéro rattrapage, mémoire rendu en avance) : vous savez en semaine 6 si vous êtes sur la trajectoire, pas en semaine 15.</li>
</ul>
<h2>Vraiment gratuit, vraiment sans friction</h2>
<p>Pas de carte bancaire, pas d'essai de 14 jours : les fonctionnalités principales sont gratuites, point. Cosmo fonctionne dans le navigateur de votre téléphone comme sur l'ordi de la BU, sans installation. <a href="/">Testez la démo sans inscription</a> — deux minutes suffisent pour voir si le système vous parle.</p>`,
  },
  {
    slug: 'pour-managers',
    audience: 'managers',
    title: "L'application de productivité pour managers et chefs d'équipe",
    metaTitle: 'App de productivité manager : OKR, priorités, temps protégé',
    description:
      "Manager : pilotez vos OKR, protégez votre temps de travail profond entre les réunions et suivez les tâches partagées avec votre équipe. Gratuit.",
    lead: "Le paradoxe du manager : plus vous êtes sollicité, moins il reste de temps pour le travail qui justifie votre poste — la stratégie, les décisions, les gens. Reprendre ce temps est un problème d'outillage autant que de discipline.",
    html: `
<h2>L'agenda d'un manager est un champ de bataille</h2>
<p>Des réunions posées par d'autres, des sollicitations continues, et en fin de semaine cette question : « qu'ai-je vraiment fait avancer ? ». Les objectifs annuels de l'équipe, eux, vivent dans un slide revu deux fois par an. Ce n'est pas un défaut personnel — c'est ce qui arrive quand l'important n'a pas d'outil face à l'urgent.</p>
<h2>Ce que Cosmo apporte à un manager</h2>
<ul>
<li><strong>Les OKR sortent du slide.</strong> Objectifs du trimestre et résultats clés mesurables, progression calculée automatiquement, graphique d'avancement sur le dashboard : le point OKR du lundi se prépare en 5 minutes, avec des chiffres réels.</li>
<li><strong>Le time-blocking défend votre travail profond.</strong> Bloquez vos créneaux de réflexion avant que les réunions ne dévorent la semaine — un agenda déjà occupé par vos priorités est votre meilleure ligne de défense.</li>
<li><strong>Le partage de tâches, sans usine à gaz.</strong> Partagez une tâche avec un collaborateur en rôle Lecteur ou Éditeur, suivez l'avancement depuis votre dashboard, discutez dans le contexte de la tâche — sans déployer un outil de gestion de projet de plus.</li>
<li><strong>Les statistiques révèlent votre vraie semaine.</strong> Temps passé par catégorie (réunions, 1:1, production, stratégie) : la donnée qui manque à chaque conversation sur « la charge ».</li>
</ul>
<h2>Commencez par vous</h2>
<p>Le meilleur argument pour diffuser une méthode à son équipe, c'est de l'incarner un trimestre. <a href="/">Essayez la démo sans inscription</a>, posez vos OKR du trimestre en 15 minutes, et jugez sur vos propres résultats — c'est gratuit.</p>`,
  },
];

export const getUseCase = (slug) => USE_CASES.find((u) => u.slug === slug);
