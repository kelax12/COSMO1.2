// Corps indexable de /entreprise-presentation (fr, en).
// Gabarits HTML du prérendu, injectés tels quels dans #seo-fallback.
import { PRIX_VISIBLES } from '../flags.ts';
import type { LocaleContent } from '../types.ts';

export const ENTREPRISE_CONTENT: LocaleContent = {
  fr: `<h1>Cosmo Entreprise : toute votre entreprise en un seul endroit</h1>
        <p>Cosmo Entreprise réunit les tâches, les projets, les OKR et les équipes de votre organisation. Chaque collaborateur garde le Cosmo personnel qu'il utilise déjà : les tâches qu'on lui assigne y arrivent, ce qui évite d'avoir un outil de plus à faire adopter. La mise en place tient en cinq étapes.</p>

        <h2>Étape 1 : invitez votre équipe</h2>
        <p>Chacun rejoint l'organisation avec le compte Cosmo qu'il a déjà, invité par e-mail, par code d'organisation, par lien ou parmi vos contacts, et reçoit d'office le rôle par défaut. L'administrateur écrit ses rôles personnalisés et coche leurs droits : créer ou modifier des projets, supprimer des tâches ou des OKR, inviter, lire les rapports de toute l'entreprise. Un rôle peut s'arrêter seul à une date, pour une mission ou un prestataire. Les équipes portent les projets, les OKR et les statistiques ; une personne peut appartenir à plusieurs équipes, et un projet n'est visible que par ses équipes. Chacun ouvre Cosmo sur son travail, pas sur celui de toute l'entreprise, et la règle est appliquée en base de données, pas seulement masquée dans l'interface.</p>

        <h2>Étape 2 : suivez l'exécution</h2>
        <p>Chaque tâche porte un statut (à faire, en cours, en relecture, bloquée, terminée) ; une relecture se valide ou se renvoie en un clic. Les responsables d'une tâche déclarent aussi son état, dans les temps, à risque ou en difficulté, pour régler un problème avant qu'il ne soit trop tard. Une tâche peut en bloquer une autre : reliez-les, et chacun voit ce qui l'attend. L'onglet Tâches réunit les tâches de tous vos projets, en liste ou en kanban.</p>
        <p><img src="/screenshots/entreprise/taches-tableau.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Onglet Tâches de Cosmo Entreprise en vue Tableau : une colonne par statut, de à faire à terminée, avec les retards signalés" /></p>

        <h2>Étape 3 : créez vos projets et attribuez-les à l'échelle voulue</h2>
        <p>Un projet appartient à une équipe et rassemble ses tâches. Vous les assignez à une personne ou à plusieurs, dans tout votre périmètre, et chacune les retrouve dans son propre Cosmo à côté de ses tâches personnelles. Trois vues : la liste pour le détail, le planning pour voir arriver les échéances et le chemin critique, le portefeuille pour comparer statut, responsable et avancement de tous les projets. Sous-tâches, commentaires à mentions et historique des modifications sont dans chaque tâche.</p>
        <p><img src="/screenshots/entreprise/projets.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Onglet Projets de Cosmo Entreprise en vue Liste : les projets d'équipe avec leurs tâches, échéances, statuts et personnes assignées" /></p>
        <p><img src="/screenshots/entreprise/projets-portefeuille.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Onglet Projets en vue Portefeuille : chaque projet avec son responsable, son statut, son avancement et ce qui le bloque" /></p>

        <h2>Étape 4 : posez vos objectifs, à toutes les échelles</h2>
        <p>Un objectif d'organisation se décline en OKR d'équipe, chaque OKR en résultats clés chiffrés avec leur porteur. Un objectif peut être visible par toute l'entreprise, par certaines équipes ou par les seules personnes choisies. Chaque résultat clé atteint est journalisé à la date où il l'a été, dans un journal qui ne se réécrit pas après coup.</p>
        <p><img src="/screenshots/entreprise/okr.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Onglet OKR de Cosmo Entreprise : les objectifs et leurs résultats clés chiffrés avec leur porteur et leur progression" /></p>

        <h2>Étape 5 : suivez la progression de chacun</h2>
        <p>Les rapports d'activité répondent à la question du lundi matin : ce qui a avancé, et grâce à qui. Chaque nuit, Cosmo fige ce que l'entreprise et chaque équipe ont fait (tâches terminées, projets et OKR qui ont progressé, événements tenus), lisible au jour, à la semaine ou au mois, avec le détail par personne. L'aperçu ouvre chaque journée : les tâches à valider, les mentions, les personnes que vous bloquez, votre charge de la semaine, votre agenda et vos résultats clés.</p>
        <p><img src="/screenshots/entreprise/rapports.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Rapports d'activité de Cosmo Entreprise : tâches terminées, projets et OKR qui ont avancé, et qui a fait quoi" /></p>
        <p><img src="/screenshots/entreprise/apercu.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Aperçu de Cosmo Entreprise : tâches à valider, mentions, charge de la semaine, agenda et résultats clés" /></p>

        <h2>Quelques fonctionnalités en plus</h2>
        <p>Une réunion d'équipe calée sur les créneaux où tout le monde est libre, un résumé quotidien par e-mail, une recherche Ctrl K limitée à ce que chacun a le droit de voir. Des relances automatiques, des actions groupées, l'envoi vers Slack. Un assistant de départ qui transmet tâches et objectifs, des rôles à date de fin, des domaines vérifiés. Un fil de discussion par projet, une corbeille de trente jours, un journal d'audit conservé un an et un export CSV complet.</p>

        <h2>Sécurité, confidentialité et réversibilité</h2>
        <p>Chaque table est protégée par des politiques d'accès évaluées côté serveur : une requête forgée depuis le navigateur ne rapporte rien de plus qu'une requête légitime. Chacun voit le travail de ses équipes, jamais les tâches, habitudes ou agenda personnels de ses collègues. Effacement du compte réellement exécuté côté serveur, consentement explicite à l'entrée dans une organisation, aucune donnée revendue. Transfert de propriété, départ d'un membre avec transmission de son travail et suppression de l'organisation sont dans l'interface, pas dans un ticket de support.</p>
        ${PRIX_VISIBLES ? `<h2>Tarifs</h2>
        <p>Un forfait pour toute l'organisation, quel que soit le nombre de projets, et non un tarif par personne : gratuit jusqu'à 5 membres, 70 € par mois de 5 à 10 membres, 150 € de 10 à 20, 350 € de 20 à 50, 700 € de 50 à 100, et 1000 € au-delà de 100. Le forfait s'ajuste tout seul quand l'organisation grandit et redescend si l'effectif baisse. Sans engagement, résiliable à tout moment, sans carte bancaire pour démarrer.</p>
` : ''}

        <p><a href="/">Cosmo pour moi</a> · <a href="/signup">Créer mon organisation</a> · <a href="/guide">Guide d'utilisation</a></p>`,
  en: `<h1>Cosmo for companies: your whole company in one place</h1>
        <p>Cosmo for companies brings together your organisation's tasks, projects, OKRs and teams. Each colleague keeps the personal Cosmo they already use: the tasks assigned to them land there, which avoids having one more tool to get adopted. Setting it up takes five steps.</p>

        <h2>Step 1: invite your team</h2>
        <p>Everyone joins the organisation with the Cosmo account they already have, invited by email, organisation code, link or from your contacts, and gets the default role straight away. The admin writes custom roles and ticks their permissions: create or edit projects, delete tasks or OKRs, invite, read company-wide reports. A role can end on its own at a set date, for an assignment or a contractor. Teams carry projects, OKRs and statistics; one person can belong to several teams, and a project is only visible to its teams. Everyone opens Cosmo on their own work, not the whole company's, and the rule is enforced in the database, not merely hidden in the interface.</p>

        <h2>Step 2: track execution</h2>
        <p>Every task carries a status (to do, in progress, in review, blocked, done); a review is approved or sent back in one click. A task's assignees also declare its health, on track, at risk or off track, so a problem gets fixed before it's too late. A task can block another: link them, and everyone sees what they are waiting on. The Tasks tab gathers the tasks of all your projects, as a list or a board.</p>
        <p><img src="/screenshots/entreprise/taches-tableau.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="The Tasks tab in Cosmo for companies in Board view: one column per status, from to do to done, with overdue tasks flagged" /></p>

        <h2>Step 3: create your projects and assign them at the right scale</h2>
        <p>A project belongs to a team and gathers its tasks. You assign them to one person or several, anywhere in your scope, and each of them finds those tasks in their own Cosmo alongside their personal ones. Three views: the list for detail, the timeline to see deadlines and the critical path coming, the portfolio to compare status, lead and progress across all projects. Subtasks, comments with mentions and a change history live in every task.</p>
        <p><img src="/screenshots/entreprise/projets.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="The Projects tab in Cosmo for companies in List view: team projects with their tasks, deadlines, statuses and assignees" /></p>
        <p><img src="/screenshots/entreprise/projets-portefeuille.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="The Projects tab in Portfolio view: each project with its lead, status, progress and what is blocking it" /></p>

        <h2>Step 4: set your goals, at every scale</h2>
        <p>An organisation goal cascades into team OKRs, each OKR into numeric key results with their owner. An objective can be visible to the whole company, to some teams or only to the people you pick. Each key result achieved is logged on the date it was achieved, in a journal that cannot be rewritten afterwards.</p>
        <p><img src="/screenshots/entreprise/okr.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="The OKR tab in Cosmo for companies: objectives and their numeric key results with their owner and progress" /></p>

        <h2>Step 5: follow everyone's progress</h2>
        <p>Activity reports answer the Monday morning question: what moved forward, and thanks to whom. Every night, Cosmo records what the company and each team did (completed tasks, projects and OKRs that progressed, events held), readable by day, week or month, with the detail per person. The overview opens each day: tasks to approve, mentions, the people you are blocking, your workload for the week, your calendar and your key results.</p>
        <p><img src="/screenshots/entreprise/rapports.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Activity reports in Cosmo for companies: completed tasks, projects and OKRs that moved forward, and who did what" /></p>
        <p><img src="/screenshots/entreprise/apercu.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="The Overview in Cosmo for companies: tasks to approve, mentions, weekly workload, calendar and key results" /></p>

        <h2>A few more features</h2>
        <p>A team meeting set on the slots where everyone is free, a daily email recap, a Ctrl K search limited to what each person may see. Automatic reminders, bulk actions, delivery to Slack. A departure assistant that hands over tasks and goals, roles with an end date, verified domains. One conversation thread per project, a thirty-day trash, an audit log kept for a year and a full CSV export.</p>

        <h2>Security, privacy and reversibility</h2>
        <p>Every table is protected by access policies evaluated server side: a request forged from the browser brings back nothing more than a legitimate one. Everyone sees their teams' work, never the personal tasks, habits or calendar of their colleagues. Account deletion is genuinely executed server side, consent to joining an organisation is explicit, and no data is resold. Transferring ownership, a member's departure with their work handed over, and deleting the organisation are in the interface, not in a support ticket.</p>
        ${PRIX_VISIBLES ? `<h2>Pricing</h2>
        <p>One plan for the whole organisation, whatever the number of projects, rather than a per-person price: free up to 5 members, 70 € a month from 5 to 10 members, 150 € from 10 to 20, 350 € from 20 to 50, 700 € from 50 to 100, and 1000 € beyond 100. The plan adjusts itself as the organisation grows and comes back down if headcount falls. No commitment, cancellable at any time, no credit card to start.</p>
` : ''}

        <p><a href="/en/">Cosmo for me</a> · <a href="/en/signup">Create my organisation</a> · <a href="/en/guide">User guide</a></p>`,
  hr: `<h1>Cosmo za tvrtke: cijela vaša tvrtka na jednom mjestu</h1>
        <p>Cosmo za tvrtke okuplja zadatke, projekte, OKR-ove i timove vaše organizacije. Svaki suradnik zadržava osobni Cosmo koji već koristi: zadaci koji mu se dodijele stižu onamo, pa ne morate uvoditi još jedan alat. Postavljanje traje pet koraka.</p>

        <h2>1. korak: pozovite svoj tim</h2>
        <p>Svatko se pridružuje organizaciji s Cosmo računom koji već ima, pozvan e-poštom, kodom organizacije, poveznicom ili iz vaših kontakata, i odmah dobiva zadanu ulogu. Administrator piše prilagođene uloge i označava njihova prava: stvaranje ili uređivanje projekata, brisanje zadataka ili OKR-ova, pozivanje, čitanje izvješća za cijelu tvrtku. Uloga može sama isteći na zadani datum, za projektni zadatak ili vanjskog suradnika. Timovi nose projekte, OKR-ove i statistiku; jedna osoba može pripadati u više timova, a projekt vide samo njegovi timovi. Svatko otvara Cosmo na svom poslu, a ne na poslu cijele tvrtke, a pravilo se provodi u bazi podataka, ne samo skriva u sučelju.</p>

        <h2>2. korak: pratite izvršenje</h2>
        <p>Svaki zadatak ima status (za obaviti, u tijeku, na pregledu, blokirano, obavljeno); pregled se odobrava ili vraća jednim klikom. Nositelji zadatka označavaju i njegovo stanje, u roku, u riziku ili u poteškoćama, kako bi se problem riješio prije nego što bude prekasno. Zadatak može blokirati drugi: povežite ih i svatko vidi što ga čeka. Kartica Zadaci okuplja zadatke svih vaših projekata, kao popis ili kanban.</p>
        <p><img src="/screenshots/entreprise/taches-tableau.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Kartica Zadaci u Cosmu za tvrtke u prikazu Ploča: jedan stupac po statusu, od za napraviti do završeno, s označenim kašnjenjima" /></p>

        <h2>3. korak: izradite projekte i dodijelite ih na željenoj razini</h2>
        <p>Projekt pripada timu i okuplja njegove zadatke. Dodjeljujete ih jednoj ili više osoba, bilo gdje u svom opsegu, a svaka ih pronalazi u vlastitom Cosmu uz svoje osobne zadatke. Tri prikaza: popis za detalje, plan za praćenje nadolazećih rokova i kritičnog puta, portfelj za usporedbu statusa, voditelja i napretka svih projekata. Podzadaci, komentari s spominjanjima i povijest izmjena nalaze se u svakom zadatku.</p>
        <p><img src="/screenshots/entreprise/projets.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Kartica Projekti u Cosmu za tvrtke u prikazu Popis: timski projekti sa zadacima, rokovima, statusima i dodijeljenim osobama" /></p>
        <p><img src="/screenshots/entreprise/projets-portefeuille.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Kartica Projekti u prikazu Portfelj: svaki projekt s voditeljem, statusom, napretkom i onim što ga blokira" /></p>

        <h2>4. korak: postavite ciljeve na svim razinama</h2>
        <p>Cilj organizacije razlaže se u timske OKR-ove, a svaki OKR u brojčane ključne rezultate s nositeljem. Cilj može biti vidljiv cijeloj tvrtki, nekim timovima ili samo odabranim osobama. Svaki postignuti ključni rezultat bilježi se na datum kada je postignut, u dnevniku koji se naknadno ne može prepraviti.</p>
        <p><img src="/screenshots/entreprise/okr.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Kartica OKR u Cosmu za tvrtke: ciljevi i njihovi brojčani ključni rezultati s nositeljem i napretkom" /></p>

        <h2>5. korak: pratite napredak svakoga</h2>
        <p>Izvještaji o aktivnosti odgovaraju na pitanje ponedjeljka ujutro: što je napredovalo i zahvaljujući kome. Svake noći Cosmo bilježi što su tvrtka i svaki tim napravili (završeni zadaci, projekti i OKR-ovi koji su napredovali, održani događaji), čitljivo po danu, tjednu ili mjesecu, s pojedinostima po osobi. Pregled otvara svaki dan: zadaci za odobriti, spominjanja, osobe koje blokirate, vaše opterećenje u tjednu, kalendar i ključni rezultati.</p>
        <p><img src="/screenshots/entreprise/rapports.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Izvještaji o aktivnosti u Cosmu za tvrtke: završeni zadaci, projekti i OKR-ovi koji su napredovali te tko je što napravio" /></p>
        <p><img src="/screenshots/entreprise/apercu.webp" width="1600" height="1000" loading="lazy" decoding="async" alt="Pregled u Cosmu za tvrtke: zadaci za odobriti, spominjanja, tjedno opterećenje, kalendar i ključni rezultati" /></p>

        <h2>Još nekoliko funkcija</h2>
        <p>Timski sastanak u terminima kad su svi slobodni, dnevni pregled e-poštom, pretraga Ctrl K ograničena na ono što svatko smije vidjeti. Automatski podsjetnici, skupne radnje, slanje u Slack. Pomoćnik za odlazak koji prenosi zadatke i ciljeve, uloge s datumom završetka, potvrđene domene. Jedna nit razgovora po projektu, koš za smeće od trideset dana, revizijski zapisnik koji se čuva godinu dana i potpuni izvoz u CSV.</p>

        <h2>Sigurnost, povjerljivost i reverzibilnost</h2>
        <p>Svaka je tablica zaštićena pravilima pristupa koja se provjeravaju na poslužitelju: krivotvoreni zahtjev iz preglednika ne donosi ništa više od legitimnog. Svatko vidi rad svojih timova, nikad osobne zadatke, navike ili kalendar svojih kolega. Brisanje računa stvarno se izvršava na poslužitelju, pristanak na ulazak u organizaciju je izričit, a podaci se ne preprodaju. Prijenos vlasništva, odlazak člana uz predaju njegova rada i brisanje organizacije nalaze se u sučelju, a ne u zahtjevu za podršku.</p>
        ${PRIX_VISIBLES ? `<h2>Cijene</h2>
        <p>Jedan paket za cijelu organizaciju, bez obzira na broj projekata, a ne cijena po osobi: besplatno do 5 članova, 70 € mjesečno od 5 do 10 članova, 150 € od 10 do 20, 350 € od 20 do 50, 700 € od 50 do 100 i 1000 € iznad 100. Paket se sam prilagođava kad organizacija raste i spušta se ako se broj članova smanji. Bez obveze, otkazivo u bilo kojem trenutku, bez kartice za početak.</p>` : ''}

        <p><a href="/hr/">Cosmo za mene</a> · <a href="/hr/signup">Izradi moju organizaciju</a> · <a href="/hr/guide">Vodič za korištenje</a></p>`,
};
