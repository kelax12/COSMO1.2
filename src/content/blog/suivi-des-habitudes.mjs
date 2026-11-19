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
  slug: "suivi-des-habitudes",
  datePublished: "2026-08-12",
  dateModified: "2026-08-12",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["combien-de-temps-prendre-habitude","tableau-de-bord-productivite","methode-okr-exemples"],
  locales: {
    fr: {
      title: "Suivi des habitudes : ce qu'il faut mesurer (et ce qui décourage)",
      metaTitle: "Suivi des habitudes : quoi mesurer pour tenir dans la durée",
      description: "Streak, taux de complétion, heatmap : quels indicateurs de suivi des habitudes aident vraiment, lesquels sabotent la régularité, et comment bien démarrer.",
      readingMinutes: 8,
      faq: [
        ["Quel est le meilleur indicateur pour suivre une habitude ?", "Le taux de complétion sur une période glissante (4 à 12 semaines). Il tolère les jours manqués, contrairement au streak, et reflète la régularité réelle plutôt que la performance récente."],
        ["Le streak est-il utile ou contre-productif ?", "Les deux. Il motive tant qu'il monte, mais un streak cassé provoque souvent un abandon total, l'effet « tout ou rien ». Utilisez-le comme encouragement secondaire, jamais comme indicateur principal."],
        ["Combien d’habitudes suivre en même temps ?", "Deux ou trois au démarrage. Chaque habitude supplémentaire réduit la probabilité de toutes les tenir : le facteur limitant n'est pas la motivation mais le nombre de décisions quotidiennes que le système vous demande."],
      ],
      html: `
<p class="lead">Suivre ses habitudes, c'est cocher des cases, la partie facile. La difficulté est ailleurs : choisir <em>quoi</em> regarder. Selon l'indicateur mis en avant, le même suivi produit soit une régularité qui s'installe, soit un abandon au premier accroc. Voici ce que chaque indicateur mesure réellement, celui qu'il faut mettre au centre, et la façon de démarrer un suivi qui tienne au-delà de trois semaines.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Le suivi d'habitudes de Cosmo : tableau hebdomadaire des habitudes cochées, avec la série de jours consécutifs de chacune." /><figcaption>Le suivi d'habitudes de Cosmo : tableau hebdomadaire des habitudes cochées, avec la série de jours consécutifs de chacune. Capture du mode démo, données fictives.</figcaption></figure>

<h2 id="pourquoi">Pourquoi suivre, plutôt que simplement faire</h2>
<p>Le suivi ne sert pas à se noter. Il sert à trois choses précises, et si votre système n'en fournit aucune, il ne vaut pas le temps qu'il coûte :</p>
<ul>
<li><strong>Rendre la régularité visible.</strong> Notre mémoire est mauvaise juge : après une semaine irrégulière, on se souvient soit de l'échec, soit de l'exception. Une trace objective tranche.</li>
<li><strong>Détecter le mauvais calibrage tôt.</strong> Une habitude tenue à 30 % n'est pas un problème de motivation, c'est une habitude mal dimensionnée ou mal placée. Le chiffre le dit en trois semaines ; l'intuition met trois mois.</li>
<li><strong>Fournir un retour immédiat.</strong> Le bénéfice d'une habitude arrive dans des mois ; cocher donne un signal aujourd'hui. C'est ce qui fait tenir l'intervalle.</li>
</ul>

<h2 id="indicateurs">Les trois indicateurs, et ce qu'ils valent</h2>

<h3>Le streak : motivant, mais fragile</h3>
<p>Le nombre de jours consécutifs. Il fonctionne remarquablement bien tant qu'il monte, et c'est précisément son défaut. Un streak de 40 jours cassé un mardi produit chez beaucoup de gens un abandon complet, parce que l'indicateur retombe à zéro alors que la réalité, elle, vaut toujours 40 jours sur 41.</p>
<p>Utilisez-le comme encouragement, jamais comme juge. Et si vous y êtes sensible, adoptez la règle qui a fait ses preuves : <strong>ne jamais manquer deux fois de suite</strong>. Elle conserve le bénéfice du streak sans son effet falaise.</p>

<h3>Le taux de complétion : l'indicateur central</h3>
<p>Le pourcentage de fois où l'habitude a été tenue sur une période glissante, quatre à douze semaines. C'est celui qu'il faut mettre au centre, pour une raison simple : il tolère les jours manqués sans les effacer. Une habitude à 85 % est excellente ; à 60 %, elle est réelle mais fragile ; sous 50 %, elle n'existe pas encore et demande un ajustement, pas un effort supplémentaire.</p>
<p>Sa vraie force est comparative : le taux de ce mois face à celui du mois dernier vous dit si vous progressez, ce qu'aucun compteur cumulé ne peut faire.</p>

<h3>La heatmap : la vue qui révèle les motifs</h3>
<p>Une case par jour, colorée si l'habitude a été tenue, la représentation popularisée par le graphe de contributions GitHub. Son intérêt n'est pas esthétique : elle fait apparaître des <strong>motifs</strong> qu'aucun pourcentage ne montre. Des trous systématiques le week-end, une rupture nette à chaque déplacement, une dégradation progressive après six semaines : autant d'informations qui pointent vers une cause précise, donc vers une correction possible.</p>
<p>Sur 26 semaines (six mois, soit la durée au-delà de laquelle une habitude est généralement ancrée), la heatmap raconte une histoire lisible en trois secondes.</p>

<h2 id="pieges">Les quatre pièges du suivi</h2>
<ol>
<li><strong>Trop d'habitudes en même temps.</strong> C'est de loin la cause d'échec numéro un. Chaque habitude ajoutée diminue la probabilité de toutes les tenir, parce que le coût n'est pas l'effort de chacune mais le nombre de décisions quotidiennes. Deux ou trois, pas davantage, jusqu'à ce qu'elles ne demandent plus d'y penser.</li>
<li><strong>Des habitudes trop grosses.</strong> « Faire du sport une heure » échoue là où « mettre ses chaussures et sortir » réussit. Calibrez sur votre pire journée, pas sur votre meilleure : une habitude doit rester tenable un jour où tout va mal, sinon elle ne survivra pas à la première semaine difficile.</li>
<li><strong>Suivre un résultat au lieu d'une action.</strong> « Perdre 4 kg » n'est pas une habitude, c'est un objectif, et il ne se coche pas quotidiennement. Suivez l'action que vous contrôlez ; le résultat relève des <a href="/blog/methode-okr-exemples">OKR</a>, avec un horizon et des indicateurs différents.</li>
<li><strong>Confondre suivi et jugement.</strong> Un tableau majoritairement vide est une information sur le calibrage, pas un verdict sur vous. Le jour où le suivi devient une source de culpabilité, il cesse d'être un outil, et c'est à ce moment-là qu'on arrête de cocher.</li>
</ol>

<h2 id="demarrer">Démarrer un suivi qui tient</h2>
<ol>
<li><strong>Choisissez deux habitudes</strong>, dont une déjà presque acquise. Le succès rapide de la première porte la seconde.</li>
<li><strong>Attachez chacune à un déclencheur existant</strong> : après le café du matin, en fermant l'ordinateur, avant le dîner. Un horaire fixe fonctionne moins bien qu'un enchaînement avec ce que vous faites déjà.</li>
<li><strong>Cochez au moment même</strong>, pas le soir de mémoire. Un suivi reconstitué est faux, et un suivi faux ne sert plus à décider.</li>
<li><strong>Ne jugez rien avant trois semaines.</strong> Les deux premières mesurent l'installation, pas l'habitude.</li>
<li><strong>À la quatrième semaine, regardez le taux de complétion</strong> et ajustez une seule chose : la taille de l'habitude, ou son moment. Jamais les deux, sinon vous ne saurez pas ce qui a fonctionné.</li>
</ol>
<p>Sur la durée nécessaire avant qu'une habitude devienne automatique, l'article <a href="/blog/combien-de-temps-prendre-habitude">combien de temps pour ancrer une habitude</a> détaille ce que dit réellement la recherche, et pourquoi le chiffre de 21 jours est un mythe tenace. Sur un rythme scolaire, où le calendrier impose ses propres pics, la page <a href="/pour-etudiants">Cosmo pour les étudiants</a> montre la même mécanique appliquée aux révisions.</p>

<h2 id="pratique">Le suivi des habitudes dans Cosmo</h2>
<p>Dans <a href="/">Cosmo</a>, une habitude se crée avec sa fréquence (quotidienne, hebdomadaire ou jours précis) et se coche en un geste. Les trois indicateurs de cet article sont fournis d'office : heatmap 26 semaines, streak et taux de complétion sur la période choisie, avec le taux mis en avant plutôt que le streak, exactement pour la raison décrite plus haut.</p>
<p>Le reste vient de l'intégration : vos habitudes apparaissent sur le même <a href="/blog/tableau-de-bord-productivite">tableau de bord</a> que vos tâches du jour et vos objectifs, ce qui évite l'application de suivi supplémentaire qu'on oublie d'ouvrir au bout d'un mois. <a href="/signup">C'est gratuit</a>, et la démo s'ouvre sans inscription avec 100 habitudes et plusieurs mois d'historique pour voir à quoi ressemblent ces courbes une fois remplies.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Faut-il suivre ses habitudes sur papier ou dans une application ?</h3>
<p>Le papier suffit pour deux ou trois habitudes et a l'avantage d'être immédiat. L'application devient nettement supérieure dès qu'on veut comparer des périodes ou repérer des motifs, le calcul manuel du taux de complétion est exactement le genre de corvée qui fait abandonner un suivi.</p>
<h3>Que faire après une longue interruption ?</h3>
<p>Reprendre à une version réduite de l'habitude, pas à celle d'avant. Repartir au niveau d'origine après trois semaines d'arrêt échoue presque toujours, et l'échec confirme à tort qu'on « n'y arrive pas ».</p>
<h3>Quand peut-on arrêter de suivre une habitude ?</h3>
<p>Quand l'oublier devient inconfortable, c'est le signe que le comportement s'est automatisé. Vous pouvez alors la retirer du suivi et libérer la place pour la suivante.</p>
`,
    },
    en: {
      title: "Habit tracking: what to measure (and what discourages you)",
      metaTitle: "Habit tracking: what to measure to keep going",
      description: "Streaks, completion rate, heatmaps: which habit-tracking indicators genuinely help, which sabotage consistency, and how to start properly.",
      readingMinutes: 8,
      faq: [
        ["What is the best indicator for tracking a habit?", "The completion rate over a rolling period of 4 to 12 weeks. It tolerates missed days, unlike a streak, and reflects real consistency rather than recent performance."],
        ["Are streaks useful or counterproductive?", "Both. A streak motivates while it climbs, but a broken streak often triggers a complete abandonment, the all-or-nothing effect. Use it as secondary encouragement, never as the main indicator."],
        ["How many habits should you track at once?", "Two or three at the start. Every extra habit lowers the probability of keeping all of them: the limiting factor is not motivation but the number of daily decisions your system asks of you."],
      ],
      html: `
<p class="lead">Tracking habits means ticking boxes, and that is the easy part. The difficulty lies elsewhere: choosing <em>what</em> to look at. Depending on which indicator you put front and centre, the same tracking produces either consistency that settles in, or abandonment at the first slip. Here is what each indicator actually measures, which one belongs at the centre, and how to start a tracking practice that lasts beyond three weeks.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days." /><figcaption>Cosmo's habit tracker: a weekly grid of checked habits, with each habit's streak of consecutive days. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="pourquoi">Why track, rather than simply do</h2>
<p>Tracking is not there to grade you. It serves three precise purposes, and if your system delivers none of them it is not worth the time it costs:</p>
<ul>
<li><strong>Making consistency visible.</strong> Memory is a poor judge: after an irregular week you remember either the failure or the exception. An objective record settles it.</li>
<li><strong>Detecting bad calibration early.</strong> A habit kept 30 % of the time is not a motivation problem, it is a badly sized or badly placed habit. The number says so in three weeks, intuition takes three months.</li>
<li><strong>Providing immediate feedback.</strong> The benefit of a habit arrives in months, ticking gives a signal today. That is what carries you across the gap.</li>
</ul>

<h2 id="indicateurs">The three indicators, and what each is worth</h2>

<h3>The streak: motivating, but fragile</h3>
<p>The number of consecutive days. It works remarkably well while it climbs, and that is precisely its flaw. A 40-day streak broken on a Tuesday produces, in a lot of people, a complete abandonment, because the indicator drops to zero while reality still stands at 40 days out of 41.</p>
<p>Use it as encouragement, never as a judge. And if you are sensitive to it, adopt the rule that has proven itself: <strong>never miss twice in a row</strong>. It keeps the benefit of the streak without its cliff edge.</p>

<h3>The completion rate: the central indicator</h3>
<p>The percentage of times the habit was kept over a rolling period of four to twelve weeks. This is the one to put at the centre, for a simple reason: it tolerates missed days without erasing them. A habit at 85 % is excellent, at 60 % it is real but fragile, below 50 % it does not exist yet and needs an adjustment rather than extra effort.</p>
<p>Its real strength is comparative: this month's rate against last month's tells you whether you are improving, which no cumulative counter can do.</p>

<h3>The heatmap: the view that reveals patterns</h3>
<p>One cell per day, coloured if the habit was kept, the representation popularised by the GitHub contribution graph. Its value is not aesthetic: it surfaces <strong>patterns</strong> that no percentage shows. Systematic gaps at weekends, a clean break every time you travel, a gradual decline after six weeks. Each of those points at a precise cause, and therefore at a possible correction.</p>
<p>Over 26 weeks (six months, beyond which a habit is generally anchored), the heatmap tells a story you can read in three seconds.</p>

<h2 id="pieges">The four traps of tracking</h2>
<ol>
<li><strong>Too many habits at once.</strong> This is by far the number one cause of failure. Every habit added lowers the probability of keeping all of them, because the cost is not the effort of each one but the number of daily decisions. Two or three, no more, until they no longer require thinking about.</li>
<li><strong>Habits that are too big.</strong> "Exercise for an hour" fails where "put your shoes on and go outside" succeeds. Calibrate on your worst day, not your best: a habit has to stay doable on a day when everything is going wrong, otherwise it will not survive the first difficult week.</li>
<li><strong>Tracking an outcome instead of an action.</strong> "Lose 4 kg" is not a habit, it is a goal, and it cannot be ticked daily. Track the action you control. The outcome belongs to <a href="/en/blog/methode-okr-exemples">OKRs</a>, with a different horizon and different indicators.</li>
<li><strong>Confusing tracking with judgement.</strong> A largely empty grid is information about calibration, not a verdict on you. The day tracking becomes a source of guilt it stops being a tool, and that is the moment people stop ticking.</li>
</ol>

<h2 id="demarrer">Starting a tracking practice that lasts</h2>
<ol>
<li><strong>Choose two habits</strong>, one of which you almost have already. The quick success of the first carries the second.</li>
<li><strong>Attach each one to an existing trigger</strong>: after the morning coffee, when you close the laptop, before dinner. A fixed time of day works less well than chaining onto something you already do.</li>
<li><strong>Tick at the moment itself</strong>, not in the evening from memory. Reconstructed tracking is wrong, and wrong tracking is no longer useful for deciding.</li>
<li><strong>Judge nothing before three weeks.</strong> The first two measure the installation, not the habit.</li>
<li><strong>In week four, look at the completion rate</strong> and adjust one single thing: the size of the habit, or its moment. Never both, or you will not know what worked.</li>
</ol>
<p>On how long it takes before a habit becomes automatic, the article on <a href="/en/blog/combien-de-temps-prendre-habitude">how long it takes to build a habit</a> sets out what the research actually says, and why the 21-day figure is a stubborn myth. On an academic rhythm, where the calendar imposes its own peaks, the <a href="/en/for-students">Cosmo for students</a> page shows the same mechanics applied to revision.</p>

<h2 id="pratique">Habit tracking in Cosmo</h2>
<p>In <a href="/en/">Cosmo</a>, a habit is created with its frequency (daily, weekly or specific days) and ticked in one gesture. The three indicators in this article come as standard: a 26-week heatmap, the streak and the completion rate over the chosen period, with the rate given prominence rather than the streak, for exactly the reason described above.</p>
<p>The rest comes from the integration: your habits appear on the same <a href="/en/blog/tableau-de-bord-productivite">dashboard</a> as your tasks for the day and your goals, which avoids the extra tracking app that everybody forgets to open after a month. <a href="/en/signup">It is free</a>, and the demo opens with no sign-up, with 100 habits and several months of history so you can see what these curves look like once filled in.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Should you track habits on paper or in an app?</h3>
<p>Paper is enough for two or three habits and has the advantage of being immediate. An app becomes clearly better as soon as you want to compare periods or spot patterns, and computing a completion rate by hand is exactly the kind of chore that makes people abandon tracking.</p>
<h3>What do you do after a long interruption?</h3>
<p>Restart at a reduced version of the habit, not the one from before. Going straight back to the original level after three weeks off almost always fails, and the failure wrongly confirms that you "cannot do it".</p>
<h3>When can you stop tracking a habit?</h3>
<p>When forgetting it feels uncomfortable, which is the sign that the behaviour has become automatic. You can then drop it from tracking and free the slot for the next one.</p>
`,
    },
    hr: {
      title: "Praćenje navika: što mjeriti (a što obeshrabruje)",
      metaTitle: "Praćenje navika: što mjeriti da biste ustrajali",
      description: "Niz, postotak izvršenja, toplinska karta: koji pokazatelji praćenja navika stvarno pomažu, koji kvare ustrajnost i kako dobro započeti.",
      readingMinutes: 8,
      faq: [
        ["Koji je najbolji pokazatelj za praćenje navike?", "Postotak izvršenja u kliznom razdoblju (4 do 12 tjedana). Za razliku od niza, podnosi propuštene dane i odražava stvarnu ustrajnost, a ne samo nedavni učinak."],
        ["Je li niz koristan ili kontraproduktivan?", "I jedno i drugo. Motivira dok raste, ali prekinuti niz često izazove potpuno odustajanje, učinak „sve ili ništa“. Koristite ga kao sporedni poticaj, nikad kao glavni pokazatelj."],
        ["Koliko navika pratiti istovremeno?", "Dvije ili tri na početku. Svaka dodatna navika smanjuje vjerojatnost da ćete se držati svih: ograničavajući čimbenik nije motivacija, nego broj svakodnevnih odluka koje sustav od vas traži."],
      ],
      html: `
<p class="lead">Praćenje navika znači označavanje kućica, a to je lakši dio. Teškoća je drugdje: odabrati <em>što</em> gledati. Ovisno o pokazatelju koji stavite u prvi plan, isto praćenje donosi ili ustrajnost koja se učvršćuje ili odustajanje pri prvom posrtaju. Evo što svaki pokazatelj stvarno mjeri, koji treba biti u središtu i kako započeti praćenje koje traje dulje od tri tjedna.</p>
<figure><img src="/screenshots/habitudes.webp" srcset="/screenshots/habitudes-800.webp 800w, /screenshots/habitudes.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Praćenje navika u Cosmu: tjedna tablica označenih navika s nizom uzastopnih dana za svaku." /><figcaption>Praćenje navika u Cosmu: tjedna tablica označenih navika s nizom uzastopnih dana za svaku. Snimka zaslona demo načina rada, izmišljeni podaci.</figcaption></figure>

<h2 id="pourquoi">Zašto pratiti, a ne samo raditi</h2>
<p>Praćenje ne služi tome da sami sebe ocjenjujete. Služi za tri konkretne stvari, a ako vaš sustav ne pruža nijednu od njih, nije vrijedan vremena koje oduzima:</p>
<ul>
<li><strong>Učiniti ustrajnost vidljivom.</strong> Pamćenje je loš sudac: nakon neujednačenog tjedna sjećate se ili neuspjeha ili iznimke. Objektivan zapis presuđuje.</li>
<li><strong>Rano otkriti loše odmjerenu naviku.</strong> Navika koju održavate u 30 % slučajeva nije problem motivacije, nego navika loše veličine ili na lošem mjestu. Broj to pokaže za tri tjedna, a intuiciji trebaju tri mjeseca.</li>
<li><strong>Dati trenutačnu povratnu informaciju.</strong> Korist od navike stiže za nekoliko mjeseci, a označavanje daje signal danas. Upravo to vas održi u međuvremenu.</li>
</ul>

<h2 id="indicateurs">Tri pokazatelja i koliko vrijede</h2>

<h3>Niz: motivira, ali je krhak</h3>
<p>Broj uzastopnih dana. Izvanredno djeluje dok raste, i upravo je to njegova mana. Niz od 40 dana prekinut u utorak kod mnogih ljudi izazove potpuno odustajanje, jer pokazatelj padne na nulu, a stvarnost je i dalje 40 dana od 41.</p>
<p>Koristite ga kao poticaj, nikad kao suca. Ako ste na njega osjetljivi, prihvatite provjereno pravilo: <strong>nikad ne propustite dva puta zaredom</strong>. Tako zadržavate korist od niza bez njegova učinka litice.</p>

<h3>Postotak izvršenja: središnji pokazatelj</h3>
<p>Postotak puta kada ste održali naviku u kliznom razdoblju od četiri do dvanaest tjedana. Njega treba staviti u središte, iz jednostavnog razloga: podnosi propuštene dane, a ne briše ih. Navika na 85 % je izvrsna; na 60 % je stvarna, ali krhka; ispod 50 % još ne postoji i traži prilagodbu, a ne dodatni trud.</p>
<p>Njegova je prava snaga u usporedbi: postotak ovog mjeseca u odnosu na prošli govori napredujete li, a to nijedan zbirni brojač ne može.</p>

<h3>Toplinska karta: prikaz koji otkriva obrasce</h3>
<p>Jedno polje po danu, obojeno ako je navika održana, prikaz koji je popularizirao GitHubov graf doprinosa. Njegova vrijednost nije estetska: otkriva <strong>obrasce</strong> koje nijedan postotak ne pokazuje. Sustavne rupe vikendom, jasan prekid pri svakom putovanju, postupno slabljenje nakon šest tjedana: sve su to informacije koje upućuju na konkretan uzrok, a time i na moguću ispravku.</p>
<p>Kroz 26 tjedana (šest mjeseci, nakon čega je navika uglavnom učvršćena) toplinska karta priča priču koju pročitate za tri sekunde.</p>

<h2 id="pieges">Četiri zamke praćenja</h2>
<ol>
<li><strong>Previše navika odjednom.</strong> To je daleko najčešći uzrok neuspjeha. Svaka dodana navika smanjuje vjerojatnost da ćete se držati svih, jer cijena nije trud svake pojedine, nego broj svakodnevnih odluka. Dvije ili tri, ne više, dok o njima više ne budete morali razmišljati.</li>
<li><strong>Prevelike navike.</strong> „Vježbati sat vremena“ ne uspijeva ondje gdje „obuti tenisice i izaći van“ uspijeva. Odmjerite naviku prema svom najgorem danu, a ne najboljem: mora ostati izvediva i kad sve ide naopako, inače neće preživjeti prvi težak tjedan.</li>
<li><strong>Praćenje rezultata umjesto radnje.</strong> „Smršavjeti 4 kg“ nije navika, nego cilj, i ne može se označavati svaki dan. Pratite radnju koju kontrolirate; rezultat pripada <a href="/hr/blog/methode-okr-exemples">OKR-ovima</a>, s drugačijim vremenskim okvirom i pokazateljima.</li>
<li><strong>Brkanje praćenja i osude.</strong> Uglavnom prazna tablica informacija je o odmjeravanju, a ne presuda o vama. Onoga dana kad praćenje postane izvor krivnje, prestaje biti alat, i tada se prestaje označavati.</li>
</ol>

<h2 id="demarrer">Kako započeti praćenje koje traje</h2>
<ol>
<li><strong>Odaberite dvije navike</strong>, od kojih je jedna gotovo već usvojena. Brzi uspjeh prve nosi drugu.</li>
<li><strong>Vežite svaku uz postojeći okidač</strong>: nakon jutarnje kave, kad zatvorite laptop, prije večere. Fiksno vrijeme djeluje slabije od nadovezivanja na nešto što već radite.</li>
<li><strong>Označite odmah</strong>, a ne navečer po sjećanju. Naknadno rekonstruirano praćenje je netočno, a netočno praćenje više ne pomaže u odlučivanju.</li>
<li><strong>Ništa ne prosuđujte prije tri tjedna.</strong> Prva dva mjere uhodavanje, a ne naviku.</li>
<li><strong>U četvrtom tjednu pogledajte postotak izvršenja</strong> i prilagodite samo jednu stvar: veličinu navike ili njezin trenutak. Nikad oboje, inače nećete znati što je upalilo.</li>
</ol>
<p>O tome koliko treba da navika postane automatska, članak <a href="/hr/blog/combien-de-temps-prendre-habitude">koliko treba za stvaranje navike</a> donosi što istraživanja zaista kažu i zašto je broj od 21 dan uporan mit. Za školski ritam, u kojem kalendar nameće vlastite vrhunce, stranica <a href="/hr/za-studente">Cosmo za studente</a> pokazuje isti mehanizam primijenjen na učenje.</p>

<h2 id="pratique">Praćenje navika u Cosmu</h2>
<p>U <a href="/hr/">Cosmu</a> se navika stvara zajedno s učestalošću (dnevno, tjedno ili određenim danima) i označava jednim potezom. Sva tri pokazatelja iz ovog članka dostupna su odmah: toplinska karta od 26 tjedana, niz i postotak izvršenja za odabrano razdoblje, pri čemu je postotak istaknut ispred niza, upravo iz gore opisanog razloga.</p>
<p>Ostalo donosi integracija: vaše se navike prikazuju na istoj <a href="/hr/blog/tableau-de-bord-productivite">nadzornoj ploči</a> kao i današnji zadaci i ciljevi, pa vam ne treba još jedna aplikacija za praćenje koju nakon mjesec dana zaboravite otvoriti. <a href="/hr/signup">Besplatno je</a>, a demo se otvara bez registracije, sa 100 navika i nekoliko mjeseci povijesti, da vidite kako te krivulje izgledaju kad se popune.</p>

<h2 id="faq">Česta pitanja</h2>
<h3>Pratiti navike na papiru ili u aplikaciji?</h3>
<p>Papir je dovoljan za dvije ili tri navike i ima prednost neposrednosti. Aplikacija postaje znatno bolja čim želite uspoređivati razdoblja ili uočavati obrasce, a ručno računanje postotka izvršenja upravo je ona vrsta gnjavaže zbog koje se odustaje od praćenja.</p>
<h3>Što učiniti nakon duže stanke?</h3>
<p>Nastavite sa smanjenom verzijom navike, a ne s onom od prije. Povratak na izvornu razinu nakon tri tjedna pauze gotovo uvijek propadne, a neuspjeh pogrešno potvrdi da vam „ne ide“.</p>
<h3>Kada možete prestati pratiti naviku?</h3>
<p>Kada vam postane neugodno ako je zaboravite, to je znak da se ponašanje automatiziralo. Tada je možete maknuti s popisa i osloboditi mjesto za sljedeću.</p>
`,
    },
  },
};
