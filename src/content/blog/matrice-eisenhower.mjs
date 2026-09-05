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
  slug: "matrice-eisenhower",
  datePublished: "2026-07-18",
  dateModified: "2026-07-18",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["gestion-du-temps-efficace","time-blocking-guide","glossaire-productivite"],
  locales: {
    fr: {
      title: "La matrice Eisenhower : prioriser ses tâches en 4 cases (+ exemples)",
      metaTitle: "Matrice Eisenhower : méthode, exemples et limites (guide)",
      description: "Urgent ou important ? La matrice Eisenhower classe vos tâches en 4 quadrants : faire, planifier, déléguer ou supprimer. Méthode complète avec exemples.",
      readingMinutes: 7,
      faq: [
        ["Quelle est la différence entre urgent et important ?", "Urgent = exige une action immédiate (une deadline, un appel). Important = contribue à vos objectifs de fond. Une tâche peut être l'un, l'autre, les deux ou aucun des deux, d'où les 4 quadrants."],
        ["Que faire des tâches ni urgentes ni importantes ?", "Les supprimer, ou les assumer comme du loisir choisi. Le piège n'est pas de se détendre, c'est de traiter ces tâches comme du travail."],
        ["La matrice Eisenhower suffit-elle pour s’organiser ?", "Non : elle classe, mais ne planifie pas. Elle est plus efficace combinée au time-blocking (le quadrant 2 va dans l'agenda) et à des objectifs clairs qui définissent ce qui est « important »."],
      ],
      html: `
<p class="lead">« Ce qui est important est rarement urgent, et ce qui est urgent est rarement important. » La phrase attribuée au président Eisenhower a donné son nom à l'outil de priorisation le plus simple qui existe : deux questions, quatre cases, une décision par tâche. Voici comment l'utiliser correctement, et surtout comment éviter le piège dans lequel tombe la majorité de ses utilisateurs.</p>

<h2 id="principe">Le principe : deux questions, quatre quadrants</h2>
<p>Pour chaque tâche, posez deux questions : <strong>est-ce urgent ?</strong> (est-ce que ça exige une action immédiate ?) et <strong>est-ce important ?</strong> (est-ce que ça contribue à mes objectifs de fond ?). Les réponses placent la tâche dans l'un des quatre quadrants :</p>
<div class="table-wrap"><table>
<thead><tr><th></th><th>Urgent</th><th>Pas urgent</th></tr></thead>
<tbody>
<tr><td><strong>Important</strong></td><td><strong>Q1 : Faire</strong> : maintenant, soi-même</td><td><strong>Q2 : Planifier</strong> : lui donner un créneau</td></tr>
<tr><td><strong>Pas important</strong></td><td><strong>Q3 : Déléguer</strong> (ou réduire drastiquement)</td><td><strong>Q4 : Supprimer</strong></td></tr>
</tbody>
</table></div>

<h2 id="quadrants">Les 4 quadrants avec exemples</h2>
<h3>Q1 : urgent et important, faire</h3>
<p>La crise client, le bug en production, le dossier à rendre ce soir, le problème de santé. Ces tâches se traitent immédiatement et personnellement. Un Q1 chargé en permanence n'est pas une fatalité : c'est presque toujours le symptôme d'un Q2 négligé (tout ce qui n'a pas été planifié finit par devenir urgent).</p>
<h3>Q2 : important, pas urgent, planifier</h3>
<p>La prospection, la formation, le sport, la stratégie, les relations, la prévention. <strong>C'est le quadrant où se joue votre trajectoire</strong>, et c'est mécaniquement celui qu'on sacrifie, puisque rien n'y crie. La seule protection efficace : donner à ces tâches un créneau dans l'agenda, exactement ce que fait le <a href="/blog/time-blocking-guide">time-blocking</a>.</p>
<h3>Q3 : urgent, pas important, déléguer ou réduire</h3>
<p>La plupart des interruptions, une partie des réunions et des emails : urgent pour quelqu'un d'autre, pas pour vos objectifs. Déléguez quand c'est possible, c'est le quotidien d'un <a href="/pour-managers">manager d'équipe</a> ; sinon, regroupez (traiter les emails en 2 blocs par jour plutôt qu'en continu) et apprenez le non poli.</p>
<h3>Q4 : ni urgent ni important, supprimer</h3>
<p>Le scroll par défaut, les réunions sans ordre du jour où votre présence n'apporte rien, le perfectionnisme sur des détails invisibles. À supprimer sans culpabilité, ou à assumer comme du vrai repos choisi, ce qui est différent.</p>

<h2 id="piege">Le piège classique : vivre dans Q1 et Q3</h2>
<p>L'erreur n'est pas de mal classer : c'est de laisser l'urgence décider. Une journée pilotée par les notifications se passe intégralement dans Q1 et Q3 : on éteint des feux et on répond aux urgences des autres, avec le sentiment d'avoir été débordé et l'impression de n'avoir rien avancé. Les deux antidotes :</p>
<ol>
<li><strong>Classer le matin, pas en continu.</strong> 5 minutes pour trier la liste du jour avant d'ouvrir la boîte mail. Après, il est trop tard, l'urgence a pris la main.</li>
<li><strong>Protéger Q2 physiquement.</strong> Une tâche Q2 sans créneau réservé perdra toujours contre une urgence Q3. La matrice classe ; l'agenda protège. C'est le quatrième des sept principes d'une <a href="/blog/gestion-du-temps-efficace">gestion du temps efficace</a> : ce qui n'a pas de créneau n'existe pas.</li>
</ol>

<h2 id="important">« Important » par rapport à quoi ?</h2>
<p>La matrice a un prérequis silencieux : savoir ce qui est important <em>pour vous</em>. Sans objectifs explicites, tout semble important et la matrice ne filtre plus rien. C'est là que la <a href="/blog/methode-okr-exemples">méthode OKR</a> complète parfaitement Eisenhower : vos 2-4 objectifs du trimestre deviennent le critère objectif de la colonne « important ». Une tâche qui ne sert ni un OKR ni une obligation réelle a de fortes chances d'être du Q3 ou du Q4 déguisé.</p>

<h2 id="pratique">La mettre en pratique dans Cosmo</h2>
<p>Dans <a href="/">Cosmo</a>, la matrice se traduit naturellement : les <strong>priorités 1 à 5</strong> encodent l'importance, la <strong>deadline</strong> porte l'urgence, et les listes filtrées vous montrent votre « Q1 » réel du jour. Les tâches Q2 se glissent dans l'agenda en time-blocking (l'événement lié se crée tout seul), et vos <a href="/blog/methode-okr-exemples">OKR</a> définissent ce que « important » veut dire ce trimestre. <a href="/signup">Gratuit</a>, démo sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Quelle différence entre urgent et important ?</h3>
<p>Urgent = exige une action immédiate. Important = contribue à vos objectifs de fond. Le tri des deux notions est exactement ce que la matrice force à faire.</p>
<h3>Que faire des tâches ni urgentes ni importantes ?</h3>
<p>Les supprimer, ou les assumer comme du loisir choisi. Le piège est de les traiter comme du travail.</p>
<h3>La matrice suffit-elle pour s'organiser ?</h3>
<p>Non : elle classe mais ne planifie pas. Combinez-la au time-blocking (Q2 → agenda) et à des objectifs explicites (OKR) qui définissent « important ».</p>
`,
    },
    en: {
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

<h2 id="faq">Frequently asked questions</h2>
<h3>What is the difference between urgent and important?</h3>
<p>Urgent means it demands immediate action. Important means it contributes to your underlying goals. Separating the two is exactly what the matrix forces you to do.</p>
<h3>What should you do with tasks that are neither urgent nor important?</h3>
<p>Delete them, or own them as chosen leisure. The trap is treating them as work.</p>
<h3>Is the matrix enough to get organised?</h3>
<p>No: it sorts but it does not schedule. Combine it with time-blocking (Q2 → calendar) and with explicit goals (OKRs) that define what "important" means.</p>
`,
    },
  },
};
