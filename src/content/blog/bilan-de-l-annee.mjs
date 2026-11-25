// Article de blog, contenu partagé React + prerender. ESM pur.
// Page saisonnière (plan SEO C1) : slug SANS année, contenu remis à jour
// chaque décembre. Structure et règles : src/content/blog/index.mjs.
export const article = {
  slug: "bilan-de-l-annee",
  datePublished: "2026-11-25",
  dateModified: "2026-11-25",
  related: ["objectifs-de-l-annee","tableau-de-bord-productivite","tenir-ses-resolutions"],
  locales: {
    fr: {
      title: "Bilan de l'année : le modèle en 10 questions pour préparer 2027",
      metaTitle: "Bilan de l'année : le modèle en 10 questions",
      description: "Faire le bilan de son année en une heure : 10 questions à se poser, dans l'ordre, pour comprendre ce qui a marché et choisir ses objectifs 2027 en connaissance de cause.",
      readingMinutes: 7,
      faq: [
        ["Combien de temps prend un bilan de l'année ?", "Une heure suffit, au calme, sans écran autour. Mieux vaut une heure bien utilisée qu'un week-end entier qu'on repousse."],
        ["Quand faire son bilan annuel ?", "Entre Noël et le 1er janvier est le moment classique. Ce qui compte, c'est de le faire avant de fixer ses objectifs de l'année, pas après."],
        ["Faut-il relire ses objectifs de l'an dernier ?", "Oui, s'ils existent. Comparer ce qu'on visait et ce qui s'est passé est la partie la plus instructive du bilan."],
      ],
      html: `
<p class="lead">On se fixe des objectifs chaque janvier, mais on fait rarement le bilan de l'année qui précède. Résultat : on reprend les mêmes résolutions, qui échoueront pour les mêmes raisons. Un bon bilan de l'année prend <strong>une heure</strong>, tient sur une page et change la qualité de tout ce que vous déciderez ensuite. Voici un modèle en 10 questions, à suivre dans l'ordre.</p>

<h2 id="preparer">Avant de commencer : 3 conseils</h2>
<ul>
<li><strong>Rassemblez vos traces.</strong> Agenda, photos, notes, relevés de compte, liste de tâches terminées. La mémoire retient les trois derniers mois et quelques moments forts : les traces rendent les dix autres mois.</li>
<li><strong>Écrivez, ne réfléchissez pas seulement.</strong> Une réponse écrite oblige à être précis. « Bof » ne tient pas sur le papier.</li>
<li><strong>Soyez factuel avant d'être sévère.</strong> Le but n'est pas de se juger, mais de comprendre ce qui a produit les résultats, bons comme mauvais.</li>
</ul>

<h2 id="questions">Les 10 questions</h2>
<h3>Partie 1 : ce qui s'est passé</h3>
<p><strong>1. Quels sont les 5 moments marquants de mon année ?</strong> Bons ou mauvais. Parcourez votre agenda mois par mois pour ne pas oublier le premier semestre.</p>
<p><strong>2. De quoi suis-je le plus fier ?</strong> Une réalisation, une décision difficile, une habitude tenue. Notez aussi pourquoi : ce qui l'a rendue possible est réutilisable.</p>
<p><strong>3. Qu'est-ce qui ne s'est pas passé comme prévu ?</strong> Un projet abandonné, un objectif manqué. Décrivez les faits sans commentaire. L'analyse vient à la question suivante.</p>
<p><strong>4. Pourquoi ?</strong> Pour chaque point de la question 3, cherchez la cause réelle : manque de temps, objectif mal défini, mauvais moment, ou simplement ce n'était pas une priorité. Cette dernière réponse est fréquente et parfaitement acceptable.</p>

<h3>Partie 2 : ce que j'en retiens</h3>
<p><strong>5. Qu'est-ce qui m'a donné de l'énergie, et qu'est-ce qui m'en a pris ?</strong> Activités, personnes, projets. Deux colonnes. C'est souvent la question qui produit les décisions les plus utiles.</p>
<p><strong>6. Où est passé mon temps ?</strong> Comparez ce que vous dites être important et ce que votre agenda montre. L'écart entre les deux est la matière première de vos prochains objectifs. Un <a href="/blog/tableau-de-bord-productivite">tableau de bord personnel</a> rend cette comparaison beaucoup plus facile l'année suivante.</p>
<p><strong>7. Quelles habitudes ai-je prises ou perdues ?</strong> Sommeil, sport, lecture, écrans. Une habitude installée cette année est un acquis à protéger ; une habitude perdue est souvent la cause cachée de plusieurs objectifs manqués.</p>
<p><strong>8. Quelle est la leçon principale de cette année ?</strong> Une seule phrase. Si vous en avez cinq, choisissez celle que vous voudriez relire en décembre prochain.</p>

<h3>Partie 3 : ce que je prépare</h3>
<p><strong>9. Qu'est-ce que j'arrête, qu'est-ce que je continue, qu'est-ce que je commence ?</strong> Trois listes courtes. La liste « arrêter » est la plus difficile, et la plus importante : elle libère le temps dont les nouveaux objectifs auront besoin.</p>
<p><strong>10. Si l'année prochaine est réussie, qu'est-ce qui aura changé ?</strong> Décrivez trois changements concrets. Ce seront les objectifs de votre année : il ne restera qu'à les rendre mesurables avec <a href="/blog/objectifs-de-l-annee">la méthode OKR</a>.</p>

<h2 id="modele">Le modèle sur une page</h2>
<div class="table-wrap"><table>
<thead><tr><th>Partie</th><th>Questions</th><th>Durée conseillée</th></tr></thead>
<tbody>
<tr><td>Ce qui s'est passé</td><td>1 à 4 : moments marquants, fierté, ce qui a manqué, pourquoi</td><td>25 min</td></tr>
<tr><td>Ce que j'en retiens</td><td>5 à 8 : énergie, temps, habitudes, leçon</td><td>20 min</td></tr>
<tr><td>Ce que je prépare</td><td>9 et 10 : arrêter, continuer, commencer ; trois changements</td><td>15 min</td></tr>
</tbody>
</table></div>
<p>Copiez ces dix questions dans un carnet ou un document, répondez dans l'ordre, et gardez la page : relue dans un an, elle sera le point de départ du bilan suivant.</p>

<h2 id="erreurs">Les 3 pièges du bilan annuel</h2>
<ol>
<li><strong>Ne retenir que le négatif.</strong> Un bilan qui ne liste que des échecs démotive et fausse l'analyse. Les questions 2 et 5 sont là pour l'équilibre.</li>
<li><strong>Passer directement aux résolutions.</strong> Sans les questions 3 et 4, vous reprendrez les mêmes objectifs que l'an dernier, avec les mêmes obstacles. C'est l'une des raisons pour lesquelles <a href="/blog/tenir-ses-resolutions">les résolutions échouent</a>.</li>
<li><strong>En faire un exercice parfait.</strong> Une heure honnête vaut mieux qu'un week-end de réflexion qu'on repousse à février.</li>
</ol>

<h2 id="ensuite">Et ensuite ?</h2>
<p>Le bilan vous donne trois changements à viser. Pour qu'ils ne restent pas des intentions, transformez-les en objectifs chiffrés pour le premier trimestre, avec un rendez-vous de suivi chaque semaine. Dans <a href="/">Cosmo</a>, objectifs, habitudes et tâches vivent au même endroit : l'an prochain, la question 6 (« où est passé mon temps ? ») aura sa réponse sous les yeux. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien de temps prend un bilan de l'année ?</h3>
<p>Une heure suffit, au calme, sans écran autour. Mieux vaut une heure bien utilisée qu'un week-end entier qu'on repousse.</p>
<h3>Quand faire son bilan annuel ?</h3>
<p>Entre Noël et le 1er janvier est le moment classique. Ce qui compte, c'est de le faire avant de fixer ses objectifs de l'année, pas après.</p>
<h3>Faut-il relire ses objectifs de l'an dernier ?</h3>
<p>Oui, s'ils existent. Comparer ce qu'on visait et ce qui s'est passé est la partie la plus instructive du bilan.</p>
<h3>Peut-on faire le bilan à deux ou en équipe ?</h3>
<p>Oui. Les mêmes questions fonctionnent pour un couple ou une petite équipe : chacun répond seul d'abord, puis on compare. Les écarts de réponse sont souvent les plus intéressants.</p>
`,
    },
    en: {
      title: "Year in review: a 10-question template to prepare for 2027",
      metaTitle: "Year in review: a simple 10-question template",
      description: "Review your year in one hour: 10 questions to answer, in order, to understand what worked and choose your 2027 goals with your eyes open.",
      readingMinutes: 7,
      faq: [
        ["How long does a year in review take?", "One hour is enough, somewhere quiet, without screens around. An hour well spent beats a whole weekend you keep putting off."],
        ["When should you do your annual review?", "Between Christmas and January 1st is the classic time. What matters is doing it before setting your goals for the year, not after."],
        ["Should you reread last year's goals?", "Yes, if you have them. Comparing what you aimed for with what actually happened is the most instructive part of the review."],
      ],
      html: `
<p class="lead">We set goals every January, but we rarely review the year that came before. The result: we pick up the same resolutions, which fail for the same reasons. A good year in review takes <strong>one hour</strong>, fits on one page and improves everything you decide afterwards. Here is a 10-question template to follow in order.</p>

<h2 id="preparer">Before you start: 3 tips</h2>
<ul>
<li><strong>Gather your traces.</strong> Calendar, photos, notes, bank statements, completed task lists. Memory keeps the last three months and a few highlights: the traces give you back the other ten.</li>
<li><strong>Write, do not just think.</strong> A written answer forces precision. "Meh" does not survive on paper.</li>
<li><strong>Be factual before being harsh.</strong> The aim is not to judge yourself but to understand what produced the results, good and bad.</li>
</ul>

<h2 id="questions">The 10 questions</h2>
<h3>Part 1: what happened</h3>
<p><strong>1. What were the 5 defining moments of my year?</strong> Good or bad. Go through your calendar month by month so the first half of the year is not forgotten.</p>
<p><strong>2. What am I most proud of?</strong> An achievement, a hard decision, a habit you kept. Write down why, too: whatever made it possible can be reused.</p>
<p><strong>3. What did not go as planned?</strong> An abandoned project, a missed goal. Describe the facts without comment. The analysis comes next.</p>
<p><strong>4. Why?</strong> For each item in question 3, look for the real cause: lack of time, a badly defined goal, bad timing, or simply that it was not a priority. That last answer is common and perfectly acceptable.</p>

<h3>Part 2: what I take from it</h3>
<p><strong>5. What gave me energy, and what drained it?</strong> Activities, people, projects. Two columns. This is often the question that produces the most useful decisions.</p>
<p><strong>6. Where did my time go?</strong> Compare what you say matters with what your calendar shows. The gap between the two is the raw material for your next goals. A <a href="/en/blog/tableau-de-bord-productivite">personal dashboard</a> makes that comparison much easier next year.</p>
<p><strong>7. Which habits did I gain or lose?</strong> Sleep, exercise, reading, screens. A habit built this year is an asset to protect; a habit lost is often the hidden cause of several missed goals.</p>
<p><strong>8. What is the main lesson of this year?</strong> One sentence. If you have five, pick the one you would want to reread next December.</p>

<h3>Part 3: what I prepare</h3>
<p><strong>9. What do I stop, continue and start?</strong> Three short lists. The "stop" list is the hardest and the most important: it frees the time your new goals will need.</p>
<p><strong>10. If next year goes well, what will have changed?</strong> Describe three concrete changes. They will be your goals for the year: all that is left is to make them measurable with <a href="/en/blog/objectifs-de-l-annee">the OKR method</a>.</p>

<h2 id="modele">The one-page template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Part</th><th>Questions</th><th>Suggested time</th></tr></thead>
<tbody>
<tr><td>What happened</td><td>1 to 4: defining moments, pride, what fell short, why</td><td>25 min</td></tr>
<tr><td>What I take from it</td><td>5 to 8: energy, time, habits, lesson</td><td>20 min</td></tr>
<tr><td>What I prepare</td><td>9 and 10: stop, continue, start; three changes</td><td>15 min</td></tr>
</tbody>
</table></div>
<p>Copy these ten questions into a notebook or document, answer them in order, and keep the page: reread in a year, it becomes the starting point of your next review.</p>

<h2 id="erreurs">The 3 traps of an annual review</h2>
<ol>
<li><strong>Keeping only the negative.</strong> A review that lists only failures is demotivating and skews the analysis. Questions 2 and 5 are there for balance.</li>
<li><strong>Jumping straight to resolutions.</strong> Without questions 3 and 4, you will pick up last year's goals with last year's obstacles. It is one of the reasons <a href="/en/blog/tenir-ses-resolutions">resolutions fail</a>.</li>
<li><strong>Making it a perfect exercise.</strong> One honest hour beats a weekend of reflection pushed back to February.</li>
</ol>

<h2 id="ensuite">What next?</h2>
<p>The review gives you three changes to aim for. To keep them from staying intentions, turn them into numbered goals for the first quarter, with a check-in every week. In <a href="/en">Cosmo</a>, goals, habits and tasks live in the same place: next year, question 6 ("where did my time go?") will have its answer in front of you. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How long does a year in review take?</h3>
<p>One hour is enough, somewhere quiet, without screens around. An hour well spent beats a whole weekend you keep putting off.</p>
<h3>When should you do your annual review?</h3>
<p>Between Christmas and January 1st is the classic time. What matters is doing it before setting your goals for the year, not after.</p>
<h3>Should you reread last year's goals?</h3>
<p>Yes, if you have them. Comparing what you aimed for with what actually happened is the most instructive part of the review.</p>
<h3>Can you do the review as a couple or a team?</h3>
<p>Yes. The same questions work for a couple or a small team: everyone answers alone first, then you compare. The differences between answers are often the most interesting part.</p>
`,
    },
  },
};
