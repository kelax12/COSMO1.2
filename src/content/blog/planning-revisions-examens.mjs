// Modèle de la galerie /modeles (plan SEO C5), publié comme un article du blog :
// sitemap, OG, auteur et accès démo hérités. Anglais : blog/en.mjs.
export const article = {
  slug: "planning-revisions-examens",
  kind: "modele",
  categorie: "planning",
  datePublished: "2026-11-26",
  dateModified: "2026-11-26",
  related: ["modele-okr-etudiant","time-blocking-guide","matrice-eisenhower"],
  locales: {
    fr: {
      title: "Planning de révisions : un modèle sur 4 semaines pour préparer ses examens",
      metaTitle: "Planning de révisions : modèle sur 4 semaines",
      description: "Un modèle de planning de révisions sur 4 semaines : répartition par matière, créneaux, annales et marges. Exemple rempli et erreurs à éviter avant les examens.",
      readingMinutes: 3,
      faq: [["Combien d'heures de révision par jour ?","Trois à cinq heures de travail réellement concentré, en créneaux avec des pauses, suffisent la plupart du temps."],["Quand commencer à réviser ?","Quatre semaines avant pour un partiel classique, davantage pour un concours."]],
      html: `
<p class="lead">Un planning de révisions échoue rarement par manque d'heures. Il échoue parce qu'il est trop chargé dès le premier jour, sans marge, et qu'il s'effondre au premier imprévu. Ce modèle sur quatre semaines part du temps réellement disponible et garde une demi-journée de rattrapage chaque semaine.</p>

<h2 id="en-bref">Comment faire un planning de révisions efficace ?</h2>
<p class="answer">Comptez d'abord les heures réellement disponibles, puis répartissez-les par matière selon le coefficient et votre niveau. Placez les révisions en créneaux fixes de 45 à 90 minutes, alternez les matières, réservez la dernière semaine aux annales et gardez une demi-journée de rattrapage par semaine. Revoyez le plan chaque dimanche.</p>

<h2 id="modele">Le modèle sur 4 semaines</h2>
<div class="table-wrap"><table>
<thead><tr><th>Semaine</th><th>Objectif</th><th>Contenu</th><th>Marge</th></tr></thead>
<tbody>
<tr><td>1</td><td>Faire le tour</td><td>Relire et ficher chaque chapitre une fois</td><td>½ journée</td></tr>
<tr><td>2</td><td>Comprendre</td><td>Exercices par chapitre, points faibles en priorité</td><td>½ journée</td></tr>
<tr><td>3</td><td>Consolider</td><td>Révisions croisées, questions de cours à voix haute</td><td>½ journée</td></tr>
<tr><td>4</td><td>S'entraîner</td><td>Annales en conditions réelles, correction</td><td>1 soirée</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Exemple rempli : 4 matières, 20 heures par semaine</h2>
<p>Une étudiante dispose de 20 heures par semaine en dehors des cours. Elle donne 7 heures à la matière au plus gros coefficient, 5 heures chacune à deux autres et 3 heures à la plus facile. Chaque créneau dure 75 minutes, deux matières différentes par demi-journée. Le samedi après-midi reste libre pour rattraper. En semaine 2, une matière prend du retard : la marge du samedi absorbe l'écart sans toucher au reste.</p>

<h2 id="erreurs">Les erreurs à éviter</h2>
<ul>
<li>Planifier 100 % du temps disponible : le premier imprévu fait tout tomber.</li>
<li>Relire sans s'entraîner : seuls les exercices et les annales montrent ce qui est su.</li>
<li>Garder les matières difficiles pour la fin : elles sont prioritaires dès la semaine 1.</li>
</ul>

<h2 id="cosmo">Utiliser ce modèle dans Cosmo</h2>
<p>Recopiez ce modèle sur papier ou dans un tableur, ou utilisez-le directement dans <a href="/">Cosmo</a>, où les tâches se placent dans un agenda de time-blocking, à côté de vos habitudes et de vos objectifs vivent au même endroit. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>
<p>Voir aussi : <a href="/modeles">tous les modèles</a>.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien d'heures de révision par jour ?</h3>
<p>Trois à cinq heures de travail réellement concentré, en créneaux avec des pauses, suffisent la plupart du temps.</p>
<h3>Quand commencer à réviser ?</h3>
<p>Quatre semaines avant pour un partiel classique, davantage pour un concours.</p>
`,
    },
  },
};
