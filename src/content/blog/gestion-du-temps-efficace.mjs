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
  slug: "gestion-du-temps-efficace",
  datePublished: "2026-08-12",
  dateModified: "2026-08-12",
  // Suite de lecture : choisie par proximité de sujet, pas par date. Le tri
  // par récence envoyait les mêmes 3 liens depuis les 11 articles, ce qui
  // laissait 4 d'entre eux sans aucun lien entrant interne.
  related: ["time-blocking-guide","matrice-eisenhower","cosmo-vs-todoist"],
  locales: {
    fr: {
      title: "Gestion du temps efficace : 7 principes qui tiennent dans la durée",
      metaTitle: "Gestion du temps efficace : 7 principes qui tiennent",
      description: "Les 7 principes de gestion du temps qui survivent à une semaine chargée, sans méthode compliquée : arbitrage, créneaux, unité de travail, revue hebdomadaire.",
      readingMinutes: 9,
      faq: [
        ["Quelle est la méthode de gestion du temps la plus efficace ?", "Celle que vous tenez trois mois. En pratique, la combinaison qui résiste le mieux est : une liste unique, un arbitrage explicite des priorités, et des créneaux réservés dans l'agenda pour ce qui compte vraiment."],
        ["Comment gérer son temps quand tout est urgent ?", "Tout ne peut pas être urgent : c'est presque toujours le symptôme d'une absence d'arbitrage. Classez sur deux axes (urgent / important), traitez le quadrant 1, et surtout réservez un créneau pour le quadrant 2, c'est lui qui produit les urgences de la semaine prochaine."],
        ["Combien de temps faut-il pour voir un résultat ?", "Deux à trois semaines pour sentir la différence sur la charge mentale, six à huit pour que le système tienne sans effort conscient. En dessous, on juge un système sur sa période d'installation."],
      ],
      html: `
<p class="lead">La gestion du temps souffre d'un malentendu : on la présente comme un problème de technique, alors que c'est d'abord un problème d'arbitrage. Aucune méthode ne fait entrer soixante heures de travail dans une semaine de trente-cinq. Ce qu'une bonne méthode fait, en revanche, c'est rendre visible ce qui ne rentre pas, assez tôt pour décider quoi abandonner. Voici sept principes qui survivent à une semaine chargée, du plus structurant au plus fin.</p>
<figure><img src="/screenshots/agenda.webp" srcset="/screenshots/agenda-800.webp 800w, /screenshots/agenda.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="L'agenda de Cosmo en vue semaine : les tâches à planifier sont listées à gauche et se glissent dans un créneau." /><figcaption>L'agenda de Cosmo en vue semaine : les tâches à planifier sont listées à gauche et se glissent dans un créneau. Capture du mode démo, données fictives.</figcaption></figure>

<h2 id="arbitrage">1. Accepter que gérer son temps, c'est renoncer</h2>
<p>C'est le principe dont découlent tous les autres, et le seul qui soit vraiment difficile. Une semaine contient un nombre fixe d'heures utiles, pour la plupart des gens, entre trente et quarante en comptant honnêtement. Toute méthode qui promet de « faire plus » sans rien retirer déplace simplement le moment où vous constaterez que ça ne rentrait pas.</p>
<p>Conséquence pratique : chaque fois que vous acceptez quelque chose de nouveau, nommez ce que ça déplace. Pas mentalement, dans votre liste. Un engagement pris sans contrepartie identifiée est un engagement qui sera tenu au détriment de quelque chose que vous n'avez pas choisi.</p>

<h2 id="liste-unique">2. Une seule liste, pas quatre</h2>
<p>Des tâches dans un carnet, d'autres dans les emails non lus, d'autres encore dans des messages qu'on se laisse à soi-même : la charge mentale ne vient pas du volume de travail, elle vient de l'incertitude sur ce qu'on a oublié. Tant que la liste n'est pas unique, une partie de votre attention reste occupée à surveiller les autres.</p>
<p>Le regroupement compte plus que l'outil choisi. Une seule liste sur papier bat trois applications parfaites. Si le choix de l'outil vous bloque malgré tout, le <a href="/blog/cosmo-vs-todoist">comparatif Cosmo / Todoist</a> pose les critères qui comptent vraiment.</p>

<h2 id="arbitrer">3. Arbitrer explicitement, pas au feeling</h2>
<p>Sans critère écrit, « prioriser » revient à traiter ce qui crie le plus fort. Deux questions suffisent pour chaque tâche : <strong>est-ce urgent ?</strong> et <strong>est-ce important ?</strong>, c'est la <a href="/blog/matrice-eisenhower">matrice Eisenhower</a>, et son intérêt n'est pas le classement en lui-même mais le fait de forcer la question « important par rapport à quoi ? ».</p>
<p>C'est là que des objectifs explicites deviennent utiles : sans eux, tout paraît important et l'arbitrage ne filtre plus rien. Deux à quatre objectifs pour le trimestre suffisent à trancher 80 % des cas.</p>

<h2 id="creneaux">4. Ce qui n'a pas de créneau n'existe pas</h2>
<p>Une tâche importante mais non urgente perdra toujours contre une urgence, indéfiniment, quelle que soit votre discipline. La seule protection qui fonctionne est physique : lui donner une place dans l'agenda, au même titre qu'un rendez-vous avec quelqu'un d'autre.</p>
<p>C'est le principe du <a href="/blog/time-blocking-guide">time-blocking</a>, et son bénéfice secondaire est aussi précieux que le premier : en posant vos tâches dans des créneaux, vous découvrez immédiatement ce qui ne tient pas dans la semaine, avant de vous être engagé, pas après.</p>

<h2 id="unite">5. Travailler par unités, pas en continu</h2>
<p>L'attention soutenue se compte en blocs de vingt à quatre-vingt-dix minutes selon les personnes et les tâches, pas en journées. Deux conséquences concrètes :</p>
<ul>
<li><strong>Regroupez ce qui est de même nature.</strong> Les emails en deux blocs par jour plutôt qu'en continu, les appels d'affilée, l'administratif sur une plage unique. Chaque changement de contexte coûte plusieurs minutes de remise en route, un coût invisible et considérable quand on l'accumule.</li>
<li><strong>Protégez le début de bloc.</strong> Les premières minutes déterminent le reste : savoir exactement par quoi commencer vaut mieux que dix minutes de plus. D'où l'intérêt de découper les tâches jusqu'à ce que la première action soit évidente.</li>
</ul>

<h2 id="frottement">6. Réduire le frottement plutôt que compter sur la volonté</h2>
<p>La volonté est une ressource variable, le frottement est constant. Si une tâche demande d'ouvrir trois outils et de retrouver un mot de passe avant de commencer, elle sera repoussée, non par paresse, mais par coût d'entrée. Inversement, ce qui est à portée immédiate se fait.</p>
<p>Cela vaut pour le système lui-même : une méthode qui exige quinze minutes de maintenance quotidienne sera abandonnée en trois semaines, quelle que soit sa qualité théorique. La bonne question n'est pas « quelle est la meilleure méthode ? » mais « laquelle vais-je encore utiliser dans trois mois ? ».</p>

<h2 id="revue">7. Une revue hebdomadaire, courte et non négociable</h2>
<p>C'est le principe le plus souvent abandonné, et celui qui fait tenir tous les autres. Quinze à vingt minutes en fin de semaine :</p>
<ol>
<li>Ce qui a été terminé, et surtout ce qui a été planifié sans être fait, ce qui renseigne sur votre calibrage réel.</li>
<li>Où est parti le temps, par grande catégorie. C'est souvent la surprise de la semaine.</li>
<li>Où en sont les objectifs de fond, en trajectoire plutôt qu'en pourcentage exact.</li>
<li><strong>Un seul</strong> ajustement pour la semaine suivante. Un, pas cinq : c'est ce qui rend la revue tenable.</li>
</ol>
<p>Sans ce rendez-vous, un système d'organisation dérive en quelques semaines sans que personne ne s'en aperçoive, parce que rien, dans une semaine ordinaire, ne vous force à lever la tête.</p>

<h2 id="pratique">Mettre les 7 principes en place concrètement</h2>
<p>Aucun de ces principes n'exige un outil particulier ; tous exigent que les données soient au même endroit. C'est ce qui rend l'empilement d'applications coûteux : la revue hebdomadaire devient un travail de collecte, donc elle saute. Les <a href="/pour-freelances">freelances</a> le vivent plus durement que les autres : personne d'autre ne tiendra le cadre à leur place. Et si un terme croisé ici vous est étranger, le <a href="/blog/glossaire-productivite">glossaire de la productivité</a> les définit tous.</p>
<p><a href="/">Cosmo</a> a été construit sur cette contrainte : une liste unique avec priorités et catégories, un agenda qui accepte le glisser-déposer des tâches pour le time-blocking, des habitudes pour ce qui doit devenir automatique, des <a href="/blog/methode-okr-exemples">OKR</a> pour définir ce que « important » veut dire ce trimestre, et un <a href="/blog/tableau-de-bord-productivite">tableau de bord</a> qui rend la revue du vendredi possible en quinze minutes, sans ressaisie. <a href="/signup">Gratuit</a>, démo accessible sans inscription.</p>

<h2 id="faq">Questions fréquentes</h2>
<h3>Par quel principe commencer ?</h3>
<p>Le deuxième : regrouper tout dans une liste unique. Il ne demande aucune méthode et produit le soulagement le plus immédiat. Les autres s'ajoutent ensuite, un par semaine.</p>
<h3>Faut-il planifier chaque minute de sa journée ?</h3>
<p>Non, et c'est contre-productif. Réservez les deux ou trois blocs qui comptent vraiment et laissez le reste ouvert : une journée planifiée à 100 % ne survit pas au premier imprévu, et on abandonne alors le plan entier.</p>
<h3>Que faire quand la semaine dérape complètement ?</h3>
<p>Ne pas rattraper. Reprendre à la revue suivante comme si de rien n'était. Les systèmes d'organisation ne meurent pas d'une mauvaise semaine, ils meurent de la tentative de compenser la mauvaise semaine.</p>
`,
    },
    en: {
      title: "Effective time management: 7 principles that last",
      metaTitle: "Effective time management: 7 principles that hold up",
      description: "The 7 time-management principles that survive a busy week, with no complicated method: trade-offs, calendar slots, work units, the weekly review.",
      readingMinutes: 9,
      faq: [
        ["What is the most effective time-management method?", "The one you keep for three months. In practice the combination that holds up best is: a single list, an explicit trade-off on priorities, and reserved calendar slots for what genuinely matters."],
        ["How do you manage your time when everything is urgent?", "Everything cannot be urgent: that is almost always the symptom of a missing trade-off. Sort on two axes (urgent and important), handle quadrant 1, and above all reserve a slot for quadrant 2, because that is what produces next week's emergencies."],
        ["How long before you see a result?", "Two to three weeks to feel the difference in mental load, six to eight for the system to hold without conscious effort. Below that you are judging a system on its installation period."],
      ],
      html: `
<p class="lead">Time management suffers from a misunderstanding: it is presented as a problem of technique, when it is first of all a problem of trade-offs. No method fits sixty hours of work into a thirty-five hour week. What a good method does instead is make visible what does not fit, early enough for you to decide what to drop. Here are seven principles that survive a busy week, from the most structural to the most granular.</p>
<figure><img src="/screenshots/agenda.webp" srcset="/screenshots/agenda-800.webp 800w, /screenshots/agenda.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Cosmo's calendar in week view: tasks waiting to be scheduled are listed on the left and dragged into a time slot." /><figcaption>Cosmo's calendar in week view: tasks waiting to be scheduled are listed on the left and dragged into a time slot. Screenshot of the demo mode, sample data.</figcaption></figure>

<h2 id="arbitrage">1. Accept that managing your time means giving things up</h2>
<p>This is the principle all the others follow from, and the only genuinely hard one. A week contains a fixed number of useful hours, for most people between thirty and forty when counted honestly. Any method that promises to "do more" without removing anything simply postpones the moment you discover it did not fit.</p>
<p>The practical consequence: every time you accept something new, name what it displaces. Not mentally, in your list. A commitment made without an identified counterpart is a commitment that will be kept at the expense of something you did not choose.</p>

<h2 id="liste-unique">2. One list, not four</h2>
<p>Tasks in a notebook, others in unread email, others again in messages you send yourself: mental load does not come from the volume of work, it comes from uncertainty about what you have forgotten. As long as the list is not single, part of your attention stays busy watching the others.</p>
<p>Consolidating matters more than which tool you pick. One list on paper beats three perfect apps. If the choice of tool is blocking you anyway, the <a href="/en/blog/cosmo-vs-todoist">Cosmo and Todoist comparison</a> sets out the criteria that actually count.</p>

<h2 id="arbitrer">3. Make trade-offs explicitly, not by feel</h2>
<p>With no written criterion, "prioritising" amounts to handling whatever shouts loudest. Two questions are enough for each task: <strong>is it urgent?</strong> and <strong>is it important?</strong> That is the <a href="/en/blog/matrice-eisenhower">Eisenhower matrix</a>, and its value is not the sorting itself but the fact that it forces the question "important relative to what?".</p>
<p>This is where explicit goals become useful: without them everything looks important and the trade-off stops filtering anything. Two to four goals for the quarter are enough to settle 80 % of cases.</p>

<h2 id="creneaux">4. What has no slot does not exist</h2>
<p>An important but non-urgent task will always lose to an emergency, indefinitely, whatever your discipline. The only protection that works is physical: give it a place in the calendar, on the same footing as an appointment with somebody else.</p>
<p>That is the principle of <a href="/en/blog/time-blocking-guide">time-blocking</a>, and its secondary benefit is as valuable as the first: by placing your tasks in slots, you discover immediately what does not fit in the week, before you have committed rather than after.</p>

<h2 id="unite">5. Work in units, not continuously</h2>
<p>Sustained attention is counted in blocks of twenty to ninety minutes depending on the person and the task, not in days. Two concrete consequences:</p>
<ul>
<li><strong>Group what is of the same nature.</strong> Email in two blocks a day rather than continuously, calls back to back, admin in a single stretch. Every context switch costs several minutes of spinning back up, an invisible and considerable cost once accumulated.</li>
<li><strong>Protect the start of a block.</strong> The first minutes determine the rest: knowing exactly what to begin with is worth more than ten extra minutes. Hence the value of splitting tasks until the first action is obvious.</li>
</ul>

<h2 id="frottement">6. Reduce friction rather than relying on willpower</h2>
<p>Willpower is a variable resource, friction is constant. If a task requires opening three tools and finding a password before you can start, it will be postponed, not out of laziness but because of the cost of entry. Conversely, what is immediately at hand gets done.</p>
<p>The same applies to the system itself: a method that demands fifteen minutes of daily maintenance will be abandoned within three weeks, whatever its theoretical quality. The right question is not "which is the best method?" but "which one will I still be using in three months?".</p>

<h2 id="revue">7. A weekly review, short and non-negotiable</h2>
<p>This is the most frequently abandoned principle, and the one that holds all the others up. Fifteen to twenty minutes at the end of the week:</p>
<ol>
<li>What was finished, and above all what was planned without being done, which tells you about your real calibration.</li>
<li>Where the time went, by broad category. This is often the surprise of the week.</li>
<li>Where the underlying goals stand, as a trajectory rather than an exact percentage.</li>
<li><strong>A single</strong> adjustment for the following week. One, not five: that is what makes the review sustainable.</li>
</ol>
<p>Without that appointment, an organisation system drifts within a few weeks and nobody notices, because nothing in an ordinary week forces you to look up.</p>

<h2 id="pratique">Putting the 7 principles in place</h2>
<p>None of these principles requires a particular tool, but all of them require the data to be in one place. That is what makes a stack of applications expensive: the weekly review turns into a collection job, so it gets skipped. <a href="/en/for-freelancers">Freelancers</a> feel this more harshly than most, because nobody else will hold the frame for them. And if a term used here is unfamiliar, the <a href="/en/blog/glossaire-productivite">productivity glossary</a> defines them all.</p>
<p><a href="/en/">Cosmo</a> was built on that constraint: a single list with priorities and categories, a calendar that accepts tasks dragged in for time-blocking, habits for what should become automatic, <a href="/en/blog/methode-okr-exemples">OKRs</a> to define what "important" means this quarter, and a <a href="/en/blog/tableau-de-bord-productivite">dashboard</a> that makes the Friday review possible in fifteen minutes with no re-entry. <a href="/en/signup">Free</a>, with a demo you can open without signing up.</p>

<h2 id="faq">Frequently asked questions</h2>
<h3>Which principle should you start with?</h3>
<p>The second one: bring everything into a single list. It requires no method and produces the most immediate relief. The others get added afterwards, one a week.</p>
<h3>Should you plan every minute of your day?</h3>
<p>No, and it is counterproductive. Reserve the two or three blocks that genuinely matter and leave the rest open: a day planned to 100 % does not survive the first surprise, and then the whole plan gets abandoned.</p>
<h3>What do you do when a week goes completely off the rails?</h3>
<p>Do not catch up. Pick things up at the next review as though nothing had happened. Organisation systems do not die of a bad week, they die of the attempt to compensate for the bad week.</p>
`,
    },
    hr: {
      title: "Učinkovito upravljanje vremenom: 7 načela koja traju",
      metaTitle: "Upravljanje vremenom: 7 načela koja stvarno funkcioniraju",
      description: "7 načela upravljanja vremenom koja prežive naporan tjedan, bez složene metode: odabir prioriteta, termini u kalendaru, radne cjeline, tjedni pregled.",
      readingMinutes: 9,
      faq: [
        ["Koja je najučinkovitija metoda upravljanja vremenom?", "Ona koju ćete zadržati tri mjeseca. U praksi najbolje drži ova kombinacija: jedna lista, izričit odabir prioriteta i rezervirani termini u kalendaru za ono što je stvarno važno."],
        ["Kako upravljati vremenom kad je sve hitno?", "Ne može sve biti hitno: to je gotovo uvijek simptom odluke koja nije donesena. Razvrstajte po dvije osi (hitno i važno), riješite 1. kvadrant, a prije svega rezervirajte termin za 2. kvadrant, jer upravo on stvara hitnoće sljedećeg tjedna."],
        ["Koliko treba da se vide rezultati?", "Dva do tri tjedna da osjetite razliku u mentalnom opterećenju, šest do osam da sustav drži bez svjesnog napora. Prije toga sustav procjenjujete u razdoblju uvođenja."],
      ],
      html: `
<p class="lead">Oko upravljanja vremenom postoji nesporazum: predstavlja se kao problem tehnike, a prije svega je problem odabira. Nijedna metoda ne može šezdeset sati posla smjestiti u tjedan od trideset pet sati. Dobra metoda umjesto toga čini vidljivim ono što ne stane, dovoljno rano da odlučite čega se odreći. Evo sedam načela koja prežive naporan tjedan, od najstrukturnijeg do najdetaljnijeg.</p>
<figure><img src="/screenshots/agenda.webp" srcset="/screenshots/agenda-800.webp 800w, /screenshots/agenda.webp 2560w" sizes="(max-width: 48rem) calc(100vw - 2rem), 45rem" width="1280" height="800" loading="lazy" decoding="async" alt="Kalendar u Cosmu u tjednom prikazu: zadaci koji čekaju planiranje nalaze se lijevo i povlače se u vremenski termin." /><figcaption>Kalendar u Cosmu u tjednom prikazu: zadaci koji čekaju planiranje nalaze se lijevo i povlače se u vremenski termin. Snimka zaslona demo načina rada, primjeri podataka.</figcaption></figure>

<h2 id="arbitrage">1. Prihvatite da upravljati vremenom znači odricati se</h2>
<p>To je načelo iz kojeg proizlaze sva ostala i jedino koje je stvarno teško. Tjedan ima ograničen broj korisnih sati, kod većine ljudi između trideset i četrdeset kad se pošteno prebroje. Svaka metoda koja obećava „učiniti više“ bez da išta uklanja samo odgađa trenutak u kojem otkrijete da nije stalo.</p>
<p>Praktična posljedica: svaki put kad prihvatite nešto novo, imenujte što to istiskuje. Ne u glavi, nego na listi. Obveza preuzeta bez utvrđene protuvrijednosti bit će ispunjena na račun nečega što niste odabrali.</p>

<h2 id="liste-unique">2. Jedna lista, a ne četiri</h2>
<p>Zadaci u bilježnici, drugi u nepročitanoj e-pošti, treći u porukama koje šaljete sami sebi: mentalno opterećenje ne dolazi od količine posla, nego od nesigurnosti o tome što ste zaboravili. Dok lista nije jedna, dio vaše pažnje ostaje zauzet nadzorom ostalih.</p>
<p>Objedinjavanje je važnije od izbora alata. Jedna lista na papiru bolja je od tri savršene aplikacije. Ako vas izbor alata ipak koči, <a href="/hr/blog/cosmo-vs-todoist">usporedba Cosma i Todoista</a> navodi kriterije koji su stvarno bitni.</p>

<h2 id="arbitrer">3. Odlučujte izričito, a ne po osjećaju</h2>
<p>Bez zapisanog kriterija „određivanje prioriteta“ svodi se na rješavanje onoga što najglasnije viče. Za svaki zadatak dovoljna su dva pitanja: <strong>je li hitan?</strong> i <strong>je li važan?</strong> To je <a href="/hr/blog/matrice-eisenhower">Eisenhowerova matrica</a>, a njezina vrijednost nije u samom razvrstavanju, nego u tome što vas tjera na pitanje „važno u odnosu na što?“.</p>
<p>Tu izričiti ciljevi postaju korisni: bez njih sve izgleda važno i odabir više ništa ne filtrira. Dva do četiri cilja za tromjesečje dovoljna su da riješite 80 % slučajeva.</p>

<h2 id="creneaux">4. Ono što nema termin, ne postoji</h2>
<p>Važan, ali ne hitan zadatak uvijek će izgubiti od hitnoće, beskonačno, kakva god bila vaša disciplina. Jedina zaštita koja djeluje je fizička: dajte mu mjesto u kalendaru, ravnopravno sa sastankom s nekim drugim.</p>
<p>To je načelo <a href="/hr/blog/time-blocking-guide">time-blockinga</a>, a njegova sporedna korist vrijedi koliko i glavna: smještanjem zadataka u termine odmah otkrivate što ne stane u tjedan, prije nego što se obvežete, a ne poslije.</p>

<h2 id="unite">5. Radite u cjelinama, a ne neprekidno</h2>
<p>Usredotočena pažnja mjeri se u blokovima od dvadeset do devedeset minuta, ovisno o osobi i zadatku, a ne u danima. Dvije konkretne posljedice:</p>
<ul>
<li><strong>Grupirajte ono što je iste vrste.</strong> E-pošta u dva bloka dnevno umjesto neprestano, pozivi jedan za drugim, administracija u jednom potezu. Svaka promjena konteksta stoji nekoliko minuta ponovnog zagrijavanja, nevidljiv trošak koji je, kad se zbroji, golem.</li>
<li><strong>Zaštitite početak bloka.</strong> Prve minute određuju ostatak: znati točno čime početi vrijedi više od deset minuta viška. Zato se zadaci isplati dijeliti dok prvi korak ne postane očit.</li>
</ul>

<h2 id="frottement">6. Smanjite trenje umjesto da se oslanjate na volju</h2>
<p>Snaga volje je promjenjiv resurs, trenje je stalno. Ako zadatak zahtijeva otvaranje tri alata i traženje lozinke prije početka, bit će odgođen, ne iz lijenosti, nego zbog cijene ulaska. Obrnuto, ono što je odmah pri ruci, bude obavljeno.</p>
<p>Isto vrijedi i za sam sustav: metoda koja traži petnaest minuta dnevnog održavanja bit će napuštena u tri tjedna, kakva god bila njezina teorijska kvaliteta. Pravo pitanje nije „koja je metoda najbolja?“, nego „koju ću i dalje koristiti za tri mjeseca?“.</p>

<h2 id="revue">7. Tjedni pregled, kratak i neupitan</h2>
<p>To je načelo koje se najčešće napušta, a ujedno ono koje drži sva ostala. Petnaest do dvadeset minuta na kraju tjedna:</p>
<ol>
<li>Što je završeno i, prije svega, što je bilo planirano, a nije obavljeno, jer to govori o vašoj stvarnoj procjeni.</li>
<li>Kamo je otišlo vrijeme, po širim kategorijama. To je često iznenađenje tjedna.</li>
<li>Gdje su dugoročni ciljevi, kao smjer kretanja, a ne kao točan postotak.</li>
<li><strong>Jedna jedina</strong> prilagodba za sljedeći tjedan. Jedna, ne pet: upravo to pregled čini održivim.</li>
</ol>
<p>Bez tog termina sustav organizacije za nekoliko tjedana skrene s puta, a nitko to ne primijeti, jer ništa u običnom tjednu ne tjera da podignete pogled.</p>

<h2 id="pratique">Kako uvesti 7 načela</h2>
<p>Nijedno od ovih načela ne zahtijeva poseban alat, ali sva zahtijevaju da podaci budu na jednom mjestu. Zbog toga je hrpa aplikacija skupa: tjedni pregled pretvara se u skupljanje podataka, pa se preskače. <a href="/hr/za-freelancere">Freelanceri</a> to osjećaju jače od drugih, jer nitko drugi neće držati okvir umjesto njih. A ako vam neki ovdje korišten pojam nije poznat, <a href="/hr/blog/glossaire-productivite">pojmovnik produktivnosti</a> definira ih sve.</p>
<p><a href="/hr/">Cosmo</a> je nastao upravo s tim ograničenjem na umu: jedna lista s prioritetima i kategorijama, kalendar u koji povlačite zadatke za time-blocking, navike za ono što treba postati automatsko, <a href="/hr/blog/methode-okr-exemples">OKR-ovi</a> koji određuju što „važno“ znači ovog tromjesečja i <a href="/hr/blog/tableau-de-bord-productivite">nadzorna ploča</a> koja omogućuje petkov pregled u petnaest minuta, bez ponovnog unosa. <a href="/hr/signup">Besplatno</a>, s demom koji se otvara bez registracije.</p>

<h2 id="faq">Česta pitanja</h2>
<h3>Kojim načelom početi?</h3>
<p>Drugim: sve objedinite u jednu listu. Ne traži nikakvu metodu i donosi najbrže olakšanje. Ostala se dodaju poslije, jedno tjedno.</p>
<h3>Treba li isplanirati svaku minutu dana?</h3>
<p>Ne, i to je kontraproduktivno. Rezervirajte dva ili tri bloka koji su stvarno važni, a ostatak ostavite slobodnim: dan isplaniran do 100 % ne preživi prvo iznenađenje, a onda se napušta cijeli plan.</p>
<h3>Što kad tjedan potpuno izmakne kontroli?</h3>
<p>Ne nadoknađujte. Nastavite na sljedećem pregledu kao da se ništa nije dogodilo. Sustavi organizacije ne umiru od lošeg tjedna, nego od pokušaja da se loš tjedan nadoknadi.</p>
`,
    },
  },
};
