// Articles du blog en anglais, par slug. Séparés des articles pour ne partir
// que chez les visiteurs `en` (budget du chunk `blog`) : cf. src/content/load-locale.mjs.
export const EN = {
  "bilan-de-l-annee": {
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

<h2 id="en-bref">How do you review your year?</h2>
<p class="answer">Take an hour somewhere quiet, with your calendar and notes. Answer ten questions in writing, in three parts: what happened (defining moments, pride, failures and their causes), what you take from it (energy, time, habits, main lesson), then what you will stop, continue and start next year.</p>

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
  "combien-de-temps-prendre-habitude": {
      title: "How long does it really take to build a habit? (what the science says)",
      metaTitle: "How long to build a habit? The real answer",
      description: "21 days? 66 days? The real answer from the science is more nuanced, and far more useful. What the landmark study found, and how to actually use it.",
      readingMinutes: 7,
      faq: [
        ["So is it 21, 30, 66 or 90 days to build a habit?", "A median of 66 days according to the landmark study (Lally, 2009), with a real range of 18 to 254 days depending on the habit and the person."],
        ["How many habits should you start at once?", "Two or three at most. Every habit still forming consumes attention."],
        ["If a streak breaks, is everything lost?", "No: an isolated miss has no measurable effect on habit formation. The rule is simply never to miss twice in a row."],
      ],
      html: `
<p class="lead">"It takes 21 days to build a habit." You have read that number everywhere, and it is wrong. The research gives an answer that is both less marketable and far more useful: <strong>66 days on average, with enormous variation depending on the habit and the person, from 18 to 254 days</strong>. Understanding why changes how you go about it entirely, and above all it explains why you were never "bad at this": you just had the wrong number in your head.</p>

<h2 id="en-bref">How many days does it take to build a habit?</h2>
<p class="answer">66 days on average, according to Phillippa Lally's landmark study (University College London, 2009), with a real range of 18 to 254 days depending on the habit and the person. The 21-day figure is a myth. Missing a single day has no measurable effect: what matters is never missing twice in a row.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days." /><figcaption>Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="mythe">Where does the 21-day myth come from?</h2>
<p>From a misreading. In the 1960s, the cosmetic surgeon Maxwell Maltz observed that his patients took <em>"a minimum of about 21 days"</em> to get used to their new face. His book <em>Psycho-Cybernetics</em> sold millions of copies, the qualifier fell away along the road, and "a minimum of about 21 days" became "it takes 21 days". No study has ever validated that figure for habit formation.</p>

<h2 id="etude">What the real study says: 18 to 254 days</h2>
<p>The scientific reference is the study by <strong>Phillippa Lally</strong> (University College London, 2009), published in the <em>European Journal of Social Psychology</em>. 96 participants each chose a new daily habit (drinking a glass of water at lunch, running for 15 minutes, eating a piece of fruit) and reported every day how automatic the behaviour felt.</p>
<p>The results:</p>
<ul>
<li><strong>a median of 66 days</strong> to reach the plateau of automaticity;</li>
<li>a real range of <strong>18 to 254 days</strong> depending on the habit and the person;</li>
<li>the more complex the habit, the longer it takes: drinking a glass of water becomes automatic in a few weeks, doing 50 sit-ups before your morning coffee can take months;</li>
<li>and the most important finding of all: <strong>missing a single isolated day had no measurable effect</strong> on habit formation.</li>
</ul>

<h2 id="consequences">The 4 practical consequences</h2>
<h3>1. Stop judging yourself at day 21</h3>
<p>If the habit still takes effort after three weeks, you are simply average. The feeling of automaticity arrives much later than popular culture promises. The only real failure is quitting because you believed it should already be easy.</p>
<h3>2. One missed day breaks nothing, two do</h3>
<p>The science is clear: an isolated miss is neutral. The operational rule that follows is <strong>"never twice in a row"</strong>. Miss Monday if life demands it, then protect Tuesday as though your streak depended on it, because that is where it is actually decided.</p>
<h3>3. Difficulty predicts duration, so start ridiculously small</h3>
<p>Since complexity lengthens the time to automaticity, the rational strategy is to shrink the habit to its minimum version: 5 minutes of running, 1 page of reading, 10 vocabulary words, the same logic behind <a href="/en/for-students">student revision routines</a>. You automate the <em>trigger</em> first (running every morning), and increase the <em>dose</em> afterwards. Doing it the other way round, starting strong, maximises both the difficulty and the delay.</p>
<h3>4. The trigger matters more than motivation</h3>
<p>In Lally's study the habit was always anchored to a precise context ("after lunch", "after my coffee"). That is the principle behind <em>habit stacking</em>: attach the new habit to an existing routine rather than to an abstract time of day. "After I put my cup in the sink, I put my running shoes on" beats "run at 7 am" hands down.</p>

<h2 id="phases">The 3 phases (and where it breaks)</h2>
<div class="table-wrap"><table>
<thead><tr><th>Phase</th><th>Rough period</th><th>What happens</th><th>The risk</th></tr></thead>
<tbody>
<tr><td>Take-off</td><td>Weeks 1 to 2</td><td>High motivation, high effort, no visible results</td><td>Starting too hard and burning out</td></tr>
<tr><td>Crossing the desert</td><td>Weeks 3 to 8</td><td>The novelty has gone, automaticity has not arrived</td><td>This is where 80 % of people quit</td></tr>
<tr><td>Automaticity</td><td>From 2 to 3 months</td><td>The behaviour fires on its own, not doing it feels uncomfortable</td><td>Believing you have "arrived" and dismantling the tracking</td></tr>
</tbody>
</table></div>
<p>Crossing the desert is precisely the moment when <strong>visual tracking</strong> becomes decisive: when the feeling of progress is absent, visible proof of the ground already covered takes its place.</p>

<h2 id="mesurer">Making consistency visible</h2>
<p>That is the whole principle of habit tracking in <a href="/en/">Cosmo</a>: every habit shows a <strong>26-week heatmap</strong> in the GitHub style, where each day ticked colours a cell, plus your current <strong>streak</strong> and your completion rate. The chain of green cells makes visible exactly what crossing the desert hides from you: you are moving forward. And because missing an isolated day is scientifically harmless, what counts is the trend over 26 weeks, not perfection. On which indicators are worth watching, and which discourage instead of helping, the article on <a href="/en/blog/suivi-des-habitudes">habit tracking</a> takes a position. Create your first two or three habits <a href="/en/signup">for free</a>, or try the demo with no sign-up and habits already filled in.</p>

<p>Planning your New Year's resolutions? Here is <a href="/en/blog/tenir-ses-resolutions">why most of them fail, and how to keep yours</a>, with a <a href="/en/blog/habit-tracker-a-imprimer">printable 2027 habit tracker</a> to tick off your first days.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>So is it 21, 30, 66 or 90 days?</h3>
<p>A median of 66 days, ranging from 18 to 254. Remember it as "roughly 2 to 3 months, longer if it is ambitious", and design your system to hold for that long, not for three weeks.</p>
<h3>How many habits should you start at once?</h3>
<p>Two or three at most. Every habit still forming consumes attention, and starting six is the surest way to keep none.</p>
<h3>If a streak breaks, is everything lost?</h3>
<p>No, and this is the most toxic myth in the field. Lally's study shows that an isolated miss has no measurable effect. The only rule: never miss twice in a row.</p>
`,
  },
  "cosmo-vs-google-tasks": {
      title: "Cosmo or Google Tasks: when to move to a more complete alternative?",
      metaTitle: "Google Tasks alternative: Cosmo, an honest comparison",
      description: "Google Tasks is simple, free and built into Gmail and Calendar. Cosmo adds priorities, habits, time blocking and OKRs. An honest comparison, and when to switch.",
      readingMinutes: 5,
      html: `
<p class="lead">Google Tasks does one thing and does it well: a simple, free task list, available from Gmail and Google Calendar. For many people that is enough. This page is for those who feel its limits: too many tasks at the same level, goals that appear nowhere, days that overflow. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Keep Google Tasks</strong> if you have few tasks, live in Gmail and want zero setup.</li>
<li><strong>Move to Cosmo</strong> if you want to prioritise, schedule tasks into time slots, and track habits and numbered goals.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Google Tasks</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Task lists, subtasks, dates</td><td>Yes, simple</td><td>Yes</td></tr>
<tr><td>Priorities and categories</td><td>No (star only)</td><td>Yes</td></tr>
<tr><td>Gmail and Google Calendar integration</td><td>Yes, native</td><td>No</td></tr>
<tr><td>Time blocking</td><td>Dated tasks shown in the calendar</td><td>Dedicated calendar to place tasks into time slots</td></tr>
<tr><td>Habit tracking</td><td>No</td><td>Yes</td></tr>
<tr><td>Goals (OKRs)</td><td>No</td><td>Yes</td></tr>
<tr><td>Statistics</td><td>No</td><td>Yes, dashboard</td></tr>
</tbody>
</table></div>

<h2 id="google-fort">Where Google Tasks is still ahead</h2>
<p>Integration is its strength: turning an email into a task, seeing dated tasks in Google Calendar, with nothing to install. If your day fits into a dozen tasks, adding a tool would be needless complexity.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>When the list grows, a flat list no longer tells you where to start. Cosmo adds what is missing: priorities and categories to sort, a calendar to give important tasks a real slot (see <a href="/en/blog/gestion-du-temps-efficace">effective time management</a>), habits tracked day after day, and quarterly goals with their progress. It is the difference between a list and a system.</p>

<h2 id="quand">Signs it is time to switch</h2>
<ul>
<li>Your list is over thirty tasks and you no longer know which one matters.</li>
<li>Your important tasks slip from day to day for lack of a time slot.</li>
<li>You have goals for the year, but nothing connects them to your week.</li>
</ul>

<h2 id="conclusion">Conclusion</h2>
<p>Google Tasks is perfect for a simple list. Cosmo is built to steer your days and your goals. To see the difference without losing anything, <a href="/en/signup">try Cosmo for free</a> or open the demo without sign-up, filled with sample data.</p>
`,
  },
  "cosmo-vs-notion": {
      title: "Cosmo or Notion for getting organised: which alternative to choose?",
      metaTitle: "Notion alternative for personal planning: Cosmo compared",
      description: "Notion can do everything, provided you build everything. Cosmo ships tasks, habits, calendar and OKRs ready to use. An honest comparison, and who each one suits best.",
      readingMinutes: 6,
      html: `
<p class="lead">Notion is an almost endless workspace: documents, databases, wikis, thousands of templates. Many people use it for their tasks, habits and goals, with a downloaded template or one built by hand. If you are looking for a Notion alternative for getting organised, the question is simple: do you prefer to <strong>build your system</strong> or to <strong>use a system that is already wired together</strong>? Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose Notion</strong> if you want a single tool for notes, documents, wiki and projects, and you enjoy building your own setup.</li>
<li><strong>Choose Cosmo</strong> if you want tasks, habits, a calendar and OKRs that work together from minute one, with no database to design or maintain.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Notion</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Notes, documents, wiki</td><td>Yes, it is the core</td><td>No</td></tr>
<tr><td>Tasks</td><td>Through a database you configure</td><td>Yes, ready to use</td></tr>
<tr><td>Habit tracking</td><td>Through a template or a manual build</td><td>Yes, native, with streak and heatmap</td></tr>
<tr><td>OKRs with calculated progress</td><td>Through formulas and relations you build</td><td>Yes, native</td></tr>
<tr><td>Time-blocking calendar</td><td>Calendar view of a database</td><td>Calendar to place tasks into time slots</td></tr>
<tr><td>Setup time</td><td>From a few hours to several days</td><td>A few minutes, demo without an account</td></tr>
<tr><td>Use on a phone</td><td>Possible, less comfortable for complex databases</td><td>Designed for the phone first</td></tr>
</tbody>
</table></div>

<h2 id="notion-fort">Where Notion is still ahead</h2>
<p>Notion is unbeatable on flexibility and on writing. Taking notes, documenting a project, sharing a team wiki, linking pages together: no specialised productivity tool comes close. If your organisation rests mainly on documents, keep Notion.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>Notion's flexibility has a cost: you build the system, then you fix it. A goals dashboard pieced together with relations and formulas works as long as you maintain it, and that is often where it stops. Cosmo makes the opposite choice: less freedom, but a complete circuit already connected. An objective breaks down into key results, key results into tasks, tasks get a slot in the calendar, and the <a href="/en/blog/tableau-de-bord-productivite">statistics</a> show what is moving.</p>

<h2 id="ensemble">Both together?</h2>
<p>It is a common and sensible combination: Notion for notes and documentation, Cosmo for day-to-day execution (tasks, habits, calendar, goals). Each does what it does best, and you no longer maintain a task database.</p>

<h2 id="migration">Moving your tasks from Notion to Cosmo</h2>
<ol>
<li>Open the demo to see how things are organised, filled with sample data.</li>
<li>Bring over only your current tasks and active habits: no need to migrate the history.</li>
<li>If you tracked goals in a Notion table, copy them as OKRs with their starting value and target. The <a href="/en/blog/template-okr-gratuit">OKR template</a> explains how to word them.</li>
</ol>

<h2 id="conclusion">Conclusion</h2>
<p>Notion is an excellent tool for writing and building. Cosmo is a tool for executing, already built. If you spend more time maintaining your system than using it, <a href="/en/signup">try Cosmo for free</a> or open the demo without sign-up.</p>
`,
  },
  "cosmo-vs-ticktick": {
      title: "Cosmo or TickTick: which alternative for your tasks and habits?",
      metaTitle: "TickTick alternative: Cosmo, an honest comparison",
      description: "TickTick combines tasks, habits and Pomodoro. Cosmo adds OKRs and a time-blocking calendar tied to your goals. An honest comparison, and who each one suits best.",
      readingMinutes: 6,
      html: `
<p class="lead">TickTick is one of the most complete task managers around: lists, reminders, habit tracking, a Pomodoro timer, a calendar view and an Eisenhower matrix. If you are looking for a TickTick alternative, the real question is not "which has more features" but "what do you want to steer". TickTick organises your days; Cosmo ties your days to your goals. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose TickTick</strong> if you mainly want a very fast task list, native apps on every device (watch included) and a built-in Pomodoro timer.</li>
<li><strong>Choose Cosmo</strong> if you want your tasks and habits to serve numbered goals (OKRs), with a time-blocking calendar and statistics that show the gap between what you aim for and what you do.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Feature</th><th>TickTick</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Tasks, subtasks, reminders, recurrence</td><td>Yes, very complete</td><td>Yes</td></tr>
<tr><td>Habit tracking</td><td>Yes</td><td>Yes, with a 26-week heatmap</td></tr>
<tr><td>Objectives and key results (OKRs)</td><td>No</td><td>Yes, linked to tasks and the dashboard</td></tr>
<tr><td>Calendar and time blocking</td><td>Calendar view</td><td>Calendar to schedule tasks into time slots</td></tr>
<tr><td>Pomodoro timer</td><td>Yes, built in</td><td>No</td></tr>
<tr><td>Native apps</td><td>Yes, on most platforms</td><td>No: web app, usable on mobile</td></tr>
<tr><td>Try without an account</td><td>No</td><td>Yes, full demo without sign-up</td></tr>
<tr><td>Team space with permissions</td><td>Shared lists</td><td>Business mode: teams, per-member permissions</td></tr>
</tbody>
</table></div>

<h2 id="ticktick-fort">Where TickTick is still ahead</h2>
<p>TickTick is years ahead on quick capture and being everywhere: widgets, desktop apps, smartwatch, natural-language input. Its Pomodoro timer linked to tasks is a real plus if you work in sessions. If your need is "forget nothing and move forward task by task", TickTick is an excellent choice, and it would be dishonest to say otherwise.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>TickTick does not handle goals. You can track "run 3 times a week" but not "run 10 km by the end of March" with a starting value, a target and progress. Cosmo is built around that link: a quarterly objective breaks down into <a href="/en/blog/methode-okr-exemples">key results</a>, which turn into tasks placed in the calendar and habits ticked every day. The dashboard then shows what is really moving.</p>
<p>Second difference: the demo. Cosmo opens without an account, with twelve months of sample data, so you judge the tool loaded rather than in front of an empty screen.</p>

<h2 id="profils">Which tool for which profile?</h2>
<ul>
<li><strong>Student preparing exams</strong>: TickTick for Pomodoro, Cosmo if you want to link revision, habits and semester goals (see <a href="/en/for-students">Cosmo for students</a>).</li>
<li><strong>Freelancer</strong>: Cosmo, to plan days in blocks and track revenue or prospecting goals.</li>
<li><strong>Someone who just wants a shopping list and reminders</strong>: TickTick, without hesitation.</li>
</ul>

<h2 id="migration">Moving from TickTick to Cosmo</h2>
<ol>
<li>Open the demo to check the way it is organised suits you.</li>
<li>Recreate your habits first (there are few of them), then only your current tasks: a good moment to clear things out.</li>
<li>Write one or two goals for the quarter and link your tasks to them. That is what changes most day to day.</li>
</ol>

<h2 id="conclusion">Conclusion</h2>
<p>TickTick is an excellent task manager with habits. Cosmo is a steering tool where tasks, habits, calendar and OKRs work together. If your tasks need to serve goals, <a href="/en/signup">try Cosmo for free</a> or open the demo without sign-up. Also weighing Todoist? See <a href="/en/blog/cosmo-vs-todoist">Cosmo vs Todoist</a>.</p>
`,
  },
  "cosmo-vs-todoist": {
      title: "Cosmo vs Todoist: which one should you choose in 2026?",
      metaTitle: "Cosmo vs Todoist (2026): an honest, complete comparison",
      description: "Todoist is an excellent task manager. Cosmo adds habits, a time-blocking calendar and OKRs in a free app. An honest comparison, point by point.",
      readingMinutes: 7,
      html: `
<p class="lead">Todoist is probably the most accomplished task manager on the market: 18 years of existence, native apps everywhere, formidable natural-language input. So why compare at all? Because the question is not "which is the best to-do list?" but "<strong>what does your system actually need?</strong>". If the answer includes habit tracking, time-blocking or measurable goals, the match gets interesting. An honest comparison, point by point.</p>
<figure><img src="/screenshots/taches.webp" srcset="/screenshots/taches-800.webp 800w, /screenshots/taches.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's task manager: quick-access lists, filters by priority and category, overdue tasks flagged." /><figcaption>Cosmo's task manager: quick-access lists, filters by priority and category, overdue tasks flagged. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose Todoist</strong> if you only want to manage tasks, with native apps (Windows, macOS, mobile), integrations across your whole ecosystem (Gmail, Slack, calendars) and extremely fast capture.</li>
<li><strong>Choose Cosmo</strong> if you want to connect tasks, <strong>habits</strong>, a <strong>time-blocking calendar</strong> and <strong>OKRs</strong> in a single free tool, rather than juggling three or four applications.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Todoist</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Task management</td><td>Excellent, the market reference</td><td>Complete: priorities 1 to 5, categories, lists, filters</td></tr>
<tr><td>Natural-language input</td><td>Yes, remarkable ("tomorrow 2pm")</td><td>No, a structured form</td></tr>
<tr><td>Habit tracking</td><td>Not native, worked around with recurring tasks</td><td>Native: 26-week heatmap, streaks, completion rate</td></tr>
<tr><td>Calendar and time-blocking</td><td>Calendar view (paid), no true time-blocking</td><td>Native: drag a task into the calendar and the linked event is created</td></tr>
<tr><td>OKRs and goals</td><td>Absent</td><td>Native, with progress computed for you</td></tr>
<tr><td>Statistics</td><td>Karma, a gamification score</td><td>Across modules: time invested in tasks, habits, calendar, OKRs</td></tr>
<tr><td>Collaboration</td><td>Yes, mature (shared projects)</td><td>Task sharing with Viewer and Editor roles</td></tr>
<tr><td>Native apps</td><td>Windows, macOS, iOS, Android, extensions</td><td>A mobile-first web app, nothing to install</td></tr>
<tr><td>Third-party integrations</td><td>Very many (calendars, Slack, email)</td><td>None to date</td></tr>
<tr><td>Price</td><td>Limited free tier (5 projects), Pro around 4 to 5 € a month</td><td>Free, with the main features unlimited</td></tr>
<tr><td>Try without an account</td><td>No</td><td>Yes, an instant pre-filled demo with no sign-up</td></tr>
</tbody>
</table></div>
<p><em>Comparison written on 18 July 2026 and reviewed on 13 October 2026, based on Todoist's public pages (features and pricing). Todoist's plans change: check them on todoist.com before choosing.</em></p>

<h2 id="todoist-fort">Where Todoist is still ahead</h2>
<p>Let us be direct: on <strong>pure task management</strong>, Todoist has an 18-year head start and it shows.</p>
<ul>
<li><strong>Natural-language input.</strong> Typing "Report every Monday 9am #Work" and watching the recurrence, the time and the project fill themselves in is the best on the market.</li>
<li><strong>Native apps.</strong> System-wide keyboard shortcuts, a widget, capture from anywhere: if you capture 30 tasks a day, that comfort matters.</li>
<li><strong>The ecosystem.</strong> Todoist plugs into Gmail, Outlook, Slack and your calendar. For personal use, Cosmo does not offer third-party integrations yet; only the company workspace can send its task events to Slack or to a web service.</li>
<li><strong>Collaborative maturity.</strong> Todoist's shared projects are battle-tested for running a whole team.</li>
</ul>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>Todoist's limit is not what it does, it is what it does not do. A complete personal system rests on four pillars, and Todoist covers one.</p>
<ul>
<li><strong>Habits are native.</strong> In Todoist a habit is a recurring task that makes you feel guilty when it is overdue. In Cosmo it is its own object: a 26-week GitHub-style heatmap, streaks, completion rate. Consistency gets built visually.</li>
<li><strong>Time-blocking is real.</strong> You drag a task onto a calendar slot and the event is created and linked to the task. Planning your day takes two minutes, with no external sync.</li>
<li><strong>OKRs give a direction.</strong> A to-do list tells you what to do today, it never tells you whether you are moving towards what matters. Cosmo's OKRs connect your daily actions to measurable goals (<a href="/en/blog/methode-okr-exemples">see our guide to the OKR method with 15 examples</a>).</li>
<li><strong>The price.</strong> Cosmo's main features are free with no project limit. Free Todoist caps at 5 projects, and the calendar view is paid.</li>
<li><strong>Frictionless trial.</strong> The <a href="/en/">Cosmo demo</a> opens with no account, pre-filled with 12 months of realistic data, so you can judge it loaded in two minutes.</li>
</ul>

<h2 id="profils">Which tool for which profile?</h2>
<h3>You capture a great many tasks, everywhere, all the time</h3>
<p><strong>Todoist.</strong> Its lightning capture and native apps are built for exactly that.</p>
<h3>You want to build habits as well as manage tasks</h3>
<p><strong>Cosmo.</strong> That is the structural difference: habits are a pillar here, not a workaround.</p>
<h3>You plan your days with time-blocking</h3>
<p><strong>Cosmo</strong>, unless you already have a Todoist plus Google Calendar flow that suits you.</p>
<h3>You set quarterly goals, personal or professional</h3>
<p><strong>Cosmo.</strong> Todoist simply does not have that building block.</p>
<h3>Your whole team has to collaborate on projects</h3>
<p><strong>Todoist</strong> for heavy collaboration and integrations. Cosmo is enough for sharing tasks between two or three people, and goes further as soon as shared goals are involved, as the <a href="/en/for-teams">Cosmo for teams</a> page shows.</p>

<h2 id="migration">Moving from Todoist to Cosmo</h2>
<p>There is no automatic import today, but that is an opportunity to clear house: copy across only the tasks that are genuinely active (rarely more than 20), recreate your projects as coloured categories, then add what Todoist was not carrying: two or three habits and a first quarterly OKR. The <a href="/en/guide">user guide</a> covers the full setup in ten minutes. If you work for yourself, the <a href="/en/for-freelancers">Cosmo for freelancers</a> page shows the same flow applied to a client portfolio.</p>

<p>Comparing other tools? See also <a href="/en/blog/cosmo-vs-ticktick">Cosmo or TickTick</a>, <a href="/en/blog/cosmo-vs-notion">Cosmo or Notion</a>, <a href="/en/blog/cosmo-vs-trello">Cosmo or Trello</a>, <a href="/en/blog/cosmo-vs-google-tasks">Cosmo or Google Tasks</a>, <a href="/en/blog/cosmo-vs-clickup">Cosmo or ClickUp</a>, <a href="/en/blog/cosmo-vs-habitica">Cosmo or Habitica</a>, <a href="/en/blog/cosmo-vs-microsoft-to-do">Cosmo or Microsoft To Do</a> and <a href="/en/blog/cosmo-vs-any-do">Cosmo or Any.do</a>.</p>

<h2 id="conclusion">Conclusion</h2>
<p>Todoist is an excellent tool, and if your need stops at tasks, keep it. But if your system looks like "a to-do list plus a habit app plus a calendar plus a goals spreadsheet", then the real question is not which to-do list is best: it is how to stop paying the friction between four tools. That is precisely Cosmo's bet, and you can check it in two minutes, <a href="/en/signup">free and with no credit card</a>.</p>
`,
  },
  "cosmo-vs-trello": {
      title: "Cosmo or Trello: which alternative for organising your work?",
      metaTitle: "Trello alternative: Cosmo, an honest comparison",
      description: "Trello excels at tracking a flow in columns. Cosmo organises your days around priorities, habits and goals. An honest comparison, and who each one suits best.",
      readingMinutes: 5,
      html: `
<p class="lead">Trello popularised the kanban board: cards moving from "To do" to "Doing" to "Done". It is an excellent way to follow a workflow. But a board tells you <em>where</em> each card stands, not <em>when</em> you will do it or <em>why</em> it matters. If you are looking for a Trello alternative for personal organisation, here is what really changes. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose Trello</strong> to follow a process in stages (content, hiring, small project teams), visually, with plenty of integrations.</li>
<li><strong>Choose Cosmo</strong> to decide what to do today: prioritised tasks, slots in the calendar, habits and numbered goals in one place.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Trello</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Kanban board</td><td>Yes, it is the core</td><td>No: prioritised task lists</td></tr>
<tr><td>Scheduling tasks within the day</td><td>Due dates on cards</td><td>Time-blocking calendar</td></tr>
<tr><td>Habit tracking</td><td>No</td><td>Yes</td></tr>
<tr><td>Objectives and key results</td><td>No</td><td>Yes</td></tr>
<tr><td>Third-party integrations</td><td>Many (Power-Ups)</td><td>Limited</td></tr>
<tr><td>Team and permissions</td><td>Shared boards</td><td>Business mode: teams, projects, per-member permissions</td></tr>
</tbody>
</table></div>

<h2 id="trello-fort">Where Trello is still ahead</h2>
<p>For visualising a multi-step flow, Trello remains a reference: you see at a glance what is stuck, you drag a card, everyone understands. Its integrations plug it into many other tools. For a very visual team process, it is hard to beat.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>A personal kanban board often ends up with a "To do" column of forty cards. The problem is not seeing them, it is choosing. Cosmo starts from priority: the <a href="/en/blog/matrice-eisenhower">Eisenhower matrix</a> to sort, <a href="/en/blog/time-blocking-guide">time blocking</a> to give important tasks a slot, and quarterly goals to know why they matter. Habits complete the picture: what you do every day, not just what you finish.</p>

<h2 id="profils">Which tool for which profile?</h2>
<ul>
<li><strong>Team following a process</strong> (publishing, hiring, support): Trello.</li>
<li><strong>Manager or freelancer who has to arbitrate their days</strong>: Cosmo (see <a href="/en/for-managers">Cosmo for managers</a>).</li>
<li><strong>Personal organisation</strong>: Cosmo, to connect tasks, habits and goals.</li>
</ul>

<h2 id="conclusion">Conclusion</h2>
<p>Trello shows the state of a flow. Cosmo helps you decide your day and tie it to your goals. If your "To do" column only keeps growing, <a href="/en/signup">try Cosmo for free</a> or open the demo without sign-up. Also comparing with Notion? See <a href="/en/blog/cosmo-vs-notion">Cosmo or Notion</a>.</p>
`,
  },
  "gestion-du-temps-efficace": {
      title: "Effective time management: 7 principles that last",
      metaTitle: "Effective time management: 7 principles that hold up",
      description: "The 7 time-management principles that survive a busy week, with no complicated method: trade-offs, calendar slots, work units, the weekly review.",
      readingMinutes: 9,
      faq: [
        ["What is the most effective time-management method?", "The one you keep for three months. In practice the combination that holds up best is: a single list, an explicit trade-off on priorities, and reserved calendar slots for what genuinely matters."],
        ["How do you manage your time when everything is urgent?", "Everything cannot be urgent: that is almost always the symptom of a missing trade-off. Sort on two axes (urgent and important), handle quadrant 1, and above all reserve a slot for quadrant 2, because that is what produces next week's emergencies."],
        ["How long before you see a result?", "Two to three weeks to feel the difference in mental load, six to eight for the system to hold without conscious effort. Below that you are judging a system on its installation period."],
      ],
      html: `
<p class="lead">Time management suffers from a misunderstanding: it is presented as a problem of technique, when it is first of all a problem of trade-offs. No method fits sixty hours of work into a thirty-five hour week. What a good method does instead is make visible what does not fit, early enough for you to decide what to drop. Here are seven principles that survive a busy week, from the most structural to the most granular.</p>

<h2 id="en-bref">What is effective time management?</h2>
<p class="answer">Deciding in advance what deserves your time, then protecting it. In practice: clarify your priorities, give important tasks a slot in your calendar rather than leaving them on a list, batch short tasks, limit interruptions and review your week every week to correct course.</p>
<figure><img src="/screenshots/agenda.webp" srcset="/screenshots/agenda-800.webp 800w, /screenshots/agenda.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's calendar in week view: tasks waiting to be scheduled are listed on the left and dragged into a time slot." /><figcaption>Cosmo's calendar in week view: tasks waiting to be scheduled are listed on the left and dragged into a time slot. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="arbitrage">1. Accept that managing your time means giving things up</h2>
<p>This is the principle all the others follow from, and the only genuinely hard one. A week contains a fixed number of useful hours, for most people between thirty and forty when counted honestly. Any method that promises to "do more" without removing anything simply postpones the moment you discover it did not fit.</p>
<p>The practical consequence: every time you accept something new, name what it displaces. Not mentally, in your list. A commitment made without an identified counterpart is a commitment that will be kept at the expense of something you did not choose.</p>

<h2 id="liste-unique">2. One list, not four</h2>
<p>Tasks in a notebook, others in unread email, others again in messages you send yourself: mental load does not come from the volume of work, it comes from uncertainty about what you have forgotten. As long as the list is not single, part of your attention stays busy watching the others.</p>
<p>Consolidating matters more than which tool you pick. One list on paper beats three perfect apps. If the choice of tool is blocking you anyway, the <a href="/en/blog/cosmo-vs-todoist">Cosmo and Todoist comparison</a> sets out the criteria that actually count.</p>

<h2 id="arbitrer">3. Make trade-offs explicitly, not by feel</h2>
<p>With no written criterion, "prioritising" amounts to handling whatever shouts loudest. Two questions are enough for each task: <strong>is it urgent?</strong> and <strong>is it important?</strong> That is the <a href="/en/blog/matrice-eisenhower">Eisenhower matrix</a>, and its value is not the sorting itself but the fact that it forces the question "important relative to what?".</p>
<p>This is where explicit goals become useful: without them everything looks important and the trade-off stops filtering anything. Two to four goals for the quarter are enough to settle 80 % of cases.</p>

<h2 id="creneaux">4. What has no slot does not exist</h2>
<p>An important but non-urgent task will always lose to an emergency, indefinitely, whatever your discipline. The only protection that works is physical: give it a place in the calendar, on the same footing as an appointment with somebody else.</p>
<p>That is the principle of <a href="/en/blog/time-blocking-guide">time-blocking</a>, and its secondary benefit is as valuable as the first: by placing your tasks in slots, you discover immediately what does not fit in the week, before you have committed rather than after.</p>

<h2 id="unite">5. Work in units, not continuously</h2>
<p>Sustained attention is counted in blocks of twenty to ninety minutes depending on the person and the task, not in days. Two concrete consequences:</p>
<ul>
<li><strong>Group what is of the same nature.</strong> Email in two blocks a day rather than continuously, calls back to back, admin in a single stretch. Every context switch costs several minutes of spinning back up, an invisible and considerable cost once accumulated.</li>
<li><strong>Protect the start of a block.</strong> The first minutes determine the rest: knowing exactly what to begin with is worth more than ten extra minutes. Hence the value of splitting tasks until the first action is obvious.</li>
</ul>

<h2 id="frottement">6. Reduce friction rather than relying on willpower</h2>
<p>Willpower is a variable resource, friction is constant. If a task requires opening three tools and finding a password before you can start, it will be postponed, not out of laziness but because of the cost of entry. Conversely, what is immediately at hand gets done.</p>
<p>The same applies to the system itself: a method that demands fifteen minutes of daily maintenance will be abandoned within three weeks, whatever its theoretical quality. The right question is not "which is the best method?" but "which one will I still be using in three months?".</p>

<h2 id="revue">7. A weekly review, short and non-negotiable</h2>
<p>This is the most frequently abandoned principle, and the one that holds all the others up. Fifteen to twenty minutes at the end of the week:</p>
<ol>
<li>What was finished, and above all what was planned without being done, which tells you about your real calibration.</li>
<li>Where the time went, by broad category. This is often the surprise of the week.</li>
<li>Where the underlying goals stand, as a trajectory rather than an exact percentage.</li>
<li><strong>A single</strong> adjustment for the following week. One, not five: that is what makes the review sustainable.</li>
</ol>
<p>Without that appointment, an organisation system drifts within a few weeks and nobody notices, because nothing in an ordinary week forces you to look up.</p>

<h2 id="pratique">Putting the 7 principles in place</h2>
<p>None of these principles requires a particular tool, but all of them require the data to be in one place. That is what makes a stack of applications expensive: the weekly review turns into a collection job, so it gets skipped. <a href="/en/for-freelancers">Freelancers</a> feel this more harshly than most, because nobody else will hold the frame for them. And if a term used here is unfamiliar, the <a href="/en/blog/glossaire-productivite">productivity glossary</a> defines them all.</p>
<p><a href="/en/">Cosmo</a> was built on that constraint: a single list with priorities and categories, a calendar that accepts tasks dragged in for time-blocking, habits for what should become automatic, <a href="/en/blog/methode-okr-exemples">OKRs</a> to define what "important" means this quarter, and a <a href="/en/blog/tableau-de-bord-productivite">dashboard</a> that makes the Friday review possible in fifteen minutes with no re-entry. <a href="/en/signup">Free</a>, with a demo you can open without signing up.</p>

<p>To choose the tool that will carry your method, our comparisons: <a href="/en/blog/cosmo-vs-google-tasks">Cosmo or Google Tasks</a>, <a href="/en/blog/cosmo-vs-trello">Cosmo or Trello</a>, <a href="/en/blog/cosmo-vs-ticktick">Cosmo or TickTick</a>, <a href="/en/blog/cosmo-vs-notion">Cosmo or Notion</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Which principle should you start with?</h3>
<p>The second one: bring everything into a single list. It requires no method and produces the most immediate relief. The others get added afterwards, one a week.</p>
<h3>Should you plan every minute of your day?</h3>
<p>No, and it is counterproductive. Reserve the two or three blocks that genuinely matter and leave the rest open: a day planned to 100 % does not survive the first surprise, and then the whole plan gets abandoned.</p>
<h3>What do you do when a week goes completely off the rails?</h3>
<p>Do not catch up. Pick things up at the next review as though nothing had happened. Organisation systems do not die of a bad week, they die of the attempt to compensate for the bad week.</p>
`,
  },
  "glossaire-productivite": {
      title: "A productivity glossary: 20 terms finally defined clearly",
      metaTitle: "Productivity glossary: OKRs, time-blocking, deep work",
      description: "OKRs, time-blocking, deep work, habit stacking, Parkinson's law and more. 20 productivity terms defined clearly, with what each one is actually good for.",
      readingMinutes: 8,
      html: `
<p class="lead">Productivity culture loves its jargon. Here are the 20 terms you will run into everywhere, defined plainly and without mystique, each with the part actually worth remembering.</p>

<h2 id="en-bref">Which productivity terms should you know?</h2>
<p class="answer">The most useful ones: OKR (a qualitative objective with two to five numbered key results), KPI (an indicator tracked continuously), time blocking (reserving calendar slots for your tasks), Eisenhower matrix (sorting by urgency and importance), GTD (emptying your head into a trusted system) and habit (a behaviour that has become automatic).</p>
<figure><img src="/screenshots/dashboard.webp" srcset="/screenshots/dashboard-800.webp 800w, /screenshots/dashboard.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's dashboard: today's tasks, calendar events, key results and habits on a single screen." /><figcaption>Cosmo's dashboard: today's tasks, calendar events, key results and habits on a single screen. Screenshot of the demo mode, sample data.</figcaption></figure>

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
  "habit-tracker-a-imprimer": {
      title: "Printable 2027 habit tracker: 12 free monthly pages in PDF (and how to use it well)",
      metaTitle: "Printable 2027 habit tracker: free PDF, 12 months",
      description: "Download a free printable 2027 habit tracker: one page per month, 6 habits, no sign-up. Plus the 5 rules that keep you filling it in past March.",
      readingMinutes: 6,
      faq: [
        ["Is the PDF really free?", "Yes, direct download, no sign-up and no email address. Print it as many times as you like."],
        ["How many habits should I track at once?", "Two or three to start with. The tracker has six rows, but that is capacity, not a quota."],
        ["What if I forget to tick a day?", "Nothing serious: a single miss makes no difference to habit formation. The useful rule is never to miss two days in a row."],
      ],
      html: `
<p class="lead">A habit tracker is the simplest form of habit tracking: a grid, one box per day, a cross when it is done. Its strength fits in one sentence: <strong>it makes visible a consistency you cannot feel yet</strong>. Here is a free printable 2027 habit tracker, one page per month, and how to use it so it is still being filled in come March.</p>

<h2 id="en-bref">How do you use a habit tracker?</h2>
<p class="answer">Write down two or three habits in their minimal version, attach each one to a specific moment of the day, then tick one box for every successful day, right when it is done. Keep the sheet where you will see it. At the end of the month, note the totals and change a single thing for the next month.</p>

<p><a href="/downloads/habit-tracker-2027.pdf" download><strong>Download the 2027 habit tracker (PDF, 12 A4 pages)</strong></a> (month and day labels are in French)</p>

<h2 id="contenu">What is in the PDF</h2>
<ul>
<li><strong>12 pages, one per month</strong>, from January to December 2027, A4 landscape.</li>
<li><strong>6 habit rows</strong> per month, one box per day, with the weekdays marked so you can spot slipping weekends at a glance.</li>
<li><strong>A total column</strong> at the end of each row, to note how many days you succeeded that month.</li>
<li>No intrusive logo, no data requested: it is a sheet to print, nothing more.</li>
</ul>

<h2 id="regles">5 rules to keep it filled in past March</h2>
<h3>1. Start with two or three habits</h3>
<p>The tracker has six rows; that is not a quota. Every habit being formed consumes attention, and starting six at once is the surest way to keep none. Add a new one only once the first ones happen without thinking.</p>
<h3>2. Write the minimal version of the habit</h3>
<p>"10 minutes of reading" rather than "read for an hour", "5 minutes of running" rather than "run 10 km". You automate the trigger first and raise the dose later. An overly ambitious habit never gets ticked, and an empty box discourages more than a small win.</p>
<h3>3. Attach each habit to a specific moment</h3>
<p>"After my coffee, I read for 10 minutes" works far better than "read every day". Write that trigger next to the habit's name on the sheet.</p>
<h3>4. Put the sheet where you will see it</h3>
<p>On the fridge, next to your desk, on the bathroom door. A tracker filed in a drawer does not get filled in. Ticking should take three seconds, right when the habit is done.</p>
<h3>5. Never miss two days in a row</h3>
<p>The research is clear: a single missed day has no measurable effect on forming a habit, which takes 66 days on average, not 21 (details in <a href="/en/blog/combien-de-temps-prendre-habitude">how long it takes to build a habit</a>). What breaks a habit is the second missed day. Protect the day after a slip as if it counted double.</p>

<h2 id="idees">Habit ideas to track in 2027</h2>
<div class="table-wrap"><table>
<thead><tr><th>Area</th><th>Minimal version to tick</th></tr></thead>
<tbody>
<tr><td>Health</td><td>A large glass of water on waking; a 20-minute walk</td></tr>
<tr><td>Exercise</td><td>5 minutes of stretching; one 20-minute session</td></tr>
<tr><td>Sleep</td><td>Screens off at 10:30 pm; in bed before 11 pm</td></tr>
<tr><td>Learning</td><td>10 minutes of a language; 10 pages of reading</td></tr>
<tr><td>Organisation</td><td>Plan tomorrow in 5 minutes; inbox zero on Fridays</td></tr>
<tr><td>Money</td><td>Write down the day's spending</td></tr>
<tr><td>Wellbeing</td><td>3 lines of journaling; 5 phone-free minutes after waking</td></tr>
</tbody>
</table></div>

<h2 id="lire">Reading your tracker at the end of the month</h2>
<p>On the last day of the month, take two minutes before moving to the next page:</p>
<ol>
<li>write down each row's total;</li>
<li>spot the days where everything slips (often weekends, or one particular weekday);</li>
<li>decide on a single adjustment for next month: change the time, lower the dose, or drop a habit that no longer serves you.</li>
</ol>
<p>A 70 to 80% rate over a month is a good result. Aiming for 100% makes you quit at the first hiccup. For which numbers to watch and which to ignore, see <a href="/en/blog/suivi-des-habitudes">habit tracking</a>.</p>

<h2 id="objectifs">Linking your habits to your goals for the year</h2>
<p>A habit makes the most sense when it serves a goal: three workouts a week serve "get fit again", ten minutes of English a day serve "be comfortable in meetings". If you are planning your year, start by <a href="/en/blog/objectifs-de-l-annee">setting your 2027 goals with the OKR method</a>, then pick the two or three habits that move them forward.</p>

<h2 id="papier-ou-app">Paper or app?</h2>
<p>Paper has two real strengths: you see it without opening anything, and ticking a box with a pen feels good. Its limits show over time: no reminders, no history beyond the month, and the sheet stays at home when you travel. <a href="/en">Cosmo</a> keeps the grid idea (a 26-week heatmap per habit, your current streak, your completion rate) and adds reminders and the link to your goals. Many people combine both: paper on the fridge, the app in their pocket. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Is the PDF really free?</h3>
<p>Yes, direct download, no sign-up and no email address. Print it as many times as you like.</p>
<h3>How many habits should I track at once?</h3>
<p>Two or three to start with. The tracker has six rows, but that is capacity, not a quota.</p>
<h3>What if I forget to tick a day?</h3>
<p>Nothing serious: a single miss makes no difference to habit formation. The useful rule is never to miss two days in a row.</p>
<h3>Can I start partway through the year?</h3>
<p>Of course: just print the current month's page. There is nothing to catch up on.</p>
`,
  },
  "matrice-eisenhower": {
      title: "The Eisenhower matrix: prioritise your tasks in 4 boxes (with examples)",
      metaTitle: "Eisenhower matrix: method, examples and limits (guide)",
      description: "Urgent or important? The Eisenhower matrix sorts your tasks into 4 quadrants: do, schedule, delegate or delete. The full method, with examples.",
      readingMinutes: 7,
      faq: [
        ["What is the difference between urgent and important?", "Urgent means it demands immediate action (a deadline, a phone call). Important means it contributes to your underlying goals. A task can be one, the other, both or neither, which is exactly why there are 4 quadrants."],
        ["What should you do with tasks that are neither urgent nor important?", "Delete them, or own them as chosen leisure. The trap is not relaxing, it is treating those tasks as work."],
        ["Is the Eisenhower matrix enough to get organised?", "No: it sorts, it does not schedule. It works far better combined with time-blocking (quadrant 2 goes into the calendar) and with clear goals that define what counts as important."],
      ],
      html: `
<p class="lead">"What is important is seldom urgent, and what is urgent is seldom important." The sentence attributed to President Eisenhower gave its name to the simplest prioritisation tool there is: two questions, four boxes, one decision per task. Here is how to use it properly, and above all how to avoid the trap most of its users fall into.</p>

<h2 id="en-bref">What is the Eisenhower matrix?</h2>
<p class="answer">A prioritisation method that sorts each task by two criteria, urgency and importance, into four boxes: urgent and important (do now), important but not urgent (schedule), urgent but not important (delegate) and neither (drop). The box worth protecting is the second one.</p>
<figure><img src="/screenshots/taches.webp" srcset="/screenshots/taches-800.webp 800w, /screenshots/taches.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's task manager: quick-access lists, filters by priority and category, overdue tasks flagged." /><figcaption>Cosmo's task manager: quick-access lists, filters by priority and category, overdue tasks flagged. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="principe">The principle: two questions, four quadrants</h2>
<p>For each task, ask two questions: <strong>is it urgent?</strong> (does it demand immediate action?) and <strong>is it important?</strong> (does it contribute to my underlying goals?). The answers place the task in one of four quadrants:</p>
<div class="table-wrap"><table>
<thead><tr><th></th><th>Urgent</th><th>Not urgent</th></tr></thead>
<tbody>
<tr><td><strong>Important</strong></td><td><strong>Q1: Do</strong>, now, yourself</td><td><strong>Q2: Schedule</strong>, give it a slot</td></tr>
<tr><td><strong>Not important</strong></td><td><strong>Q3: Delegate</strong> (or cut back hard)</td><td><strong>Q4: Delete</strong></td></tr>
</tbody>
</table></div>

<h2 id="quadrants">The 4 quadrants, with examples</h2>
<h3>Q1: urgent and important, do it</h3>
<p>The client crisis, the production bug, the file due tonight, the health problem. These are handled immediately and personally. A permanently crowded Q1 is not a fate: it is almost always the symptom of a neglected Q2, because everything that never got scheduled eventually turns urgent.</p>
<h3>Q2: important, not urgent, schedule it</h3>
<p>Prospecting, learning, exercise, strategy, relationships, prevention. <strong>This is the quadrant where your trajectory is decided</strong>, and it is mechanically the one that gets sacrificed, because nothing in it shouts. The only effective protection is to give these tasks a slot in the calendar, which is exactly what <a href="/en/blog/time-blocking-guide">time-blocking</a> does.</p>
<h3>Q3: urgent, not important, delegate or cut back</h3>
<p>Most interruptions, part of your meetings and email: urgent for somebody else, not for your goals. Delegate where you can, which is daily life for a <a href="/en/for-managers">team manager</a>. Where you cannot, batch them (handle email in 2 blocks a day rather than continuously) and learn the polite no.</p>
<h3>Q4: neither urgent nor important, delete</h3>
<p>Default scrolling, agenda-less meetings where your presence adds nothing, perfectionism on details nobody sees. Delete without guilt, or own it as genuine chosen rest, which is a different thing.</p>

<h2 id="piege">The classic trap: living in Q1 and Q3</h2>
<p>The mistake is not misfiling a task, it is letting urgency decide. A day driven by notifications is spent entirely in Q1 and Q3: you put out fires and answer other people's emergencies, ending up feeling swamped and with the impression of having moved nothing forward. Two antidotes:</p>
<ol>
<li><strong>Sort in the morning, not continuously.</strong> Five minutes to triage the day's list before opening your inbox. Afterwards it is too late, urgency has taken over.</li>
<li><strong>Protect Q2 physically.</strong> A Q2 task with no reserved slot will always lose to a Q3 emergency. The matrix sorts, the calendar protects. It is the fourth of the seven principles of <a href="/en/blog/gestion-du-temps-efficace">effective time management</a>: what has no slot does not exist.</li>
</ol>

<h2 id="important">"Important" relative to what?</h2>
<p>The matrix has a silent prerequisite: knowing what is important <em>to you</em>. Without explicit goals everything looks important and the matrix stops filtering anything. This is where the <a href="/en/blog/methode-okr-exemples">OKR method</a> completes Eisenhower perfectly: your 2 to 4 objectives for the quarter become the objective criterion for the "important" column. A task that serves neither an OKR nor a real obligation stands a good chance of being Q3 or Q4 in disguise.</p>

<h2 id="pratique">Putting it into practice in Cosmo</h2>
<p>In <a href="/en/">Cosmo</a>, the matrix translates naturally: <strong>priorities 1 to 5</strong> encode importance, the <strong>deadline</strong> carries urgency, and filtered lists show you your real Q1 for the day. Q2 tasks are dragged into the calendar as time blocks (the linked event is created for you), and your <a href="/en/blog/methode-okr-exemples">OKRs</a> define what "important" means this quarter. <a href="/en/signup">Free</a>, with a demo and no sign-up.</p>

<p>To sort your tasks right away, use the <a href="/en/eisenhower-matrix-online">online Eisenhower matrix</a>: free, no sign-up, printable.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>What is the difference between urgent and important?</h3>
<p>Urgent means it demands immediate action. Important means it contributes to your underlying goals. Separating the two is exactly what the matrix forces you to do.</p>
<h3>What should you do with tasks that are neither urgent nor important?</h3>
<p>Delete them, or own them as chosen leisure. The trap is treating them as work.</p>
<h3>Is the matrix enough to get organised?</h3>
<p>No: it sorts but it does not schedule. Combine it with time-blocking (Q2 → calendar) and with explicit goals (OKRs) that define what "important" means.</p>
`,
  },
  "methode-okr-exemples": {
      title: "The OKR method explained simply (with 15 concrete examples)",
      metaTitle: "OKR method: a simple guide and 15 concrete examples (2026)",
      description: "What is the OKR method? A simple definition, the rules for writing them, and 15 concrete personal and professional OKR examples ready to adapt.",
      readingMinutes: 9,
      faq: [
        ["How many OKRs should you set?", "Two to four objectives per cycle at most, with 2 to 5 key results each. The fewer you have, the better the method works."],
        ["How long should an OKR cycle be?", "The quarter is the standard. For personal goals, a cycle of 6 to 12 weeks works very well too."],
        ["Is an OKR at 60 % a failure?", "No. The healthy target is around 70 %, which is the sign of genuinely ambitious goals."],
      ],
      html: `
<p class="lead">The OKR method (Objectives &amp; Key Results) is the goal-setting system used by Google, Intel, Netflix and Spotify. Its principle fits in one sentence: an ambitious, qualitative <strong>objective</strong>, measured by 2 to 5 numeric <strong>key results</strong>. This guide explains how it works, how to write good OKRs, and gives you 15 concrete examples, personal and professional, to adapt directly.</p>

<h2 id="en-bref">What is the OKR method?</h2>
<p class="answer">OKR stands for Objectives and Key Results. You set one qualitative, motivating objective, then two to five numbered key results, each with a starting value and a target, that prove you got there. A cycle usually lasts a quarter, with a short review every week. Reaching about 70% is considered a success.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="OKRs in Cosmo: each objective shows its key results, its progress and how much of the period has elapsed." /><figcaption>OKRs in Cosmo: each objective shows its key results, its progress and how much of the period has elapsed. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="definition">What is an OKR? A simple definition</h2>
<p>An OKR has two parts:</p>
<ul>
<li><strong>The Objective (O)</strong>: a qualitative, ambitious and motivating direction. It answers "where do I want to go?". For example: <em>"Become a reference in my field"</em>.</li>
<li><strong>The Key Results (KR)</strong>: 2 to 5 numeric measures that prove the objective has been reached. They answer "how will I know I am there?". For example: <em>"Publish 12 articles", "Reach 1,000 newsletter subscribers"</em>.</li>
</ul>
<p>The golden rule: <strong>the objective inspires, the key results measure</strong>. If your objective contains a number, it is probably a key result in disguise. The vocabulary of the field (KR, KPI, deep work, time-blocking) is gathered in our <a href="/en/blog/glossaire-productivite">productivity glossary</a> if a term escapes you. And if your key result cannot be measured without an argument ("improve quality"), it is not a key result.</p>

<h2 id="origines">Where does the OKR method come from?</h2>
<p>The method was born at <strong>Intel</strong> in the 1970s, driven by Andy Grove. John Doerr, then a young engineer at Intel, brought it to <strong>Google in 1999</strong>, when the company had barely 40 employees. Larry Page would later credit OKRs with part of Google's ability to grow without losing its bearings. The method has since spread far beyond tech, and it also works very well at an individual scale, to structure a year, a quarter or a personal project.</p>

<h2 id="pourquoi">Why it works, where resolutions fail</h2>
<ul>
<li><strong>Measurement replaces intention.</strong> "Get back into sport" fails because nothing tells you whether you are on track. "Run 3 times a week for 12 weeks" can be checked every week.</li>
<li><strong>Ambition is calibrated.</strong> A good OKR aims at 70 % attainment. Hitting 100 % everywhere means you aimed too low, which is a fundamental difference from classic SMART goals.</li>
<li><strong>The number is limited.</strong> Two to four objectives a quarter, no more. The method forces you to choose, and therefore to give things up, which is its real power.</li>
<li><strong>The rhythm is short.</strong> The quarter is the ideal cycle: long enough to achieve, short enough to correct.</li>
</ul>

<h2 id="ecrire">How to write a good OKR: the checklist</h2>
<ol>
<li>The objective fits in one sentence, contains no number, and genuinely motivates you.</li>
<li>Each key result has a number (a target value) and an implicit deadline (the end of the cycle).</li>
<li>Two to five key results per objective. Beyond that, split it into two objectives.</li>
<li>Key results measure a <strong>result</strong>, not an activity. "Send 50 applications" is an activity, "land 5 interviews" is a result. Both are useful, but know which one you are writing.</li>
<li>At the halfway point, each key result must be scoreable objectively, from 0 to 100 %.</li>
</ol>

<h2 id="exemples-perso">8 personal OKR examples</h2>

<h3>1. Health: getting back in shape</h3>
<p><strong>O:</strong> Get back to a level of fitness I am proud of.<br><strong>KR1:</strong> Run 3 sessions a week for 12 weeks. <strong>KR2:</strong> Go from 0 to 10 km without stopping. <strong>KR3:</strong> Sleep 7 hours 30 on average, measured over the month.</p>

<h3>2. Money: taking back control</h3>
<p><strong>O:</strong> Put my personal finances in order.<br><strong>KR1:</strong> Save 15 % of every monthly income. <strong>KR2:</strong> Cut recurring spending by 100 € a month. <strong>KR3:</strong> Build an emergency fund of 3,000 €.</p>

<h3>3. Learning: picking up a language</h3>
<p><strong>O:</strong> Hold a conversation in Spanish.<br><strong>KR1:</strong> 90 sessions of 15 minutes over the quarter. <strong>KR2:</strong> Finish 2 easy books in the original. <strong>KR3:</strong> Have 6 conversations of 30 minutes with a native speaker.</p>

<h3>4. Side project: finally shipping</h3>
<p><strong>O:</strong> Make my project exist in the real world.<br><strong>KR1:</strong> Publish a first usable version. <strong>KR2:</strong> Reach 50 active users. <strong>KR3:</strong> Collect 20 structured pieces of user feedback.</p>

<h3>5. Reading and culture</h3>
<p><strong>O:</strong> Become a real reader again.<br><strong>KR1:</strong> Read 6 books in the quarter. <strong>KR2:</strong> 20 minutes of reading on 5 evenings a week. <strong>KR3:</strong> Write a summary note for each book finished.</p>

<h3>6. Career: preparing a move</h3>
<p><strong>O:</strong> Make myself the obvious choice for the role I want.<br><strong>KR1:</strong> Lead 2 projects visible beyond my team. <strong>KR2:</strong> Earn a recognised certification in the field. <strong>KR3:</strong> Have lunch with 6 people who already hold that role.</p>

<h3>7. Social life and family</h3>
<p><strong>O:</strong> Be genuinely present for the people close to me.<br><strong>KR1:</strong> One fully disconnected weekend a month. <strong>KR2:</strong> Organise 6 dinners or outings with friends. <strong>KR3:</strong> Call my parents every week, 12 out of 12.</p>

<h3>8. Creativity</h3>
<p><strong>O:</strong> Build a regular creative practice.<br><strong>KR1:</strong> Publish 12 pieces, one a week. <strong>KR2:</strong> Follow one structured course or tutorial all the way through. <strong>KR3:</strong> Get feedback from 3 creators I admire.</p>

<h2 id="exemples-pro">7 professional OKR examples</h2>
<p>The examples that follow read on their own, but they make full sense collectively: how they cascade by department and by team is the subject of the <a href="/en/for-teams">Cosmo for teams</a> page.</p>

<h3>9. Early-stage startup: finding product-market fit</h3>
<p><strong>O:</strong> Prove the product solves a real problem.<br><strong>KR1:</strong> 40 % of active users come back every week. <strong>KR2:</strong> 25 user interviews conducted. <strong>KR3:</strong> NPS above 40.</p>

<h3>10. Marketing: organic acquisition</h3>
<p><strong>O:</strong> Make content our first acquisition channel.<br><strong>KR1:</strong> Go from 2,000 to 8,000 monthly organic visits. <strong>KR2:</strong> Publish 12 SEO-optimised articles. <strong>KR3:</strong> Earn 15 backlinks from authoritative sites.</p>

<h3>11. Product: activation</h3>
<p><strong>O:</strong> Make the first use magical.<br><strong>KR1:</strong> Raise day-one activation from 30 % to 50 %. <strong>KR2:</strong> Bring median time-to-value under 3 minutes. <strong>KR3:</strong> Halve support tickets related to onboarding.</p>

<h3>12. Sales</h3>
<p><strong>O:</strong> Build a predictable sales machine.<br><strong>KR1:</strong> 30 qualified demos a month. <strong>KR2:</strong> Demo-to-customer conversion rate of 20 %. <strong>KR3:</strong> Average sales cycle down from 45 to 30 days.</p>

<h3>13. HR: recruiting</h3>
<p><strong>O:</strong> Attract profiles we would not have dared approach.<br><strong>KR1:</strong> 3 senior hires signed. <strong>KR2:</strong> 50 % of applications coming from referrals. <strong>KR3:</strong> Average time to hire under 35 days.</p>

<h3>14. Customer support</h3>
<p><strong>O:</strong> Turn support into a competitive advantage.<br><strong>KR1:</strong> First response in under 2 hours (median). <strong>KR2:</strong> CSAT at 95 % or above. <strong>KR3:</strong> 20 help articles published, cutting recurring tickets by 30 %.</p>

<h3>15. Engineering team</h3>
<p><strong>O:</strong> Ship fast without breaking things.<br><strong>KR1:</strong> Deploy to production every day. <strong>KR2:</strong> Halve the rate of critical incidents. <strong>KR3:</strong> 90 % test coverage on the core modules.</p>

<h2 id="erreurs">The 5 mistakes that kill OKRs</h2>
<ol>
<li><strong>Too many objectives.</strong> Six objectives means zero priorities. Keep to 2 to 4.</li>
<li><strong>Activity key results everywhere.</strong> If all your key results are "do X times", you are measuring your busyness, not your results.</li>
<li><strong>Writing them, then forgetting them.</strong> An OKR is revisited every week, and 10 minutes is enough. Without a follow-up ritual the method is worth nothing.</li>
<li><strong>Aiming for 100 %.</strong> If everything is green at the end of the quarter, your goals were not ambitious.</li>
<li><strong>Tying OKRs to pay.</strong> In a company, that is the surest way to get goals sandbagged from the moment they are written.</li>
</ol>

<h2 id="okr-smart">OKRs, SMART, KPIs: what is the difference?</h2>
<p>The three coexist very well: a <strong>KPI</strong> is a permanent health indicator (the dashboard), a <strong>SMART</strong> goal is a single well-worded aim, and an <strong>OKR</strong> is a complete system connecting an ambition to its numeric proof over a short cycle. In practice: watch your KPIs continuously, and when a KPI has to move significantly, turn it into an OKR for a quarter. The <a href="/en/blog/okr-vs-smart-vs-kpi">detailed comparison of the three methods</a> gives the full table and the rule for choosing.</p>

<h2 id="demarrer">Tracking your OKRs without a spreadsheet</h2>
<p>To start today, we offer a <a href="/en/blog/template-okr-gratuit">free OKR spreadsheet template</a>, with pre-filled examples, automatic progress and no email required. But the real friction point of OKRs is not the writing, it is the <strong>weekly follow-up</strong>. A spreadsheet works, but nobody opens it. <a href="/en/">Cosmo</a> has OKRs built in: you create your objectives and key results, progress is computed as you update the key results, and the dashboard chart shows the key results you have achieved week after week, next to your <a href="/en/guide">tasks, habits and calendar</a>, so that follow-up happens in the same place as the action. <a href="/en/signup">It is free</a>, and demo mode lets you try it with 8 pre-filled OKRs and no sign-up.</p>

<p>Planning the year ahead? See <a href="/en/blog/objectifs-de-l-annee">how to set your 2027 goals with the OKR method</a>, with a fully filled-in example.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many OKRs should you set?</h3>
<p>Two to four objectives per cycle at most, with 2 to 5 key results each. The fewer you have, the better the method works.</p>
<h3>How long should an OKR cycle be?</h3>
<p>The quarter is the standard. For personal goals, a cycle of 6 to 12 weeks works very well too.</p>
<h3>Is an OKR at 60 % a failure?</h3>
<p>No. The healthy target is around 70 %, which is the sign of genuinely ambitious goals. An OKR that always lands at 100 % should push you to aim higher next cycle.</p>
`,
  },
  "objectifs-de-l-annee": {
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

<h2 id="en-bref">How do you set your goals for the year?</h2>
<p class="answer">Start from a review of the past year, pick three areas at most, write one objective per area with no number in it, then two to four measurable key results with a starting value and a target. Set those results for the first quarter only, and review them for ten minutes every week.</p>
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
  "okr-vs-smart-vs-kpi": {
      title: "OKRs vs SMART goals vs KPIs: which one to use, and when",
      metaTitle: "OKRs vs SMART vs KPIs: which method should you use?",
      description: "OKRs, SMART goals and KPIs do not answer the same question. Concrete differences, a comparison table and a simple rule for knowing when to use each one.",
      readingMinutes: 6,
      faq: [
        ["Can you use OKRs and KPIs at the same time?", "Yes, and it is the ideal setup: KPIs watch the health of the business continuously, OKRs concentrate a quarter's effort on what has to change. When a KPI degrades for long enough, it becomes a candidate for an OKR."],
        ["Can a SMART goal serve as a key result?", "In practice a good key result looks a great deal like a SMART goal: specific, measurable, time-bound. What the OKR adds, and what an isolated SMART goal lacks, is the qualitative ambition that ties several measures together."],
        ["Which method works for personal goals?", "OKRs adapt very well to personal use: a 6 to 12 week cycle, 2 or 3 objectives, key results that are simple to measure. SMART helps you word each key result properly."],
      ],
      html: `
<p class="lead">Three acronyms, three promises to help you "reach your goals", and a lot of confusion. The reality is simpler: <strong>OKRs, SMART goals and KPIs do not answer the same question</strong>. SMART words a goal, a KPI watches a metric, OKRs organise a cycle of ambition. Once that distinction is clear, knowing which to use becomes obvious.</p>

<h2 id="en-bref">What is the difference between OKRs, SMART goals and KPIs?</h2>
<p class="answer">A SMART goal is a single well-worded goal (specific, measurable, achievable, realistic, time-bound). An OKR ties a qualitative ambition to several numbered key results over a short cycle, to change something. A KPI is an indicator you monitor continuously to check that an activity stays healthy.</p>
<figure><img src="/screenshots/okr.webp" srcset="/screenshots/okr-800.webp 800w, /screenshots/okr.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="OKRs in Cosmo: each objective shows its key results, its progress and how much of the period has elapsed." /><figcaption>OKRs in Cosmo: each objective shows its key results, its progress and how much of the period has elapsed. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="definitions">The three methods, one sentence each</h2>
<ul>
<li><strong>SMART</strong> is a <em>drafting grid</em>: a goal should be Specific, Measurable, Achievable, Realistic and Time-bound. SMART does not tell you what to aim at, it checks that what you are aiming at is properly written.</li>
<li><strong>KPI</strong> (Key Performance Indicator) is a <em>monitoring instrument</em>: a metric followed continuously to know the health of an activity (monthly traffic, churn rate, average basket, the number on the scale).</li>
<li><strong>OKR</strong> (Objectives &amp; Key Results) is a <em>cycle system</em>: a qualitative ambition (the objective) proven by 2 to 5 numeric measures (the key results), over a quarter, with a target attainment of around 70 %.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>SMART</th><th>KPI</th><th>OKR</th></tr></thead>
<tbody>
<tr><td>What it is</td><td>A grid for writing ONE goal</td><td>A metric watched continuously</td><td>Ambition plus measures over a cycle</td></tr>
<tr><td>Horizon</td><td>Variable, often long</td><td>Permanent</td><td>A quarter (6 to 12 weeks personally)</td></tr>
<tr><td>Level of ambition</td><td>"Achievable" by definition</td><td>Neutral, it is a thermometer</td><td>Deliberately ambitious (70 % counts as success)</td></tr>
<tr><td>Answers</td><td>"Is my goal well written?"</td><td>"How is the business doing?"</td><td>"What has to change this quarter, and how do we prove it?"</td></tr>
<tr><td>Main risk</td><td>Wording the wrong goal beautifully</td><td>Watching without ever acting</td><td>Too many OKRs, so no priorities at all</td></tr>
</tbody>
</table></div>

<h2 id="complementaires">Why treating them as rivals is a mistake</h2>
<p>The three nest naturally:</p>
<ol>
<li><strong>Your KPIs run continuously</strong>: that is the dashboard. Most of the time you look at them and do nothing in particular, because nothing is wrong.</li>
<li><strong>When a KPI has to move significantly</strong> (churn is climbing, traffic is flat, sleep is getting worse), it becomes the raw material of an <strong>OKR</strong>: a quarter of concentrated effort with numeric key results.</li>
<li><strong>Each key result is worded the SMART way</strong>: specific, measurable, time-bound. SMART is the drafting tool, the OKR is the structure that gives it a direction and a rhythm.</li>
</ol>
<p>A worked example: your "monthly organic visits" KPI has been flat at 2,000 for six months. You turn it into a quarterly OKR. Objective: "make content our first acquisition channel". KR1: go from 2,000 to 8,000 visits a month. KR2: publish 12 articles. KR3: earn 15 backlinks. Each KR is SMART. At the end of the cycle the KPI goes back to being a plain monitoring indicator, at its new level.</p>

<h2 id="quand">Which method, when? The simple rule</h2>
<ul>
<li><strong>You want to monitor</strong> → KPI. Define 3 to 7 health indicators, not forty.</li>
<li><strong>You want to change something</strong> → OKR. Two to four objectives per cycle, no more. Borrow from our <a href="/en/blog/methode-okr-exemples">15 OKR examples</a> or start from the <a href="/en/blog/template-okr-gratuit">free template</a>.</li>
<li><strong>You are writing any goal or key result</strong> → run it through the SMART filter before you commit to it.</li>
</ul>

<h2 id="cosmo">What that looks like in practice</h2>
<p>In <a href="/en/">Cosmo</a> this articulation is built in: your <strong>OKRs</strong> carry the cycle (progress is recomputed every time a key result is updated), the <strong>statistics</strong> play the KPI role (time invested per module and per category, week after week), and your daily tasks connect to all of it through <a href="/en/blog/time-blocking-guide">time-blocking</a>. Inside an organisation, those same OKRs cascade by team and by department in the <a href="/en/for-companies">company workspace</a>. <a href="/en/signup">Free</a>, with a demo and no sign-up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Can you use OKRs and KPIs at the same time?</h3>
<p>Yes, and it is the ideal setup. KPIs watch, OKRs concentrate effort where an indicator has to move.</p>
<h3>Can a SMART goal serve as a key result?</h3>
<p>A good key result is SMART by construction. The OKR adds the qualitative ambition that ties several measures together.</p>
<h3>What about personal goals?</h3>
<p>OKRs over 6 to 12 weeks, 2 or 3 objectives, key results that are simple to measure. SMART works as a wording filter.</p>
`,
  },
  "suivi-des-habitudes": {
      title: "Habit tracking: what to measure (and what discourages you)",
      metaTitle: "Habit tracking: what to measure to keep going",
      description: "Streaks, completion rate, heatmaps: which habit-tracking indicators genuinely help, which sabotage consistency, and how to start properly.",
      readingMinutes: 8,
      faq: [
        ["What is the best indicator for tracking a habit?", "The completion rate over a rolling period of 4 to 12 weeks. It tolerates missed days, unlike a streak, and reflects real consistency rather than recent performance."],
        ["Are streaks useful or counterproductive?", "Both. A streak motivates while it climbs, but a broken streak often triggers a complete abandonment, the all-or-nothing effect. Use it as secondary encouragement, never as the main indicator."],
        ["How many habits should you track at once?", "Two or three at the start. Every extra habit lowers the probability of keeping all of them: the limiting factor is not motivation but the number of daily decisions your system asks of you."],
      ],
      html: `
<p class="lead">Tracking habits means ticking boxes, and that is the easy part. The difficulty lies elsewhere: choosing <em>what</em> to look at. Depending on which indicator you put front and centre, the same tracking produces either consistency that settles in, or abandonment at the first slip. Here is what each indicator actually measures, which one belongs at the centre, and how to start a tracking practice that lasts beyond three weeks.</p>

<h2 id="en-bref">What should you measure when tracking habits?</h2>
<p class="answer">Consistency over several weeks, not perfection. The useful numbers are your completion rate over 30 days, the trend from week to week and the days when the habit slips. A streak motivates but becomes discouraging when it breaks: a single miss does not count, two in a row do.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days." /><figcaption>Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="pourquoi">Why track, rather than simply do</h2>
<p>Tracking is not there to grade you. It serves three precise purposes, and if your system delivers none of them it is not worth the time it costs:</p>
<ul>
<li><strong>Making consistency visible.</strong> Memory is a poor judge: after an irregular week you remember either the failure or the exception. An objective record settles it.</li>
<li><strong>Detecting bad calibration early.</strong> A habit kept 30 % of the time is not a motivation problem, it is a badly sized or badly placed habit. The number says so in three weeks, intuition takes three months.</li>
<li><strong>Providing immediate feedback.</strong> The benefit of a habit arrives in months, ticking gives a signal today. That is what carries you across the gap.</li>
</ul>

<h2 id="indicateurs">The three indicators, and what each is worth</h2>

<h3>The streak: motivating, but fragile</h3>
<p>The number of consecutive days. It works remarkably well while it climbs, and that is precisely its flaw. A 40-day streak broken on a Tuesday produces, in a lot of people, a complete abandonment, because the indicator drops to zero while reality still stands at 40 days out of 41.</p>
<p>Use it as encouragement, never as a judge. And if you are sensitive to it, adopt the rule that has proven itself: <strong>never miss twice in a row</strong>. It keeps the benefit of the streak without its cliff edge.</p>

<h3>The completion rate: the central indicator</h3>
<p>The percentage of times the habit was kept over a rolling period of four to twelve weeks. This is the one to put at the centre, for a simple reason: it tolerates missed days without erasing them. A habit at 85 % is excellent, at 60 % it is real but fragile, below 50 % it does not exist yet and needs an adjustment rather than extra effort.</p>
<p>Its real strength is comparative: this month's rate against last month's tells you whether you are improving, which no cumulative counter can do.</p>

<h3>The heatmap: the view that reveals patterns</h3>
<p>One cell per day, coloured if the habit was kept, the representation popularised by the GitHub contribution graph. Its value is not aesthetic: it surfaces <strong>patterns</strong> that no percentage shows. Systematic gaps at weekends, a clean break every time you travel, a gradual decline after six weeks. Each of those points at a precise cause, and therefore at a possible correction.</p>
<p>Over 26 weeks (six months, beyond which a habit is generally anchored), the heatmap tells a story you can read in three seconds.</p>

<h2 id="pieges">The four traps of tracking</h2>
<ol>
<li><strong>Too many habits at once.</strong> This is by far the number one cause of failure. Every habit added lowers the probability of keeping all of them, because the cost is not the effort of each one but the number of daily decisions. Two or three, no more, until they no longer require thinking about.</li>
<li><strong>Habits that are too big.</strong> "Exercise for an hour" fails where "put your shoes on and go outside" succeeds. Calibrate on your worst day, not your best: a habit has to stay doable on a day when everything is going wrong, otherwise it will not survive the first difficult week.</li>
<li><strong>Tracking an outcome instead of an action.</strong> "Lose 4 kg" is not a habit, it is a goal, and it cannot be ticked daily. Track the action you control. The outcome belongs to <a href="/en/blog/methode-okr-exemples">OKRs</a>, with a different horizon and different indicators.</li>
<li><strong>Confusing tracking with judgement.</strong> A largely empty grid is information about calibration, not a verdict on you. The day tracking becomes a source of guilt it stops being a tool, and that is the moment people stop ticking.</li>
</ol>

<h2 id="demarrer">Starting a tracking practice that lasts</h2>
<ol>
<li><strong>Choose two habits</strong>, one of which you almost have already. The quick success of the first carries the second.</li>
<li><strong>Attach each one to an existing trigger</strong>: after the morning coffee, when you close the laptop, before dinner. A fixed time of day works less well than chaining onto something you already do.</li>
<li><strong>Tick at the moment itself</strong>, not in the evening from memory. Reconstructed tracking is wrong, and wrong tracking is no longer useful for deciding.</li>
<li><strong>Judge nothing before three weeks.</strong> The first two measure the installation, not the habit.</li>
<li><strong>In week four, look at the completion rate</strong> and adjust one single thing: the size of the habit, or its moment. Never both, or you will not know what worked.</li>
</ol>
<p>On how long it takes before a habit becomes automatic, the article on <a href="/en/blog/combien-de-temps-prendre-habitude">how long it takes to build a habit</a> sets out what the research actually says, and why the 21-day figure is a stubborn myth. On an academic rhythm, where the calendar imposes its own peaks, the <a href="/en/for-students">Cosmo for students</a> page shows the same mechanics applied to revision.</p>

<h2 id="pratique">Habit tracking in Cosmo</h2>
<p>In <a href="/en/">Cosmo</a>, a habit is created with its frequency (daily, weekly or specific days) and ticked in one gesture. The three indicators in this article come as standard: a 26-week heatmap, the streak and the completion rate over the chosen period, with the rate given prominence rather than the streak, for exactly the reason described above.</p>
<p>The rest comes from the integration: your habits appear on the same <a href="/en/blog/tableau-de-bord-productivite">dashboard</a> as your tasks for the day and your goals, which avoids the extra tracking app that everybody forgets to open after a month. <a href="/en/signup">It is free</a>, and the demo opens with no sign-up, with 100 habits and several months of history so you can see what these curves look like once filled in.</p>

<p>For a paper version, download the <a href="/en/blog/habit-tracker-a-imprimer">printable 2027 habit tracker</a> (free PDF, one page per month). Using Habitica? See <a href="/en/blog/cosmo-vs-habitica">Cosmo or Habitica</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Should you track habits on paper or in an app?</h3>
<p>Paper is enough for two or three habits and has the advantage of being immediate. An app becomes clearly better as soon as you want to compare periods or spot patterns, and computing a completion rate by hand is exactly the kind of chore that makes people abandon tracking.</p>
<h3>What do you do after a long interruption?</h3>
<p>Restart at a reduced version of the habit, not the one from before. Going straight back to the original level after three weeks off almost always fails, and the failure wrongly confirms that you "cannot do it".</p>
<h3>When can you stop tracking a habit?</h3>
<p>When forgetting it feels uncomfortable, which is the sign that the behaviour has become automatic. You can then drop it from tracking and free the slot for the next one.</p>
`,
  },
  "tableau-de-bord-productivite": {
      title: "A productivity dashboard: what to put on it (and what to take off)",
      metaTitle: "Productivity dashboard: the 6 indicators worth having",
      description: "What should a personal productivity dashboard show? The 6 indicators that make you act, the ones that are useless, and how to build it.",
      readingMinutes: 8,
      faq: [
        ["Which indicators belong on a productivity dashboard?", "Six are enough: tasks completed over the period, habit completion rate, time split by category, goal progress, the load of the week ahead, and the planned-to-done ratio. Beyond that you look without acting."],
        ["How often should you look at your dashboard?", "Once a week for the review, plus a ten-second daily glance at the day's load. Checking it continuously changes no decision and costs attention."],
        ["Should a personal dashboard look like a company dashboard?", "No. A company dashboard exists to report, a personal dashboard exists to decide. It should fit on one screen and show only what you can act on this week."],
      ],
      html: `
<p class="lead">A productivity dashboard is a tempting promise: your life on one screen. In practice, most of the ones people build end up as decoration. Pretty, consulted for three weeks, then ignored. The reason is almost always the same: they show what is easy to measure rather than what triggers a decision. Here is what deserves a place, what to take off, and how to build one without spending a weekend on it.</p>

<h2 id="en-bref">What should a productivity dashboard include?</h2>
<p class="answer">A few indicators, each tied to a decision: progress on your goals relative to elapsed time, the consistency of your habits, the time actually spent on your priorities and the tasks that keep slipping week after week. Remove any number that never makes you change anything.</p>
<figure><img src="/screenshots/dashboard.webp" srcset="/screenshots/dashboard-800.webp 800w, /screenshots/dashboard.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's dashboard: today's tasks, calendar events, key results and habits on a single screen." /><figcaption>Cosmo's dashboard: today's tasks, calendar events, key results and habits on a single screen. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="critere">The only criterion that counts: does it change a decision?</h2>
<p>Before adding an indicator, ask it this question: <strong>if this number doubles or collapses, what do I do differently on Monday?</strong> If the answer is "nothing", the indicator does not belong. It is interesting, not useful, and the difference between the two is exactly what separates a living dashboard from an abandoned one.</p>
<p>That filter removes most of the metrics you find in tools straight away: total tasks created since forever, cumulative time over the year, badges, composite scores. They flatter or they shame, they steer nothing.</p>

<h2 id="indicateurs">The 6 indicators that make you act</h2>

<h3>1. Tasks completed over the period</h3>
<p>Not the historical total: the volume of the past week, compared with the ones before it. This is your real throughput, and it serves one precise purpose, calibrating what you commit to next week. Someone who finishes twelve tasks a week and plans thirty is organising their own disappointment, every Monday.</p>

<h3>2. Habit completion rate</h3>
<p>The percentage of times you kept your routines over the period. Below 50 %, the habit is badly calibrated: too ambitious, badly placed in the day, or not wanted enough. That is a signal to adjust, not a reason for guilt, and it is far better seen in week 3 than in month 4. The <a href="/en/blog/combien-de-temps-prendre-habitude">real time it takes for a habit to stick</a> makes this tracking indispensable, and the article on <a href="/en/blog/suivi-des-habitudes">habit tracking</a> sets out which of the three indicators deserves first place.</p>

<h3>3. Time split by category</h3>
<p>The indicator that surprises people the most, consistently. You believe you spend your days producing, and the split shows that admin and meetings take half of it. It is the only figure that allows an honest conversation with yourself about workload, and, for a freelancer, the basis for better pricing.</p>

<h3>4. Goal progress</h3>
<p>If you work with <a href="/en/blog/methode-okr-exemples">OKRs</a>, this is the progress of each key result. Otherwise a simple estimate per goal. What matters is the <strong>trajectory</strong>: halfway through a quarter, a goal at 20 % is not "behind", it is being silently abandoned. Seeing that early leaves two options, accelerate or give up explicitly. Both are better than drift.</p>

<h3>5. The load of the week ahead</h3>
<p>The hours already committed in the calendar against the hours genuinely available. This is the only forward-looking indicator, and therefore the only one that prevents a problem instead of recording it. A week with 45 hours committed against 35 available is not solved with more discipline: it is solved by removing something, before it starts. For a <a href="/en/for-managers">manager</a> it is the same indicator applied to the team: load gets read before it is endured, never after.</p>

<h3>6. The planned-to-done ratio</h3>
<p>Of the slots you had blocked, how many did you keep? This ratio measures the quality of your planning, not your worth. Persistently below 60 %, it says your blocks are too long, too optimistic, or placed at times when you are not actually available. It is the natural complement to <a href="/en/blog/time-blocking-guide">time-blocking</a>.</p>

<h2 id="a-retirer">What to take off</h2>
<ul>
<li><strong>Cumulative counters.</strong> "1,847 tasks completed" steers nothing. A running total never goes down, so it can never raise an alarm.</li>
<li><strong>Composite scores.</strong> A "productivity score out of 100" mixes things that are not comparable: when it drops, you do not know what to do. Prefer five readable numbers to one opaque index.</li>
<li><strong>Comparisons with other people.</strong> Their constraints are not yours. The only useful point of comparison is you, a month ago.</li>
<li><strong>Series that are too long.</strong> A three-year chart flattens the recent variations, the ones you can still act on. Twelve weeks is almost always enough.</li>
</ul>

<h2 id="rythme">How often to look</h2>
<p>A dashboard consulted continuously becomes a news feed: it occupies attention without producing a decision. Two appointments are enough.</p>
<ol>
<li><strong>Ten seconds in the morning</strong> on the day's load and the habits to tick. No analysis, just framing.</li>
<li><strong>Fifteen minutes at the end of the week</strong> for the review: real throughput, time per category, goal progress, and a single adjustment decision for the week ahead. A single one, because that is what makes the review sustainable.</li>
</ol>

<h2 id="construire">Building it without spending a weekend</h2>
<p>Plenty of people build their dashboard in a spreadsheet. It works, and it is an excellent exercise for clarifying what you want to track, but manual entry is a debt: after six weeks the data is out of date, and a stale dashboard is worse than no dashboard, because it gives false confidence.</p>
<p>The practical rule: <strong>only track by hand what no tool can compute on its own.</strong> Everything that follows from your tasks, your habits or your calendar should fill itself in, otherwise you will end up stopping.</p>
<p>That is precisely what <a href="/en/">Cosmo</a> does: the dashboard shows the day's progress, the habits to tick, the next events and the curve of key results achieved, and the Statistics page gives time invested per category and how it evolves. The first five indicators in this article are readable there with no extra data entry, they fall out of normal use of the app. <a href="/en/signup">It is free</a>, and the demo opens with no sign-up and 12 months of data, so you can see what the dashboard looks like once it is full.</p>

<p>At the end of the year, this dashboard feeds straight into <a href="/en/blog/bilan-de-l-annee">a year in review in 10 questions</a>, especially the question "where did my time go?".</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many indicators at most?</h3>
<p>Six, seven if truly necessary. Beyond that you stop reading and start skimming. A dashboard that does not fit on one screen has already failed.</p>
<h3>Should you track your time to the minute?</h3>
<p>No. A split by category in half-hour blocks is more than enough to reveal the imbalances. Minute-level tracking costs more attention than it saves.</p>
<h3>What if all my indicators are red?</h3>
<p>Optimise nothing. That is the sign of overload, not of a flawed method: remove commitments until the week ahead fits in the hours available, then go back to steering.</p>
`,
  },
  "template-okr-gratuit": {
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

<h2 id="en-bref">How do you fill in an OKR template?</h2>
<p class="answer">Write two to four objectives with no numbers for the next twelve weeks. Under each one, add two to five measurable key results with their starting value and target. Every week, update the current value only: progress calculates itself. Aim for about 70% achievement at the end of the cycle.</p>
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

<p>Before filling in the template for the year, take an hour for <a href="/en/blog/bilan-de-l-annee">a year in review in 10 questions</a>, then <a href="/en/blog/objectifs-de-l-annee">set your 2027 goals</a>.</p>

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
  "tenir-ses-resolutions": {
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

<h2 id="en-bref">How do you keep your New Year's resolutions?</h2>
<p class="answer">Make one to three resolutions at most, phrased as a positive goal rather than a ban, with a number and a deadline. Write an "if... then..." plan for each foreseeable obstacle, start with a minimal version, track them daily and review them weekly. After a slip, restart the next day without waiting for Monday.</p>
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
  "time-blocking-guide": {
      title: "Time-blocking: the complete guide to taking back your days",
      metaTitle: "Time-blocking: the complete guide (method and examples)",
      description: "Time-blocking means reserving slots for your tasks instead of enduring your day. A step-by-step method, variants, mistakes to avoid and examples.",
      readingMinutes: 8,
      faq: [
        ["How long does it take to get the hang of time-blocking?", "Allow two weeks of running in: the first mostly serves to show you that you underestimate how long things take."],
        ["Does time-blocking work in a job full of interruptions?", "Yes, by inverting the logic: block only 2 or 3 protected hours a day and leave the rest open."],
        ["Should you time-block at the weekend?", "Nothing requires it. Many people only benefit from one or two chosen blocks, and the rest of their free time stays free."],
      ],
      html: `
<p class="lead">A to-do list tells you what you have to do. It never tells you <em>when</em>. That is exactly why yours is overflowing: without an appointment in the calendar, a task stays a wish. <strong>Time-blocking</strong> fixes that structural flaw by giving every important thing a slot. Cal Newport, the author of <em>Deep Work</em>, reckons a time-blocked 40-hour week produces as much as a 60-hour week run as things come. Here is how to get started, concretely.</p>

<h2 id="en-bref">What is time blocking?</h2>
<p class="answer">A method that reserves calendar slots for specific tasks, instead of working from a plain list. Each block has a purpose. You place important tasks first, at the hours when you work best, leave buffers, then adjust tomorrow's plan each evening.</p>
<figure><img src="/screenshots/agenda.webp" srcset="/screenshots/agenda-800.webp 800w, /screenshots/agenda.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's calendar in week view: tasks waiting to be scheduled are listed on the left and dragged into a time slot." /><figcaption>Cosmo's calendar in week view: tasks waiting to be scheduled are listed on the left and dragged into a time slot. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="definition">What exactly is time-blocking?</h2>
<p>Time-blocking means <strong>cutting your day into dedicated blocks</strong>: each block is reserved for one task or one type of work, like an appointment you make with yourself. Instead of a list of 20 tasks making you feel guilty, you have a plan: 9:00 to 10:30, the client file; 10:30 to 11:00, email; 11:00 to 12:00, preparing the meeting.</p>
<p>The mental shift is simple but deep: you no longer decide <em>during</em> the day, when your willpower is at its lowest, you decide <em>beforehand</em>, while you still have some perspective.</p>

<h2 id="pourquoi">Why it works: 4 mechanisms</h2>
<ul>
<li><strong>Parkinson's law kept in check.</strong> Work expands to fill the time available. A 90-minute block imposes a constraint that concentrates the effort.</li>
<li><strong>The cost of context switching disappears.</strong> Each interruption costs an average of 23 minutes to refocus (Gloria Mark, UC Irvine). Blocks protect stretches of deep work.</li>
<li><strong>Forced realism.</strong> Placing your tasks in a calendar immediately reveals that a day contains only 6 to 7 useful hours. You stop planning 14 hours of work into 8.</li>
<li><strong>The decision is already made.</strong> At 9:00 the question is no longer "what do I start with?", the calendar has answered. Procrastination loses its favourite playground, which is choice.</li>
</ul>

<h2 id="methode">The method, step by step</h2>
<h3>1. List, then estimate</h3>
<p>Start from your task list and give each one a realistic duration. Rule of thumb: your first estimate multiplied by 1.5. Underestimating is beginners' mistake number one.</p>
<h3>2. Block deep work first</h3>
<p>Place your one or two blocks of intense concentration (90 to 120 minutes) at the hours when your energy peaks, which for most people is the morning. These are the non-negotiable blocks, and the rest is organised around them.</p>
<h3>3. Group the small tasks</h3>
<p>Email, messages, admin: group them into one or two 30-minute batching blocks. Checking your inbox continuously is the death of time-blocking.</p>
<h3>4. Keep empty space</h3>
<p>Leave 20 to 30 % of the day unblocked. The unexpected will arrive, and if it has nowhere to go it will eat your deep blocks. A buffer block late in the afternoon absorbs the overflow.</p>
<h3>5. Reschedule without guilt</h3>
<p>A missed block is not recovered by "trying harder", it is rescheduled, the way you move an appointment. The 5-minute review at the end of the day (what drops, what moves?) is part of the method. Time-blocking is in fact only one of the seven principles of <a href="/en/blog/gestion-du-temps-efficace">effective time management</a>: it is the one that makes the other six applicable.</p>

<h2 id="variantes">The 3 useful variants</h2>
<h3>Task batching</h3>
<p>Grouping tasks of the same nature into one block (all the invoices, all the calls). It reduces the context-switching cost to almost zero.</p>
<h3>Day theming</h3>
<p>Giving each day a theme: Monday product, Tuesday clients, Wednesday content. Ideal for founders and <a href="/en/for-freelancers">freelancers</a> who wear several hats.</p>
<h3>Time-boxing</h3>
<p>The "contract" version: the block has a hard end, and when the time is up you stop, finished or not. Perfect for tasks with no natural end, such as research, monitoring or polishing.</p>

<h2 id="exemple">Example: a realistic time-blocked day</h2>
<div class="table-wrap"><table>
<thead><tr><th>Slot</th><th>Block</th><th>Type</th></tr></thead>
<tbody>
<tr><td>8:30 to 9:00</td><td>Review the plan, urgent email only</td><td>Batching</td></tr>
<tr><td>9:00 to 10:45</td><td>Deep work: the priority file</td><td>Deep work</td></tr>
<tr><td>10:45 to 11:00</td><td>A real break, no screen</td><td>Recovery</td></tr>
<tr><td>11:00 to 12:30</td><td>Meetings and calls</td><td>Collaborative</td></tr>
<tr><td>13:30 to 14:00</td><td>Email and messages (batch 2)</td><td>Batching</td></tr>
<tr><td>14:00 to 15:30</td><td>Deep work 2, or medium tasks</td><td>Deep work</td></tr>
<tr><td>15:30 to 16:30</td><td>Buffer: surprises and overflow</td><td>Buffer</td></tr>
<tr><td>16:30 to 17:00</td><td>Close-down: review the day, plan tomorrow</td><td>Ritual</td></tr>
</tbody>
</table></div>

<h2 id="erreurs">The 5 mistakes that make people quit</h2>
<ol>
<li><strong>Blocking 100 % of the day.</strong> The first surprise destroys the whole plan, and the frustration makes people abandon the method within a week. Aim for 70 to 80 %.</li>
<li><strong>Blocks that are too granular.</strong> Planning in 15-minute slices turns the method into a prison. The useful grain is 30 minutes to 2 hours.</li>
<li><strong>Ignoring your energy.</strong> A deep-work block at 3:30 pm after a heavy lunch is fiction. Line the demanding blocks up with your real peaks.</li>
<li><strong>Never revising.</strong> The morning plan is a hypothesis. Without the 5 minutes of evening rescheduling, the gap between plan and reality becomes discouraging.</li>
<li><strong>Treating the calendar and the to-do list as two worlds.</strong> If your tasks live in one tool and your slots in another, the friction of copying kills the routine in a fortnight.</li>
</ol>

<h2 id="outils">Which tool for time-blocking?</h2>
<p>Paper, Google Calendar, anything works as long as friction stays low. That is precisely the weak point of the "separate to-do list plus calendar" pairing: copying each task into the calendar, twice a day, every day. If that is exactly where your hesitation lies, our <a href="/en/blog/cosmo-vs-todoist">Cosmo and Todoist comparison</a> makes it its main angle.</p>
<p>In <a href="/en/">Cosmo</a>, time-blocking is native: your tasks appear in a panel beside the calendar, and <strong>dragging a task onto a slot creates the linked event</strong>, duration, category and colour included. A completed task updates your time-invested statistics, and if it feeds an <a href="/en/blog/methode-okr-exemples">OKR</a>, the progress follows. Planning your day takes two minutes, <a href="/en/signup">for free</a>, and the demo can be tried without signing up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How long does it take to get the hang of it?</h3>
<p>Allow two weeks of running in: the first mostly serves to show you that you underestimate how long things take. That is normal, and it is already a gain.</p>
<h3>Does time-blocking work in a job full of interruptions?</h3>
<p>Yes, by inverting the logic: block only 2 or 3 protected hours a day, the vital minimum of deep work, and leave the rest open. Even partial, the gain is real.</p>
<h3>Should you time-block at the weekend?</h3>
<p>Nothing requires it. Many people only benefit from one or two chosen blocks (exercise, a personal project), and the rest of their free time stays free.</p>
`,
  },
  "cosmo-vs-clickup": {
      title: "Cosmo or ClickUp: a simpler alternative for getting organised?",
      metaTitle: "A simpler ClickUp alternative: Cosmo compared",
      description: "ClickUp can do almost anything, at the cost of heavy setup. Cosmo brings tasks, habits, calendar and OKRs together, ready to use. An honest comparison.",
      readingMinutes: 5,
      html: `
<p class="lead">ClickUp wants to replace all your tools: tasks, docs, boards, goals, dashboards, automations. For a team with time to configure it, that is powerful. For one person or a small team it is often too much: dozens of settings before you write your first task. If you are looking for a simpler ClickUp alternative, here is what changes. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose ClickUp</strong> to run complex team projects, with many views, custom fields and automations.</li>
<li><strong>Choose Cosmo</strong> for personal or small-team organisation, ready in minutes, adding what ClickUp lacks: habit tracking.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>ClickUp</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Tasks and projects</td><td>Yes, highly configurable</td><td>Yes, simple</td></tr>
<tr><td>Views (list, board, Gantt...)</td><td>Many</td><td>List and calendar</td></tr>
<tr><td>Goals</td><td>Yes (Goals)</td><td>Yes, OKRs linked to tasks and habits</td></tr>
<tr><td>Habit tracking</td><td>No</td><td>Yes</td></tr>
<tr><td>Time-blocking calendar</td><td>Calendar view</td><td>Calendar to place tasks into time slots</td></tr>
<tr><td>Automations, custom fields</td><td>Yes</td><td>No</td></tr>
<tr><td>Getting started</td><td>Long</td><td>A few minutes, demo without an account</td></tr>
</tbody>
</table></div>

<h2 id="clickup-fort">Where ClickUp is still ahead</h2>
<p>For a team of several dozen people with precise processes, ClickUp offers a depth Cosmo does not aim for: multiple views, dependencies, automations, integrations. If those features genuinely serve you, stay with it.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>Cosmo makes the opposite bet: few settings, a complete circuit. Your goals break down into <a href="/en/blog/methode-okr-exemples">key results</a>, your tasks get a slot in the calendar, your habits are ticked every day, and the dashboard ties it all together. The tool fits a day, not an org chart. For a team, business mode adds teams, projects and per-member permissions, with no upfront setup.</p>

<h2 id="conclusion">Conclusion</h2>
<p>ClickUp is a very complete project management tool. Cosmo is an organisation tool that works straight away. If you spend more time configuring than moving forward, <a href="/en/signup">try Cosmo for free</a> or open the demo without sign-up. Also weighing Notion? See <a href="/en/blog/cosmo-vs-notion">Cosmo or Notion</a>.</p>
`,
    },
  "cosmo-vs-habitica": {
      title: "Cosmo or Habitica: which alternative for tracking your habits?",
      metaTitle: "Habitica alternative: Cosmo, an honest comparison",
      description: "Habitica turns your habits into a role-playing game. Cosmo links them to your goals, tasks and calendar. An honest comparison, and who each one suits best.",
      readingMinutes: 5,
      html: `
<p class="lead">Habitica has a brilliant idea: turn your habits into a role-playing game. Every habit kept earns your character experience and gold, every miss costs health, and you can team up with other players. For many people it works. Others tire of the game, or want to link their habits to concrete goals. Here is what changes with Cosmo. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose Habitica</strong> if game-style motivation (rewards, party, challenges) is what keeps you going.</li>
<li><strong>Choose Cosmo</strong> if you want your habits to serve goals, next to your tasks and calendar, with plain statistics rather than a game.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Habitica</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Habits and daily tasks</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Gamification (character, rewards, parties)</td><td>Yes, it is the core</td><td>No</td></tr>
<tr><td>Visual habit history</td><td>Limited</td><td>26-week heatmap, streak, completion rate</td></tr>
<tr><td>Numbered goals (OKRs)</td><td>No</td><td>Yes</td></tr>
<tr><td>Time-blocking calendar</td><td>No</td><td>Yes</td></tr>
<tr><td>Tone</td><td>Video game</td><td>Plain working tool</td></tr>
</tbody>
</table></div>

<h2 id="habitica-fort">Where Habitica is still ahead</h2>
<p>The social, playful side is unique: joining a party, fighting a boss together, not wanting to let your teammates down. If that is what motivates you, no plain app will do better.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>A habit is not an end in itself: it serves a goal. In Cosmo, "run 3 times a week" is linked to "run 10 km by March", and to sessions placed in the calendar. The <a href="/en/blog/suivi-des-habitudes">heatmap and streak</a> show consistency without turning a missed day into a punishment: research shows a single slip does not derail a habit (see <a href="/en/blog/combien-de-temps-prendre-habitude">how long it takes to build a habit</a>).</p>

<h2 id="conclusion">Conclusion</h2>
<p>Habitica motivates through play. Cosmo motivates through proof of progress and the link to your goals. If the game is no longer enough, <a href="/en/signup">try Cosmo for free</a> or open the demo without sign-up, with habits already filled in.</p>
`,
    },
  "cosmo-vs-microsoft-to-do": {
      title: "Cosmo or Microsoft To Do: which alternative to go further?",
      metaTitle: "Microsoft To Do alternative: Cosmo, an honest comparison",
      description: "Microsoft To Do is simple, free and linked to Outlook. Cosmo adds habits, time blocking and OKRs. An honest comparison, and when to move from one to the other.",
      readingMinutes: 5,
      html: `
<p class="lead">Microsoft To Do is a clear, free task list with one good idea: "My Day", a list you fill each morning with what you intend to do today. Linked to Outlook, it suits simple use very well. This page is for those who want to go further: prioritise, plan in time slots, track habits and goals. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Keep Microsoft To Do</strong> if you work in the Microsoft ecosystem and want a simple list linked to Outlook.</li>
<li><strong>Move to Cosmo</strong> if "My Day" is no longer enough: you want to give tasks a time slot, track habits and connect it all to goals.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Microsoft To Do</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Lists, steps, reminders, due dates</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Planning your day</td><td>"My Day" list</td><td>Time-blocking calendar, tasks placed into slots</td></tr>
<tr><td>Outlook and Microsoft 365 integration</td><td>Yes</td><td>No</td></tr>
<tr><td>Priorities and categories</td><td>Importance (star), lists</td><td>Priorities and nested categories</td></tr>
<tr><td>Habit tracking</td><td>No</td><td>Yes</td></tr>
<tr><td>Goals (OKRs)</td><td>No</td><td>Yes</td></tr>
</tbody>
</table></div>

<h2 id="microsoft-fort">Where Microsoft To Do is still ahead</h2>
<p>If you live in Outlook, the integration is valuable: flagged emails, tasks shared across Microsoft apps, nothing else to install. And its simplicity is a real strength: little to learn, little to maintain.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>"My Day" says what to do, not when. A list of fifteen tasks for the day often holds ten too many. Cosmo moves from list to calendar: every important task gets a slot (<a href="/en/blog/time-blocking-guide">time blocking</a>), the <a href="/en/blog/matrice-eisenhower">Eisenhower matrix</a> helps you sort, and your habits and quarterly goals sit in the same place.</p>

<h2 id="conclusion">Conclusion</h2>
<p>Microsoft To Do is a very good list. Cosmo is a complete system for planning your days and tracking your goals. <a href="/en/signup">Try Cosmo for free</a> or open the demo without sign-up. Also comparing Google Tasks? See <a href="/en/blog/cosmo-vs-google-tasks">Cosmo or Google Tasks</a>.</p>
`,
    },
  "cosmo-vs-any-do": {
      title: "Cosmo or Any.do: which alternative for planning your days?",
      metaTitle: "Any.do alternative: Cosmo, an honest comparison",
      description: "Any.do brings tasks, reminders and calendar together in a polished app. Cosmo adds habits and OKRs tied to the calendar. An honest comparison, profile by profile.",
      readingMinutes: 5,
      html: `
<p class="lead">Any.do is a polished task app that put the calendar at the centre early on: your tasks and events side by side, with a daily ritual to plan your day. If you are looking for an Any.do alternative, it is probably because you want to go beyond tasks: track habits, or link your days to goals. Comparison checked in November 2026.</p>

<h2 id="resume">The verdict in 30 seconds</h2>
<ul>
<li><strong>Choose Any.do</strong> for an elegant task list with calendar and reminders, on native apps.</li>
<li><strong>Choose Cosmo</strong> if, on top of tasks and calendar, you want habits tracked every day and numbered goals linked to your tasks.</li>
</ul>

<h2 id="tableau">Side by side</h2>
<div class="table-wrap"><table>
<thead><tr><th>Criterion</th><th>Any.do</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Tasks, reminders, recurrence</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Calendar with tasks</td><td>Yes</td><td>Yes, time-blocking calendar</td></tr>
<tr><td>Habit tracking</td><td>No</td><td>Yes</td></tr>
<tr><td>Goals (OKRs)</td><td>No</td><td>Yes</td></tr>
<tr><td>Personal statistics</td><td>Limited</td><td>Dashboard</td></tr>
<tr><td>Native apps</td><td>Yes</td><td>No: web app, usable on mobile</td></tr>
<tr><td>Try without an account</td><td>No</td><td>Yes, full demo</td></tr>
</tbody>
</table></div>

<h2 id="anydo-fort">Where Any.do is still ahead</h2>
<p>Any.do is pleasant to use, with polished native apps and quick capture. For use centred on everyday tasks and appointments, it is a very good choice.</p>

<h2 id="cosmo-fort">Where Cosmo changes the terms</h2>
<p>Planning your day is good; knowing whether those days lead somewhere is better. Cosmo adds two layers Any.do lacks: habits, ticked daily with their streak, and quarterly goals broken into key results. The <a href="/en/blog/gestion-du-temps-efficace">time</a> you plan is then tied to what you want to achieve.</p>

<h2 id="conclusion">Conclusion</h2>
<p>Any.do is an excellent task and calendar app. Cosmo adds habits and goals. <a href="/en/signup">Try Cosmo for free</a> or open the demo without sign-up. See also <a href="/en/blog/cosmo-vs-todoist">Cosmo vs Todoist</a> and <a href="/en/blog/cosmo-vs-ticktick">Cosmo or TickTick</a>.</p>
`,
    },
  "modele-okr-freelance": {
    title: "OKR template for freelancers: quarterly goals ready to fill in (full example)",
    metaTitle: "Freelancer OKR template: goals and a worked example",
    description: "An OKR template built for freelancers: revenue, prospecting, billable time. Three quarterly objectives, numbered key results and a filled-in example.",
    readingMinutes: 3,
    faq: [["How many objectives for a freelancer?","Three at most, one per job (deliver, sell, run the business), with two or three key results each."],["How do I measure billable time?","Block your client work sessions in your calendar: their share of the week is a good enough measure."]],
    html: `
<p class="lead">A freelancer does three jobs: delivering, selling and running the business. Delivery always spills over the other two, and that is often where the business stalls. This OKR template sets one objective per job, for a quarter, with key results you can measure on your own in ten minutes a week.</p>

<h2 id="en-bref">What OKRs should a freelancer set?</h2>
<p class="answer">One objective per job: delivery (quality and deadlines), sales (prospecting and new clients) and running the business (revenue, billable time, cash). Each carries two or three numbered key results with a starting value, over a quarter, plus a ten-minute review every week to decide the next action.</p>

<h2 id="modele">The template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Objective</th><th>Key result</th><th>Start</th><th>Target</th></tr></thead>
<tbody>
<tr><td>Fill my pipeline</td><td>Qualified outreach contacts per week</td><td>0</td><td>5</td></tr>
<tr><td></td><td>New clients signed</td><td>0</td><td>2</td></tr>
<tr><td>Earn a better living</td><td>Average monthly revenue</td><td>current</td><td>+20%</td></tr>
<tr><td></td><td>Share of billable time (%)</td><td>measured</td><td>65%</td></tr>
<tr><td>Deliver without burning out</td><td>On-time deliveries (%)</td><td>measured</td><td>95%</td></tr>
<tr><td></td><td>Weeks over 45 hours worked</td><td>measured</td><td>0</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a freelance designer, Q1</h2>
<p>Starting point: 3 recurring clients, average monthly revenue of 4,200, no regular prospecting. Her key results: 5 outreach contacts a week (tracked as a habit), 2 new clients, 5,000 average monthly revenue and 60% billable time. In week 6, prospecting is at 3 a week: the action for the week becomes a fixed 45-minute slot on Tuesday mornings.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Setting "work more" as an objective: time is not a result, it is a cost.</li>
<li>Forgetting the starting value for revenue: without it, progress means nothing.</li>
<li>Tracking only delivery: today's prospecting is what fills next quarter.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where objectives, their key results and the tasks that move them forward live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many objectives for a freelancer?</h3>
<p>Three at most, one per job (deliver, sell, run the business), with two or three key results each.</p>
<h3>How do I measure billable time?</h3>
<p>Block your client work sessions in your calendar: their share of the week is a good enough measure.</p>
`,
  },
  "modele-okr-etudiant": {
    title: "OKR template for students: ace your semester with measurable goals",
    metaTitle: "Student OKR template: semester goals and example",
    description: "An OKR template for students: grades, revision, internship and balance. Semester objectives, numbered key results and a filled-in example, free.",
    readingMinutes: 3,
    faq: [["Do I need one OKR per subject?","No: one overall success objective with key results for the hardest subjects is enough."],["What about exam season?","Keep the same key results, but review them twice a week."]],
    html: `
<p class="lead">"Get better grades" does not tell you what to do on Monday morning. A semester OKR turns that wish into a few numbers tracked weekly: revision hours, practice papers done, applications sent. Here is a ready-to-fill template and a complete example.</p>

<h2 id="en-bref">How can a student use OKRs?</h2>
<p class="answer">By setting two or three objectives for the semester (academic results, career plans, life balance), each with two to four measurable key results: target average, revision hours per week, applications sent, nights of enough sleep. A ten-minute review on Sundays is enough to stay on course.</p>

<h2 id="modele">The template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Objective</th><th>Key result</th><th>Start</th><th>Target</th></tr></thead>
<tbody>
<tr><td>Pass my semester without a final rush</td><td>Overall average</td><td>current</td><td>+1.5 points</td></tr>
<tr><td></td><td>Revision hours per week</td><td>measured</td><td>8</td></tr>
<tr><td></td><td>Past papers done per subject</td><td>0</td><td>3</td></tr>
<tr><td>Land my internship</td><td>Tailored applications sent</td><td>0</td><td>20</td></tr>
<tr><td></td><td>Interviews obtained</td><td>0</td><td>3</td></tr>
<tr><td>Keep the pace</td><td>Nights of at least 7 h per week</td><td>measured</td><td>5</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a second-year economics student</h2>
<p>Starting point: an 11.2 average, revision crammed into the last week, no internship applications. Key results: a 12.5 average, 8 revision hours a week from September, 3 past papers per subject, 20 applications and 3 interviews, 5 nights of 7 hours a week. In week 4, revision tops out at 5 hours: he moves it into two fixed slots after Tuesday and Thursday classes.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Targeting a grade without targeting the work behind it: the average is a result, revision hours are the lever.</li>
<li>Forgetting sleep: it is the first thing sacrificed and the costliest during exams.</li>
<li>Setting targets for the whole year: a semester is the right cycle.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where objectives, their key results and the tasks that move them forward live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Do I need one OKR per subject?</h3>
<p>No: one overall success objective with key results for the hardest subjects is enough.</p>
<h3>What about exam season?</h3>
<p>Keep the same key results, but review them twice a week.</p>
`,
  },
  "modele-okr-equipe-marketing": {
    title: "OKR template for a marketing team: example objectives and key results",
    metaTitle: "Marketing OKR template: team goals and a worked example",
    description: "An OKR template for marketing teams: acquisition, conversion, content and brand. Quarterly objectives, numbered key results, owners and a filled-in example.",
    readingMinutes: 3,
    faq: [["How many key results per person?","One to three at most, so they fit into the week next to day-to-day work."],["Team or individual OKRs?","Team first: individual OKRs multiply tracking without improving alignment."]],
    html: `
<p class="lead">Marketing has numbers everywhere, and that is exactly the risk: tracking twenty indicators means steering none. A team OKR picks, for one quarter, the two or three changes that matter, and leaves the rest to the KPI dashboard. Here is a template ready to adapt.</p>

<h2 id="en-bref">What OKRs suit a marketing team?</h2>
<p class="answer">Two or three objectives per quarter, each tied to a business priority: more qualified leads, better conversion, stronger awareness. Every key result has an owner, a starting value and a target. Routine indicators stay as KPIs tracked separately, not as OKRs.</p>

<h2 id="modele">The template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Objective</th><th>Key result</th><th>Owner</th><th>Start → target</th></tr></thead>
<tbody>
<tr><td>Fill the sales pipeline</td><td>Qualified demo requests per month</td><td>Acquisition</td><td>40 → 70</td></tr>
<tr><td></td><td>Cost per qualified request</td><td>Acquisition</td><td>current → −20%</td></tr>
<tr><td>Convert our visitors better</td><td>Visit to sign-up rate</td><td>Product / web</td><td>1.8% → 3%</td></tr>
<tr><td></td><td>Key pages with a call to action visible without scrolling</td><td>Web</td><td>3 → 10</td></tr>
<tr><td>Become the reference on our topic</td><td>Third-party sites linking to us</td><td>Content</td><td>5 → 15</td></tr>
<tr><td></td><td>Articles on page one for target queries</td><td>Content</td><td>0 → 3</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a four-person team in a B2B SME</h2>
<p>In Q1 the team keeps only two objectives: fill the pipeline and convert better. The third (awareness) is postponed. In week 5, qualified requests are at 48 a month against a target of 70, but conversion is improving faster than expected: the review moves one person from content to landing page optimisation.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Turning every KPI into an OKR: an OKR is for changing something, a KPI for monitoring.</li>
<li>A key result with no owner: it does not move.</li>
<li>Tying bonuses to OKR attainment: targets turn cautious within two quarters.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where objectives, their key results and the tasks that move them forward live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many key results per person?</h3>
<p>One to three at most, so they fit into the week next to day-to-day work.</p>
<h3>Team or individual OKRs?</h3>
<p>Team first: individual OKRs multiply tracking without improving alignment.</p>
`,
  },
  "modele-okr-startup": {
    title: "OKR template for startups: align a small team on three priorities",
    metaTitle: "Startup OKR template: team priorities and an example",
    description: "An OKR template for startups: traction, product and team. Three quarterly objectives, numbered key results, a review ritual and a filled-in example.",
    readingMinutes: 3,
    faq: [["Do two founders need OKRs?","Yes, in a short version: two objectives, a few key results, a review on Mondays."],["How do you score an OKR at the end of a quarter?","The average progress of its key results: 60 to 80% is a good score."]],
    html: `
<p class="lead">In a startup everything feels like a priority and everything changes fast. OKRs serve one purpose: making sure the five or ten people on the team know, every Monday, what the three priorities for the quarter are. This template fits on one page and is reread in the team meeting.</p>

<h2 id="en-bref">How do you set OKRs for a startup?</h2>
<p class="answer">Pick three objectives per quarter at most, often traction, product and team. Each gets two to four numbered key results, an owner and a measured starting value. The team reviews progress weekly in fifteen minutes, and an honest score at the end of the quarter calibrates the next one.</p>

<h2 id="modele">The template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Objective</th><th>Key result</th><th>Owner</th><th>Start → target</th></tr></thead>
<tbody>
<tr><td>Prove the market wants the product</td><td>Active paying customers</td><td>Founders</td><td>12 → 30</td></tr>
<tr><td></td><td>3-month retention (%)</td><td>Product</td><td>45 → 60</td></tr>
<tr><td>Make the product indispensable</td><td>Weekly active users / sign-ups (%)</td><td>Product</td><td>20 → 35</td></tr>
<tr><td></td><td>Average time to first value (minutes)</td><td>Product</td><td>15 → 5</td></tr>
<tr><td>Build a team that holds</td><td>Key hires signed</td><td>Founders</td><td>0 → 2</td></tr>
<tr><td></td><td>Weekly rituals held (%)</td><td>Whole team</td><td>— → 90</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a six-person SaaS startup</h2>
<p>End of Q1: 26 paying customers out of 30, 3-month retention at 57%, time to first value down to 7 minutes, one hire out of two. Average score: 78%, within the target zone. The end-of-quarter review concludes that retention, not acquisition, becomes next quarter's main objective.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Using tasks as key results ("launch v2"): a launch is not a result, its usage is.</li>
<li>Ten objectives for ten people: alignment disappears.</li>
<li>Dropping OKRs mid-quarter at the first pivot: adjust them openly instead.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where objectives, their key results and the tasks that move them forward live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Do two founders need OKRs?</h3>
<p>Yes, in a short version: two objectives, a few key results, a review on Mondays.</p>
<h3>How do you score an OKR at the end of a quarter?</h3>
<p>The average progress of its key results: 60 to 80% is a good score.</p>
`,
  },
  "routine-du-matin": {
    title: "Morning routine: a simple 5-step template (and how to stick to it)",
    metaTitle: "Morning routine: a simple 5-step template to follow",
    description: "A 5-step morning routine template, 20 to 45 minutes, with a minimal version for busy days. Example, mistakes to avoid and habit tracking.",
    readingMinutes: 3,
    faq: [["Do I have to get up at 5 am?","No. The time matters less than consistency and how much you sleep."],["How long before it is automatic?","About two months on average, longer for demanding actions."]],
    html: `
<p class="lead">A good morning routine is not a list of ten rituals found online. It is a short sequence of habits that gets you going without thinking, and that holds up on the days you are running late. Here is a five-step template, with its minimal version.</p>

<h2 id="en-bref">How do you build an effective morning routine?</h2>
<p class="answer">Choose three to five short actions, in a fixed order, attached to waking up: hydrate, move, get ready, plan your day. Keep a five-minute minimal version for busy days, tick each morning off and add an action only once the others are automatic, which often takes two months.</p>

<h2 id="modele">The template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Step</th><th>Full version</th><th>Minimal version</th><th>Time</th></tr></thead>
<tbody>
<tr><td>1. Wake up</td><td>Get up without snoozing, curtains open</td><td>Same</td><td>1 min</td></tr>
<tr><td>2. Hydrate</td><td>A large glass of water</td><td>Same</td><td>1 min</td></tr>
<tr><td>3. Move</td><td>15 min of walking, stretching or exercise</td><td>2 min of stretching</td><td>2 to 15 min</td></tr>
<tr><td>4. Get ready</td><td>Shower, dress, screen-free breakfast</td><td>Get dressed</td><td>10 to 20 min</td></tr>
<tr><td>5. Plan</td><td>Reread the day's 3 priorities in the calendar</td><td>1 priority</td><td>2 to 5 min</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a week of routine for someone working from home</h2>
<p>Up at 7, a glass of water, a 15-minute walk around the block, shower, breakfast, then five minutes to pick the day's three priorities before opening email. On Wednesday there is an 8 am meeting: he uses the minimal version (water, 2 minutes of stretching, one priority). Over the week the full routine is kept 4 days out of 5 and the minimal one on the fifth: the streak never breaks.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Copying someone else's routine: start from your real constraints (children, commute, hours).</li>
<li>Starting with the wake-up time: moving bedtime comes first.</li>
<li>All or nothing: without a minimal version, the routine breaks on the first busy morning.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where each step becomes a habit ticked daily, with its streak and heatmap live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Do I have to get up at 5 am?</h3>
<p>No. The time matters less than consistency and how much you sleep.</p>
<h3>How long before it is automatic?</h3>
<p>About two months on average, longer for demanding actions.</p>
`,
  },
  "planning-revisions-examens": {
    title: "Revision timetable: a 4-week template to prepare for your exams",
    metaTitle: "Revision timetable: a 4-week exam template",
    description: "A 4-week revision timetable template: split by subject, time slots, past papers and buffers. Filled-in example and mistakes to avoid before exams.",
    readingMinutes: 3,
    faq: [["How many hours of revision a day?","Three to five hours of genuinely focused work, in slots with breaks, is enough most of the time."],["When should I start revising?","Four weeks ahead for a standard exam, longer for a competitive one."]],
    html: `
<p class="lead">A revision timetable rarely fails for lack of hours. It fails because it is overloaded from day one, with no buffer, and collapses at the first surprise. This four-week template starts from the time you really have and keeps half a day for catching up every week.</p>

<h2 id="en-bref">How do you make an effective revision timetable?</h2>
<p class="answer">First count the hours you really have, then split them by subject according to weighting and your level. Put revision into fixed 45 to 90-minute slots, alternate subjects, keep the last week for past papers and leave half a day each week to catch up. Review the plan every Sunday.</p>

<h2 id="modele">The 4-week template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Week</th><th>Goal</th><th>Content</th><th>Buffer</th></tr></thead>
<tbody>
<tr><td>1</td><td>Cover everything</td><td>Reread and summarise each chapter once</td><td>½ day</td></tr>
<tr><td>2</td><td>Understand</td><td>Exercises per chapter, weak points first</td><td>½ day</td></tr>
<tr><td>3</td><td>Consolidate</td><td>Mixed revision, explaining topics out loud</td><td>½ day</td></tr>
<tr><td>4</td><td>Practise</td><td>Past papers in exam conditions, marking</td><td>1 evening</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: 4 subjects, 20 hours a week</h2>
<p>A student has 20 hours a week outside classes. She gives 7 hours to the most heavily weighted subject, 5 hours each to two others and 3 hours to the easiest. Each slot lasts 75 minutes, two different subjects per half-day. Saturday afternoon stays free for catching up. In week 2 one subject falls behind: Saturday's buffer absorbs the gap without touching the rest.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Scheduling 100% of available time: the first surprise brings everything down.</li>
<li>Rereading without practising: only exercises and past papers show what you know.</li>
<li>Leaving hard subjects until the end: they come first from week 1.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where tasks go into a time-blocking calendar, next to your habits and goals live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many hours of revision a day?</h3>
<p>Three to five hours of genuinely focused work, in slots with breaks, is enough most of the time.</p>
<h3>When should I start revising?</h3>
<p>Four weeks ahead for a standard exam, longer for a competitive one.</p>
`,
  },
  "planning-semaine-time-blocking": {
    title: "Weekly planner with time blocking: a template ready to copy",
    metaTitle: "Weekly time-blocking planner: a template to copy",
    description: "A typical-week time-blocking template: deep work blocks, short tasks, meetings and buffers. Filled-in example, simple rules and mistakes to avoid.",
    readingMinutes: 3,
    faq: [["How long should a block be?","60 to 120 minutes for deep work, 30 minutes for short tasks."],["What if my calendar is full of meetings?","Block at least two mornings a week as meetings with yourself."]],
    html: `
<p class="lead">Time blocking means giving each kind of work a slot instead of picking from a list. The easiest way to start is not to plan everything but to begin with a typical week: a few fixed blocks that you then fill each week with your real tasks.</p>

<h2 id="en-bref">How do you plan your week with time blocking?</h2>
<p class="answer">Start with a typical week: two to four deep work blocks in the morning, a daily block for short tasks and messages, meetings grouped in the afternoon and a buffer every day. On Sunday or Monday morning, place your important tasks in those blocks, then adjust the next day every evening.</p>

<h2 id="modele">The typical week</h2>
<div class="table-wrap"><table>
<thead><tr><th>Slot</th><th>Monday to Thursday</th><th>Friday</th></tr></thead>
<tbody>
<tr><td>9 - 11 am</td><td>Deep work: the most important task</td><td>Deep work</td></tr>
<tr><td>11 - 11:30 am</td><td>Messages and short tasks</td><td>Messages</td></tr>
<tr><td>11:30 am - 12:30 pm</td><td>Deep work, continued</td><td>Weekly review (30 min)</td></tr>
<tr><td>2 - 4 pm</td><td>Meetings and calls grouped</td><td>Catch-up</td></tr>
<tr><td>4 - 5 pm</td><td>Short tasks, admin</td><td>Prepare next week</td></tr>
<tr><td>5 - 5:30 pm</td><td>Buffer and tomorrow's plan</td><td>Buffer</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a project manager's week</h2>
<p>On Monday morning she puts into the deep work blocks the specification to finish (Tuesday and Wednesday), preparation for a steering meeting (Thursday) and the project schedule update (Monday). The week's five meetings are grouped between 2 and 4 pm. On Thursday a client incident eats the morning: Friday afternoon's catch-up block absorbs the delay.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Filling every minute: without buffers, the plan is wrong by Tuesday.</li>
<li>Putting deep work in the afternoon by default: place it at your most productive hours.</li>
<li>Never comparing plan and reality: the Friday review is what improves next week.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where tasks go into a time-blocking calendar, next to your habits and goals live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How long should a block be?</h3>
<p>60 to 120 minutes for deep work, 30 minutes for short tasks.</p>
<h3>What if my calendar is full of meetings?</h3>
<p>Block at least two mornings a week as meetings with yourself.</p>
`,
  },
  "revue-hebdomadaire": {
    title: "Weekly review: a 30-minute template to steer your week",
    metaTitle: "Weekly review: a 30-minute template",
    description: "A 30-minute weekly review template: empty, review, decide, plan. The questions to ask, a filled-in example and the mistakes that make people give it up.",
    readingMinutes: 3,
    faq: [["Friday or Monday?","Friday closes the week with a clear head; Monday morning works if you genuinely use it to decide, not to catch up."],["What if I miss a review?","Do the next one as usual, without catching up on the old one: consistency is what counts."]],
    html: `
<p class="lead">The weekly review is the appointment that keeps every other system working: your task list, your goals, your calendar. Without it, everything drifts within three weeks. With it, thirty minutes on Friday is enough to start Monday knowing what to do.</p>

<h2 id="en-bref">How do you do a weekly review?</h2>
<p class="answer">Block thirty minutes at the same time every week, often Friday afternoon. In four steps: empty whatever is lying around (notes, messages, ideas) into your list, review the past week and your goals, decide next week's three priorities, then place them in your calendar. Finish with one question: what do I change?</p>

<h2 id="modele">The 4-step template</h2>
<div class="table-wrap"><table>
<thead><tr><th>Step</th><th>Question</th><th>Time</th></tr></thead>
<tbody>
<tr><td>1. Empty</td><td>What is sitting outside my list (notes, messages, ideas)?</td><td>8 min</td></tr>
<tr><td>2. Review</td><td>What moved, slipped, got dropped? Where are my goals?</td><td>8 min</td></tr>
<tr><td>3. Decide</td><td>What are next week's 3 priorities?</td><td>7 min</td></tr>
<tr><td>4. Plan</td><td>When, exactly, will I do them?</td><td>7 min</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Filled-in example: a consultant's review, Friday at 4:30 pm</h2>
<p>He empties three notebooks and a dozen emails into tasks. Review: two deliverables done, the sales proposal slipped for the second week, the prospecting goal is at 40% with 50% of the quarter gone. Decision: the proposal becomes priority number one, placed on Monday from 9 to 11, and a 30-minute prospecting habit is set for Tuesday and Thursday.</p>

<h2 id="erreurs">Mistakes to avoid</h2>
<ul>
<li>Doing it "when I have time": without a fixed slot it disappears within three weeks.</li>
<li>Turning the review into a work session: you decide, you do not execute.</li>
<li>Leaving with fifteen priorities: three at most, placed in the calendar.</li>
</ul>

<h2 id="cosmo">Using this template in Cosmo</h2>
<p>Copy this template on paper or into a spreadsheet, or use it directly in <a href="/en">Cosmo</a>, where tasks go into a time-blocking calendar, next to your habits and goals live in one place. It is <a href="/en/signup">free</a>, and the demo opens without sign-up.</p>
<p>See also: <a href="/en/templates">all templates</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Friday or Monday?</h3>
<p>Friday closes the week with a clear head; Monday morning works if you genuinely use it to decide, not to catch up.</p>
<h3>What if I miss a review?</h3>
<p>Do the next one as usual, without catching up on the old one: consistency is what counts.</p>
`,
  },
};
