// Article de blog, contenu partagé React + prerender. ESM pur.
// Comparatif « alternative à X » (plan SEO C3). Publicité comparative :
// fonctions vérifiables seulement, aucun prix concurrent. Anglais : blog/en.mjs.
export const article = {
  slug: "cosmo-vs-microsoft-to-do",
  datePublished: "2026-11-25",
  dateModified: "2026-11-25",
  related: ["cosmo-vs-google-tasks","matrice-eisenhower","time-blocking-guide"],
  locales: {
    fr: {
      title: "Cosmo ou Microsoft To Do : quelle alternative pour aller plus loin ?",
      metaTitle: "Alternative à Microsoft To Do : Cosmo, comparatif honnête",
      description: "Microsoft To Do est simple, gratuit et relié à Outlook. Cosmo ajoute habitudes, time-blocking et OKR. Comparatif honnête, et quand passer de l'un à l'autre.",
      readingMinutes: 5,
      html: `
<p class="lead">Microsoft To Do est une liste de tâches claire et gratuite, avec une bonne idée : « Ma journée », une liste qu'on remplit chaque matin avec ce qu'on compte faire aujourd'hui. Reliée à Outlook, elle convient très bien à un usage simple. Cette page est pour ceux qui veulent aller plus loin : prioriser, planifier en créneaux, suivre des habitudes et des objectifs. Comparatif vérifié en novembre 2026.</p>

<h2 id="resume">Le verdict en 30 secondes</h2>
<ul>
<li><strong>Gardez Microsoft To Do</strong> si vous travaillez dans l'environnement Microsoft et voulez une liste simple reliée à Outlook.</li>
<li><strong>Passez à Cosmo</strong> si « Ma journée » ne suffit plus : vous voulez donner un créneau à vos tâches, suivre des habitudes et relier le tout à des objectifs.</li>
</ul>

<h2 id="tableau">Tableau comparatif</h2>
<div class="table-wrap"><table>
<thead><tr><th>Critère</th><th>Microsoft To Do</th><th>Cosmo</th></tr></thead>
<tbody>
<tr><td>Listes, étapes, rappels, échéances</td><td>Oui</td><td>Oui</td></tr>
<tr><td>Planifier sa journée</td><td>Liste « Ma journée »</td><td>Agenda de time-blocking, tâches placées en créneaux</td></tr>
<tr><td>Intégration Outlook et Microsoft 365</td><td>Oui</td><td>Non</td></tr>
<tr><td>Priorités et catégories</td><td>Importance (étoile), listes</td><td>Priorités et catégories hiérarchiques</td></tr>
<tr><td>Suivi d'habitudes</td><td>Non</td><td>Oui</td></tr>
<tr><td>Objectifs (OKR)</td><td>Non</td><td>Oui</td></tr>
</tbody>
</table></div>

<h2 id="microsoft-fort">Là où Microsoft To Do reste devant</h2>
<p>Pour qui vit dans Outlook, l'intégration est précieuse : e-mails marqués, tâches partagées entre les applications Microsoft, rien à installer de plus. Et sa simplicité est un vrai atout : peu de choses à apprendre, peu de choses à entretenir.</p>

<h2 id="cosmo-fort">Là où Cosmo change la donne</h2>
<p>« Ma journée » dit quoi faire, pas quand. Une liste de quinze tâches pour la journée en contient souvent dix de trop. Cosmo passe de la liste à l'agenda : chaque tâche importante reçoit un créneau (<a href="/blog/time-blocking-guide">time-blocking</a>), la <a href="/blog/matrice-eisenhower">matrice d'Eisenhower</a> aide à trier, et vos habitudes et objectifs trimestriels sont visibles au même endroit.</p>

<h2 id="conclusion">Conclusion</h2>
<p>Microsoft To Do est une très bonne liste. Cosmo est un système complet pour planifier ses journées et suivre ses objectifs. <a href="/signup">Essayez Cosmo gratuitement</a> ou ouvrez la démo sans inscription. Vous comparez aussi avec Google Tasks ? Voir <a href="/blog/cosmo-vs-google-tasks">Cosmo ou Google Tasks</a>.</p>
`,
    },
  },
};
