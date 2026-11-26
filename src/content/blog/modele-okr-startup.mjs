// Modèle de la galerie /modeles (plan SEO C5), publié comme un article du blog :
// sitemap, OG, auteur et accès démo hérités. Anglais : blog/en.mjs.
export const article = {
  slug: "modele-okr-startup",
  kind: "modele",
  categorie: "okr",
  datePublished: "2026-11-26",
  dateModified: "2026-11-26",
  related: ["modele-okr-equipe-marketing","template-okr-gratuit","tableau-de-bord-productivite"],
  locales: {
    fr: {
      title: "Modèle OKR pour startup : aligner une petite équipe sur trois priorités",
      metaTitle: "Modèle OKR startup : priorités d'équipe et exemple",
      description: "Un modèle OKR pour startup : traction, produit et équipe. Trois objectifs trimestriels, résultats clés chiffrés, rituel de revue et exemple rempli.",
      readingMinutes: 3,
      faq: [["Faut-il des OKR quand on est deux fondateurs ?","Oui, en version courte : deux objectifs, quelques résultats clés, une revue le lundi."],["Comment noter un OKR en fin de trimestre ?","La moyenne de la progression des résultats clés : 60 à 80 % est un bon score."]],
      html: `
<p class="lead">Dans une startup, tout semble prioritaire et tout change vite. Les OKR servent à une chose : que les cinq ou dix personnes de l'équipe sachent, chaque lundi, quelles sont les trois priorités du trimestre. Ce modèle tient sur une page et se relit en réunion d'équipe.</p>

<h2 id="en-bref">Comment fixer les OKR d'une startup ?</h2>
<p class="answer">Choisissez trois objectifs par trimestre au maximum, souvent traction, produit et équipe. Chacun reçoit deux à quatre résultats clés chiffrés, un responsable et une valeur de départ mesurée. L'équipe relit la progression chaque semaine en quinze minutes, et l'on note un score honnête en fin de trimestre pour calibrer le suivant.</p>

<h2 id="modele">Le modèle</h2>
<div class="table-wrap"><table>
<thead><tr><th>Objectif</th><th>Résultat clé</th><th>Responsable</th><th>Départ → cible</th></tr></thead>
<tbody>
<tr><td>Prouver que le marché veut le produit</td><td>Clients payants actifs</td><td>Fondateurs</td><td>12 → 30</td></tr>
<tr><td></td><td>Rétention à 3 mois (%)</td><td>Produit</td><td>45 → 60</td></tr>
<tr><td>Rendre le produit indispensable</td><td>Utilisateurs actifs chaque semaine / inscrits (%)</td><td>Produit</td><td>20 → 35</td></tr>
<tr><td></td><td>Délai moyen avant la première valeur (minutes)</td><td>Produit</td><td>15 → 5</td></tr>
<tr><td>Construire une équipe qui tient</td><td>Recrutements clés signés</td><td>Fondateurs</td><td>0 → 2</td></tr>
<tr><td></td><td>Rituels hebdomadaires tenus (%)</td><td>Toute l'équipe</td><td>— → 90</td></tr>
</tbody>
</table></div>

<h2 id="exemple">Exemple rempli : une startup SaaS de six personnes</h2>
<p>Fin du 1er trimestre : 26 clients payants sur 30, rétention à 3 mois à 57 %, délai avant première valeur ramené à 7 minutes, un recrutement sur deux. Score moyen : 78 %, dans la zone visée. La revue de fin de trimestre conclut que la rétention, et non l'acquisition, devient l'objectif principal du trimestre suivant.</p>

<h2 id="erreurs">Les erreurs à éviter</h2>
<ul>
<li>Mettre des tâches en résultats clés (« lancer la v2 ») : un lancement n'est pas un résultat, son usage l'est.</li>
<li>Dix objectifs pour dix personnes : l'alignement disparaît.</li>
<li>Abandonner les OKR en cours de trimestre au premier pivot : ajustez-les plutôt en le disant.</li>
</ul>

<h2 id="cosmo">Utiliser ce modèle dans Cosmo</h2>
<p>Recopiez ce modèle sur papier ou dans un tableur, ou utilisez-le directement dans <a href="/">Cosmo</a>, où les objectifs, leurs résultats clés et les tâches qui les font avancer vivent au même endroit. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>
<p>Voir aussi : <a href="/modeles">tous les modèles</a>.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Faut-il des OKR quand on est deux fondateurs ?</h3>
<p>Oui, en version courte : deux objectifs, quelques résultats clés, une revue le lundi.</p>
<h3>Comment noter un OKR en fin de trimestre ?</h3>
<p>La moyenne de la progression des résultats clés : 60 à 80 % est un bon score.</p>
`,
    },
  },
};
