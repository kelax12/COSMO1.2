// Article de blog — contenu partagé React + prerender. ESM pur.
export const article = {
  slug: 'matrice-eisenhower',
  title: 'La matrice Eisenhower : prioriser ses tâches en 4 cases (+ exemples)',
  metaTitle: 'Matrice Eisenhower : méthode, exemples et limites (guide)',
  description:
    "Urgent ou important ? La matrice Eisenhower classe vos tâches en 4 quadrants pour décider quoi faire, planifier, déléguer ou supprimer. Méthode complète avec exemples.",
  datePublished: '2026-07-18',
  dateModified: '2026-07-18',
  readingMinutes: 7,
  faq: [
    ['Quelle est la différence entre urgent et important ?', "Urgent = exige une action immédiate (une deadline, un appel). Important = contribue à vos objectifs de fond. Une tâche peut être l'un, l'autre, les deux ou aucun des deux — d'où les 4 quadrants."],
    ['Que faire des tâches ni urgentes ni importantes ?', "Les supprimer, ou les assumer comme du loisir choisi. Le piège n'est pas de se détendre, c'est de traiter ces tâches comme du travail."],
    ['La matrice Eisenhower suffit-elle pour s’organiser ?', "Non : elle classe, mais ne planifie pas. Elle est plus efficace combinée au time-blocking (le quadrant 2 va dans l'agenda) et à des objectifs clairs qui définissent ce qui est « important »."],
  ],
  html: `
<p class="lead">« Ce qui est important est rarement urgent, et ce qui est urgent est rarement important. » La phrase attribuée au président Eisenhower a donné son nom à l'outil de priorisation le plus simple qui existe : deux questions, quatre cases, une décision par tâche. Voici comment l'utiliser correctement — et surtout comment éviter le piège dans lequel tombe la majorité de ses utilisateurs.</p>

<h2 id="principe">Le principe : deux questions, quatre quadrants</h2>
<p>Pour chaque tâche, posez deux questions : <strong>est-ce urgent ?</strong> (est-ce que ça exige une action immédiate ?) et <strong>est-ce important ?</strong> (est-ce que ça contribue à mes objectifs de fond ?). Les réponses placent la tâche dans l'un des quatre quadrants :</p>
<div class="table-wrap"><table>
<thead><tr><th></th><th>Urgent</th><th>Pas urgent</th></tr></thead>
<tbody>
<tr><td><strong>Important</strong></td><td><strong>Q1 — Faire</strong> : maintenant, soi-même</td><td><strong>Q2 — Planifier</strong> : lui donner un créneau</td></tr>
<tr><td><strong>Pas important</strong></td><td><strong>Q3 — Déléguer</strong> (ou réduire drastiquement)</td><td><strong>Q4 — Supprimer</strong></td></tr>
</tbody>
</table></div>

<h2 id="quadrants">Les 4 quadrants avec exemples</h2>
<h3>Q1 — Urgent et important : faire</h3>
<p>La crise client, le bug en production, le dossier à rendre ce soir, le problème de santé. Ces tâches se traitent immédiatement et personnellement. Un Q1 chargé en permanence n'est pas une fatalité : c'est presque toujours le symptôme d'un Q2 négligé (tout ce qui n'a pas été planifié finit par devenir urgent).</p>
<h3>Q2 — Important, pas urgent : planifier</h3>
<p>La prospection, la formation, le sport, la stratégie, les relations, la prévention. <strong>C'est le quadrant où se joue votre trajectoire</strong> — et c'est mécaniquement celui qu'on sacrifie, puisque rien n'y crie. La seule protection efficace : donner à ces tâches un créneau dans l'agenda, exactement ce que fait le <a href="/blog/time-blocking-guide">time-blocking</a>.</p>
<h3>Q3 — Urgent, pas important : déléguer ou réduire</h3>
<p>La plupart des interruptions, une partie des réunions et des emails : urgent pour quelqu'un d'autre, pas pour vos objectifs. Déléguez quand c'est possible ; sinon, regroupez (traiter les emails en 2 blocs par jour plutôt qu'en continu) et apprenez le non poli.</p>
<h3>Q4 — Ni urgent ni important : supprimer</h3>
<p>Le scroll par défaut, les réunions sans ordre du jour où votre présence n'apporte rien, le perfectionnisme sur des détails invisibles. À supprimer sans culpabilité — ou à assumer comme du vrai repos choisi, ce qui est différent.</p>

<h2 id="piege">Le piège classique : vivre dans Q1 et Q3</h2>
<p>L'erreur n'est pas de mal classer — c'est de laisser l'urgence décider. Une journée pilotée par les notifications se passe intégralement dans Q1 et Q3 : on éteint des feux et on répond aux urgences des autres, avec le sentiment d'avoir été débordé et l'impression de n'avoir rien avancé. Les deux antidotes :</p>
<ol>
<li><strong>Classer le matin, pas en continu.</strong> 5 minutes pour trier la liste du jour avant d'ouvrir la boîte mail — après, il est trop tard, l'urgence a pris la main.</li>
<li><strong>Protéger Q2 physiquement.</strong> Une tâche Q2 sans créneau réservé perdra toujours contre une urgence Q3. La matrice classe ; l'agenda protège.</li>
</ol>

<h2 id="important">« Important » par rapport à quoi ?</h2>
<p>La matrice a un prérequis silencieux : savoir ce qui est important <em>pour vous</em>. Sans objectifs explicites, tout semble important et la matrice ne filtre plus rien. C'est là que la <a href="/blog/methode-okr-exemples">méthode OKR</a> complète parfaitement Eisenhower : vos 2-4 objectifs du trimestre deviennent le critère objectif de la colonne « important ». Une tâche qui ne sert ni un OKR ni une obligation réelle a de fortes chances d'être du Q3 ou du Q4 déguisé.</p>

<h2 id="pratique">La mettre en pratique dans Cosmo</h2>
<p>Dans <a href="/">Cosmo</a>, la matrice se traduit naturellement : les <strong>priorités 1 à 5</strong> encodent l'importance, la <strong>deadline</strong> porte l'urgence, et les listes filtrées vous montrent votre « Q1 » réel du jour. Les tâches Q2 se glissent dans l'agenda en time-blocking (l'événement lié se crée tout seul), et vos <a href="/blog/methode-okr-exemples">OKR</a> définissent ce que « important » veut dire ce trimestre. <a href="/signup">Gratuit</a>, démo sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Quelle différence entre urgent et important ?</h3>
<p>Urgent = exige une action immédiate. Important = contribue à vos objectifs de fond. Le tri des deux notions est exactement ce que la matrice force à faire.</p>
<h3>Que faire des tâches ni urgentes ni importantes ?</h3>
<p>Les supprimer — ou les assumer comme du loisir choisi. Le piège est de les traiter comme du travail.</p>
<h3>La matrice suffit-elle pour s'organiser ?</h3>
<p>Non : elle classe mais ne planifie pas. Combinez-la au time-blocking (Q2 → agenda) et à des objectifs explicites (OKR) qui définissent « important ».</p>
`,
};
