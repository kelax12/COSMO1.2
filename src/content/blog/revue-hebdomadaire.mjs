// Modèle de la galerie /modeles (plan SEO C5), publié comme un article du blog :
// sitemap, OG, auteur et accès démo hérités. Anglais : blog/en.mjs.
export const article = {
  slug: "revue-hebdomadaire",
  kind: "modele",
  categorie: "methode",
  datePublished: "2026-11-26",
  dateModified: "2026-11-26",
  related: ["planning-semaine-time-blocking","tableau-de-bord-productivite","template-okr-gratuit"],
  locales: {
    fr: {
      title: "Revue hebdomadaire : le modèle en 30 minutes pour piloter sa semaine",
      metaTitle: "Revue hebdomadaire : modèle en 30 minutes",
      description: "Un modèle de revue hebdomadaire en 30 minutes : vider, relire, décider, planifier. Les questions à se poser, un exemple rempli et les erreurs qui la font abandonner.",
      readingMinutes: 3,
      faq: [["Vendredi ou lundi ?","Le vendredi ferme la semaine l'esprit libre ; le lundi matin convient si vous l'utilisez vraiment pour décider, pas pour rattraper."],["Et si je rate une revue ?","Faites la suivante normalement, sans rattraper l'ancienne : c'est la régularité qui compte."]],
      html: `
<p class="lead">La revue hebdomadaire est le rendez-vous qui fait tenir tous les autres systèmes : la liste de tâches, les objectifs, l'agenda. Sans elle, tout se dérègle en trois semaines. Avec elle, trente minutes le vendredi suffisent pour commencer le lundi en sachant quoi faire.</p>

<h2 id="en-bref">Comment faire une revue hebdomadaire ?</h2>
<p class="answer">Bloquez trente minutes au même moment chaque semaine, souvent le vendredi après-midi. En quatre temps : videz ce qui traîne (notes, messages, idées) dans votre liste, relisez la semaine écoulée et vos objectifs, décidez des trois priorités de la semaine suivante, puis placez-les dans l'agenda. Terminez par une question : qu'est-ce que je change ?</p>

<h2 id="modele">Le modèle en 4 temps</h2>
<div class="table-wrap"><table>
<thead><tr><th>Temps</th><th>Question</th><th>Durée</th></tr></thead>
<tbody>
<tr><td>1. Vider</td><td>Qu'est-ce qui traîne hors de ma liste (notes, messages, idées) ?</td><td>8 min</td></tr>
<tr><td>2. Relire</td><td>Qu'est-ce qui a avancé, glissé, été abandonné ? Où en sont mes objectifs ?</td><td>8 min</td></tr>
<tr><td>3. Décider</td><td>Quelles sont les 3 priorités de la semaine prochaine ?</td><td>7 min</td></tr>
<tr><td>4. Planifier</td><td>Quand, précisément, vais-je les faire ?</td><td>7 min</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Exemple rempli : la revue d'un consultant, un vendredi à 16 h 30</h2>
<p>Il vide trois carnets de notes et une dizaine de mails en tâches. Relecture : deux livrables terminés, la proposition commerciale a glissé pour la deuxième semaine, l'objectif de prospection est à 40 % pour 50 % du trimestre écoulé. Décision : la proposition devient la priorité numéro un, placée lundi de 9 h à 11 h, et une habitude de prospection de 30 minutes est fixée le mardi et le jeudi.</p>

<h2 id="erreurs">Les erreurs à éviter</h2>
<ul>
<li>La faire « quand j'ai le temps » : sans créneau fixe, elle disparaît en trois semaines.</li>
<li>Transformer la revue en séance de travail : on décide, on n'exécute pas.</li>
<li>Sortir avec quinze priorités : trois au plus, placées dans l'agenda.</li>
</ul>

<h2 id="cosmo">Utiliser ce modèle dans Cosmo</h2>
<p>Recopiez ce modèle sur papier ou dans un tableur, ou utilisez-le directement dans <a href="/">Cosmo</a>, où les tâches se placent dans un agenda de time-blocking, à côté de vos habitudes et de vos objectifs vivent au même endroit. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>
<p>Voir aussi : <a href="/modeles">tous les modèles</a>.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Vendredi ou lundi ?</h3>
<p>Le vendredi ferme la semaine l'esprit libre ; le lundi matin convient si vous l'utilisez vraiment pour décider, pas pour rattraper.</p>
<h3>Et si je rate une revue ?</h3>
<p>Faites la suivante normalement, sans rattraper l'ancienne : c'est la régularité qui compte.</p>
`,
    },
  },
};
