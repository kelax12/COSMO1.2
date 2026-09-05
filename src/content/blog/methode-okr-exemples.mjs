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
  slug: "methode-okr-exemples",
  datePublished: "2026-07-18",
  dateModified: "2026-07-18",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["template-okr-gratuit","okr-vs-smart-vs-kpi","tableau-de-bord-productivite"],
  locales: {
    fr: {
      title: "La méthode OKR expliquée simplement (+ 15 exemples concrets)",
      metaTitle: "Méthode OKR : guide simple + 15 exemples concrets (2026)",
      description: "Qu'est-ce que la méthode OKR ? Définition simple, règles d'écriture et 15 exemples concrets d'OKR personnels et professionnels, prêts à adapter.",
      readingMinutes: 9,
      faq: [
        ["Combien d’OKR faut-il définir ?", "2 à 4 objectifs maximum par cycle, avec 2 à 5 résultats clés chacun. Moins vous en avez, plus la méthode fonctionne."],
        ["Quelle durée pour un cycle OKR ?", "Le trimestre est le standard. Pour des objectifs personnels, un cycle de 6 à 12 semaines fonctionne très bien aussi."],
        ["Un OKR à 60 %, c’est un échec ?", "Non. La cible saine se situe autour de 70 % : c’est le signe d’objectifs réellement ambitieux."],
      ],
      html: `
<p class="lead">La méthode OKR (Objectives &amp; Key Results) est le système de définition d'objectifs utilisé par Google, Intel, Netflix ou Spotify. Son principe tient en une phrase : un <strong>objectif</strong> ambitieux et qualitatif, mesuré par 2 à 5 <strong>résultats clés</strong> chiffrés. Ce guide vous explique comment elle fonctionne, comment écrire de bons OKR, et vous donne 15 exemples concrets (personnels et professionnels) à adapter directement.</p>

<h2 id="definition">Qu'est-ce qu'un OKR ? Définition simple</h2>
<p>Un OKR se compose de deux éléments :</p>
<ul>
<li><strong>L'Objectif (O)</strong> : une direction qualitative, ambitieuse et motivante. Il répond à la question « où veux-je aller ? ». Exemple : <em>« Devenir une référence dans mon domaine »</em>.</li>
<li><strong>Les Résultats Clés (KR)</strong> : 2 à 5 mesures chiffrées qui prouvent que l'objectif est atteint. Ils répondent à « comment saurai-je que j'y suis ? ». Exemple : <em>« Publier 12 articles », « Atteindre 1 000 abonnés à la newsletter »</em>.</li>
</ul>
<p>La règle d'or : <strong>l'objectif inspire, les résultats clés mesurent</strong>. Si votre objectif contient un chiffre, c'est probablement un résultat clé déguisé. Le vocabulaire du domaine (KR, KPI, deep work, time-blocking) est réuni dans notre <a href="/blog/glossaire-productivite">glossaire de la productivité</a> si un terme vous échappe. Si votre résultat clé n'est pas mesurable sans débat (« améliorer la qualité »), ce n'est pas un résultat clé.</p>

<h2 id="origines">D'où vient la méthode OKR ?</h2>
<p>La méthode naît chez <strong>Intel</strong> dans les années 1970, sous l'impulsion d'Andy Grove. John Doerr, alors jeune ingénieur chez Intel, l'importe chez <strong>Google en 1999</strong>, quand l'entreprise compte à peine 40 salariés. Larry Page attribuera aux OKR une partie de la capacité de Google à croître sans perdre le cap. Depuis, la méthode s'est diffusée bien au-delà de la tech, et elle fonctionne aussi très bien à l'échelle individuelle, pour structurer une année, un trimestre ou un projet personnel.</p>

<h2 id="pourquoi">Pourquoi ça marche (là où les résolutions échouent)</h2>
<ul>
<li><strong>La mesure remplace l'intention.</strong> « Me remettre au sport » échoue car rien ne dit si vous êtes en bonne voie. « Courir 3 fois par semaine pendant 12 semaines » se vérifie chaque semaine.</li>
<li><strong>L'ambition est calibrée.</strong> Un bon OKR vise 70 % de réussite. Atteindre 100 % partout signifie que vous visiez trop bas ; c'est une différence fondamentale avec les objectifs SMART classiques.</li>
<li><strong>Le nombre est limité.</strong> 2 à 4 objectifs par trimestre, pas plus. La méthode force à choisir, donc à renoncer : c'est sa vraie puissance.</li>
<li><strong>Le rythme est court.</strong> Le trimestre est le cycle idéal : assez long pour accomplir, assez court pour corriger.</li>
</ul>

<h2 id="ecrire">Comment écrire un bon OKR : la checklist</h2>
<ol>
<li>L'objectif tient en une phrase, sans chiffre, et vous motive vraiment.</li>
<li>Chaque résultat clé a un nombre (valeur cible) et une échéance implicite (la fin du cycle).</li>
<li>2 à 5 résultats clés par objectif ; au-delà, découpez en deux objectifs.</li>
<li>Les KR mesurent un <strong>résultat</strong>, pas une activité. « Envoyer 50 candidatures » est une activité ; « Décrocher 5 entretiens » est un résultat. Les deux sont utiles, mais sachez lequel vous écrivez.</li>
<li>À mi-parcours, chaque KR doit pouvoir être noté objectivement (0 → 100 %).</li>
</ol>

<h2 id="exemples-perso">8 exemples d'OKR personnels</h2>

<h3>1. Santé : se remettre en forme</h3>
<p><strong>O :</strong> Retrouver une forme physique dont je suis fier.<br><strong>KR1 :</strong> Courir 3 séances par semaine pendant 12 semaines. <strong>KR2 :</strong> Passer de 0 à 10 km en continu. <strong>KR3 :</strong> Dormir 7 h 30 en moyenne (mesuré sur le mois).</p>

<h3>2. Finances : reprendre le contrôle</h3>
<p><strong>O :</strong> Assainir mes finances personnelles.<br><strong>KR1 :</strong> Épargner 15 % de chaque revenu mensuel. <strong>KR2 :</strong> Réduire mes dépenses récurrentes de 100 €/mois. <strong>KR3 :</strong> Constituer un fonds d'urgence de 3 000 €.</p>

<h3>3. Apprentissage : apprendre une langue</h3>
<p><strong>O :</strong> Tenir une conversation en espagnol.<br><strong>KR1 :</strong> 90 sessions de 15 minutes sur le trimestre. <strong>KR2 :</strong> Finir 2 livres faciles en VO. <strong>KR3 :</strong> Réaliser 6 conversations de 30 minutes avec un natif.</p>

<h3>4. Side-project : lancer enfin</h3>
<p><strong>O :</strong> Faire exister mon projet dans le monde réel.<br><strong>KR1 :</strong> Publier une première version utilisable. <strong>KR2 :</strong> Obtenir 50 utilisateurs actifs. <strong>KR3 :</strong> Recueillir 20 retours utilisateurs structurés.</p>

<h3>5. Lecture &amp; culture</h3>
<p><strong>O :</strong> Redevenir un vrai lecteur.<br><strong>KR1 :</strong> Lire 6 livres dans le trimestre. <strong>KR2 :</strong> 20 minutes de lecture 5 soirs par semaine. <strong>KR3 :</strong> Rédiger une note de synthèse par livre terminé.</p>

<h3>6. Carrière : préparer une évolution</h3>
<p><strong>O :</strong> Me rendre incontournable pour le poste que je vise.<br><strong>KR1 :</strong> Mener 2 projets visibles au-delà de mon équipe. <strong>KR2 :</strong> Obtenir une certification reconnue du domaine. <strong>KR3 :</strong> Déjeuner avec 6 personnes qui occupent déjà ce poste.</p>

<h3>7. Vie sociale &amp; famille</h3>
<p><strong>O :</strong> Être réellement présent pour mes proches.<br><strong>KR1 :</strong> 1 week-end entièrement déconnecté par mois. <strong>KR2 :</strong> Organiser 6 dîners ou sorties avec des amis. <strong>KR3 :</strong> Appeler mes parents chaque semaine (12/12).</p>

<h3>8. Créativité</h3>
<p><strong>O :</strong> Construire une pratique créative régulière.<br><strong>KR1 :</strong> Publier 12 créations (une par semaine). <strong>KR2 :</strong> Suivre 1 cours ou tutoriel structuré jusqu'au bout. <strong>KR3 :</strong> Recevoir un feedback de 3 créateurs que j'admire.</p>

<h2 id="exemples-pro">7 exemples d'OKR professionnels</h2>
<p>Les exemples qui suivent se lisent seuls, mais ils prennent tout leur sens en collectif : voir comment ils se déclinent par service et par équipe est l'objet de la page <a href="/pour-equipes">Cosmo pour les équipes</a>.</p>

<h3>9. Startup early-stage : trouver le product-market fit</h3>
<p><strong>O :</strong> Prouver que le produit résout un vrai problème.<br><strong>KR1 :</strong> 40 % des utilisateurs actifs reviennent chaque semaine. <strong>KR2 :</strong> 25 interviews utilisateurs menées. <strong>KR3 :</strong> NPS supérieur à 40.</p>

<h3>10. Marketing : acquisition organique</h3>
<p><strong>O :</strong> Faire du contenu notre premier canal d'acquisition.<br><strong>KR1 :</strong> Passer de 2 000 à 8 000 visites organiques mensuelles. <strong>KR2 :</strong> Publier 12 articles optimisés SEO. <strong>KR3 :</strong> Obtenir 15 backlinks de sites d'autorité.</p>

<h3>11. Produit : activation</h3>
<p><strong>O :</strong> Rendre la première utilisation magique.<br><strong>KR1 :</strong> Porter l'activation J1 de 30 % à 50 %. <strong>KR2 :</strong> Réduire le time-to-value médian sous 3 minutes. <strong>KR3 :</strong> Diviser par deux les tickets support liés à l'onboarding.</p>

<h3>12. Ventes</h3>
<p><strong>O :</strong> Construire une machine commerciale prévisible.<br><strong>KR1 :</strong> 30 démos qualifiées par mois. <strong>KR2 :</strong> Taux de conversion démo → client de 20 %. <strong>KR3 :</strong> Cycle de vente moyen ramené de 45 à 30 jours.</p>

<h3>13. RH : recrutement</h3>
<p><strong>O :</strong> Attirer des profils que nous n'aurions pas osé approcher.<br><strong>KR1 :</strong> 3 recrutements seniors signés. <strong>KR2 :</strong> 50 % des candidatures issues de recommandations. <strong>KR3 :</strong> Délai moyen de recrutement sous 35 jours.</p>

<h3>14. Support client</h3>
<p><strong>O :</strong> Transformer le support en avantage concurrentiel.<br><strong>KR1 :</strong> Première réponse en moins de 2 h (médiane). <strong>KR2 :</strong> CSAT ≥ 95 %. <strong>KR3 :</strong> 20 articles d'aide publiés, réduisant les tickets récurrents de 30 %.</p>

<h3>15. Équipe engineering</h3>
<p><strong>O :</strong> Livrer vite sans casser.<br><strong>KR1 :</strong> Déployer en production chaque jour. <strong>KR2 :</strong> Taux d'incidents critiques divisé par deux. <strong>KR3 :</strong> 90 % du code couvert par des tests sur les modules cœur.</p>

<h2 id="erreurs">Les 5 erreurs qui tuent les OKR</h2>
<ol>
<li><strong>Trop d'objectifs.</strong> Six objectifs, c'est zéro priorité. Limitez-vous à 2-4.</li>
<li><strong>Des KR-activités partout.</strong> Si tous vos KR sont des « faire X fois », vous mesurez votre agitation, pas vos résultats.</li>
<li><strong>Écrire puis oublier.</strong> Un OKR se revisite chaque semaine, 10 minutes suffisent. Sans rituel de suivi, la méthode ne vaut rien.</li>
<li><strong>Viser 100 %.</strong> Si tout est vert à la fin du trimestre, vos objectifs n'étaient pas ambitieux.</li>
<li><strong>Lier les OKR à la rémunération.</strong> En entreprise, c'est le meilleur moyen d'obtenir des objectifs sabordés dès l'écriture.</li>
</ol>

<h2 id="okr-smart">OKR, SMART, KPI : quelle différence ?</h2>
<p>Les trois coexistent très bien : le <strong>KPI</strong> est un indicateur de santé permanent (le tableau de bord), l'objectif <strong>SMART</strong> est un but unique bien formulé, l'<strong>OKR</strong> est un système complet qui relie une ambition à ses preuves chiffrées sur un cycle court. En pratique : surveillez vos KPI en continu, et quand un KPI doit bouger significativement, transformez-le en OKR le temps d'un trimestre. Le <a href="/blog/okr-vs-smart-vs-kpi">comparatif détaillé des trois méthodes</a> donne le tableau complet et la règle de choix.</p>

<h2 id="demarrer">Suivre ses OKR sans tableur</h2>
<p>Pour démarrer aujourd'hui, nous proposons un <a href="/blog/template-okr-gratuit">template OKR Excel gratuit</a> (exemples pré-remplis, progression automatique, sans email). Mais le vrai point de friction des OKR n'est pas l'écriture, c'est le <strong>suivi hebdomadaire</strong>. Un tableur fonctionne, mais personne ne l'ouvre. <a href="/">Cosmo</a> intègre les OKR nativement : vous créez vos objectifs et résultats clés, la progression se calcule automatiquement à mesure que vous mettez à jour vos KR, et le graphique du dashboard montre vos KR réalisés semaine après semaine, à côté de vos <a href="/guide">tâches, habitudes et agenda</a>, pour que le suivi se fasse au même endroit que l'action. <a href="/signup">C'est gratuit</a>, et le mode démo permet d'essayer avec 8 OKR pré-remplis, sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien d'OKR faut-il définir ?</h3>
<p>2 à 4 objectifs maximum par cycle, avec 2 à 5 résultats clés chacun. Moins vous en avez, plus la méthode fonctionne.</p>
<h3>Quelle durée pour un cycle OKR ?</h3>
<p>Le trimestre est le standard. Pour des objectifs personnels, un cycle de 6 à 12 semaines fonctionne très bien aussi.</p>
<h3>Un OKR à 60 %, c'est un échec ?</h3>
<p>Non. La cible saine se situe autour de 70 % : c'est le signe d'objectifs réellement ambitieux. Un OKR systématiquement à 100 % doit vous pousser à viser plus haut au cycle suivant.</p>
`,
    },
    en: {
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

<h2 id="faq">Frequently asked questions</h2>
<h3>How many OKRs should you set?</h3>
<p>Two to four objectives per cycle at most, with 2 to 5 key results each. The fewer you have, the better the method works.</p>
<h3>How long should an OKR cycle be?</h3>
<p>The quarter is the standard. For personal goals, a cycle of 6 to 12 weeks works very well too.</p>
<h3>Is an OKR at 60 % a failure?</h3>
<p>No. The healthy target is around 70 %, which is the sign of genuinely ambitious goals. An OKR that always lands at 100 % should push you to aim higher next cycle.</p>
`,
    },
  },
};
