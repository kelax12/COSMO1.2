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
  slug: "tableau-de-bord-productivite",
  datePublished: "2026-08-12",
  dateModified: "2026-08-12",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["methode-okr-exemples","suivi-des-habitudes","cosmo-vs-todoist"],
  locales: {
    fr: {
      title: "Tableau de bord de productivité : quoi y mettre (et quoi en retirer)",
      metaTitle: "Tableau de bord productivité : les 6 indicateurs utiles",
      description: "Que doit afficher un tableau de bord de productivité personnel ? Les 6 indicateurs qui font agir, ceux qui ne servent à rien, et comment le construire.",
      readingMinutes: 8,
      faq: [
        ["Quels indicateurs mettre dans un tableau de bord de productivité ?", "Six suffisent : les tâches terminées sur la période, le taux de complétion des habitudes, le temps réparti par catégorie, l'avancement des objectifs, la charge de la semaine à venir et le ratio planifié/réalisé. Au-delà, on regarde sans agir."],
        ["À quelle fréquence consulter son tableau de bord ?", "Une fois par semaine pour la revue, plus un coup d'œil quotidien de dix secondes sur la charge du jour. Le consulter en continu ne change aucune décision et coûte de l'attention."],
        ["Un tableau de bord personnel doit-il ressembler à un dashboard d’entreprise ?", "Non. Un dashboard d'entreprise sert à rendre compte, un tableau de bord personnel sert à décider. Il doit tenir sur un écran et ne montrer que ce sur quoi vous pouvez agir cette semaine."],
      ],
      html: `
<p class="lead">Un tableau de bord de productivité est une promesse tentante : voir sa vie en un écran. En pratique, la plupart de ceux qu'on construit finissent en décoration, jolis, consultés trois semaines, puis ignorés. La raison est presque toujours la même : ils affichent ce qui est facile à mesurer plutôt que ce qui déclenche une décision. Voici ce qui mérite d'y figurer, ce qu'il faut en retirer, et comment le monter sans y passer un week-end.</p>
<figure><img src="/screenshots/dashboard.webp" srcset="/screenshots/dashboard-800.webp 800w, /screenshots/dashboard.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Le tableau de bord de Cosmo : tâches du jour, événements d'agenda, résultats clés et habitudes réunis sur un seul écran." /><figcaption>Le tableau de bord de Cosmo : tâches du jour, événements d'agenda, résultats clés et habitudes réunis sur un seul écran. Capture du mode démo, données fictives.</figcaption></figure>

<h2 id="critere">Le seul critère qui compte : est-ce que ça change une décision ?</h2>
<p>Avant d'ajouter un indicateur, posez-lui cette question : <strong>si ce chiffre double ou s'effondre, qu'est-ce que je fais différemment lundi ?</strong> Si la réponse est « rien », l'indicateur n'a pas sa place. Il est intéressant, pas utile, et la différence entre les deux est exactement ce qui sépare un tableau de bord vivant d'un tableau de bord abandonné.</p>
<p>Ce filtre élimine d'emblée la majorité des métriques qu'on trouve dans les outils : le nombre total de tâches créées depuis toujours, le temps cumulé sur l'année, les badges, les scores composites. Ils flattent ou culpabilisent, ils ne pilotent rien.</p>

<h2 id="indicateurs">Les 6 indicateurs qui font agir</h2>

<h3>1. Les tâches terminées sur la période</h3>
<p>Pas le total historique : le volume de la semaine écoulée, comparé aux précédentes. C'est votre débit réel, et il sert à une chose précise : calibrer ce que vous vous engagez à faire la semaine suivante. Quelqu'un qui termine douze tâches par semaine et en planifie trente organise sa propre déception, chaque lundi.</p>

<h3>2. Le taux de complétion des habitudes</h3>
<p>Le pourcentage de fois où vous avez tenu vos routines sur la période. Sous 50 %, l'habitude est mal calibrée : trop ambitieuse, mal placée dans la journée, ou pas assez désirée. C'est un signal d'ajustement, pas un motif de culpabilité, et il vaut mieux le voir en semaine 3 qu'en mois 4. La <a href="/blog/combien-de-temps-prendre-habitude">durée réelle d'ancrage d'une habitude</a> rend ce suivi indispensable, et l'article <a href="/blog/suivi-des-habitudes">suivi des habitudes</a> détaille lequel des trois indicateurs mérite la première place.</p>

<h3>3. Le temps réparti par catégorie</h3>
<p>L'indicateur qui surprend le plus, systématiquement. Vous croyez consacrer vos journées à la production ; la répartition montre que l'administratif et les réunions en prennent la moitié. C'est le seul chiffre qui permet une conversation honnête avec soi-même sur la charge, et, pour un indépendant, la base d'une meilleure tarification.</p>

<h3>4. L'avancement des objectifs</h3>
<p>Si vous travaillez en <a href="/blog/methode-okr-exemples">OKR</a>, c'est la progression de chaque résultat clé. Sinon, une simple estimation par objectif. L'important est la <strong>trajectoire</strong> : à mi-trimestre, un objectif à 20 % n'est pas « en retard », il est en train d'être abandonné silencieusement. Le voir tôt laisse deux options : accélérer ou renoncer explicitement. Les deux valent mieux que la dérive.</p>

<h3>5. La charge de la semaine à venir</h3>
<p>Le nombre d'heures déjà engagées dans l'agenda face aux heures réellement disponibles. C'est le seul indicateur tourné vers l'avant, et donc le seul qui empêche un problème au lieu de le constater. Une semaine à 45 heures engagées sur 35 disponibles ne se règle pas par plus de discipline : elle se règle en retirant quelque chose, avant qu'elle ne commence. Pour un <a href="/pour-managers">manager</a>, c'est le même indicateur appliqué à l'équipe : la charge se lit avant d'être subie, jamais après.</p>

<h3>6. Le ratio planifié / réalisé</h3>
<p>Sur les créneaux que vous aviez bloqués, combien ont été tenus ? Ce ratio mesure la qualité de votre planification, pas votre valeur. Durablement sous 60 %, il dit que vos blocs sont trop longs, trop optimistes, ou posés à des moments où vous n'êtes pas disponible. C'est le complément naturel du <a href="/blog/time-blocking-guide">time-blocking</a>.</p>

<h2 id="a-retirer">Ce qu'il faut retirer</h2>
<ul>
<li><strong>Les compteurs cumulés.</strong> « 1 847 tâches terminées » ne pilote rien. Un cumul ne redescend jamais, donc il ne peut jamais alerter.</li>
<li><strong>Les scores composites.</strong> Un « score de productivité » sur 100 mélange des choses non comparables : quand il baisse, vous ne savez pas quoi faire. Préférez cinq chiffres lisibles à un indice opaque.</li>
<li><strong>Les comparaisons avec d'autres.</strong> Vos contraintes ne sont pas les leurs. Le seul point de comparaison utile, c'est vous il y a un mois.</li>
<li><strong>Les séries trop longues.</strong> Un graphique sur trois ans écrase les variations récentes, celles sur lesquelles vous pouvez encore agir. Douze semaines suffisent presque toujours.</li>
</ul>

<h2 id="rythme">Le rythme de consultation</h2>
<p>Un tableau de bord consulté en permanence devient un fil d'actualité : il occupe l'attention sans produire de décision. Deux rendez-vous suffisent.</p>
<ol>
<li><strong>Dix secondes le matin</strong> sur la charge du jour et les habitudes à cocher. Pas d'analyse, juste un cadrage.</li>
<li><strong>Quinze minutes en fin de semaine</strong> pour la revue : débit réel, temps par catégorie, avancement des objectifs, et une seule décision d'ajustement pour la semaine suivante. Une seule, c'est ce qui rend la revue tenable dans la durée.</li>
</ol>

<h2 id="construire">Le construire sans y passer un week-end</h2>
<p>Beaucoup de gens montent leur tableau de bord dans un tableur. C'est faisable, et c'est un excellent exercice pour clarifier ce qu'on veut suivre, mais la saisie manuelle est une dette : au bout de six semaines, les données ne sont plus à jour, et un tableau de bord périmé est pire que pas de tableau de bord, parce qu'il donne une fausse assurance.</p>
<p>La règle pratique : <strong>ne suivez à la main que ce qu'aucun outil ne peut calculer seul.</strong> Tout ce qui découle de vos tâches, de vos habitudes ou de votre agenda doit se remplir automatiquement, sinon vous finirez par arrêter.</p>
<p>C'est précisément ce que fait <a href="/">Cosmo</a> : le dashboard affiche l'avancement du jour, les habitudes à cocher, les prochains événements et la courbe des résultats clés atteints, et la page Statistiques donne le temps investi par catégorie et son évolution. Les cinq premiers indicateurs de cet article s'y lisent sans aucune saisie supplémentaire, ils tombent de l'usage normal de l'application. <a href="/signup">C'est gratuit</a>, et la démo s'ouvre sans inscription avec 12 mois de données pour voir à quoi ressemble le tableau de bord une fois rempli.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Combien d'indicateurs au maximum ?</h3>
<p>Six, sept si vraiment nécessaire. Au-delà, on ne lit plus : on balaie. Un tableau de bord qui ne tient pas sur un écran a déjà échoué.</p>
<h3>Faut-il suivre son temps à la minute ?</h3>
<p>Non. Une répartition par catégorie sur des blocs d'une demi-heure suffit largement à révéler les déséquilibres. Le suivi à la minute coûte plus d'attention qu'il n'en fait gagner.</p>
<h3>Que faire si tous mes indicateurs sont au rouge ?</h3>
<p>Ne rien optimiser. C'est le signe d'une surcharge, pas d'un défaut de méthode : retirez des engagements jusqu'à ce que la semaine à venir tienne dans les heures disponibles, puis reprenez le pilotage.</p>
`,
    },
    en: {
      title: "A productivity dashboard: what to put on it (and what to take off)",
      metaTitle: "Productivity dashboard: the 6 indicators worth having",
      description: "What should a personal productivity dashboard show? The 6 indicators that make you act, the ones that are useless, and how to build it.",
      readingMinutes: 8,
      faq: [
        ["Which indicators belong on a productivity dashboard?", "Six are enough: tasks completed over the period, habit completion rate, time split by category, goal progress, the load of the week ahead, and the planned-to-done ratio. Beyond that you look without acting."],
        ["How often should you look at your dashboard?", "Once a week for the review, plus a ten-second daily glance at the day's load. Checking it continuously changes no decision and costs attention."],
        ["Should a personal dashboard look like a company dashboard?", "No. A company dashboard exists to report, a personal dashboard exists to decide. It should fit on one screen and show only what you can act on this week."],
      ],
      html: `
<p class="lead">A productivity dashboard is a tempting promise: your life on one screen. In practice, most of the ones people build end up as decoration. Pretty, consulted for three weeks, then ignored. The reason is almost always the same: they show what is easy to measure rather than what triggers a decision. Here is what deserves a place, what to take off, and how to build one without spending a weekend on it.</p>
<figure><img src="/screenshots/dashboard.webp" srcset="/screenshots/dashboard-800.webp 800w, /screenshots/dashboard.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's dashboard: today's tasks, calendar events, key results and habits on a single screen." /><figcaption>Cosmo's dashboard: today's tasks, calendar events, key results and habits on a single screen. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="critere">The only criterion that counts: does it change a decision?</h2>
<p>Before adding an indicator, ask it this question: <strong>if this number doubles or collapses, what do I do differently on Monday?</strong> If the answer is "nothing", the indicator does not belong. It is interesting, not useful, and the difference between the two is exactly what separates a living dashboard from an abandoned one.</p>
<p>That filter removes most of the metrics you find in tools straight away: total tasks created since forever, cumulative time over the year, badges, composite scores. They flatter or they shame, they steer nothing.</p>

<h2 id="indicateurs">The 6 indicators that make you act</h2>

<h3>1. Tasks completed over the period</h3>
<p>Not the historical total: the volume of the past week, compared with the ones before it. This is your real throughput, and it serves one precise purpose, calibrating what you commit to next week. Someone who finishes twelve tasks a week and plans thirty is organising their own disappointment, every Monday.</p>

<h3>2. Habit completion rate</h3>
<p>The percentage of times you kept your routines over the period. Below 50 %, the habit is badly calibrated: too ambitious, badly placed in the day, or not wanted enough. That is a signal to adjust, not a reason for guilt, and it is far better seen in week 3 than in month 4. The <a href="/en/blog/combien-de-temps-prendre-habitude">real time it takes for a habit to stick</a> makes this tracking indispensable, and the article on <a href="/en/blog/suivi-des-habitudes">habit tracking</a> sets out which of the three indicators deserves first place.</p>

<h3>3. Time split by category</h3>
<p>The indicator that surprises people the most, consistently. You believe you spend your days producing, and the split shows that admin and meetings take half of it. It is the only figure that allows an honest conversation with yourself about workload, and, for a freelancer, the basis for better pricing.</p>

<h3>4. Goal progress</h3>
<p>If you work with <a href="/en/blog/methode-okr-exemples">OKRs</a>, this is the progress of each key result. Otherwise a simple estimate per goal. What matters is the <strong>trajectory</strong>: halfway through a quarter, a goal at 20 % is not "behind", it is being silently abandoned. Seeing that early leaves two options, accelerate or give up explicitly. Both are better than drift.</p>

<h3>5. The load of the week ahead</h3>
<p>The hours already committed in the calendar against the hours genuinely available. This is the only forward-looking indicator, and therefore the only one that prevents a problem instead of recording it. A week with 45 hours committed against 35 available is not solved with more discipline: it is solved by removing something, before it starts. For a <a href="/en/for-managers">manager</a> it is the same indicator applied to the team: load gets read before it is endured, never after.</p>

<h3>6. The planned-to-done ratio</h3>
<p>Of the slots you had blocked, how many did you keep? This ratio measures the quality of your planning, not your worth. Persistently below 60 %, it says your blocks are too long, too optimistic, or placed at times when you are not actually available. It is the natural complement to <a href="/en/blog/time-blocking-guide">time-blocking</a>.</p>

<h2 id="a-retirer">What to take off</h2>
<ul>
<li><strong>Cumulative counters.</strong> "1,847 tasks completed" steers nothing. A running total never goes down, so it can never raise an alarm.</li>
<li><strong>Composite scores.</strong> A "productivity score out of 100" mixes things that are not comparable: when it drops, you do not know what to do. Prefer five readable numbers to one opaque index.</li>
<li><strong>Comparisons with other people.</strong> Their constraints are not yours. The only useful point of comparison is you, a month ago.</li>
<li><strong>Series that are too long.</strong> A three-year chart flattens the recent variations, the ones you can still act on. Twelve weeks is almost always enough.</li>
</ul>

<h2 id="rythme">How often to look</h2>
<p>A dashboard consulted continuously becomes a news feed: it occupies attention without producing a decision. Two appointments are enough.</p>
<ol>
<li><strong>Ten seconds in the morning</strong> on the day's load and the habits to tick. No analysis, just framing.</li>
<li><strong>Fifteen minutes at the end of the week</strong> for the review: real throughput, time per category, goal progress, and a single adjustment decision for the week ahead. A single one, because that is what makes the review sustainable.</li>
</ol>

<h2 id="construire">Building it without spending a weekend</h2>
<p>Plenty of people build their dashboard in a spreadsheet. It works, and it is an excellent exercise for clarifying what you want to track, but manual entry is a debt: after six weeks the data is out of date, and a stale dashboard is worse than no dashboard, because it gives false confidence.</p>
<p>The practical rule: <strong>only track by hand what no tool can compute on its own.</strong> Everything that follows from your tasks, your habits or your calendar should fill itself in, otherwise you will end up stopping.</p>
<p>That is precisely what <a href="/en/">Cosmo</a> does: the dashboard shows the day's progress, the habits to tick, the next events and the curve of key results achieved, and the Statistics page gives time invested per category and how it evolves. The first five indicators in this article are readable there with no extra data entry, they fall out of normal use of the app. <a href="/en/signup">It is free</a>, and the demo opens with no sign-up and 12 months of data, so you can see what the dashboard looks like once it is full.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>How many indicators at most?</h3>
<p>Six, seven if truly necessary. Beyond that you stop reading and start skimming. A dashboard that does not fit on one screen has already failed.</p>
<h3>Should you track your time to the minute?</h3>
<p>No. A split by category in half-hour blocks is more than enough to reveal the imbalances. Minute-level tracking costs more attention than it saves.</p>
<h3>What if all my indicators are red?</h3>
<p>Optimise nothing. That is the sign of overload, not of a flawed method: remove commitments until the week ahead fits in the hours available, then go back to steering.</p>
`,
    },
    hr: {
      title: "Nadzorna ploča produktivnosti: što na nju staviti (i što s nje maknuti)",
      metaTitle: "Nadzorna ploča produktivnosti: 6 korisnih pokazatelja",
      description: "Što treba prikazivati osobna nadzorna ploča produktivnosti? 6 pokazatelja koji potiču na djelovanje, oni koji ne služe ničemu i kako je složiti.",
      readingMinutes: 8,
      faq: [
        ["Koje pokazatelje staviti na nadzornu ploču produktivnosti?", "Šest je dovoljno: završeni zadaci u razdoblju, stopa izvršenja navika, vrijeme po kategorijama, napredak ciljeva, opterećenje nadolazećeg tjedna i omjer planiranog i ostvarenog. Više od toga samo gledate, a ne djelujete."],
        ["Koliko često gledati nadzornu ploču?", "Jednom tjedno za pregled, uz desetak sekundi dnevno za opterećenje toga dana. Stalno gledanje ne mijenja nijednu odluku, a troši pažnju."],
        ["Treba li osobna nadzorna ploča izgledati kao ona u tvrtki?", "Ne. Ploča u tvrtki služi za izvještavanje, osobna služi za odlučivanje. Mora stati na jedan zaslon i prikazivati samo ono na što ovaj tjedan možete utjecati."],
      ],
      html: `
<p class="lead">Nadzorna ploča produktivnosti primamljivo je obećanje: cijeli život na jednom zaslonu. U praksi većina takvih ploča završi kao ukras: lijepe su, gledamo ih tri tjedna, a onda ih zaboravimo. Razlog je gotovo uvijek isti: prikazuju ono što je lako izmjeriti, a ne ono što potiče odluku. Evo što zaslužuje mjesto na ploči, što treba maknuti i kako je složiti bez trošenja cijelog vikenda.</p>
<figure><img src="/screenshots/dashboard.webp" srcset="/screenshots/dashboard-800.webp 800w, /screenshots/dashboard.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Nadzorna ploča u Cosmu: današnji zadaci, događaji iz kalendara, ključni rezultati i navike na jednom zaslonu." /><figcaption>Nadzorna ploča u Cosmu: današnji zadaci, događaji iz kalendara, ključni rezultati i navike na jednom zaslonu. Snimka demo načina, izmišljeni podaci.</figcaption></figure>

<h2 id="critere">Jedini kriterij koji vrijedi: mijenja li to neku odluku?</h2>
<p>Prije nego što dodate pokazatelj, postavite mu pitanje: <strong>ako se ovaj broj udvostruči ili sruši, što ću u ponedjeljak napraviti drukčije?</strong> Ako je odgovor „ništa“, pokazatelju nije mjesto na ploči. Zanimljiv je, ali nije koristan, a upravo ta razlika dijeli živu nadzornu ploču od napuštene.</p>
<p>Taj filtar odmah uklanja većinu metrika koje nude alati: ukupan broj zadataka stvorenih otkad postojite, zbrojeno vrijeme za cijelu godinu, značke, složene ocjene. One laskaju ili izazivaju grižnju savjesti, ali ništa ne usmjeravaju.</p>

<h2 id="indicateurs">6 pokazatelja koji potiču na djelovanje</h2>

<h3>1. Završeni zadaci u razdoblju</h3>
<p>Ne ukupan broj kroz povijest, nego obujam proteklog tjedna u usporedbi s prethodnima. To je vaš stvarni kapacitet i služi jednoj stvari: da odmjerite koliko ćete preuzeti sljedeći tjedan. Tko završi dvanaest zadataka tjedno, a planira trideset, svakog ponedjeljka sam sebi priprema razočaranje.</p>

<h3>2. Stopa izvršenja navika</h3>
<p>Postotak puta kada ste se držali svojih rutina u tom razdoblju. Ispod 50 % navika je loše odmjerena: preambiciozna, smještena u krivi dio dana ili nedovoljno željena. To je signal za prilagodbu, a ne razlog za grižnju savjesti, i bolje ga je uočiti u 3. tjednu nego u 4. mjesecu. <a href="/hr/blog/combien-de-temps-prendre-habitude">Stvarno vrijeme potrebno da se navika ustali</a> čini ovo praćenje nužnim, a članak o <a href="/hr/blog/suivi-des-habitudes">praćenju navika</a> objašnjava koji od tri pokazatelja zaslužuje prvo mjesto.</p>

<h3>3. Vrijeme po kategorijama</h3>
<p>Pokazatelj koji uvijek najviše iznenadi. Mislite da dane provodite stvarajući nešto, a raspodjela pokaže da administracija i sastanci odnose polovicu. To je jedini broj koji omogućuje iskren razgovor sa samim sobom o opterećenju, a za samostalce i temelj za bolje određivanje cijena.</p>

<h3>4. Napredak ciljeva</h3>
<p>Ako radite s <a href="/hr/blog/methode-okr-exemples">OKR-ovima</a>, to je napredak svakog ključnog rezultata. Ako ne, dovoljna je jednostavna procjena po cilju. Važna je <strong>putanja</strong>: na polovici tromjesečja cilj na 20 % nije „u zaostatku“, nego ga tiho napuštate. Ako to uočite rano, imate dvije mogućnosti: ubrzati ili od cilja izričito odustati. Obje su bolje od lutanja.</p>

<h3>5. Opterećenje nadolazećeg tjedna</h3>
<p>Broj sati već zauzetih u kalendaru u odnosu na sate koji su vam stvarno na raspolaganju. To je jedini pokazatelj okrenut prema naprijed, pa je i jedini koji problem sprječava umjesto da ga samo zabilježi. Tjedan s 45 zauzetih sati na 35 raspoloživih ne rješava se većom disciplinom, nego tako da nešto maknete prije nego što počne. Za <a href="/hr/za-menadzere">menadžera</a> to je isti pokazatelj primijenjen na tim: opterećenje se čita prije nego što ga podnesete, nikad poslije.</p>

<h3>6. Omjer planiranog i ostvarenog</h3>
<p>Od termina koje ste blokirali, koliko ste ih se držali? Taj omjer mjeri kvalitetu vašeg planiranja, a ne vašu vrijednost. Ako je dugo ispod 60 %, znači da su vam blokovi predugi, preoptimistični ili postavljeni u vrijeme kad niste slobodni. Prirodna je nadopuna <a href="/hr/blog/time-blocking-guide">time-blockinga</a>.</p>

<h2 id="a-retirer">Što treba maknuti</h2>
<ul>
<li><strong>Zbirne brojače.</strong> „1847 završenih zadataka“ ništa ne usmjerava. Zbroj nikad ne pada, pa nikad ne može upozoriti.</li>
<li><strong>Složene ocjene.</strong> „Ocjena produktivnosti“ od 100 bodova miješa neusporedive stvari: kad padne, ne znate što učiniti. Bolje je pet čitljivih brojeva nego jedan neproziran indeks.</li>
<li><strong>Usporedbe s drugima.</strong> Vaša ograničenja nisu njihova. Jedina korisna usporedba ste vi prije mjesec dana.</li>
<li><strong>Preduge vremenske nizove.</strong> Grafikon za tri godine spljošti nedavne promjene, a upravo na njih još možete utjecati. Dvanaest tjedana gotovo je uvijek dovoljno.</li>
</ul>

<h2 id="rythme">Koliko često gledati ploču</h2>
<p>Nadzorna ploča koju stalno gledate postaje vijesti na društvenoj mreži: zaokuplja pažnju, a ne donosi odluke. Dovoljna su dva termina.</p>
<ol>
<li><strong>Deset sekundi ujutro</strong> za opterećenje dana i navike koje treba označiti. Bez analize, samo okvir za dan.</li>
<li><strong>Petnaest minuta na kraju tjedna</strong> za pregled: stvarni kapacitet, vrijeme po kategorijama, napredak ciljeva i samo jedna odluka o prilagodbi za sljedeći tjedan. Samo jedna, jer upravo to pregled čini održivim na duge staze.</li>
</ol>

<h2 id="construire">Kako je složiti bez trošenja vikenda</h2>
<p>Mnogi nadzornu ploču slože u proračunskoj tablici. To je izvedivo i odlična je vježba da razjasnite što želite pratiti, ali ručni unos je dug: nakon šest tjedana podaci više nisu ažurni, a zastarjela ploča gora je od nikakve jer daje lažnu sigurnost.</p>
<p>Praktično pravilo: <strong>ručno pratite samo ono što nijedan alat ne može sam izračunati.</strong> Sve što proizlazi iz vaših zadataka, navika ili kalendara treba se popunjavati samo, inače ćete s vremenom odustati.</p>
<p>Upravo to radi <a href="/hr/">Cosmo</a>: nadzorna ploča prikazuje napredak dana, navike koje treba označiti, sljedeće događaje i krivulju postignutih ključnih rezultata, a stranica Statistika daje vrijeme uloženo po kategorijama i kako se mijenja. Prvih pet pokazatelja iz ovog članka tamo se čita bez ikakvog dodatnog unosa, proizlaze iz uobičajenog korištenja aplikacije. <a href="/hr/signup">Besplatno je</a>, a demo se otvara bez registracije, s podacima za 12 mjeseci, pa vidite kako ploča izgleda kad je popunjena.</p>

<h2 id="faq">Česta pitanja</h2>
<h3>Koliko pokazatelja najviše?</h3>
<p>Šest, sedam ako je baš nužno. Iznad toga više ne čitate, nego samo preletite pogledom. Nadzorna ploča koja ne stane na jedan zaslon već je podbacila.</p>
<h3>Treba li vrijeme pratiti u minutu?</h3>
<p>Ne. Raspodjela po kategorijama u blokovima od pola sata sasvim je dovoljna da otkrije neravnoteže. Praćenje u minutu troši više pažnje nego što je donosi.</p>
<h3>Što ako su mi svi pokazatelji u crvenom?</h3>
<p>Ništa ne optimizirajte. To je znak preopterećenosti, a ne loše metode: uklanjajte obveze dok nadolazeći tjedan ne stane u raspoložive sate, a zatim ponovno preuzmite upravljanje.</p>
`,
    },
  },
};
