// Corps indexable de /entreprise-presentation (fr, en).
// Gabarits HTML du prérendu, injectés tels quels dans #seo-fallback.
import { PRIX_VISIBLES } from '../flags.ts';
import type { LocaleContent } from '../types.ts';

export const ENTREPRISE_CONTENT: LocaleContent = {
  fr: `<h1>Cosmo Entreprise, votre organigramme est votre moteur d'exécution</h1>
        <p>Dans Cosmo Entreprise, le périmètre de chacun découle de votre organigramme : ce qu'il voit, ce qu'on lui assigne, ce qu'on mesure. Chaque collaborateur garde par ailleurs le Cosmo personnel qu'il utilise déjà, ce qui évite d'avoir un outil de plus à faire adopter. La mise en place tient en cinq étapes.</p>

        <h2>Étape 1 : invitez votre équipe et regroupez-la</h2>
        <p>Chacun rejoint l'organisation avec le compte Cosmo qu'il a déjà, invité par e-mail, par code d'organisation, par lien ou parmi vos contacts, et arrive directement sous son responsable et dans ses équipes. Vous créez autant d'équipes que nécessaire, une même personne pouvant appartenir à plusieurs. Le rattachement décide par défaut de ce que chacun voit et peut faire : un responsable voit son sous-arbre complet sans qu'aucun droit n'ait à être coché. Quand il le faut, vous ajustez les droits membre par membre, et un changement de rattachement suffit à réorganiser.</p>
        <p>L'organigramme est l'écran depuis lequel on suit chaque personne : ouvrir sa fiche donne ses tâches en cours, sa charge, son agenda et sa contribution. Un responsable peut créer, déplacer et modifier les événements de l'agenda des personnes qui lui reportent ; ce qu'elles ont marqué comme personnel reste privé, seul le créneau apparaît. Deux branches sœurs de l'organigramme sont cloisonnées, et la règle est appliquée en base de données, pas seulement masquée dans l'interface.</p>
        <p><img src="/screenshots/entreprise/pyramide.webp" width="1600" height="667" loading="lazy" decoding="async" alt="Onglet Organigramme de Cosmo Entreprise : chaque membre rattaché à son responsable, avec ses tâches ouvertes et ses retards" /></p>

        <h2>Étape 2 : suivez l'exécution, pas seulement les échéances</h2>
        <p>Chaque tâche porte un statut (à faire, en cours, en relecture, bloquée, terminée) et peut en bloquer une autre. Le planning calcule le chemin critique, la chaîne de tâches dont le moindre retard décale la livraison. L'onglet Tâches réunit les tâches de tous les projets de votre périmètre, avec préréglages, listes partagées, tri et regroupement, en liste ou en kanban.</p>
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

        <h2>Vingt fonctionnalités en plus</h2>
        <p>Rôles et permissions réglables membre par membre, rôles par projet (responsable, contributeur, lecteur), une page par équipe avec la charge de chaque membre, événements d'équipe, assistant de démarrage. Modèles de projet, dépendances entre projets, actions groupées, listes et préréglages partagés par lien, recherche dans toute l'entreprise. Automatisations, envoi vers Slack ou webhooks signés, export complet en CSV, alertes réglables par type, résultats clés d'entreprise visibles dans vos OKR personnels. Journal d'audit conservé un an, domaines vérifiés, accès à durée limitée, assistant de départ et suspension, corbeille de trente jours pour les tâches et les objectifs.</p>

        <h2>Sécurité, confidentialité et réversibilité</h2>
        <p>Chaque table est protégée par des politiques d'accès évaluées côté serveur : une requête forgée depuis le navigateur ne rapporte rien de plus qu'une requête légitime. Un manager voit le travail de son périmètre, jamais les tâches, habitudes ou agenda personnels de ses collaborateurs. Effacement du compte réellement exécuté côté serveur, consentement explicite à l'entrée dans une organisation, aucune donnée revendue. Transfert de propriété, départ d'un membre avec transmission de son travail et suppression de l'organisation sont dans l'interface, pas dans un ticket de support.</p>
        ${PRIX_VISIBLES ? `<h2>Tarifs</h2>
        <p>Un forfait pour toute l'organisation, quel que soit le nombre de projets, et non un tarif par personne : gratuit jusqu'à 5 membres, 70 € par mois de 5 à 10 membres, 150 € de 10 à 20, 350 € de 20 à 50, 700 € de 50 à 100, et 1000 € au-delà de 100. Le forfait s'ajuste tout seul quand l'organisation grandit et redescend si l'effectif baisse. Sans engagement, résiliable à tout moment, sans carte bancaire pour démarrer.</p>` : ''}

        <p><a href="/">Cosmo pour moi</a> · <a href="/signup">Créer mon organisation</a> · <a href="/guide">Guide d'utilisation</a></p>`,
  en: `<h1>Cosmo for companies: your org chart is your execution engine</h1>
        <p>In Cosmo for companies, everyone's scope follows from your org chart: what they see, what gets assigned to them, what gets measured. Each colleague also keeps the personal Cosmo they already use, which avoids having one more tool to get adopted. Setting it up takes five steps.</p>

        <h2>Step 1: invite your team and group them</h2>
        <p>Everyone joins the organisation with the Cosmo account they already have, invited by email, organisation code, link or from your contacts, and lands straight under their manager and in their teams. You create as many teams as you need, and one person can belong to several. The attachment decides by default what each person sees and can do: a manager sees their complete subtree without a single permission having to be ticked. When needed, you adjust rights member by member, and changing an attachment is enough to reorganise.</p>
        <p>The org chart is the screen from which you follow each person: opening their card shows their current tasks, their workload, their calendar and their contribution. A manager can create, move and edit calendar events for the people who report to them; what those people have marked as personal stays private, and only the slot appears. Two sibling branches of the org chart are partitioned, and the rule is enforced in the database, not merely hidden in the interface.</p>
        <p><img src="/screenshots/entreprise/pyramide.webp" width="1600" height="667" loading="lazy" decoding="async" alt="The Org chart tab in Cosmo for companies: each member attached to their manager, with their open and overdue tasks" /></p>

        <h2>Step 2: follow execution, not just deadlines</h2>
        <p>Every task carries a status (to do, in progress, in review, blocked, done) and can block another. The timeline computes the critical path, the chain of tasks where the slightest delay pushes back delivery. The Tasks tab gathers the tasks of every project in your scope, with presets, shared lists, sorting and grouping, as a list or a board.</p>
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

        <h2>Twenty more features</h2>
        <p>Rights set member by member, project roles (lead, contributor, viewer), a page per team with each member's workload, team events, a getting-started assistant. Project templates, dependencies between projects, bulk actions, lists and presets shared by link, search across the whole company. Automations, delivery to Slack or signed webhooks, full CSV export, alerts set type by type, company key results shown in your personal OKRs. An audit log kept for a year, verified domains, time-limited access, a departure assistant and suspension, a thirty-day trash for tasks and objectives.</p>

        <h2>Security, privacy and reversibility</h2>
        <p>Every table is protected by access policies evaluated server side: a request forged from the browser brings back nothing more than a legitimate one. A manager sees the work in their scope, never the personal tasks, habits or calendar of their colleagues. Account deletion is genuinely executed server side, consent to joining an organisation is explicit, and no data is resold. Transferring ownership, a member's departure with their work handed over, and deleting the organisation are in the interface, not in a support ticket.</p>
        ${PRIX_VISIBLES ? `<h2>Pricing</h2>
        <p>One plan for the whole organisation, whatever the number of projects, rather than a per-person price: free up to 5 members, 70 € a month from 5 to 10 members, 150 € from 10 to 20, 350 € from 20 to 50, 700 € from 50 to 100, and 1000 € beyond 100. The plan adjusts itself as the organisation grows and comes back down if headcount falls. No commitment, cancellable at any time, no credit card to start.</p>` : ''}

        <p><a href="/en/">Cosmo for me</a> · <a href="/en/signup">Create my organisation</a> · <a href="/en/guide">User guide</a></p>`,
  hr: `<h1>Cosmo za tvrtke: vaš organigram je vaš pokretač izvršenja</h1>
        <p>U Cosmu za tvrtke opseg svakoga proizlazi iz vašeg organigrama: što vidi, što mu se dodjeljuje, što se mjeri. Svaki suradnik pritom zadržava osobni Cosmo koji već koristi, pa ne morate uvoditi još jedan alat. Postavljanje traje pet koraka.</p>

        <h2>1. korak: pozovite svoj tim i grupirajte ga</h2>
        <p>Svatko se pridružuje organizaciji s Cosmo računom koji već ima, pozvan e-poštom, kodom organizacije, poveznicom ili iz vaših kontakata, i dolazi izravno pod svog nadređenog i u svoje timove. Izrađujete onoliko timova koliko treba, a ista osoba može pripadati u više njih. Povezanost prema zadanim postavkama određuje što svatko vidi i može raditi: voditelj vidi cijelo svoje podstablo, a da nijedno pravo ne treba označiti. Kad je potrebno, prava prilagođavate člana po člana, a promjena povezanosti dovoljna je za reorganizaciju.</p>
        <p>Organigram je zaslon s kojeg pratite svaku osobu: otvaranje njezine kartice prikazuje tekuće zadatke, opterećenje, kalendar i doprinos. Voditelj može stvarati, premještati i mijenjati događaje u kalendaru osoba koje mu odgovaraju; ono što su one označile kao osobno ostaje privatno, prikazuje se samo termin. Dvije sestrinske grane organigrama međusobno su odvojene, a pravilo se provodi u bazi podataka, ne samo skriva u sučelju.</p>
        <p><img src="/screenshots/entreprise/pyramide.webp" width="1600" height="667" loading="lazy" decoding="async" alt="Kartica Organigram u Cosmu za tvrtke: svaki član povezan sa svojim nadređenim, s otvorenim zadacima i kašnjenjima" /></p>

        <h2>2. korak: pratite izvršenje, ne samo rokove</h2>
        <p>Svaki zadatak ima status (za napraviti, u tijeku, na pregledu, blokiran, završen) i može blokirati drugi. Plan izračunava kritični put, lanac zadataka u kojem i najmanje kašnjenje pomiče isporuku. Kartica Zadaci okuplja zadatke svih projekata u vašem opsegu, s predlošcima filtara, dijeljenim popisima, sortiranjem i grupiranjem, kao popis ili kanban.</p>
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

        <h2>Dvadeset dodatnih funkcija</h2>
        <p>Uloge i dopuštenja podesivi član po član, uloge po projektu (voditelj, suradnik, čitatelj), stranica za svaki tim s opterećenjem svakog člana, timski događaji, pomoćnik za početak. Predlošci projekata, ovisnosti između projekata, skupne radnje, popisi i predlošci filtara dijeljeni poveznicom, pretraga po cijeloj tvrtki. Automatizacije, slanje u Slack ili potpisani webhookovi, potpuni izvoz u CSV, obavijesti podesive po vrsti, ključni rezultati tvrtke vidljivi u vašim osobnim OKR-ovima. Revizijski dnevnik koji se čuva godinu dana, potvrđene domene, vremenski ograničen pristup, pomoćnik za odlazak i suspenziju, koš za smeće od trideset dana za zadatke i ciljeve.</p>

        <h2>Sigurnost, povjerljivost i reverzibilnost</h2>
        <p>Svaka je tablica zaštićena pravilima pristupa koja se provjeravaju na poslužitelju: krivotvoreni zahtjev iz preglednika ne donosi ništa više od legitimnog. Voditelj vidi rad u svom opsegu, nikad osobne zadatke, navike ili kalendar svojih suradnika. Brisanje računa stvarno se izvršava na poslužitelju, pristanak na ulazak u organizaciju je izričit, a podaci se ne preprodaju. Prijenos vlasništva, odlazak člana uz predaju njegova rada i brisanje organizacije nalaze se u sučelju, a ne u zahtjevu za podršku.</p>
        ${PRIX_VISIBLES ? `<h2>Cijene</h2>
        <p>Jedan paket za cijelu organizaciju, bez obzira na broj projekata, a ne cijena po osobi: besplatno do 5 članova, 70 € mjesečno od 5 do 10 članova, 150 € od 10 do 20, 350 € od 20 do 50, 700 € od 50 do 100 i 1000 € iznad 100. Paket se sam prilagođava kad organizacija raste i spušta se ako se broj članova smanji. Bez obveze, otkazivo u bilo kojem trenutku, bez kartice za početak.</p>` : ''}

        <p><a href="/hr/">Cosmo za mene</a> · <a href="/hr/signup">Izradi moju organizaciju</a> · <a href="/hr/guide">Vodič za korištenje</a></p>`,
};
