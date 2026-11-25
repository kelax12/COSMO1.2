// Article de blog, contenu partagé React + prerender. ESM pur.
// Page saisonnière (plan SEO C1) : slug SANS année, contenu remis à jour
// chaque décembre pour que l'autorité de l'URL s'accumule d'une année sur
// l'autre. Structure et règles : src/content/blog/index.mjs.
export const article = {
  slug: "objectifs-de-l-annee",
  datePublished: "2026-11-25",
  dateModified: "2026-11-25",
  related: ["template-okr-gratuit","tenir-ses-resolutions","bilan-de-l-annee"],
  locales: {
    fr: {
      title: "Objectifs 2027 : fixer ses objectifs de l'année avec la méthode OKR (modèle rempli)",
      metaTitle: "Objectifs 2027 : la méthode OKR, avec un modèle rempli",
      description: "Une liste de résolutions ne tient pas jusqu'en février. Fixez vos objectifs 2027 avec la méthode OKR : 3 objectifs, des résultats mesurables, un exemple rempli.",
      readingMinutes: 8,
      faq: [
        ["Combien d'objectifs se fixer pour l'année ?", "Trois au maximum, avec deux à quatre résultats clés chacun. Au-delà, la revue hebdomadaire dépasse dix minutes et finit par sauter."],
        ["Faut-il fixer des objectifs sur un an ou sur un trimestre ?", "Les deux : une direction pour l'année, et des résultats clés chiffrés par trimestre. Douze mois sont trop longs pour sentir l'urgence d'agir cette semaine."],
        ["Quelle différence entre un objectif et une résolution ?", "Une résolution est une intention (« faire plus de sport »). Un objectif OKR y ajoute des résultats mesurables, une échéance et un rendez-vous de suivi."],
      ],
      html: `
<p class="lead">Chaque année, la même liste : faire du sport, lire plus, mieux gérer son argent. Et chaque année, la même pente : motivée le 2 janvier, oubliée vers le 15 février. Le problème n'est presque jamais la volonté. C'est la forme : une liste d'intentions n'a ni mesure, ni échéance, ni moment pour vérifier où l'on en est. La méthode OKR règle ces trois manques avec une page et dix minutes par semaine. Voici comment fixer vos <strong>objectifs 2027</strong> avec, en exemple, un modèle entièrement rempli.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Les OKR dans Cosmo : chaque objectif affiche ses résultats clés, leur progression et le temps écoulé de la période." /><figcaption>Les OKR dans Cosmo : chaque objectif affiche ses résultats clés, leur progression et le temps écoulé de la période. Capture du mode démo, données fictives.</figcaption></figure>

<h2 id="pourquoi">Pourquoi une liste de résolutions ne tient pas</h2>
<p>Trois défauts reviennent dans presque toutes les listes de début d'année :</p>
<ul>
<li><strong>Rien n'est mesurable.</strong> « Lire plus » : à partir de quand est-ce réussi ? Sans seuil, il n'y a jamais de victoire, et la motivation n'a rien à quoi s'accrocher.</li>
<li><strong>L'échéance est trop lointaine.</strong> Décembre paraît loin en janvier. Rien ne dit que cette semaine compte.</li>
<li><strong>Personne ne relit la liste.</strong> Elle est écrite une fois, puis rangée. Sans rendez-vous de suivi, l'écart entre l'intention et la réalité se creuse sans qu'on le voie.</li>
</ul>
<p>La méthode OKR (Objectives and Key Results), née chez Intel puis popularisée par Google, est construite pour corriger exactement ces trois défauts. Elle fonctionne aussi très bien à l'échelle d'une personne. Si vous la découvrez, l'article <a href="/blog/methode-okr-exemples">méthode OKR : 15 exemples commentés</a> en donne les bases.</p>

<h2 id="principe">Le principe en une phrase</h2>
<p>Un <strong>objectif</strong> dit où vous voulez aller, en mots, sans chiffre. Ses <strong>résultats clés</strong> disent comment vous saurez que vous y êtes, en chiffres, avec une valeur de départ et une valeur cible. On se fixe une direction pour l'année, puis des résultats clés par trimestre, et on les relit chaque semaine.</p>

<h2 id="etapes">Fixer ses objectifs de l'année en 5 étapes</h2>
<h3>1. Partir du bilan, pas de l'envie du moment</h3>
<p>Avant d'écrire un seul objectif, regardez l'année qui se termine : ce qui a marché, ce qui a coûté de l'énergie, ce que vous regrettez de ne pas avoir commencé. Le <a href="/blog/bilan-de-l-annee">bilan de l'année en 10 questions</a> prend une heure et évite de se fixer des objectifs qui répètent ceux de l'an dernier, pour les mêmes raisons d'échec.</p>
<h3>2. Choisir trois domaines au plus</h3>
<p>Santé, travail, argent, relations, apprentissage : choisissez-en trois. Pas cinq. Chaque objectif en cours consomme de l'attention, et la revue hebdomadaire doit tenir en dix minutes. Ce que vous ne retenez pas n'est pas abandonné : c'est reporté au trimestre suivant.</p>
<h3>3. Écrire l'objectif comme une direction</h3>
<p>Un bon objectif tient en une ligne, donne envie et ne contient aucun chiffre : « Retrouver une vraie forme physique », « Mettre mes finances en ordre », « Devenir à l'aise en anglais au travail ». S'il contient déjà un chiffre, c'est probablement un résultat clé déguisé.</p>
<h3>4. Ajouter deux à quatre résultats clés par objectif</h3>
<p>Chaque résultat clé est un nombre vérifiable, avec une unité, une valeur de départ et une cible. « Courir 10 km sans m'arrêter (départ : 0 km) » plutôt que « courir plus ». Visez une cible que vous pensez atteindre avec 50 à 70 % de chances : en dessous, ce n'est pas un objectif, c'est une prévision.</p>
<h3>5. Découper l'année en trimestres</h3>
<p>Fixez les résultats clés pour le premier trimestre seulement (janvier à mars). Fin mars, vous ferez le point et fixerez ceux d'avril à juin à la lumière de ce que vous avez appris. Douze semaines, c'est assez long pour progresser vraiment, et assez court pour que la semaine en cours compte.</p>

<h2 id="exemple">Exemple rempli : des objectifs 2027 personnels</h2>
<p>Voici un jeu complet d'objectifs pour le premier trimestre 2027, tel qu'une personne pourrait l'écrire début janvier.</p>
<div class="table-wrap"><table>
<thead><tr><th>Objectif (l'année)</th><th>Résultat clé (T1 2027)</th><th>Départ</th><th>Cible fin mars</th></tr></thead>
<tbody>
<tr><td rowspan="3">Retrouver une vraie forme physique</td><td>Séances de sport réalisées</td><td>0</td><td>30</td></tr>
<tr><td>Distance courue sans s'arrêter (km)</td><td>2</td><td>8</td></tr>
<tr><td>Nuits d'au moins 7 h par semaine (moyenne)</td><td>3</td><td>5</td></tr>
<tr><td rowspan="2">Mettre mes finances en ordre</td><td>Épargne de précaution (mois de dépenses couverts)</td><td>0,5</td><td>1,5</td></tr>
<tr><td>Abonnements inutiles résiliés</td><td>0</td><td>4</td></tr>
<tr><td rowspan="2">Être à l'aise en anglais au travail</td><td>Heures de pratique orale</td><td>0</td><td>20</td></tr>
<tr><td>Réunions animées en anglais</td><td>0</td><td>3</td></tr>
</tbody>
</table></div>
<p>Trois remarques sur cet exemple. Chaque résultat clé a <strong>une unité</strong> : sans elle, « 8 » ne veut plus rien dire dans deux mois. Plusieurs ne partent pas de zéro : noter la vraie valeur de départ évite qu'une progression calculée mente. Et aucun ne décrit une tâche (« s'inscrire à la salle ») : les tâches viennent ensuite, dans votre semaine, au service des résultats clés.</p>
<p>Pour remplir le vôtre, le <a href="/blog/template-okr-gratuit">template OKR gratuit</a> (Excel, compatible Google Sheets) calcule la progression tout seul, sans inscription ni adresse e-mail.</p>

<h2 id="revue">Le rendez-vous qui fait la différence : 10 minutes par semaine</h2>
<p>Un objectif qui n'est relu qu'en décembre est une résolution. Ce qui transforme la liste en système, c'est un rendez-vous fixe, toujours le même jour, bloqué dans l'agenda comme une réunion. Pendant ces dix minutes :</p>
<ol>
<li>mettez à jour la valeur actuelle de chaque résultat clé, et rien d'autre ;</li>
<li>repérez celui qui est le plus en retard par rapport au temps écoulé du trimestre ;</li>
<li>écrivez <strong>une seule</strong> action concrète pour la semaine qui vient, et placez-la dans votre agenda.</li>
</ol>
<p>C'est l'usage le plus rentable du <a href="/blog/time-blocking-guide">time-blocking</a> : dix minutes protégées qui décident de l'utilité des cinquante autres heures de la semaine.</p>

<h2 id="habitudes">Objectifs et habitudes : qui fait quoi</h2>
<p>Un résultat clé comme « 30 séances de sport » se gagne par une habitude : trois séances par semaine, à heure fixe. L'objectif donne la direction, l'habitude fait avancer chaque jour. Suivre les deux au même endroit évite le piège classique : des objectifs ambitieux en janvier, et des journées qui n'ont aucun rapport avec eux. Sur la durée réelle pour qu'une habitude s'installe (bien plus que 21 jours), voir <a href="/blog/combien-de-temps-prendre-habitude">combien de temps pour prendre une habitude</a>, et pour un support papier, le <a href="/blog/habit-tracker-a-imprimer">habit tracker 2027 à imprimer</a>.</p>

<h2 id="erreurs">4 erreurs qui font décrocher en février</h2>
<ol>
<li><strong>Trop d'objectifs.</strong> Sept objectifs, c'est zéro priorité. Trois, c'est un choix.</li>
<li><strong>Des cibles décoratives.</strong> « Lire 100 livres » quand on en a lu 4 cette année : personne n'y croit, donc personne ne s'en sert pour décider.</li>
<li><strong>Changer la cible en cours de route.</strong> Une cible déplacée en semaine 7 n'est plus une cible. Notez plutôt pourquoi elle était mal calibrée, et corrigez au trimestre suivant.</li>
<li><strong>Juger à la fin de janvier.</strong> Atteindre 70 % d'un résultat clé ambitieux à la fin du trimestre est une réussite. Viser 100 % partout, c'est viser trop bas.</li>
</ol>
<p>Pour comprendre ce qui fait réellement échouer les bonnes résolutions, et ce que la recherche recommande à la place, lisez <a href="/blog/tenir-ses-resolutions">pourquoi les résolutions échouent et comment tenir les vôtres</a>.</p>

<h2 id="cosmo">Suivre ses objectifs 2027 dans Cosmo</h2>
<p><a href="/">Cosmo</a> réunit les OKR, les habitudes, les tâches et l'agenda dans la même application : vos résultats clés progressent à côté des actions qui les font avancer, et le tableau de bord montre ce qui avance et ce qui stagne. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription, avec des objectifs déjà remplis.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien d'objectifs se fixer pour l'année ?</h3>
<p>Trois au maximum, avec deux à quatre résultats clés chacun. Au-delà, la revue hebdomadaire dépasse dix minutes et finit par sauter.</p>
<h3>Faut-il fixer des objectifs sur un an ou sur un trimestre ?</h3>
<p>Les deux : une direction pour l'année, et des résultats clés chiffrés par trimestre. Douze mois sont trop longs pour sentir l'urgence d'agir cette semaine.</p>
<h3>Quelle différence entre un objectif et une résolution ?</h3>
<p>Une résolution est une intention (« faire plus de sport »). Un objectif OKR y ajoute des résultats mesurables, une échéance et un rendez-vous de suivi.</p>
<h3>Et si je commence en février ?</h3>
<p>Commencez quand même, avec un premier cycle plus court jusqu'à fin mars et des cibles réduites en proportion. Un cycle de sept semaines bien suivi vaut mieux qu'une année entière attendue.</p>
`,
    },
    en: {
      title: "2027 goals: set your goals for the year with the OKR method (filled-in example)",
      metaTitle: "2027 goals: the OKR method, with a filled-in example",
      description: "A list of resolutions rarely survives February. Set your 2027 goals with the OKR method: 3 objectives, measurable key results and a fully worked example.",
      readingMinutes: 8,
      faq: [
        ["How many goals should you set for the year?", "Three at most, with two to four key results each. Beyond that, the weekly review takes longer than ten minutes and ends up being skipped."],
        ["Should goals cover a year or a quarter?", "Both: a direction for the year, and numbered key results for each quarter. Twelve months is too long to feel any urgency to act this week."],
        ["What is the difference between a goal and a resolution?", "A resolution is an intention (\"exercise more\"). An OKR adds measurable results, a deadline and a regular check-in."],
      ],
      html: `
<p class="lead">Every year, the same list: exercise, read more, sort out your money. And every year, the same slope: fired up on January 2nd, forgotten by mid-February. The problem is almost never willpower. It is the format: a list of intentions has no measure, no deadline and no moment to check where you stand. The OKR method fixes all three with one page and ten minutes a week. Here is how to set your <strong>2027 goals</strong>, with a fully filled-in example.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="OKRs in Cosmo: each objective shows its key results, their progress and how much of the period has elapsed." /><figcaption>OKRs in Cosmo: each objective shows its key results, their progress and how much of the period has elapsed. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="pourquoi">Why a list of resolutions does not last</h2>
<p>Three flaws show up in almost every New Year list:</p>
<ul>
<li><strong>Nothing is measurable.</strong> "Read more": when does that count as done? Without a threshold there is never a win, and motivation has nothing to hold on to.</li>
<li><strong>The deadline is too far away.</strong> December feels distant in January. Nothing says this week matters.</li>
<li><strong>Nobody rereads the list.</strong> It is written once, then filed away. Without a check-in, the gap between intention and reality grows unnoticed.</li>
</ul>
<p>The OKR method (Objectives and Key Results), born at Intel and popularised by Google, is built to correct exactly these three flaws. It also works very well for one person. If it is new to you, <a href="/en/blog/methode-okr-exemples">the OKR method: 15 annotated examples</a> covers the basics.</p>

<h2 id="principe">The principle in one sentence</h2>
<p>An <strong>objective</strong> says where you want to go, in words, with no number. Its <strong>key results</strong> say how you will know you got there, in numbers, with a starting value and a target. You set a direction for the year, key results for each quarter, and you review them every week.</p>

<h2 id="etapes">Setting your goals for the year in 5 steps</h2>
<h3>1. Start from a review, not from today's mood</h3>
<p>Before writing a single goal, look at the year that is ending: what worked, what drained your energy, what you regret not starting. The <a href="/en/blog/bilan-de-l-annee">year in review in 10 questions</a> takes an hour and stops you from setting the same goals as last year, which would fail for the same reasons.</p>
<h3>2. Pick three areas at most</h3>
<p>Health, work, money, relationships, learning: pick three. Not five. Every active goal consumes attention, and the weekly review has to fit in ten minutes. What you leave out is not abandoned, only postponed to next quarter.</p>
<h3>3. Write the objective as a direction</h3>
<p>A good objective fits on one line, is motivating and contains no number: "Get genuinely fit again", "Get my finances in order", "Become comfortable speaking English at work". If it already has a number in it, it is probably a key result in disguise.</p>
<h3>4. Add two to four key results per objective</h3>
<p>Each key result is a verifiable number, with a unit, a starting value and a target. "Run 10 km without stopping (starting point: 0 km)" rather than "run more". Aim for a target you think you have a 50 to 70% chance of hitting: below that, it is not a goal, it is a forecast.</p>
<h3>5. Split the year into quarters</h3>
<p>Set key results for the first quarter only (January to March). At the end of March, review and set the next ones in light of what you learned. Twelve weeks is long enough to make real progress, and short enough for the current week to matter.</p>

<h2 id="exemple">Filled-in example: personal goals for 2027</h2>
<p>Here is a complete set of goals for the first quarter of 2027, as someone might write it in early January.</p>
<div class="table-wrap"><table>
<thead><tr><th>Objective (the year)</th><th>Key result (Q1 2027)</th><th>Start</th><th>Target end of March</th></tr></thead>
<tbody>
<tr><td rowspan="3">Get genuinely fit again</td><td>Workouts completed</td><td>0</td><td>30</td></tr>
<tr><td>Distance run without stopping (km)</td><td>2</td><td>8</td></tr>
<tr><td>Nights of at least 7 h per week (average)</td><td>3</td><td>5</td></tr>
<tr><td rowspan="2">Get my finances in order</td><td>Emergency fund (months of expenses covered)</td><td>0.5</td><td>1.5</td></tr>
<tr><td>Unused subscriptions cancelled</td><td>0</td><td>4</td></tr>
<tr><td rowspan="2">Be comfortable speaking English at work</td><td>Hours of speaking practice</td><td>0</td><td>20</td></tr>
<tr><td>Meetings led in English</td><td>0</td><td>3</td></tr>
</tbody>
</table></div>
<p>Three things to notice. Every key result has <strong>a unit</strong>: without it, "8" means nothing two months later. Several do not start at zero: recording the real starting value keeps the computed progress honest. And none describes a task ("join the gym"): tasks come next, in your week, in service of the key results.</p>
<p>To fill in your own, the <a href="/en/blog/template-okr-gratuit">free OKR template</a> (Excel, works in Google Sheets) calculates progress on its own, with no sign-up or email address.</p>

<h2 id="revue">The appointment that makes the difference: 10 minutes a week</h2>
<p>A goal you only reread in December is a resolution. What turns the list into a system is a fixed appointment, same day every week, blocked in your calendar like a meeting. During those ten minutes:</p>
<ol>
<li>update the current value of each key result, and nothing else;</li>
<li>spot the one furthest behind relative to how much of the quarter has passed;</li>
<li>write <strong>one</strong> concrete action for the coming week, and put it in your calendar.</li>
</ol>
<p>It is the most profitable use of <a href="/en/blog/time-blocking-guide">time blocking</a>: ten protected minutes that decide whether the other fifty hours of the week serve your goals.</p>

<h2 id="habitudes">Goals and habits: who does what</h2>
<p>A key result like "30 workouts" is won through a habit: three sessions a week, at a set time. The goal gives the direction, the habit moves you forward every day. Tracking both in the same place avoids the classic trap: ambitious goals in January, and days that have nothing to do with them. On how long a habit really takes to stick (far more than 21 days), see <a href="/en/blog/combien-de-temps-prendre-habitude">how long it takes to build a habit</a>, and for a paper version, the <a href="/en/blog/habit-tracker-a-imprimer">printable 2027 habit tracker</a>.</p>

<h2 id="erreurs">4 mistakes that make you drop out in February</h2>
<ol>
<li><strong>Too many goals.</strong> Seven goals means zero priorities. Three is a choice.</li>
<li><strong>Decorative targets.</strong> "Read 100 books" when you read 4 this year: nobody believes it, so nobody uses it to decide anything.</li>
<li><strong>Moving the target along the way.</strong> A target moved in week 7 is no longer a target. Write down why it was miscalibrated and fix it next quarter.</li>
<li><strong>Judging yourself at the end of January.</strong> Reaching 70% of an ambitious key result by the end of the quarter is a success. Hitting 100% everywhere means you aimed too low.</li>
</ol>
<p>To understand what really makes resolutions fail, and what the research suggests instead, read <a href="/en/blog/tenir-ses-resolutions">why resolutions fail and how to keep yours</a>.</p>

<h2 id="cosmo">Tracking your 2027 goals in Cosmo</h2>
<p><a href="/en">Cosmo</a> brings OKRs, habits, tasks and calendar together in one app: your key results move forward next to the actions that drive them, and the dashboard shows what is progressing and what is stuck. It is <a href="/en/signup">free</a>, and the demo opens without sign-up, with goals already filled in.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many goals should you set for the year?</h3>
<p>Three at most, with two to four key results each. Beyond that, the weekly review takes longer than ten minutes and ends up being skipped.</p>
<h3>Should goals cover a year or a quarter?</h3>
<p>Both: a direction for the year, and numbered key results for each quarter. Twelve months is too long to feel any urgency to act this week.</p>
<h3>What is the difference between a goal and a resolution?</h3>
<p>A resolution is an intention ("exercise more"). An OKR adds measurable results, a deadline and a regular check-in.</p>
<h3>What if I start in February?</h3>
<p>Start anyway, with a shorter first cycle until the end of March and targets scaled down accordingly. A well-tracked seven-week cycle beats a whole year spent waiting.</p>
`,
    },
  },
};
