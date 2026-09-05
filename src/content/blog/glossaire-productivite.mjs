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
  slug: "glossaire-productivite",
  datePublished: "2026-07-18",
  dateModified: "2026-07-18",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["methode-okr-exemples","time-blocking-guide","combien-de-temps-prendre-habitude"],
  locales: {
    fr: {
      title: "Glossaire de la productivité : 20 termes enfin définis clairement",
      metaTitle: "Glossaire productivité : OKR, time-blocking, deep work",
      description: "OKR, time-blocking, deep work, habit stacking, loi de Parkinson… 20 termes de la productivité définis en français, clairement, avec leur usage concret.",
      readingMinutes: 8,
      html: `
<p class="lead">Le monde de la productivité adore le jargon. Voici les 20 termes que vous croiserez partout, définis clairement et sans mystique, avec pour chacun ce qu'il faut vraiment en retenir.</p>

<h2 id="objectifs">Objectifs &amp; mesure</h2>
<h3>OKR (Objectives &amp; Key Results)</h3>
<p>Système d'objectifs sur cycle court : une ambition qualitative prouvée par 2 à 5 résultats chiffrés. Popularisé par Intel puis Google. Cible saine : ~70 % de réussite. → <a href="/blog/methode-okr-exemples">Guide complet + 15 exemples</a>.</p>
<h3>Résultat clé (Key Result)</h3>
<p>La preuve chiffrée d'un objectif : valeur de départ, valeur cible, échéance. Mesure un résultat (« 5 entretiens décrochés »), pas une activité (« 50 candidatures envoyées »).</p>
<h3>Objectif SMART</h3>
<p>Grille de formulation : Spécifique, Mesurable, Atteignable, Réaliste, Temporellement défini. Utile pour rédiger ; insuffisant seul pour prioriser. → <a href="/blog/okr-vs-smart-vs-kpi">OKR vs SMART vs KPI</a>.</p>
<h3>KPI (Key Performance Indicator)</h3>
<p>Métrique surveillée en continu pour connaître la santé d'une activité. Un thermomètre, pas un plan d'action.</p>
<h3>North Star Metric</h3>
<p>LA métrique unique censée résumer la valeur délivrée par un produit (ex. : nuits réservées pour Airbnb). Concept utile, à condition de ne pas en changer tous les mois.</p>

<h2 id="temps">Gestion du temps</h2>
<h3>Time-blocking</h3>
<p>Réserver des créneaux d'agenda pour ses tâches au lieu de travailler « au fil de l'eau ». La tâche devient un rendez-vous. → <a href="/blog/time-blocking-guide">Guide complet</a>.</p>
<h3>Time-boxing</h3>
<p>Variante du time-blocking avec fin ferme : à la fin du créneau, on s'arrête, terminé ou pas. Idéal contre le perfectionnisme et les tâches sans fin naturelle.</p>
<h3>Task batching</h3>
<p>Regrouper les tâches de même nature (emails, factures, appels) dans un même bloc pour éliminer les changements de contexte.</p>
<h3>Deep work (travail profond)</h3>
<p>Terme de Cal Newport : travail en concentration totale sur une tâche cognitivement exigeante, sans interruption. La ressource la plus rare, et la plus productive, d'une journée de travail.</p>
<h3>Changement de contexte (context switching)</h3>
<p>Le coût cognitif de passer d'une tâche à une autre : après une interruption, il faut en moyenne 23 minutes pour retrouver sa pleine concentration (Gloria Mark, UC Irvine).</p>
<h3>Méthode Pomodoro</h3>
<p>Travailler par intervalles de 25 minutes séparés de courtes pauses. Efficace pour démarrer quand la motivation manque ; moins adapté aux vraies sessions de deep work qu'il fragmente.</p>
<h3>Loi de Parkinson</h3>
<p>« Le travail s'étale de façon à occuper tout le temps disponible. » Corollaire pratique : donner moins de temps à une tâche la comprime. C'est le principe actif du time-boxing.</p>

<h2 id="priorisation">Priorisation</h2>
<h3>Matrice Eisenhower</h3>
<p>Classement des tâches selon deux axes (urgent, important) en 4 quadrants : faire, planifier, déléguer, supprimer. → <a href="/blog/matrice-eisenhower">Guide avec exemples</a>.</p>
<h3>MIT (Most Important Task)</h3>
<p>La (ou les 2-3) tâche(s) qui, si c'était la seule chose faite aujourd'hui, rendrait la journée réussie. Se choisit le matin, avant les emails.</p>
<h3>Eat the frog</h3>
<p>« Avalez le crapaud » : faire la tâche la plus pénible en premier, quand la volonté est au maximum. Attribué (approximativement) à Mark Twain, popularisé par Brian Tracy.</p>

<h2 id="habitudes">Habitudes</h2>
<h3>Streak (série)</h3>
<p>Nombre de jours consécutifs où une habitude a été tenue. Puissant moteur de motivation, à condition de savoir qu'un accroc isolé ne ruine rien. → <a href="/blog/combien-de-temps-prendre-habitude">Combien de temps pour prendre une habitude ?</a></p>
<h3>Habit stacking (empilement d'habitudes)</h3>
<p>Accrocher une nouvelle habitude à une routine existante : « après [habitude actuelle], je fais [nouvelle habitude] ». Le déclencheur contextuel bat l'heure abstraite.</p>
<h3>Heatmap d'habitudes</h3>
<p>Grille calendaire où chaque jour tenu colore une case (façon graphe de contributions GitHub). Rend la régularité, et les trous, visibles d'un coup d'œil.</p>
<h3>Règle des deux jours</h3>
<p>Ne jamais rater une habitude deux jours de suite. Fondée sur la recherche : l'accroc isolé n'a pas d'effet mesurable, c'est la répétition de l'accroc qui tue l'habitude.</p>
<h3>Loi des 21 jours (mythe)</h3>
<p>L'idée qu'une habitude se forme en 21 jours : un contresens sur une observation de Maxwell Maltz. La science (Lally, 2009) : 66 jours en médiane, de 18 à 254 selon les cas.</p>

<h2 id="pratique">Passer du glossaire à la pratique</h2>
<p>Tous ces concepts vivent au même endroit dans <a href="/">Cosmo</a> : les OKR avec progression automatique, le time-blocking par glisser-déposer, les priorités pour appliquer Eisenhower, et les habitudes avec heatmap et streaks. <a href="/signup">Gratuit</a>, démo instantanée sans inscription.</p>
`,
    },
    en: {
      title: "A productivity glossary: 20 terms finally defined clearly",
      metaTitle: "Productivity glossary: OKRs, time-blocking, deep work",
      description: "OKRs, time-blocking, deep work, habit stacking, Parkinson's law and more. 20 productivity terms defined clearly, with what each one is actually good for.",
      readingMinutes: 8,
      html: `
<p class="lead">Productivity culture loves its jargon. Here are the 20 terms you will run into everywhere, defined plainly and without mystique, each with the part actually worth remembering.</p>

<h2 id="objectifs">Goals &amp; measurement</h2>
<h3>OKR (Objectives &amp; Key Results)</h3>
<p>A short-cycle goal system: one qualitative ambition, proven by 2 to 5 numeric results. Popularised by Intel, then Google. A healthy target is around 70 % attainment. → <a href="/en/blog/methode-okr-exemples">Full guide with 15 examples</a>.</p>
<h3>Key result</h3>
<p>The numeric proof of an objective: a starting value, a target value, a deadline. It measures an outcome ("5 interviews booked"), never an activity ("50 applications sent").</p>
<h3>SMART goal</h3>
<p>A drafting grid: Specific, Measurable, Achievable, Realistic, Time-bound. Useful for writing a goal down, not sufficient on its own for deciding what matters. → <a href="/en/blog/okr-vs-smart-vs-kpi">OKRs vs SMART vs KPIs</a>.</p>
<h3>KPI (Key Performance Indicator)</h3>
<p>A metric watched continuously to know the health of an activity. A thermometer, not a plan of action.</p>
<h3>North star metric</h3>
<p>The single metric meant to sum up the value a product delivers (nights booked, for Airbnb). A useful idea, as long as you do not change it every month.</p>

<h2 id="temps">Managing time</h2>
<h3>Time-blocking</h3>
<p>Reserving calendar slots for your tasks instead of working as things come. The task becomes an appointment. → <a href="/en/blog/time-blocking-guide">Full guide</a>.</p>
<h3>Time-boxing</h3>
<p>Time-blocking with a hard stop: when the slot ends you stop, finished or not. The right tool against perfectionism and against tasks with no natural end.</p>
<h3>Task batching</h3>
<p>Grouping tasks of the same nature (email, invoices, calls) into one block to remove context switches.</p>
<h3>Deep work</h3>
<p>Cal Newport's term: fully concentrated work on a cognitively demanding task, without interruption. The scarcest and most productive resource in a working day.</p>
<h3>Context switching</h3>
<p>The cognitive cost of moving from one task to another. After an interruption it takes on average 23 minutes to get back to full concentration (Gloria Mark, UC Irvine).</p>
<h3>The Pomodoro technique</h3>
<p>Working in 25-minute intervals separated by short breaks. Effective for getting started when motivation is missing, less suited to real deep-work sessions, which it fragments.</p>
<h3>Parkinson's law</h3>
<p>"Work expands so as to fill the time available for its completion." The practical corollary: give a task less time and it compresses. That is the active ingredient in time-boxing.</p>

<h2 id="priorisation">Prioritising</h2>
<h3>The Eisenhower matrix</h3>
<p>Sorting tasks along two axes (urgent, important) into 4 quadrants: do, schedule, delegate, delete. → <a href="/en/blog/matrice-eisenhower">Guide with examples</a>.</p>
<h3>MIT (Most Important Task)</h3>
<p>The task, or the two or three tasks, that would make the day a success if they were the only thing you got done. Chosen in the morning, before email.</p>
<h3>Eat the frog</h3>
<p>Do the most unpleasant task first, while willpower is at its highest. Loosely attributed to Mark Twain, popularised by Brian Tracy.</p>

<h2 id="habitudes">Habits</h2>
<h3>Streak</h3>
<p>The number of consecutive days a habit has been kept. A powerful motivator, provided you know that one isolated miss ruins nothing. → <a href="/en/blog/combien-de-temps-prendre-habitude">How long does it take to build a habit?</a></p>
<h3>Habit stacking</h3>
<p>Attaching a new habit to an existing routine: "after [current habit], I do [new habit]". A contextual trigger beats an abstract time of day.</p>
<h3>Habit heatmap</h3>
<p>A calendar grid where each day kept colours a cell, in the spirit of the GitHub contribution graph. It makes consistency, and the gaps in it, visible at a glance.</p>
<h3>The two-day rule</h3>
<p>Never miss a habit two days in a row. It rests on the research: an isolated miss has no measurable effect, it is the repeated miss that kills the habit.</p>
<h3>The 21-day rule (a myth)</h3>
<p>The idea that a habit forms in 21 days is a misreading of an observation by Maxwell Maltz. The science (Lally, 2009): a median of 66 days, ranging from 18 to 254.</p>

<h2 id="pratique">From glossary to practice</h2>
<p>All of these concepts live in one place in <a href="/en/">Cosmo</a>: OKRs with progress computed for you, time-blocking by drag and drop, priorities to apply Eisenhower, and habits with heatmaps and streaks. <a href="/en/signup">Free</a>, with an instant demo and no sign-up.</p>
`,
    },
  },
};
