// Modèle de la galerie /modeles (plan SEO C5), publié comme un article du blog :
// sitemap, OG, auteur et accès démo hérités. Anglais : blog/en.mjs.
export const article = {
  slug: "planning-semaine-time-blocking",
  kind: "modele",
  categorie: "planning",
  datePublished: "2026-11-26",
  dateModified: "2026-11-26",
  related: ["time-blocking-guide","gestion-du-temps-efficace","revue-hebdomadaire"],
  locales: {
    fr: {
      title: "Planning de la semaine en time-blocking : un modèle prêt à copier",
      metaTitle: "Planning de semaine en time-blocking : modèle à copier",
      description: "Un modèle de semaine type en time-blocking : blocs de travail profond, tâches courtes, réunions et marges. Exemple rempli, règles simples et erreurs à éviter.",
      readingMinutes: 3,
      faq: [["Quelle durée pour un bloc ?","60 à 120 minutes pour le travail profond, 30 minutes pour les tâches courtes."],["Et si mon agenda est rempli de réunions ?","Bloquez au moins deux matinées par semaine comme des réunions avec vous-même."]],
      html: `
<p class="lead">Le time-blocking consiste à donner un créneau à chaque type de travail plutôt que de piocher dans une liste. Le plus simple pour commencer n'est pas de tout planifier, mais de partir d'une semaine type : quelques blocs fixes, que vous remplissez ensuite chaque semaine avec vos vraies tâches.</p>

<h2 id="en-bref">Comment organiser sa semaine en time-blocking ?</h2>
<p class="answer">Fixez d'abord une semaine type : deux à quatre blocs de travail profond le matin, un bloc quotidien pour les tâches courtes et les messages, les réunions regroupées l'après-midi et une marge chaque jour. Le dimanche ou le lundi matin, placez vos tâches importantes dans ces blocs, puis ajustez le lendemain chaque soir.</p>

<h2 id="modele">La semaine type</h2>
<div class="table-wrap"><table>
<thead><tr><th>Créneau</th><th>Lundi à jeudi</th><th>Vendredi</th></tr></thead>
<tbody>
<tr><td>9 h - 11 h</td><td>Travail profond : la tâche la plus importante</td><td>Travail profond</td></tr>
<tr><td>11 h - 11 h 30</td><td>Messages et tâches courtes</td><td>Messages</td></tr>
<tr><td>11 h 30 - 12 h 30</td><td>Travail profond, suite</td><td>Revue de la semaine (30 min)</td></tr>
<tr><td>14 h - 16 h</td><td>Réunions et appels regroupés</td><td>Rattrapage</td></tr>
<tr><td>16 h - 17 h</td><td>Tâches courtes, administratif</td><td>Préparer la semaine suivante</td></tr>
<tr><td>17 h - 17 h 30</td><td>Marge et plan du lendemain</td><td>Marge</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Exemple rempli : la semaine d'une cheffe de projet</h2>
<p>Le lundi matin, elle place dans les blocs de travail profond le cahier des charges à finir (mardi et mercredi), la préparation d'un comité (jeudi) et la mise à jour du planning projet (lundi). Les cinq réunions de la semaine sont regroupées entre 14 h et 16 h. Le jeudi, un incident client mange la matinée : le bloc de rattrapage du vendredi après-midi absorbe le retard.</p>

<h2 id="erreurs">Les erreurs à éviter</h2>
<ul>
<li>Remplir chaque minute : sans marge, le planning est faux dès le mardi.</li>
<li>Placer le travail profond l'après-midi par défaut : mettez-le à vos heures les plus efficaces.</li>
<li>Ne jamais comparer le plan au réel : la revue du vendredi est ce qui améliore la semaine suivante.</li>
</ul>

<h2 id="cosmo">Utiliser ce modèle dans Cosmo</h2>
<p>Recopiez ce modèle sur papier ou dans un tableur, ou utilisez-le directement dans <a href="/">Cosmo</a>, où les tâches se placent dans un agenda de time-blocking, à côté de vos habitudes et de vos objectifs vivent au même endroit. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>
<p>Voir aussi : <a href="/modeles">tous les modèles</a>.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Quelle durée pour un bloc ?</h3>
<p>60 à 120 minutes pour le travail profond, 30 minutes pour les tâches courtes.</p>
<h3>Et si mon agenda est rempli de réunions ?</h3>
<p>Bloquez au moins deux matinées par semaine comme des réunions avec vous-même.</p>
`,
    },
  },
};
