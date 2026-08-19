// Article de blog — contenu partagé React + prerender. ESM pur.
//
// Cible SEO : « tableau de bord productivité » (140 rech./mois, difficulté 13
// — le meilleur ratio volume/difficulté du set suivi au 2026-08-12).
export const article = {
  slug: 'tableau-de-bord-productivite',
  title: 'Tableau de bord de productivité : quoi y mettre (et quoi en retirer)',
  metaTitle: 'Tableau de bord productivité : les 6 indicateurs utiles',
  description:
    "Que doit afficher un tableau de bord de productivité personnel ? Les 6 indicateurs qui font agir, ceux qui ne servent à rien, et comment le construire.",
  datePublished: '2026-08-12',
  dateModified: '2026-08-12',
  readingMinutes: 8,
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ['methode-okr-exemples', 'suivi-des-habitudes', 'cosmo-vs-todoist'],
  faq: [
    ['Quels indicateurs mettre dans un tableau de bord de productivité ?', "Six suffisent : les tâches terminées sur la période, le taux de complétion des habitudes, le temps réparti par catégorie, l'avancement des objectifs, la charge de la semaine à venir et le ratio planifié/réalisé. Au-delà, on regarde sans agir."],
    ['À quelle fréquence consulter son tableau de bord ?', "Une fois par semaine pour la revue, plus un coup d'œil quotidien de dix secondes sur la charge du jour. Le consulter en continu ne change aucune décision et coûte de l'attention."],
    ['Un tableau de bord personnel doit-il ressembler à un dashboard d’entreprise ?', "Non. Un dashboard d'entreprise sert à rendre compte, un tableau de bord personnel sert à décider. Il doit tenir sur un écran et ne montrer que ce sur quoi vous pouvez agir cette semaine."],
  ],
  html: `
<p class="lead">Un tableau de bord de productivité est une promesse tentante : voir sa vie en un écran. En pratique, la plupart de ceux qu'on construit finissent en décoration, jolis, consultés trois semaines, puis ignorés. La raison est presque toujours la même : ils affichent ce qui est facile à mesurer plutôt que ce qui déclenche une décision. Voici ce qui mérite d'y figurer, ce qu'il faut en retirer, et comment le monter sans y passer un week-end.</p>

<h2 id="critere">Le seul critère qui compte : est-ce que ça change une décision ?</h2>
<p>Avant d'ajouter un indicateur, posez-lui cette question : <strong>si ce chiffre double ou s'effondre, qu'est-ce que je fais différemment lundi ?</strong> Si la réponse est « rien », l'indicateur n'a pas sa place. Il est intéressant, pas utile, et la différence entre les deux est exactement ce qui sépare un tableau de bord vivant d'un tableau de bord abandonné.</p>
<p>Ce filtre élimine d'emblée la majorité des métriques qu'on trouve dans les outils : le nombre total de tâches créées depuis toujours, le temps cumulé sur l'année, les badges, les scores composites. Ils flattent ou culpabilisent, ils ne pilotent rien.</p>

<h2 id="indicateurs">Les 6 indicateurs qui font agir</h2>

<h3>1. Les tâches terminées sur la période</h3>
<p>Pas le total historique : le volume de la semaine écoulée, comparé aux précédentes. C'est votre débit réel, et il sert à une chose précise : calibrer ce que vous vous engagez à faire la semaine suivante. Quelqu'un qui termine douze tâches par semaine et en planifie trente organise sa propre déception, chaque lundi.</p>

<h3>2. Le taux de complétion des habitudes</h3>
<p>Le pourcentage de fois où vous avez tenu vos routines sur la période. Sous 50 %, l'habitude est mal calibrée : trop ambitieuse, mal placée dans la journée, ou pas assez désirée. C'est un signal d'ajustement, pas un motif de culpabilité, et il vaut mieux le voir en semaine 3 qu'en mois 4. La <a href="/blog/combien-de-temps-prendre-habitude">durée réelle d'ancrage d'une habitude</a> rend ce suivi indispensable, et l'article <a href="/blog/suivi-des-habitudes">suivi des habitudes</a> détaille lequel des trois indicateurs mérite la première place.</p>

<h3>3. Le temps réparti par catégorie</h3>
<p>L'indicateur qui surprend le plus, systématiquement. Vous croyez consacrer vos journées à la production ; la répartition montre que l'administratif et les réunions en prennent la moitié. C'est le seul chiffre qui permet une conversation honnête avec soi-même sur la charge, et, pour un indépendant, la base d'une meilleure tarification.</p>

<h3>4. L'avancement des objectifs</h3>
<p>Si vous travaillez en <a href="/blog/methode-okr-exemples">OKR</a>, c'est la progression de chaque résultat clé. Sinon, une simple estimation par objectif. L'important est la <strong>trajectoire</strong> : à mi-trimestre, un objectif à 20 % n'est pas « en retard », il est en train d'être abandonné silencieusement. Le voir tôt laisse deux options : accélérer ou renoncer explicitement. Les deux valent mieux que la dérive.</p>

<h3>5. La charge de la semaine à venir</h3>
<p>Le nombre d'heures déjà engagées dans l'agenda face aux heures réellement disponibles. C'est le seul indicateur tourné vers l'avant, et donc le seul qui empêche un problème au lieu de le constater. Une semaine à 45 heures engagées sur 35 disponibles ne se règle pas par plus de discipline : elle se règle en retirant quelque chose, avant qu'elle ne commence. Pour un <a href="/pour-managers">manager</a>, c'est le même indicateur appliqué à l'équipe : la charge se lit avant d'être subie, jamais après.</p>

<h3>6. Le ratio planifié / réalisé</h3>
<p>Sur les créneaux que vous aviez bloqués, combien ont été tenus ? Ce ratio mesure la qualité de votre planification, pas votre valeur. Durablement sous 60 %, il dit que vos blocs sont trop longs, trop optimistes, ou posés à des moments où vous n'êtes pas disponible. C'est le complément naturel du <a href="/blog/time-blocking-guide">time-blocking</a>.</p>

<h2 id="a-retirer">Ce qu'il faut retirer</h2>
<ul>
<li><strong>Les compteurs cumulés.</strong> « 1 847 tâches terminées » ne pilote rien. Un cumul ne redescend jamais, donc il ne peut jamais alerter.</li>
<li><strong>Les scores composites.</strong> Un « score de productivité » sur 100 mélange des choses non comparables : quand il baisse, vous ne savez pas quoi faire. Préférez cinq chiffres lisibles à un indice opaque.</li>
<li><strong>Les comparaisons avec d'autres.</strong> Vos contraintes ne sont pas les leurs. Le seul point de comparaison utile, c'est vous il y a un mois.</li>
<li><strong>Les séries trop longues.</strong> Un graphique sur trois ans écrase les variations récentes, celles sur lesquelles vous pouvez encore agir. Douze semaines suffisent presque toujours.</li>
</ul>

<h2 id="rythme">Le rythme de consultation</h2>
<p>Un tableau de bord consulté en permanence devient un fil d'actualité : il occupe l'attention sans produire de décision. Deux rendez-vous suffisent.</p>
<ol>
<li><strong>Dix secondes le matin</strong> sur la charge du jour et les habitudes à cocher. Pas d'analyse, juste un cadrage.</li>
<li><strong>Quinze minutes en fin de semaine</strong> pour la revue : débit réel, temps par catégorie, avancement des objectifs, et une seule décision d'ajustement pour la semaine suivante. Une seule, c'est ce qui rend la revue tenable dans la durée.</li>
</ol>

<h2 id="construire">Le construire sans y passer un week-end</h2>
<p>Beaucoup de gens montent leur tableau de bord dans un tableur. C'est faisable, et c'est un excellent exercice pour clarifier ce qu'on veut suivre, mais la saisie manuelle est une dette : au bout de six semaines, les données ne sont plus à jour, et un tableau de bord périmé est pire que pas de tableau de bord, parce qu'il donne une fausse assurance.</p>
<p>La règle pratique : <strong>ne suivez à la main que ce qu'aucun outil ne peut calculer seul.</strong> Tout ce qui découle de vos tâches, de vos habitudes ou de votre agenda doit se remplir automatiquement, sinon vous finirez par arrêter.</p>
<p>C'est précisément ce que fait <a href="/">Cosmo</a> : le dashboard affiche l'avancement du jour, les habitudes à cocher, les prochains événements et la courbe des résultats clés atteints, et la page Statistiques donne le temps investi par catégorie et son évolution. Les cinq premiers indicateurs de cet article s'y lisent sans aucune saisie supplémentaire, ils tombent de l'usage normal de l'application. <a href="/signup">C'est gratuit</a>, et la démo s'ouvre sans inscription avec 12 mois de données pour voir à quoi ressemble le tableau de bord une fois rempli.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien d'indicateurs au maximum ?</h3>
<p>Six, sept si vraiment nécessaire. Au-delà, on ne lit plus : on balaie. Un tableau de bord qui ne tient pas sur un écran a déjà échoué.</p>
<h3>Faut-il suivre son temps à la minute ?</h3>
<p>Non. Une répartition par catégorie sur des blocs d'une demi-heure suffit largement à révéler les déséquilibres. Le suivi à la minute coûte plus d'attention qu'il n'en fait gagner.</p>
<h3>Que faire si tous mes indicateurs sont au rouge ?</h3>
<p>Ne rien optimiser. C'est le signe d'une surcharge, pas d'un défaut de méthode : retirez des engagements jusqu'à ce que la semaine à venir tienne dans les heures disponibles, puis reprenez le pilotage.</p>
`,
};
