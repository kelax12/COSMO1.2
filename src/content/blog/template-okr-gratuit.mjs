// Article de blog — contenu partagé React + prerender. ESM pur.
// Linkable asset : template Excel généré par scripts/generate-okr-template.py
// → public/downloads/template-okr-cosmo.xlsx
//
// C'est la SEULE page du site qui offre quelque chose à télécharger, donc la
// seule qui puisse attirer un lien entrant spontané. Elle a été portée de
// ~560 à ~1 800 mots le 2026-08-19 pour cette raison : à autorité de domaine
// nulle, un actif linkable vaut plus qu'un article de plus.
export const article = {
  slug: 'template-okr-gratuit',
  title: 'Template OKR gratuit (Excel) : personnel et équipe, prêt à remplir',
  metaTitle: 'Template OKR gratuit à télécharger (Excel)',
  description:
    'Téléchargez notre template OKR gratuit au format Excel : exemples pré-remplis, progression automatique, versions perso et équipe. Sans email.',
  datePublished: '2026-07-18',
  dateModified: '2026-08-19',
  readingMinutes: 9,
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ['methode-okr-exemples', 'okr-vs-smart-vs-kpi', 'glossaire-productivite'],
  faq: [
    ['Le template OKR fonctionne-t-il sur Google Sheets ?', 'Oui : importez le fichier .xlsx dans Google Sheets (Fichier → Importer), les formules de progression sont conservées. Compatible aussi LibreOffice Calc et Numbers.'],
    ['Puis-je partager le template à mon équipe ?', 'Oui, librement. Dupliquez la feuille « OKR équipe-startup » par personne si chacun suit ses propres OKR, en gardant un seul fichier pour tout le monde.'],
    ['Faut-il donner son email pour télécharger ?', 'Non. Le lien est direct, sans formulaire ni inscription.'],
    ["Combien d'objectifs mettre dans le template ?", "2 à 4 par cycle, avec 2 à 5 résultats clés chacun. Au-delà, la revue hebdomadaire dépasse dix minutes et cesse d'avoir lieu."],
    ['Peut-on commencer en cours de trimestre ?', "Oui, et c'est préférable à attendre : prenez les semaines restantes comme durée de cycle et ajustez les cibles en proportion."],
  ],
  html: `
<p class="lead">Vous connaissez la méthode, il ne manque que le support. Voici un <strong>template OKR gratuit au format Excel</strong> (compatible Google Sheets et LibreOffice) : deux feuilles prêtes à remplir (OKR personnels et OKR équipe/startup), avec des exemples concrets et la progression calculée automatiquement. Téléchargement direct, <strong>sans email demandé</strong>.</p>

<p><a href="/downloads/template-okr-cosmo.xlsx" download><strong>Télécharger le template OKR (.xlsx, 9 Ko)</strong></a></p>

<h2 id="contenu">Ce que contient le template</h2>
<ul>
<li><strong>Mode d'emploi</strong> : les 5 règles pour que vos OKR fonctionnent, sur une page.</li>
<li><strong>OKR personnels</strong> : un exemple complet pré-rempli (remise en forme) + deux objectifs vierges avec leurs résultats clés.</li>
<li><strong>OKR équipe / startup</strong> : un exemple acquisition (contenu SEO) + structure identique.</li>
<li><strong>Progression automatique</strong> : renseignez valeur de départ, valeur cible et valeur actuelle. Le pourcentage se calcule seul, borné entre 0 et 100 %.</li>
</ul>

<h3>Les 7 colonnes, et à quoi sert chacune</h3>
<div class="table-wrap"><table>
<thead><tr><th>Colonne</th><th>Ce qu'on y met</th><th>Pourquoi elle existe</th></tr></thead>
<tbody>
<tr><td>Objectif</td><td>Une direction qualitative, sans chiffre</td><td>Fusionnée sur toutes les lignes de ses résultats clés : un objectif qui n'en a aucun saute aux yeux</td></tr>
<tr><td>Résultat clé</td><td>Une mesure vérifiable, avec son unité</td><td>C'est la seule ligne que vous mettrez à jour chaque semaine</td></tr>
<tr><td>Valeur départ</td><td>Où vous en êtes le jour 1</td><td>Sans elle, une progression de 40 % ne veut rien dire</td></tr>
<tr><td>Valeur cible</td><td>Où vous voulez être à la fin du cycle</td><td>Force à trancher entre ambition et fiction</td></tr>
<tr><td>Valeur actuelle</td><td>La mesure du jour</td><td>Le seul chiffre que vous touchez lors de la revue hebdomadaire</td></tr>
<tr><td>Progression</td><td>Rien : c'est une formule</td><td>(actuelle − départ) / (cible − départ), bornée à 0 et 100 %</td></tr>
<tr><td>Notes / prochaine action</td><td>Une phrase, pas un journal</td><td>La colonne la plus négligée et la plus utile : elle transforme un constat en décision</td></tr>
</tbody>
</table></div>
<p>La progression est volontairement bornée : un résultat clé à 130 % n'existe pas dans ce template. Dépasser une cible n'est pas une performance, c'est le signe que la cible était mal posée, et laisser ce dépassement gonfler la moyenne masquerait un objectif en retard juste à côté.</p>

<h2 id="utiliser">Comment l'utiliser en 4 étapes</h2>
<ol>
<li><strong>Choisissez 2 à 4 objectifs</strong> pour les 12 prochaines semaines. Pas plus, c'est la contrainte qui fait la méthode. Un objectif est qualitatif et motivant : les chiffres n'y ont pas leur place.</li>
<li><strong>Écrivez 2 à 5 résultats clés par objectif.</strong> Chacun doit être un nombre vérifiable : « passer de 0 à 10 km en continu », pas « mieux courir ». En cas de doute sur la formulation, piochez dans nos <a href="/blog/methode-okr-exemples">15 exemples d'OKR commentés</a>.</li>
<li><strong>Renseignez départ et cible.</strong> C'est ce qui permet à la progression de se calculer, et ce qui vous force à savoir d'où vous partez, étape que tout le monde saute.</li>
<li><strong>Mettez à jour chaque semaine.</strong> 10 minutes, le même jour chaque semaine (le vendredi fonctionne bien). C'est le rituel qui sépare un OKR d'une résolution de janvier.</li>
</ol>

<h2 id="cibles">Fixer départ et cible sans se mentir</h2>
<p>C'est l'étape qui décide de la valeur du trimestre entier, et c'est celle qu'on bâcle. Deux erreurs symétriques la guettent.</p>
<p>La première est le <strong>sandbagging</strong> : poser une cible qu'on sait déjà atteinte. Elle produit un tableau vert et un trimestre sans effet. Le test est simple : si vous êtes certain à 90 % d'y arriver, ce n'est pas un résultat clé, c'est une prévision.</p>
<p>La seconde est la <strong>cible décorative</strong> : « passer de 2 000 à 50 000 visites ». Personne n'y croit, donc personne ne s'en sert pour arbitrer, et l'objectif est abandonné en silence dès la semaine 4. Une cible utile est inconfortable, pas absurde.</p>
<p>Le repère opérationnel : visez une cible que vous estimez atteindre à <strong>50-70 % de chances</strong>. Dans la culture OKR, terminer un cycle autour de 70 % est le signe d'un objectif bien calibré ; 100 % partout signifie que vous visiez trop bas.</p>
<p>Et si vous ne connaissez pas votre valeur de départ, <strong>ne l'inventez pas</strong> : passez la première semaine à la mesurer, et démarrez le cycle avec un chiffre réel. Un trimestre qui commence sur une base fausse produit douze semaines de conclusions fausses.</p>

<h2 id="exemple">Un exemple rempli, ligne par ligne</h2>
<p>La feuille « OKR personnels » arrive avec cet objectif déjà saisi, pris à la semaine 4 d'un cycle de 12 :</p>
<div class="table-wrap"><table>
<thead><tr><th>Résultat clé</th><th>Départ</th><th>Cible</th><th>Actuelle</th><th>Progression</th></tr></thead>
<tbody>
<tr><td>Courir 3 séances par semaine pendant 12 semaines (36 séances)</td><td>0</td><td>36</td><td>9</td><td>25 %</td></tr>
<tr><td>Passer de 0 à 10 km en continu</td><td>0</td><td>10</td><td>4</td><td>40 %</td></tr>
<tr><td>Dormir 7 h 30 en moyenne par nuit (heures)</td><td>6,5</td><td>7,5</td><td>7,0</td><td>50 %</td></tr>
</tbody>
</table></div>
<p>Trois choses méritent d'être remarquées. D'abord, <strong>l'unité est dans l'intitulé</strong> (séances, km, heures) : sans elle, on ne sait plus au bout d'un mois si « 9 » est un nombre de sorties ou de kilomètres. Ensuite, le troisième résultat clé part de 6,5 et non de zéro : c'est exactement le cas où une progression calculée sans valeur de départ mentirait, en affichant 93 % au lieu de 50 %. Enfin, la première ligne est à 25 % en semaine 4 sur 12, soit précisément dans les temps : la comparaison qui compte n'est pas « où j'en suis », mais « où j'en suis <em>par rapport à l'écoulement du cycle</em> ».</p>
<p>C'est la lecture qu'il faut prendre l'habitude de faire, et c'est la même que celle d'un <a href="/blog/tableau-de-bord-productivite">tableau de bord de productivité</a> : ce qui pilote une décision, c'est la trajectoire, jamais la valeur absolue.</p>

<h2 id="revue">La revue hebdomadaire de 10 minutes</h2>
<p>Le template ne vaut que par ce rituel. Sans lui, vous aurez rempli un joli tableau en janvier que vous rouvrirez en avril, avec le sentiment désagréable d'avoir perdu un trimestre.</p>
<p>Posez un créneau récurrent de 10 minutes, le même jour chaque semaine, et bloquez-le comme un rendez-vous : c'est l'usage le plus rentable du <a href="/blog/time-blocking-guide">time-blocking</a>. Pendant ces 10 minutes, trois gestes, dans cet ordre :</p>
<ol>
<li><strong>Mettre à jour la colonne « Valeur actuelle »</strong>, et elle seule. On ne réécrit pas ses objectifs pendant une revue : c'est ainsi qu'on finit par ajuster la cible au résultat plutôt que l'inverse.</li>
<li><strong>Repérer le résultat clé le plus en retard</strong> par rapport à l'écoulement du cycle. Un seul, le pire.</li>
<li><strong>Écrire une seule prochaine action</strong> dans la colonne Notes, et la reporter dans votre liste de tâches de la semaine. Une action concrète, faisable en moins de deux heures.</li>
</ol>
<p>C'est tout. La revue n'est ni un bilan ni un tribunal : c'est un aiguillage. Elle a rempli son rôle si elle produit <strong>une ligne dans votre semaine suivante</strong>.</p>

<h2 id="scorer">Noter son cycle à la fin (et pourquoi 70 % est une réussite)</h2>
<p>En fin de trimestre, la moyenne des progressions d'un objectif donne son score, entre 0 et 100 %. La grille de lecture, héritée de la pratique d'Intel puis de Google :</p>
<ul>
<li><strong>60 à 80 %</strong> : la zone visée. L'objectif était ambitieux et vous avez avancé pour de bon.</li>
<li><strong>Au-dessus de 90 %, systématiquement</strong> : vos cibles sont trop basses. Le trimestre suivant, montez-les jusqu'à ce que ce soit inconfortable.</li>
<li><strong>Sous 40 %</strong> : la question n'est pas « ai-je assez travaillé ? » mais « cet objectif était-il le bon ? ». Un objectif à 20 % à mi-cycle n'est pas en retard, il est en train d'être abandonné sans que personne ne le dise.</li>
</ul>
<p>Le score sert à calibrer le cycle suivant, jamais à évaluer une personne. Dès qu'un score OKR sert à décider d'une prime, les cibles s'effondrent en trois trimestres : chacun apprend à ne promettre que ce qu'il sait déjà tenir. Et si votre besoin est de <em>surveiller</em> plutôt que de <em>changer</em>, c'est un KPI qu'il vous faut, pas un OKR — la distinction est détaillée dans <a href="/blog/okr-vs-smart-vs-kpi">OKR vs SMART vs KPI</a>.</p>

<h2 id="equipe">Adapter le template à une équipe</h2>
<p>La feuille « OKR équipe-startup » suffit pour 2 à 5 personnes. Trois ajustements la rendent utilisable en collectif :</p>
<ul>
<li><strong>Une colonne « Porteur ».</strong> Un résultat clé sans nom en face n'avance pas. Un porteur par résultat clé, pas par objectif : c'est la granularité qui rend la revue possible.</li>
<li><strong>Une colonne « Confiance » (1 à 5).</strong> Renseignée à chaque revue, elle capte ce que la progression ne voit pas : un résultat clé à 60 % dont la confiance tombe de 4 à 2 est un signal d'alerte trois semaines avant que le chiffre ne décroche.</li>
<li><strong>Un onglet par équipe, jamais un fichier par personne.</strong> Le jour où le fichier se duplique, les versions divergent et le suivi meurt. C'est la limite structurelle du tableur en collectif, et elle arrive vite : au-delà de cinq personnes, la question n'est plus <em>si</em> mais <em>quand</em>. Le sujet est pris de front sur la page <a href="/pour-equipes">Cosmo pour les équipes</a>.</li>
</ul>

<h2 id="erreurs">Les 4 erreurs de remplissage les plus fréquentes</h2>
<ol>
<li><strong>Confondre résultat clé et tâche.</strong> « Envoyer 50 candidatures » est une activité ; « décrocher 5 entretiens » est un résultat. La première se remplit en travaillant beaucoup, la seconde en travaillant juste.</li>
<li><strong>Mettre un chiffre dans l'objectif.</strong> Si l'objectif porte déjà la mesure, les résultats clés deviennent une liste de tâches et la méthode perd son intérêt. L'objectif inspire, les résultats clés mesurent.</li>
<li><strong>Remplir les 8 lignes disponibles.</strong> Le template offre 2 objectifs vierges de 4 résultats clés chacun. C'est une capacité, pas une consigne : deux objectifs de trois résultats clés valent mieux que huit lignes qu'on ne relira jamais.</li>
<li><strong>Changer les cibles en cours de route.</strong> Une cible qui bouge en semaine 7 n'est plus une cible. Notez plutôt dans la colonne Notes pourquoi elle était mauvaise, et servez-vous-en pour calibrer le cycle suivant.</li>
</ol>
<p>Si un terme du domaine vous échappe (résultat clé, cycle, KPI, sandbagging), le <a href="/blog/glossaire-productivite">glossaire de la productivité</a> les définit tous en une phrase.</p>

<h2 id="pieges">Les 3 pièges du suivi sur tableur</h2>
<p>Ce template est le meilleur moyen de démarrer aujourd'hui. Soyons honnêtes sur ses limites, connues de quiconque a déjà suivi ses OKR dans Excel :</p>
<ol>
<li><strong>Personne n'ouvre le fichier.</strong> Le tableur ne vous relance pas : la mise à jour hebdomadaire repose à 100 % sur votre discipline, précisément la ressource que les OKR sont censés économiser.</li>
<li><strong>Le suivi est déconnecté de l'action.</strong> Vos tâches quotidiennes vivent ailleurs ; le lien entre « ce que je fais aujourd'hui » et « mes objectifs du trimestre » reste invisible.</li>
<li><strong>Pas d'historique visuel.</strong> Une cellule à 40 % ne raconte pas votre trajectoire : progression régulière ou sprint de dernière minute ?</li>
</ol>
<p>Si ces limites vous freinent, <a href="/">Cosmo</a> intègre les OKR nativement : progression mise à jour au fil de vos actions, graphique des résultats clés réalisés sur le dashboard, et vos objectifs vivent à côté de vos <a href="/blog/time-blocking-guide">tâches planifiées</a> et de vos habitudes. <a href="/signup">Gratuit</a>, démo sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Le template fonctionne-t-il sur Google Sheets ?</h3>
<p>Oui : importez le fichier .xlsx dans Google Sheets (Fichier → Importer), les formules de progression sont conservées. Compatible aussi avec LibreOffice Calc et Numbers.</p>
<h3>Puis-je le partager à mon équipe ?</h3>
<p>Oui, librement. Si chaque membre suit ses propres OKR, dupliquez la feuille « OKR équipe-startup » par personne, en gardant un seul fichier pour tout le monde plutôt qu'un fichier par personne.</p>
<h3>Faut-il donner son email pour télécharger ?</h3>
<p>Non. Le lien est direct, sans formulaire ni inscription. On préfère que vous jugiez le contenu plutôt que de capturer votre adresse.</p>
<h3>Combien d'objectifs mettre dans le template ?</h3>
<p>2 à 4 par cycle, avec 2 à 5 résultats clés chacun. Le template en propose davantage par confort de mise en page, pas comme quota à remplir. Au-delà de quatre, la revue hebdomadaire dépasse dix minutes et cesse d'avoir lieu.</p>
<h3>Puis-je commencer en cours de trimestre ?</h3>
<p>Oui, et c'est même préférable à attendre. Prenez les semaines restantes comme durée de cycle et ajustez les cibles à la baisse en proportion : un cycle de sept semaines bien suivi vaut mieux qu'un cycle de douze semaines qui commence dans un mois.</p>
<h3>Que faire si je rate deux revues d'affilée ?</h3>
<p>Reprendre à la suivante, sans rattraper les semaines manquées. Rien dans le template ne dépend de l'historique : seule la valeur actuelle compte. C'est surtout le signal qu'il faut déplacer le créneau de revue, pas augmenter la volonté.</p>
`,
};
