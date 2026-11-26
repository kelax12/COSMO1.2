// Article de blog, contenu partagé React + prerender. ESM pur.
// Page saisonnière (plan SEO C1) : slug SANS année, contenu remis à jour
// chaque décembre. Structure et règles : src/content/blog/index.mjs.
export const article = {
  slug: "bilan-de-l-annee",
  datePublished: "2026-11-25",
  dateModified: "2026-11-25",
  related: ["objectifs-de-l-annee","tableau-de-bord-productivite","tenir-ses-resolutions"],
  locales: {
    fr: {
      title: "Bilan de l'année : le modèle en 10 questions pour préparer 2027",
      metaTitle: "Bilan de l'année : le modèle en 10 questions",
      description: "Faire le bilan de son année en une heure : 10 questions à se poser, dans l'ordre, pour comprendre ce qui a marché et choisir ses objectifs 2027 en connaissance de cause.",
      readingMinutes: 7,
      faq: [
        ["Combien de temps prend un bilan de l'année ?", "Une heure suffit, au calme, sans écran autour. Mieux vaut une heure bien utilisée qu'un week-end entier qu'on repousse."],
        ["Quand faire son bilan annuel ?", "Entre Noël et le 1er janvier est le moment classique. Ce qui compte, c'est de le faire avant de fixer ses objectifs de l'année, pas après."],
        ["Faut-il relire ses objectifs de l'an dernier ?", "Oui, s'ils existent. Comparer ce qu'on visait et ce qui s'est passé est la partie la plus instructive du bilan."],
      ],
      html: `
<p class="lead">On se fixe des objectifs chaque janvier, mais on fait rarement le bilan de l'année qui précède. Résultat : on reprend les mêmes résolutions, qui échoueront pour les mêmes raisons. Un bon bilan de l'année prend <strong>une heure</strong>, tient sur une page et change la qualité de tout ce que vous déciderez ensuite. Voici un modèle en 10 questions, à suivre dans l'ordre.</p>

<h2 id="preparer">Avant de commencer : 3 conseils</h2>
<ul>
<li><strong>Rassemblez vos traces.</strong> Agenda, photos, notes, relevés de compte, liste de tâches terminées. La mémoire retient les trois derniers mois et quelques moments forts : les traces rendent les dix autres mois.</li>
<li><strong>Écrivez, ne réfléchissez pas seulement.</strong> Une réponse écrite oblige à être précis. « Bof » ne tient pas sur le papier.</li>
<li><strong>Soyez factuel avant d'être sévère.</strong> Le but n'est pas de se juger, mais de comprendre ce qui a produit les résultats, bons comme mauvais.</li>
</ul>

<h2 id="questions">Les 10 questions</h2>
<h3>Partie 1 : ce qui s'est passé</h3>
<p><strong>1. Quels sont les 5 moments marquants de mon année ?</strong> Bons ou mauvais. Parcourez votre agenda mois par mois pour ne pas oublier le premier semestre.</p>
<p><strong>2. De quoi suis-je le plus fier ?</strong> Une réalisation, une décision difficile, une habitude tenue. Notez aussi pourquoi : ce qui l'a rendue possible est réutilisable.</p>
<p><strong>3. Qu'est-ce qui ne s'est pas passé comme prévu ?</strong> Un projet abandonné, un objectif manqué. Décrivez les faits sans commentaire. L'analyse vient à la question suivante.</p>
<p><strong>4. Pourquoi ?</strong> Pour chaque point de la question 3, cherchez la cause réelle : manque de temps, objectif mal défini, mauvais moment, ou simplement ce n'était pas une priorité. Cette dernière réponse est fréquente et parfaitement acceptable.</p>

<h3>Partie 2 : ce que j'en retiens</h3>
<p><strong>5. Qu'est-ce qui m'a donné de l'énergie, et qu'est-ce qui m'en a pris ?</strong> Activités, personnes, projets. Deux colonnes. C'est souvent la question qui produit les décisions les plus utiles.</p>
<p><strong>6. Où est passé mon temps ?</strong> Comparez ce que vous dites être important et ce que votre agenda montre. L'écart entre les deux est la matière première de vos prochains objectifs. Un <a href="/blog/tableau-de-bord-productivite">tableau de bord personnel</a> rend cette comparaison beaucoup plus facile l'année suivante.</p>
<p><strong>7. Quelles habitudes ai-je prises ou perdues ?</strong> Sommeil, sport, lecture, écrans. Une habitude installée cette année est un acquis à protéger ; une habitude perdue est souvent la cause cachée de plusieurs objectifs manqués.</p>
<p><strong>8. Quelle est la leçon principale de cette année ?</strong> Une seule phrase. Si vous en avez cinq, choisissez celle que vous voudriez relire en décembre prochain.</p>

<h3>Partie 3 : ce que je prépare</h3>
<p><strong>9. Qu'est-ce que j'arrête, qu'est-ce que je continue, qu'est-ce que je commence ?</strong> Trois listes courtes. La liste « arrêter » est la plus difficile, et la plus importante : elle libère le temps dont les nouveaux objectifs auront besoin.</p>
<p><strong>10. Si l'année prochaine est réussie, qu'est-ce qui aura changé ?</strong> Décrivez trois changements concrets. Ce seront les objectifs de votre année : il ne restera qu'à les rendre mesurables avec <a href="/blog/objectifs-de-l-annee">la méthode OKR</a>.</p>

<h2 id="modele">Le modèle sur une page</h2>
<div class="table-wrap"><table>
<thead><tr><th>Partie</th><th>Questions</th><th>Durée conseillée</th></tr></thead>
<tbody>
<tr><td>Ce qui s'est passé</td><td>1 à 4 : moments marquants, fierté, ce qui a manqué, pourquoi</td><td>25 min</td></tr>
<tr><td>Ce que j'en retiens</td><td>5 à 8 : énergie, temps, habitudes, leçon</td><td>20 min</td></tr>
<tr><td>Ce que je prépare</td><td>9 et 10 : arrêter, continuer, commencer ; trois changements</td><td>15 min</td></tr>
</tbody>
</table></div>
<p>Copiez ces dix questions dans un carnet ou un document, répondez dans l'ordre, et gardez la page : relue dans un an, elle sera le point de départ du bilan suivant.</p>

<h2 id="erreurs">Les 3 pièges du bilan annuel</h2>
<ol>
<li><strong>Ne retenir que le négatif.</strong> Un bilan qui ne liste que des échecs démotive et fausse l'analyse. Les questions 2 et 5 sont là pour l'équilibre.</li>
<li><strong>Passer directement aux résolutions.</strong> Sans les questions 3 et 4, vous reprendrez les mêmes objectifs que l'an dernier, avec les mêmes obstacles. C'est l'une des raisons pour lesquelles <a href="/blog/tenir-ses-resolutions">les résolutions échouent</a>.</li>
<li><strong>En faire un exercice parfait.</strong> Une heure honnête vaut mieux qu'un week-end de réflexion qu'on repousse à février.</li>
</ol>

<h2 id="ensuite">Et ensuite ?</h2>
<p>Le bilan vous donne trois changements à viser. Pour qu'ils ne restent pas des intentions, transformez-les en objectifs chiffrés pour le premier trimestre, avec un rendez-vous de suivi chaque semaine. Dans <a href="/">Cosmo</a>, objectifs, habitudes et tâches vivent au même endroit : l'an prochain, la question 6 (« où est passé mon temps ? ») aura sa réponse sous les yeux. C'est <a href="/signup">gratuit</a>, et la démo s'ouvre sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien de temps prend un bilan de l'année ?</h3>
<p>Une heure suffit, au calme, sans écran autour. Mieux vaut une heure bien utilisée qu'un week-end entier qu'on repousse.</p>
<h3>Quand faire son bilan annuel ?</h3>
<p>Entre Noël et le 1er janvier est le moment classique. Ce qui compte, c'est de le faire avant de fixer ses objectifs de l'année, pas après.</p>
<h3>Faut-il relire ses objectifs de l'an dernier ?</h3>
<p>Oui, s'ils existent. Comparer ce qu'on visait et ce qui s'est passé est la partie la plus instructive du bilan.</p>
<h3>Peut-on faire le bilan à deux ou en équipe ?</h3>
<p>Oui. Les mêmes questions fonctionnent pour un couple ou une petite équipe : chacun répond seul d'abord, puis on compare. Les écarts de réponse sont souvent les plus intéressants.</p>
`,
    },
  },
};
