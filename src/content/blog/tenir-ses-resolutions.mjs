// Article de blog, contenu partagé React + prerender. ESM pur.
// Page saisonnière (plan SEO C1) : slug SANS année, contenu remis à jour
// chaque décembre. Structure et règles : src/content/blog/index.mjs.
export const article = {
  slug: "tenir-ses-resolutions",
  datePublished: "2026-11-25",
  dateModified: "2026-11-25",
  related: ["combien-de-temps-prendre-habitude","objectifs-de-l-annee","habit-tracker-a-imprimer"],
  locales: {
    fr: {
      title: "Bonnes résolutions : pourquoi elles échouent, et comment tenir les vôtres en 2027",
      metaTitle: "Bonnes résolutions : pourquoi elles échouent (et comment tenir)",
      description: "Les bonnes résolutions ne sont pas condamnées : la recherche montre ce qui fait la différence. 6 raisons d'échec et ce qui marche vraiment pour tenir en 2027.",
      readingMinutes: 7,
      faq: [
        ["Est-il vrai que presque toutes les résolutions échouent ?", "Non. Dans l'étude de Norcross (2002), environ 46 % des personnes qui avaient pris une résolution la tenaient encore six mois plus tard, contre 4 % de celles qui voulaient changer sans résolution formelle."],
        ["Combien de résolutions prendre ?", "Une à trois. Chaque changement demande de l'attention pendant des semaines ; les empiler est le moyen le plus sûr de toutes les abandonner."],
        ["Que faire si j'ai déjà craqué en janvier ?", "Reprendre le lendemain, sans attendre lundi ni le mois suivant. Un écart isolé ne défait pas une habitude ; c'est l'abandon qui la défait."],
      ],
      html: `
<p class="lead">On lit partout que « 92 % des résolutions échouent ». Le chiffre est invérifiable, et la réalité est plus encourageante : dans une étude de suivi menée par le psychologue John Norcross (2002), <strong>environ 46 % des personnes qui avaient pris une résolution la tenaient encore six mois plus tard</strong>, contre 4 % de celles qui voulaient changer la même chose sans s'être fixé de résolution. Prendre une résolution aide donc. Ce qui fait la différence, c'est la façon de s'y prendre.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Le suivi d'habitudes de Cosmo : tableau hebdomadaire des habitudes cochées, avec la série de jours consécutifs de chacune." /><figcaption>Le suivi d'habitudes de Cosmo : tableau hebdomadaire des habitudes cochées, avec la série de jours consécutifs de chacune. Capture du mode démo, données fictives.</figcaption></figure>

<h2 id="raisons">Les 6 raisons pour lesquelles les résolutions échouent</h2>
<h3>1. Elles sont formulées comme des interdits</h3>
<p>« Arrêter le sucre », « ne plus procrastiner ». Une étude suédoise menée sur plus de 1 000 personnes (Oscarsson et al., 2020) a comparé les résolutions formulées comme un but à atteindre et celles formulées comme quelque chose à éviter : à un an, <strong>59 % des premières étaient tenues contre 47 % des secondes</strong>. « Manger un fruit au goûter » tient mieux que « arrêter les biscuits ».</p>
<h3>2. Elles sont vagues</h3>
<p>« Faire plus de sport » n'indique ni quand, ni combien, ni comment savoir que c'est réussi. Une résolution sans mesure ne produit jamais de victoire, et la motivation s'épuise faute de preuve de progrès.</p>
<h3>3. Elles sont trop nombreuses</h3>
<p>Chaque changement de comportement consomme de l'attention pendant des semaines. Sept résolutions le 1er janvier, c'est sept chantiers ouverts en même temps, et la garantie d'en fermer la plupart d'ici février.</p>
<h3>4. On sous-estime la durée</h3>
<p>Le mythe des 21 jours fait croire qu'en trois semaines, tout devrait être facile. En réalité, une habitude met en moyenne 66 jours à devenir automatique, et jusqu'à plus de 250 jours pour les plus exigeantes (voir <a href="/blog/combien-de-temps-prendre-habitude">combien de temps pour prendre une habitude</a>). Quand l'effort est encore là fin janvier, on croit avoir échoué alors qu'on est simplement dans la moyenne.</p>
<h3>5. Il n'y a aucun plan pour les obstacles</h3>
<p>Le soir où l'on rentre tard, le week-end chez des amis, la semaine de rush au travail : ce sont des situations prévisibles, et c'est là que les résolutions cassent. Sans réponse préparée, la décision se prend dans le moment, quand la fatigue l'emporte.</p>
<h3>6. Personne ne vérifie</h3>
<p>Une résolution écrite le 31 décembre et jamais relue disparaît en silence. L'absence de suivi ne fait pas seulement oublier : elle empêche de voir les progrès réels, qui existent souvent.</p>

<h2 id="methode">Ce qui marche vraiment : 6 règles</h2>
<h3>1. Formulez un but positif et concret</h3>
<p>Transformez chaque interdit en action : « me coucher avant 23 h » plutôt que « moins d'écrans le soir », « marcher 20 minutes après le déjeuner » plutôt que « être moins sédentaire ».</p>
<h3>2. Rendez-la mesurable</h3>
<p>Ajoutez un chiffre et une échéance : « 3 séances de sport par semaine jusqu'à fin mars ». C'est exactement ce que fait la <a href="/blog/objectifs-de-l-annee">méthode OKR appliquée aux objectifs de l'année</a> : une direction, et des résultats chiffrés par trimestre.</p>
<h3>3. Limitez-vous à trois</h3>
<p>Une à trois résolutions, pas plus. Les autres attendront le trimestre suivant : une résolution reportée n'est pas abandonnée.</p>
<h3>4. Écrivez des plans « si… alors… »</h3>
<p>C'est l'une des techniques les mieux étudiées en psychologie du changement : les « intentions de mise en œuvre » du chercheur Peter Gollwitzer. On décide à l'avance d'une réponse à une situation précise : « Si je rentre après 20 h, alors je fais 10 minutes d'étirements au lieu de la séance complète. » Une méta-analyse de 94 études (Gollwitzer et Sheeran, 2006) a montré un effet net sur l'atteinte des objectifs. Écrivez-en un pour chaque obstacle prévisible.</p>
<h3>5. Commencez petit, augmentez ensuite</h3>
<p>Deux minutes de méditation tenues tous les jours valent mieux que vingt minutes abandonnées le 10 janvier. On installe d'abord le déclencheur, on augmente la dose quand il est automatique.</p>
<h3>6. Suivez, et relisez chaque semaine</h3>
<p>Une croix par jour sur un <a href="/blog/habit-tracker-a-imprimer">habit tracker à imprimer</a> ou dans une application, et dix minutes chaque semaine pour regarder où vous en êtes. Le suivi rend visible une régularité que vous ne ressentez pas encore, et il permet de corriger avant de décrocher.</p>

<h2 id="exemple">Avant / après : trois résolutions réécrites</h2>
<div class="table-wrap"><table>
<thead><tr><th>Résolution classique</th><th>Version qui tient</th><th>Plan « si… alors… »</th></tr></thead>
<tbody>
<tr><td>Faire plus de sport</td><td>3 séances de 20 min par semaine jusqu'à fin mars</td><td>Si je rate le matin, alors je marche 20 min le soir</td></tr>
<tr><td>Arrêter de procrastiner</td><td>Commencer chaque journée par 25 min sur la tâche la plus importante</td><td>Si j'ouvre ma messagerie en premier, alors je la referme et je lance le minuteur</td></tr>
<tr><td>Lire plus</td><td>10 pages chaque soir avant d'éteindre</td><td>Si je suis trop fatigué, alors je lis une seule page</td></tr>
</tbody>
</table></div>

<h2 id="craquer">Si vous craquez (et ça arrivera)</h2>
<p>Un jour raté n'efface rien : la recherche sur la formation des habitudes montre qu'un écart isolé n'a pas d'effet mesurable. Ce qui compte, c'est de ne pas rater deux fois de suite. Et inutile d'attendre lundi ou le 1er du mois pour reprendre : les chercheurs Hengchen Dai, Katherine Milkman et Jason Riis ont décrit un « effet nouveau départ » (2014), mais chaque lendemain en est un.</p>

<h2 id="preparer">Préparer ses résolutions en trois temps</h2>
<ol>
<li><strong>Faire le bilan</strong> de l'année qui se termine, pour ne pas reprendre les mêmes objectifs avec les mêmes obstacles : <a href="/blog/bilan-de-l-annee">le bilan de l'année en 10 questions</a>.</li>
<li><strong>Choisir trois objectifs</strong> et les rendre mesurables avec la méthode OKR.</li>
<li><strong>Traduire chaque objectif en une ou deux habitudes</strong>, suivies chaque jour.</li>
</ol>
<p><a href="/">Cosmo</a> réunit ces trois niveaux dans une seule application : objectifs, habitudes avec leur série de jours, tâches et agenda. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Est-il vrai que presque toutes les résolutions échouent ?</h3>
<p>Non. Dans l'étude de Norcross (2002), environ 46 % des personnes qui avaient pris une résolution la tenaient encore six mois plus tard, contre 4 % de celles qui voulaient changer sans résolution formelle.</p>
<h3>Combien de résolutions prendre ?</h3>
<p>Une à trois. Chaque changement demande de l'attention pendant des semaines ; les empiler est le moyen le plus sûr de toutes les abandonner.</p>
<h3>Que faire si j'ai déjà craqué en janvier ?</h3>
<p>Reprendre le lendemain, sans attendre lundi ni le mois suivant. Un écart isolé ne défait pas une habitude ; c'est l'abandon qui la défait.</p>
`,
    },
    en: {
      title: "New Year's resolutions: why they fail, and how to keep yours in 2027",
      metaTitle: "New Year's resolutions: why they fail (and how to keep them)",
      description: "New Year's resolutions are not doomed: research shows what makes the difference. 6 reasons they fail and what actually works to keep them in 2027.",
      readingMinutes: 7,
      faq: [
        ["Is it true that almost all resolutions fail?", "No. In Norcross's study (2002), about 46% of people who made a resolution were still keeping it six months later, compared with 4% of those who wanted to change without a formal resolution."],
        ["How many resolutions should I make?", "One to three. Each change needs attention for weeks; stacking them is the surest way to drop them all."],
        ["What if I have already slipped in January?", "Start again the next day, without waiting for Monday or next month. A single slip does not undo a habit; quitting does."],
      ],
      html: `
<p class="lead">You read everywhere that "92% of resolutions fail". The figure cannot be verified, and the reality is more encouraging: in a follow-up study led by psychologist John Norcross (2002), <strong>about 46% of people who made a resolution were still keeping it six months later</strong>, compared with 4% of those who wanted to change the same thing without making a resolution. So making a resolution helps. What makes the difference is how you go about it.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days." /><figcaption>Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="raisons">The 6 reasons resolutions fail</h2>
<h3>1. They are phrased as bans</h3>
<p>"Quit sugar", "stop procrastinating". A Swedish study of more than 1,000 people (Oscarsson et al., 2020) compared resolutions phrased as something to achieve with those phrased as something to avoid: after one year, <strong>59% of the former were kept versus 47% of the latter</strong>. "Eat a piece of fruit in the afternoon" lasts better than "stop eating biscuits".</p>
<h3>2. They are vague</h3>
<p>"Exercise more" says neither when, nor how much, nor how you will know it worked. A resolution without a measure never produces a win, and motivation runs dry for lack of proof of progress.</p>
<h3>3. There are too many</h3>
<p>Every behaviour change consumes attention for weeks. Seven resolutions on January 1st means seven projects open at once, and a guarantee that most of them close by February.</p>
<h3>4. We underestimate how long it takes</h3>
<p>The 21-day myth makes you think everything should be easy after three weeks. In reality a habit takes 66 days on average to become automatic, and more than 250 days for the most demanding ones (see <a href="/en/blog/combien-de-temps-prendre-habitude">how long it takes to build a habit</a>). When it still takes effort at the end of January, you think you have failed when you are simply average.</p>
<h3>5. There is no plan for obstacles</h3>
<p>The evening you get home late, the weekend at friends', the crunch week at work: these are predictable situations, and that is where resolutions break. Without a prepared answer, the decision is made in the moment, when tiredness wins.</p>
<h3>6. Nobody checks</h3>
<p>A resolution written on December 31st and never reread disappears quietly. Lack of tracking does not just make you forget: it hides the real progress, which often exists.</p>

<h2 id="methode">What actually works: 6 rules</h2>
<h3>1. Phrase a positive, concrete goal</h3>
<p>Turn each ban into an action: "be in bed before 11 pm" rather than "fewer screens at night", "walk 20 minutes after lunch" rather than "be less sedentary".</p>
<h3>2. Make it measurable</h3>
<p>Add a number and a deadline: "3 workouts a week until the end of March". That is exactly what <a href="/en/blog/objectifs-de-l-annee">the OKR method applied to your goals for the year</a> does: a direction, and numbered results each quarter.</p>
<h3>3. Limit yourself to three</h3>
<p>One to three resolutions, no more. The rest can wait for next quarter: a postponed resolution is not an abandoned one.</p>
<h3>4. Write "if... then..." plans</h3>
<p>It is one of the best-studied techniques in the psychology of change: psychologist Peter Gollwitzer's "implementation intentions". You decide in advance how to respond to a specific situation: "If I get home after 8 pm, then I do 10 minutes of stretching instead of the full workout." A meta-analysis of 94 studies (Gollwitzer and Sheeran, 2006) found a clear effect on goal attainment. Write one for each foreseeable obstacle.</p>
<h3>5. Start small, then build up</h3>
<p>Two minutes of meditation kept every day beat twenty minutes abandoned on January 10th. Install the trigger first, raise the dose once it is automatic.</p>
<h3>6. Track it, and review every week</h3>
<p>One cross a day on a <a href="/en/blog/habit-tracker-a-imprimer">printable habit tracker</a> or in an app, and ten minutes each week to see where you stand. Tracking makes visible a consistency you cannot feel yet, and lets you correct course before dropping out.</p>

<h2 id="exemple">Before and after: three resolutions rewritten</h2>
<div class="table-wrap"><table>
<thead><tr><th>Classic resolution</th><th>Version that lasts</th><th>"If... then..." plan</th></tr></thead>
<tbody>
<tr><td>Exercise more</td><td>3 sessions of 20 min a week until the end of March</td><td>If I miss the morning, then I walk for 20 min in the evening</td></tr>
<tr><td>Stop procrastinating</td><td>Start each day with 25 min on the most important task</td><td>If I open my inbox first, then I close it and start the timer</td></tr>
<tr><td>Read more</td><td>10 pages every night before lights out</td><td>If I am too tired, then I read a single page</td></tr>
</tbody>
</table></div>

<h2 id="craquer">If you slip (and you will)</h2>
<p>One missed day erases nothing: research on habit formation shows a single slip has no measurable effect. What matters is not missing twice in a row. And there is no need to wait for Monday or the 1st of the month to restart: researchers Hengchen Dai, Katherine Milkman and Jason Riis described a "fresh start effect" (2014), but every next day is one.</p>

<h2 id="preparer">Preparing your resolutions in three steps</h2>
<ol>
<li><strong>Review</strong> the year that is ending, so you do not pick up the same goals with the same obstacles: <a href="/en/blog/bilan-de-l-annee">the year in review in 10 questions</a>.</li>
<li><strong>Choose three goals</strong> and make them measurable with the OKR method.</li>
<li><strong>Turn each goal into one or two habits</strong>, tracked every day.</li>
</ol>
<p><a href="/en">Cosmo</a> brings these three levels together in one app: goals, habits with their streaks, tasks and calendar. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Is it true that almost all resolutions fail?</h3>
<p>No. In Norcross's study (2002), about 46% of people who made a resolution were still keeping it six months later, compared with 4% of those who wanted to change without a formal resolution.</p>
<h3>How many resolutions should I make?</h3>
<p>One to three. Each change needs attention for weeks; stacking them is the surest way to drop them all.</p>
<h3>What if I have already slipped in January?</h3>
<p>Start again the next day, without waiting for Monday or next month. A single slip does not undo a habit; quitting does.</p>
`,
    },
  },
};
