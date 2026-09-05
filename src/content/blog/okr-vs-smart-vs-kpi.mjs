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
  slug: "okr-vs-smart-vs-kpi",
  datePublished: "2026-07-18",
  dateModified: "2026-07-18",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["methode-okr-exemples","template-okr-gratuit","tableau-de-bord-productivite"],
  locales: {
    fr: {
      title: "OKR vs objectifs SMART vs KPI : quelle méthode choisir (et quand) ?",
      metaTitle: "OKR vs SMART vs KPI : quelle méthode choisir ?",
      description: "OKR, SMART et KPI ne répondent pas à la même question. Différences concrètes, tableau comparatif et règle simple pour savoir quand utiliser chaque méthode.",
      readingMinutes: 6,
      faq: [
        ["Peut-on utiliser OKR et KPI en même temps ?", "Oui, et c'est même la configuration idéale : les KPI surveillent la santé en continu, les OKR concentrent l'effort du trimestre sur ce qui doit changer. Quand un KPI se dégrade durablement, il devient candidat à un OKR."],
        ["Un objectif SMART peut-il servir de résultat clé ?", "En pratique, un bon résultat clé ressemble beaucoup à un objectif SMART : spécifique, mesurable, temporellement borné. L'OKR ajoute la couche qui manque au SMART isolé : l'ambition qualitative qui relie plusieurs mesures entre elles."],
        ["Quelle méthode pour des objectifs personnels ?", "Les OKR s'adaptent très bien au personnel : un cycle de 6-12 semaines, 2-3 objectifs, des résultats clés simples à mesurer. SMART aide à formuler chaque résultat clé proprement."],
      ],
      html: `
<p class="lead">Trois acronymes, trois promesses de « mieux atteindre ses objectifs », et beaucoup de confusion. La réalité est plus simple : <strong>OKR, SMART et KPI ne répondent pas à la même question</strong>. SMART formule un objectif, KPI surveille une métrique, OKR organise un cycle d'ambition. Une fois cette distinction posée, savoir lequel utiliser devient évident.</p>

<h2 id="definitions">Les trois méthodes en une phrase chacune</h2>
<ul>
<li><strong>SMART</strong> est une <em>grille de formulation</em> : un objectif doit être Spécifique, Mesurable, Atteignable, Réaliste et Temporellement défini. SMART ne dit pas quoi viser : il vérifie que ce que vous visez est bien écrit.</li>
<li><strong>KPI</strong> (Key Performance Indicator) est un <em>instrument de surveillance</em> : une métrique suivie en continu pour connaître la santé d'une activité (trafic mensuel, taux de churn, panier moyen, poids sur la balance).</li>
<li><strong>OKR</strong> (Objectives &amp; Key Results) est un <em>système de cycle</em> : une ambition qualitative (l'objectif) prouvée par 2 à 5 mesures chiffrées (les résultats clés), sur un trimestre, avec une cible de réussite à ~70 %.</li>
</ul>

<h2 id="tableau">Tableau comparatif</h2>
<div class="table-wrap"><table>
<thead><tr><th>Critère</th><th>SMART</th><th>KPI</th><th>OKR</th></tr></thead>
<tbody>
<tr><td>Nature</td><td>Grille d'écriture d'UN objectif</td><td>Métrique surveillée en continu</td><td>Système ambition + mesures sur un cycle</td></tr>
<tr><td>Horizon</td><td>Variable, souvent long</td><td>Permanent</td><td>Trimestre (6-12 semaines en perso)</td></tr>
<tr><td>Niveau d'ambition</td><td>« Atteignable » par définition</td><td>Neutre (c'est un thermomètre)</td><td>Volontairement ambitieux (70 % = réussite)</td></tr>
<tr><td>Répond à</td><td>« Mon objectif est-il bien formulé ? »</td><td>« Comment va l'activité ? »</td><td>« Qu'est-ce qui doit changer ce trimestre, et comment le prouver ? »</td></tr>
<tr><td>Risque principal</td><td>Bien formuler… le mauvais objectif</td><td>Surveiller sans jamais agir</td><td>Trop d'OKR = plus de priorités du tout</td></tr>
</tbody>
</table></div>

<h2 id="complementaires">Pourquoi les opposer est une erreur</h2>
<p>Les trois s'emboîtent naturellement :</p>
<ol>
<li><strong>Vos KPI tournent en continu</strong> : c'est le tableau de bord. La plupart du temps, on les regarde et on ne fait rien de spécial : tout va bien.</li>
<li><strong>Quand un KPI doit bouger significativement</strong> (le churn monte, le trafic stagne, le sommeil se dégrade), il devient la matière d'un <strong>OKR</strong> : un trimestre d'effort concentré avec des résultats clés chiffrés.</li>
<li><strong>Chaque résultat clé est formulé façon SMART</strong> : spécifique, mesurable, borné dans le temps. SMART est l'outil de rédaction ; l'OKR est la structure qui lui donne une direction et un rythme.</li>
</ol>
<p>Exemple complet : votre KPI « visites organiques mensuelles » stagne à 2 000 depuis six mois. Vous en faites un OKR de trimestre. Objectif : « Faire du contenu notre premier canal d'acquisition » ; KR1 : passer de 2 000 à 8 000 visites/mois ; KR2 : publier 12 articles ; KR3 : obtenir 15 backlinks. Chaque KR est SMART. En fin de cycle, le KPI redevient un simple indicateur de surveillance… à son nouveau niveau.</p>

<h2 id="quand">Quelle méthode, quand ? La règle simple</h2>
<ul>
<li><strong>Vous voulez surveiller</strong> → KPI. Définissez 3 à 7 indicateurs de santé, pas quarante.</li>
<li><strong>Vous voulez changer quelque chose</strong> → OKR. 2 à 4 objectifs par cycle, pas plus. Piochez dans nos <a href="/blog/methode-okr-exemples">15 exemples d'OKR</a> ou partez du <a href="/blog/template-okr-gratuit">template gratuit</a>.</li>
<li><strong>Vous rédigez n'importe quel objectif ou résultat clé</strong> → passez-le au filtre SMART avant de le valider.</li>
</ul>

<h2 id="cosmo">Et concrètement ?</h2>
<p>Dans <a href="/">Cosmo</a>, cette articulation est intégrée : vos <strong>OKR</strong> portent le cycle (progression calculée automatiquement à chaque mise à jour de résultat clé), les <strong>statistiques</strong> jouent le rôle de KPI (temps investi par module et par catégorie, semaine après semaine), et vos tâches quotidiennes se relient au tout via le <a href="/blog/time-blocking-guide">time-blocking</a>. En organisation, ces mêmes OKR se déclinent par équipe et par service dans l'<a href="/entreprise-presentation">espace entreprise</a>. <a href="/signup">Gratuit</a>, démo sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Peut-on utiliser OKR et KPI en même temps ?</h3>
<p>Oui, c'est la configuration idéale. Les KPI surveillent, les OKR concentrent l'effort là où un indicateur doit bouger.</p>
<h3>Un objectif SMART peut-il servir de résultat clé ?</h3>
<p>Un bon résultat clé est de facto SMART. L'OKR ajoute l'ambition qualitative qui relie plusieurs mesures.</p>
<h3>Et pour des objectifs personnels ?</h3>
<p>OKR sur 6-12 semaines, 2-3 objectifs, résultats clés simples. SMART sert de filtre de formulation.</p>
`,
    },
    en: {
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
  },
};
