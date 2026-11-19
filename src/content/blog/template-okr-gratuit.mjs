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
  slug: "template-okr-gratuit",
  datePublished: "2026-07-18",
  dateModified: "2026-08-19",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["methode-okr-exemples","okr-vs-smart-vs-kpi","glossaire-productivite"],
  locales: {
    fr: {
      title: "Template OKR gratuit (Excel) : personnel et équipe, prêt à remplir",
      metaTitle: "Template OKR gratuit à télécharger (Excel)",
      description: "Téléchargez notre template OKR gratuit au format Excel : exemples pré-remplis, progression automatique, versions perso et équipe. Sans email.",
      readingMinutes: 9,
      faq: [
        ["Le template OKR fonctionne-t-il sur Google Sheets ?", "Oui : importez le fichier .xlsx dans Google Sheets (Fichier → Importer), les formules de progression sont conservées. Compatible aussi LibreOffice Calc et Numbers."],
        ["Puis-je partager le template à mon équipe ?", "Oui, librement. Dupliquez la feuille « OKR équipe-startup » par personne si chacun suit ses propres OKR, en gardant un seul fichier pour tout le monde."],
        ["Faut-il donner son email pour télécharger ?", "Non. Le lien est direct, sans formulaire ni inscription."],
        ["Combien d'objectifs mettre dans le template ?", "2 à 4 par cycle, avec 2 à 5 résultats clés chacun. Au-delà, la revue hebdomadaire dépasse dix minutes et cesse d'avoir lieu."],
        ["Peut-on commencer en cours de trimestre ?", "Oui, et c'est préférable à attendre : prenez les semaines restantes comme durée de cycle et ajustez les cibles en proportion."],
      ],
      html: `
<p class="lead">Vous connaissez la méthode, il ne manque que le support. Voici un <strong>template OKR gratuit au format Excel</strong> (compatible Google Sheets et LibreOffice) : deux feuilles prêtes à remplir (OKR personnels et OKR équipe/startup), avec des exemples concrets et la progression calculée automatiquement. Téléchargement direct, <strong>sans email demandé</strong>.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Les OKR dans Cosmo : chaque objectif affiche ses résultats clés, sa progression et le temps écoulé sur la période." /><figcaption>Les OKR dans Cosmo : chaque objectif affiche ses résultats clés, sa progression et le temps écoulé sur la période. Capture du mode démo, données fictives.</figcaption></figure>

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
    },
    en: {
      title: "Free OKR template (Excel): personal and team, ready to fill in",
      metaTitle: "Free OKR template to download (Excel)",
      description: "Download our free OKR template in Excel format: pre-filled examples, automatic progress, personal and team versions. No email required.",
      readingMinutes: 9,
      faq: [
        ["Does the OKR template work in Google Sheets?", "Yes: import the .xlsx file into Google Sheets (File then Import) and the progress formulas are preserved. It is also compatible with LibreOffice Calc and Numbers."],
        ["Can I share the template with my team?", "Yes, freely. Duplicate the team and startup sheet once per person if everyone tracks their own OKRs, keeping a single file for everybody."],
        ["Do I have to give an email address to download it?", "No. The link is direct, with no form and no sign-up."],
        ["How many objectives should go in the template?", "Two to four per cycle, with 2 to 5 key results each. Beyond that, the weekly review runs past ten minutes and stops happening."],
        ["Can you start mid-quarter?", "Yes, and it beats waiting: take the remaining weeks as your cycle length and scale the targets down in proportion."],
      ],
      html: `
<p class="lead">You know the method, all that is missing is the support. Here is a <strong>free OKR template in Excel format</strong> (compatible with Google Sheets and LibreOffice): two sheets ready to fill in, personal OKRs and team or startup OKRs, with concrete examples and progress computed for you. Direct download, <strong>no email required</strong>.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="OKRs in Cosmo: each objective shows its key results, its progress and how much of the period has elapsed." /><figcaption>OKRs in Cosmo: each objective shows its key results, its progress and how much of the period has elapsed. Screenshot of the demo mode, sample data.</figcaption></figure>

<p><a href="/downloads/template-okr-cosmo.xlsx" download><strong>Download the OKR template (.xlsx, 9 KB)</strong></a> (the sheet labels are in French)</p>

<h2 id="contenu">What is in the template</h2>
<ul>
<li><strong>Instructions</strong>: the 5 rules for making your OKRs work, on one page.</li>
<li><strong>Personal OKRs</strong>: one complete pre-filled example (getting back in shape) plus two blank objectives with their key results.</li>
<li><strong>Team and startup OKRs</strong>: an acquisition example (SEO content) with the same structure.</li>
<li><strong>Automatic progress</strong>: enter the starting value, the target value and the current value. The percentage computes itself, bounded between 0 and 100 %.</li>
</ul>

<h3>The 7 columns, and what each is for</h3>
<div class="table-wrap"><table>
<thead><tr><th>Column</th><th>What goes in it</th><th>Why it exists</th></tr></thead>
<tbody>
<tr><td>Objective</td><td>A qualitative direction, with no number</td><td>Merged across all the rows of its key results, so an objective with none is impossible to miss</td></tr>
<tr><td>Key result</td><td>A verifiable measure, with its unit</td><td>This is the only row you will update every week</td></tr>
<tr><td>Starting value</td><td>Where you stand on day 1</td><td>Without it, 40 % progress means nothing</td></tr>
<tr><td>Target value</td><td>Where you want to be at the end of the cycle</td><td>Forces you to choose between ambition and fiction</td></tr>
<tr><td>Current value</td><td>Today's measure</td><td>The only number you touch during the weekly review</td></tr>
<tr><td>Progress</td><td>Nothing, it is a formula</td><td>(current minus start) divided by (target minus start), bounded to 0 and 100 %</td></tr>
<tr><td>Notes and next action</td><td>One sentence, not a journal</td><td>The most neglected and most useful column: it turns an observation into a decision</td></tr>
</tbody>
</table></div>
<p>Progress is deliberately bounded: a key result at 130 % does not exist in this template. Overshooting a target is not a performance, it is a sign the target was badly set, and letting that overshoot inflate the average would hide an objective falling behind right next to it.</p>

<h2 id="utiliser">How to use it in 4 steps</h2>
<ol>
<li><strong>Choose 2 to 4 objectives</strong> for the next 12 weeks. No more, because that constraint is what makes the method. An objective is qualitative and motivating, numbers have no place in it.</li>
<li><strong>Write 2 to 5 key results per objective.</strong> Each has to be a verifiable number: "go from 0 to 10 km without stopping", not "run better". If the wording is giving you trouble, borrow from our <a href="/en/blog/methode-okr-exemples">15 annotated OKR examples</a>.</li>
<li><strong>Fill in the start and the target.</strong> That is what lets progress compute itself, and what forces you to know where you are starting from, the step everybody skips.</li>
<li><strong>Update every week.</strong> Ten minutes, on the same day each week (Friday works well). That ritual is what separates an OKR from a January resolution.</li>
</ol>

<h2 id="cibles">Setting start and target without lying to yourself</h2>
<p>This is the step that decides the value of the whole quarter, and it is the one people rush. Two symmetrical mistakes lie in wait.</p>
<p>The first is <strong>sandbagging</strong>: setting a target you already know you will hit. It produces a green sheet and a quarter with no effect. The test is simple: if you are 90 % certain of getting there, that is not a key result, it is a forecast.</p>
<p>The second is the <strong>decorative target</strong>: "go from 2,000 to 50,000 visits". Nobody believes it, so nobody uses it to make trade-offs, and the objective is quietly abandoned by week 4. A useful target is uncomfortable, not absurd.</p>
<p>The working benchmark: aim at a target you give yourself a <strong>50 to 70 % chance</strong> of reaching. In OKR culture, finishing a cycle around 70 % is the sign of a well-calibrated objective, and 100 % everywhere means you aimed too low.</p>
<p>And if you do not know your starting value, <strong>do not invent it</strong>: spend the first week measuring it, and start the cycle with a real number. A quarter that begins on a false baseline produces twelve weeks of false conclusions.</p>

<h2 id="exemple">A worked example, line by line</h2>
<p>The personal OKR sheet ships with this objective already entered, captured at week 4 of a 12-week cycle:</p>
<div class="table-wrap"><table>
<thead><tr><th>Key result</th><th>Start</th><th>Target</th><th>Current</th><th>Progress</th></tr></thead>
<tbody>
<tr><td>Run 3 sessions a week for 12 weeks (36 sessions)</td><td>0</td><td>36</td><td>9</td><td>25 %</td></tr>
<tr><td>Go from 0 to 10 km without stopping</td><td>0</td><td>10</td><td>4</td><td>40 %</td></tr>
<tr><td>Sleep 7 hours 30 on average per night (hours)</td><td>6.5</td><td>7.5</td><td>7.0</td><td>50 %</td></tr>
</tbody>
</table></div>
<p>Three things are worth noticing. First, <strong>the unit is in the wording</strong> (sessions, km, hours): without it, after a month you no longer know whether "9" is a number of runs or of kilometres. Second, the third key result starts at 6.5 rather than zero, which is exactly the case where progress computed without a starting value would lie, showing 93 % instead of 50 %. Third, the first row is at 25 % in week 4 of 12, which is precisely on schedule: the comparison that counts is not "where am I", but "where am I <em>relative to how much of the cycle has elapsed</em>".</p>
<p>That is the reading to get into the habit of, and it is the same one as a <a href="/en/blog/tableau-de-bord-productivite">productivity dashboard</a>: what steers a decision is the trajectory, never the absolute value.</p>

<h2 id="revue">The 10-minute weekly review</h2>
<p>The template is only worth as much as this ritual. Without it you will have filled in a nice table in January and reopened it in April, with the unpleasant feeling of having lost a quarter.</p>
<p>Put a recurring 10-minute slot in the calendar, on the same day each week, and block it like an appointment: it is the most profitable use of <a href="/en/blog/time-blocking-guide">time-blocking</a> there is. During those 10 minutes, three moves, in this order:</p>
<ol>
<li><strong>Update the "current value" column</strong>, and only that. You do not rewrite your objectives during a review: that is how people end up adjusting the target to the result rather than the other way round.</li>
<li><strong>Spot the key result furthest behind</strong> relative to how much of the cycle has elapsed. One only, the worst.</li>
<li><strong>Write a single next action</strong> in the Notes column, and carry it into your task list for the week. A concrete action, doable in under two hours.</li>
</ol>
<p>That is all. The review is neither a report nor a tribunal, it is a set of points. It has done its job if it produces <strong>one line in your following week</strong>.</p>

<h2 id="scorer">Scoring your cycle at the end (and why 70 % is a success)</h2>
<p>At the end of the quarter, the average of an objective's progress gives its score, between 0 and 100 %. The reading grid, inherited from practice at Intel and then Google:</p>
<ul>
<li><strong>60 to 80 %</strong>: the zone to aim for. The objective was ambitious and you genuinely moved.</li>
<li><strong>Above 90 %, consistently</strong>: your targets are too low. Next quarter, raise them until it feels uncomfortable.</li>
<li><strong>Below 40 %</strong>: the question is not "did I work hard enough?" but "was this the right objective?". An objective at 20 % halfway through is not behind, it is being abandoned without anybody saying so.</li>
</ul>
<p>The score is there to calibrate the next cycle, never to evaluate a person. As soon as an OKR score decides a bonus, targets collapse within three quarters: everybody learns to promise only what they already know they can deliver. And if your need is to <em>monitor</em> rather than to <em>change</em>, what you want is a KPI, not an OKR. The distinction is set out in <a href="/en/blog/okr-vs-smart-vs-kpi">OKRs vs SMART vs KPIs</a>.</p>

<h2 id="equipe">Adapting the template for a team</h2>
<p>The team and startup sheet is enough for 2 to 5 people. Three adjustments make it usable collectively:</p>
<ul>
<li><strong>An "owner" column.</strong> A key result with no name against it does not move. One owner per key result, not per objective: that is the granularity that makes the review possible.</li>
<li><strong>A "confidence" column, 1 to 5.</strong> Filled in at every review, it captures what progress cannot see: a key result at 60 % whose confidence drops from 4 to 2 is a warning three weeks before the number falls away.</li>
<li><strong>One tab per team, never one file per person.</strong> The day the file gets duplicated, versions diverge and tracking dies. That is the structural limit of a spreadsheet in a group, and it arrives quickly: beyond five people the question is no longer <em>whether</em> but <em>when</em>. The subject is taken head on in the <a href="/en/for-teams">Cosmo for teams</a> page.</li>
</ul>

<h2 id="erreurs">The 4 most common filling-in mistakes</h2>
<ol>
<li><strong>Confusing a key result with a task.</strong> "Send 50 applications" is an activity, "land 5 interviews" is a result. The first is achieved by working a lot, the second by working well.</li>
<li><strong>Putting a number in the objective.</strong> If the objective already carries the measure, the key results become a task list and the method loses its point. The objective inspires, the key results measure.</li>
<li><strong>Filling all 8 available rows.</strong> The template offers 2 blank objectives of 4 key results each. That is a capacity, not an instruction: two objectives of three key results beat eight rows you will never read again.</li>
<li><strong>Changing targets along the way.</strong> A target that moves in week 7 is no longer a target. Note in the Notes column why it was wrong instead, and use that to calibrate the next cycle.</li>
</ol>
<p>If a term in the field escapes you (key result, cycle, KPI, sandbagging), the <a href="/en/blog/glossaire-productivite">productivity glossary</a> defines them all in one sentence.</p>

<h2 id="pieges">The 3 traps of tracking in a spreadsheet</h2>
<p>This template is the best way to start today. Let us be honest about its limits, familiar to anybody who has tracked OKRs in Excel:</p>
<ol>
<li><strong>Nobody opens the file.</strong> A spreadsheet does not chase you: the weekly update rests entirely on your discipline, precisely the resource OKRs are supposed to save.</li>
<li><strong>Tracking is disconnected from the action.</strong> Your daily tasks live elsewhere, and the link between "what I do today" and "my goals for the quarter" stays invisible.</li>
<li><strong>No visual history.</strong> A cell at 40 % does not tell you your trajectory: steady progress, or a last-minute sprint?</li>
</ol>
<p>If those limits are holding you back, <a href="/en/">Cosmo</a> has OKRs built in: progress updated as you act, a chart of key results achieved on the dashboard, and your goals living next to your <a href="/en/blog/time-blocking-guide">scheduled tasks</a> and your habits. <a href="/en/signup">Free</a>, with a demo and no sign-up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Does the template work in Google Sheets?</h3>
<p>Yes: import the .xlsx file into Google Sheets (File then Import) and the progress formulas are preserved. It is also compatible with LibreOffice Calc and Numbers.</p>
<h3>Can I share it with my team?</h3>
<p>Yes, freely. If each member tracks their own OKRs, duplicate the team and startup sheet once per person, keeping a single file for everybody rather than one file each.</p>
<h3>Do I have to give an email address to download it?</h3>
<p>No. The link is direct, with no form and no sign-up. We would rather you judged the content than gave us your address.</p>
<h3>How many objectives should go in the template?</h3>
<p>Two to four per cycle, with 2 to 5 key results each. The template offers more for layout comfort, not as a quota to fill. Beyond four, the weekly review runs past ten minutes and stops happening.</p>
<h3>Can I start mid-quarter?</h3>
<p>Yes, and it is better than waiting. Take the remaining weeks as your cycle length and scale the targets down in proportion: a well-tracked seven-week cycle beats a twelve-week cycle that starts in a month.</p>
<h3>What if I miss two reviews in a row?</h3>
<p>Pick up at the next one, without catching up the missed weeks. Nothing in the template depends on history, only the current value counts. It is mostly a signal that the review slot needs moving, not that willpower needs raising.</p>
`,
    },
    hr: {
      title: "Besplatan OKR predložak (Excel): osobni i timski, spreman za ispunjavanje",
      metaTitle: "Besplatan OKR predložak za preuzimanje (Excel)",
      description: "Preuzmite naš besplatan OKR predložak u Excelu: ispunjeni primjeri, automatski izračun napretka, osobna i timska verzija. Bez e-pošte.",
      readingMinutes: 10,
      faq: [
        ["Radi li OKR predložak u Google Sheetsu?", "Da: uvezite .xlsx datoteku u Google Sheets (Datoteka → Uvezi), formule za napredak ostaju sačuvane. Kompatibilan je i s LibreOffice Calcom i Numbersom."],
        ["Mogu li predložak podijeliti sa svojim timom?", "Da, slobodno. Ako svatko prati vlastite OKR-ove, duplicirajte list „OKR tim-startup“ za svaku osobu i zadržite jednu datoteku za sve."],
        ["Treba li za preuzimanje ostaviti e-poštu?", "Ne. Poveznica je izravna, bez obrasca i bez registracije."],
        ["Koliko ciljeva staviti u predložak?", "Od 2 do 4 po ciklusu, sa po 2 do 5 ključnih rezultata. Više od toga i tjedni pregled traje dulje od deset minuta, pa se prestane održavati."],
        ["Može li se početi usred tromjesečja?", "Da, i bolje je nego čekati: preostale tjedne uzmite kao trajanje ciklusa i razmjerno prilagodite ciljane vrijednosti."],
      ],
      html: `
<p class="lead">Metodu poznajete, nedostaje vam samo alat. Evo <strong>besplatnog OKR predloška u Excelu</strong> (kompatibilan s Google Sheetsom i LibreOfficeom): dva lista spremna za ispunjavanje (osobni OKR-ovi i OKR-ovi tima/startupa), s konkretnim primjerima i automatskim izračunom napretka. Izravno preuzimanje, <strong>bez traženja e-pošte</strong>.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="OKR-ovi u Cosmu: svaki cilj prikazuje svoje ključne rezultate, napredak i proteklo vrijeme razdoblja." /><figcaption>OKR-ovi u Cosmu: svaki cilj prikazuje svoje ključne rezultate, napredak i proteklo vrijeme razdoblja. Snimka demo načina, izmišljeni podaci.</figcaption></figure>

<p><a href="/downloads/template-okr-cosmo.xlsx" download><strong>Preuzmite OKR predložak (.xlsx, 9 KB)</strong></a></p>

<h2 id="contenu">Što sadrži predložak</h2>
<ul>
<li><strong>Upute za korištenje</strong>: 5 pravila da vaši OKR-ovi funkcioniraju, na jednoj stranici.</li>
<li><strong>Osobni OKR-ovi</strong>: jedan potpuno ispunjen primjer (povratak u formu) + dva prazna cilja s ključnim rezultatima.</li>
<li><strong>OKR-ovi tima / startupa</strong>: primjer akvizicije (SEO sadržaj) + ista struktura.</li>
<li><strong>Automatski napredak</strong>: unesite početnu, ciljanu i trenutačnu vrijednost. Postotak se izračunava sam, ograničen između 0 i 100 %.</li>
</ul>

<h3>7 stupaca i čemu svaki služi</h3>
<div class="table-wrap"><table>
<thead><tr><th>Stupac</th><th>Što upisati</th><th>Zašto postoji</th></tr></thead>
<tbody>
<tr><td>Cilj</td><td>Kvalitativan smjer, bez brojki</td><td>Spojen preko svih redaka svojih ključnih rezultata: cilj koji nema nijedan odmah upada u oči</td></tr>
<tr><td>Ključni rezultat</td><td>Provjerljiva mjera, s jedinicom</td><td>To je jedini redak koji ćete ažurirati svaki tjedan</td></tr>
<tr><td>Početna vrijednost</td><td>Gdje ste prvoga dana</td><td>Bez nje napredak od 40 % ne znači ništa</td></tr>
<tr><td>Ciljana vrijednost</td><td>Gdje želite biti na kraju ciklusa</td><td>Tjera vas da odlučite između ambicije i fikcije</td></tr>
<tr><td>Trenutačna vrijednost</td><td>Današnje mjerenje</td><td>Jedini broj koji mijenjate tijekom tjednog pregleda</td></tr>
<tr><td>Napredak</td><td>Ništa: to je formula</td><td>(trenutačna − početna) / (ciljana − početna), ograničeno na 0 i 100 %</td></tr>
<tr><td>Bilješke / sljedeći korak</td><td>Jedna rečenica, ne dnevnik</td><td>Najzanemareniji i najkorisniji stupac: pretvara zapažanje u odluku</td></tr>
</tbody>
</table></div>
<p>Napredak je namjerno ograničen: ključni rezultat na 130 % u ovom predlošku ne postoji. Premašiti ciljanu vrijednost nije uspjeh, nego znak da je cilj loše postavljen, a kad bi to premašivanje napuhalo prosjek, sakrilo bi cilj koji zaostaje odmah do njega.</p>

<h2 id="utiliser">Kako ga koristiti u 4 koraka</h2>
<ol>
<li><strong>Odaberite 2 do 4 cilja</strong> za sljedećih 12 tjedana. Ne više, upravo to ograničenje čini metodu. Cilj je kvalitativan i motivirajući: brojkama u njemu nije mjesto.</li>
<li><strong>Napišite 2 do 5 ključnih rezultata po cilju.</strong> Svaki mora biti provjerljiv broj: „s 0 na 10 km neprekidnog trčanja“, a ne „bolje trčati“. Ako niste sigurni kako ih formulirati, poslužite se našim <a href="/hr/blog/methode-okr-exemples">15 komentiranih primjera OKR-ova</a>.</li>
<li><strong>Upišite početnu i ciljanu vrijednost.</strong> To omogućuje izračun napretka i tjera vas da znate odakle krećete, korak koji svi preskaču.</li>
<li><strong>Ažurirajte svaki tjedan.</strong> 10 minuta, isti dan svakog tjedna (petak dobro funkcionira). Taj ritual razlikuje OKR od novogodišnje odluke.</li>
</ol>

<h2 id="cibles">Kako postaviti početnu i ciljanu vrijednost bez samozavaravanja</h2>
<p>To je korak koji određuje vrijednost cijelog tromjesečja, a upravo ga se odrađuje na brzinu. Prijete mu dvije suprotne pogreške.</p>
<p>Prva je <strong>sandbagging</strong>: postaviti cilj za koji već znate da ćete ga dosegnuti. Rezultat je zelena tablica i tromjesečje bez učinka. Provjera je jednostavna: ako ste 90 % sigurni da ćete uspjeti, to nije ključni rezultat, nego prognoza.</p>
<p>Druga je <strong>ukrasni cilj</strong>: „s 2000 na 50 000 posjeta“. Nitko u to ne vjeruje, pa ga nitko ne koristi pri odlučivanju, i cilj se tiho napušta već u 4. tjednu. Koristan cilj je neugodan, ali nije apsurdan.</p>
<p>Praktično mjerilo: ciljajte vrijednost za koju procjenjujete da je možete dosegnuti s <strong>50 do 70 % vjerojatnosti</strong>. U OKR kulturi završetak ciklusa oko 70 % znak je dobro odmjerenog cilja, a 100 % posvuda znači da ste ciljali prenisko.</p>
<p>Ako ne znate početnu vrijednost, <strong>nemojte je izmisliti</strong>: prvi tjedan posvetite mjerenju i ciklus započnite sa stvarnim brojem. Tromjesečje koje počinje na pogrešnoj osnovi daje dvanaest tjedana pogrešnih zaključaka.</p>

<h2 id="exemple">Ispunjen primjer, redak po redak</h2>
<p>List „Osobni OKR-ovi“ dolazi s ovim već unesenim ciljem, prikazanim u 4. tjednu ciklusa od 12:</p>
<div class="table-wrap"><table>
<thead><tr><th>Ključni rezultat</th><th>Početna</th><th>Ciljana</th><th>Trenutačna</th><th>Napredak</th></tr></thead>
<tbody>
<tr><td>Trčati 3 puta tjedno tijekom 12 tjedana (36 treninga)</td><td>0</td><td>36</td><td>9</td><td>25 %</td></tr>
<tr><td>S 0 na 10 km neprekidnog trčanja</td><td>0</td><td>10</td><td>4</td><td>40 %</td></tr>
<tr><td>Spavati u prosjeku 7 h 30 min po noći (sati)</td><td>6,5</td><td>7,5</td><td>7,0</td><td>50 %</td></tr>
</tbody>
</table></div>
<p>Vrijedi primijetiti tri stvari. Prvo, <strong>jedinica je u nazivu</strong> (treninzi, km, sati): bez nje nakon mjesec dana više ne znate je li „9“ broj izlazaka ili kilometara. Drugo, treći ključni rezultat kreće od 6,5, a ne od nule: upravo bi tu napredak izračunat bez početne vrijednosti lagao i prikazao 93 % umjesto 50 %. Na kraju, prvi redak je na 25 % u 4. od 12 tjedana, dakle točno u roku: važna usporedba nije „gdje sam“, nego „gdje sam <em>u odnosu na proteklo vrijeme ciklusa</em>“.</p>
<p>Takvo čitanje treba vam postati navika, a isto je kao kod <a href="/hr/blog/tableau-de-bord-productivite">nadzorne ploče produktivnosti</a>: odluku usmjerava putanja, nikad apsolutna vrijednost.</p>

<h2 id="revue">Tjedni pregled od 10 minuta</h2>
<p>Predložak vrijedi samo uz ovaj ritual. Bez njega ćete u siječnju ispuniti lijepu tablicu i ponovno je otvoriti u travnju, s neugodnim osjećajem da ste izgubili tromjesečje.</p>
<p>Postavite ponavljajući termin od 10 minuta, isti dan svakog tjedna, i blokirajte ga kao sastanak: to je najisplativija primjena <a href="/hr/blog/time-blocking-guide">time-blockinga</a>. Tijekom tih 10 minuta napravite tri stvari, ovim redom:</p>
<ol>
<li><strong>Ažurirajte stupac „Trenutačna vrijednost“</strong>, i samo njega. Tijekom pregleda ciljevi se ne prepravljaju: tako se na kraju ciljana vrijednost prilagođava rezultatu, umjesto obrnuto.</li>
<li><strong>Pronađite ključni rezultat koji najviše zaostaje</strong> u odnosu na proteklo vrijeme ciklusa. Samo jedan, najgori.</li>
<li><strong>Napišite samo jedan sljedeći korak</strong> u stupac Bilješke i prenesite ga u popis zadataka za taj tjedan. Konkretan korak, izvediv za manje od dva sata.</li>
</ol>
<p>To je sve. Pregled nije ni bilanca ni sud, nego skretnica. Ispunio je svoju ulogu ako stvori <strong>jedan redak u vašem sljedećem tjednu</strong>.</p>

<h2 id="scorer">Ocjena ciklusa na kraju (i zašto je 70 % uspjeh)</h2>
<p>Na kraju tromjesečja prosjek napretka jednog cilja daje njegovu ocjenu, između 0 i 100 %. Ljestvica za tumačenje, naslijeđena iz prakse Intela, a zatim Googlea:</p>
<ul>
<li><strong>60 do 80 %</strong>: ciljana zona. Cilj je bio ambiciozan i stvarno ste napredovali.</li>
<li><strong>Iznad 90 %, redovito</strong>: ciljane vrijednosti su vam preniske. Sljedeće tromjesečje podižite ih dok ne postane neugodno.</li>
<li><strong>Ispod 40 %</strong>: pitanje nije „jesam li dovoljno radio?“, nego „je li to bio pravi cilj?“. Cilj na 20 % na polovici ciklusa ne zaostaje, nego ga se napušta, a da to nitko ne kaže.</li>
</ul>
<p>Ocjena služi za odmjeravanje sljedećeg ciklusa, nikad za ocjenjivanje osobe. Čim OKR ocjena počne odlučivati o bonusu, ciljane vrijednosti se urušavaju za tri tromjesečja: svatko nauči obećavati samo ono što već zna da može ispuniti. A ako trebate <em>nadzirati</em>, a ne <em>mijenjati</em>, treba vam KPI, a ne OKR. Razlika je detaljno objašnjena u članku <a href="/hr/blog/okr-vs-smart-vs-kpi">OKR, SMART ili KPI</a>.</p>

<h2 id="equipe">Prilagodba predloška za tim</h2>
<p>List „OKR tim-startup“ dovoljan je za 2 do 5 osoba. Tri prilagodbe čine ga upotrebljivim za skupni rad:</p>
<ul>
<li><strong>Stupac „Nositelj“.</strong> Ključni rezultat bez imena pored njega ne napreduje. Jedan nositelj po ključnom rezultatu, a ne po cilju: ta razina detalja omogućuje pregled.</li>
<li><strong>Stupac „Pouzdanje“ (1 do 5).</strong> Upisuje se na svakom pregledu i bilježi ono što napredak ne vidi: ključni rezultat na 60 % kojemu pouzdanje padne s 4 na 2 znak je upozorenja tri tjedna prije nego što broj zaostane.</li>
<li><strong>Jedna kartica po timu, nikad datoteka po osobi.</strong> Onog dana kad se datoteka duplicira, verzije se razilaze i praćenje umire. To je strukturna granica proračunske tablice u timskom radu i brzo se dosegne: iznad pet osoba pitanje više nije <em>hoće li</em>, nego <em>kada</em>. Tom se temom izravno bavi stranica <a href="/hr/za-timove">Cosmo za timove</a>.</li>
</ul>

<h2 id="erreurs">4 najčešće pogreške pri ispunjavanju</h2>
<ol>
<li><strong>Brkanje ključnog rezultata i zadatka.</strong> „Poslati 50 prijava“ je aktivnost, „dobiti 5 razgovora za posao“ je rezultat. Prvo se ispunjava puno rada, drugo pametnim radom.</li>
<li><strong>Brojka u cilju.</strong> Ako cilj već sadrži mjeru, ključni rezultati postaju popis zadataka i metoda gubi smisao. Cilj nadahnjuje, ključni rezultati mjere.</li>
<li><strong>Ispunjavanje svih 8 raspoloživih redaka.</strong> Predložak nudi 2 prazna cilja sa po 4 ključna rezultata. To je kapacitet, a ne zadatak: dva cilja s po tri ključna rezultata vrijede više od osam redaka koje nikad nećete ponovno pročitati.</li>
<li><strong>Mijenjanje ciljanih vrijednosti usput.</strong> Ciljana vrijednost koja se pomakne u 7. tjednu više nije cilj. Umjesto toga u stupac Bilješke zapišite zašto je bila loša i iskoristite to za odmjeravanje sljedećeg ciklusa.</li>
</ol>
<p>Ako vam neki pojam izmiče (ključni rezultat, ciklus, KPI, sandbagging), <a href="/hr/blog/glossaire-productivite">pojmovnik produktivnosti</a> svaki definira jednom rečenicom.</p>

<h2 id="pieges">3 zamke praćenja u proračunskoj tablici</h2>
<p>Ovaj predložak najbolji je način da počnete već danas. Budimo iskreni o njegovim ograničenjima, poznatima svakome tko je ikad pratio OKR-ove u Excelu:</p>
<ol>
<li><strong>Nitko ne otvara datoteku.</strong> Tablica vas ne podsjeća: tjedno ažuriranje u potpunosti ovisi o vašoj disciplini, upravo o resursu koji bi OKR-ovi trebali štedjeti.</li>
<li><strong>Praćenje je odvojeno od djelovanja.</strong> Vaši dnevni zadaci žive negdje drugdje, a veza između „onoga što danas radim“ i „mojih ciljeva za tromjesečje“ ostaje nevidljiva.</li>
<li><strong>Nema vizualne povijesti.</strong> Ćelija na 40 % ne govori o vašoj putanji: ravnomjeran napredak ili sprint u zadnji čas?</li>
</ol>
<p>Ako vas ta ograničenja koče, <a href="/hr/">Cosmo</a> ima OKR-ove ugrađene: napredak se ažurira usporedno s vašim aktivnostima, grafikon ostvarenih ključnih rezultata nalazi se na nadzornoj ploči, a ciljevi žive uz vaše <a href="/hr/blog/time-blocking-guide">planirane zadatke</a> i navike. <a href="/hr/signup">Besplatno</a>, demo bez registracije.</p>

<h2 id="faq">Česta pitanja</h2>
<h3>Radi li predložak u Google Sheetsu?</h3>
<p>Da: uvezite .xlsx datoteku u Google Sheets (Datoteka → Uvezi), formule za napredak ostaju sačuvane. Kompatibilan je i s LibreOffice Calcom i Numbersom.</p>
<h3>Mogu li ga podijeliti sa svojim timom?</h3>
<p>Da, slobodno. Ako svaki član prati vlastite OKR-ove, duplicirajte list „OKR tim-startup“ za svaku osobu i zadržite jednu datoteku za sve, umjesto jedne datoteke po osobi.</p>
<h3>Treba li za preuzimanje ostaviti e-poštu?</h3>
<p>Ne. Poveznica je izravna, bez obrasca i bez registracije. Radije ćemo da procijenite sadržaj nego da prikupimo vašu adresu.</p>
<h3>Koliko ciljeva staviti u predložak?</h3>
<p>Od 2 do 4 po ciklusu, sa po 2 do 5 ključnih rezultata. Predložak ih nudi više radi preglednosti, a ne kao kvotu koju treba ispuniti. Iznad četiri tjedni pregled traje dulje od deset minuta i prestane se održavati.</p>
<h3>Mogu li početi usred tromjesečja?</h3>
<p>Da, i to je čak bolje nego čekati. Preostale tjedne uzmite kao trajanje ciklusa i razmjerno smanjite ciljane vrijednosti: dobro praćen ciklus od sedam tjedana vrijedi više od ciklusa od dvanaest tjedana koji počinje za mjesec dana.</p>
<h3>Što ako propustim dva pregleda zaredom?</h3>
<p>Nastavite na sljedećem, bez nadoknađivanja propuštenih tjedana. Ništa u predlošku ne ovisi o povijesti: važna je samo trenutačna vrijednost. To je prije svega znak da treba premjestiti termin pregleda, a ne pojačati volju.</p>
`,
    },
  },
};
