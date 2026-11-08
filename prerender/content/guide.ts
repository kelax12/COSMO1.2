// Corps indexable de /guide (fr, en).
// Gabarits HTML du prérendu, injectés tels quels dans #seo-fallback.
import type { LocaleContent } from '../types.ts';

export const GUIDE_CONTENT: LocaleContent = {
  fr: `<h1>Guide d'utilisation de Cosmo</h1>
        <p>Ce guide couvre les six zones de Cosmo, dans l'ordre où on les découvre en pratique. Comptez une quinzaine de minutes pour tout parcourir, mais rien n'oblige à tout mettre en place le premier jour : les tâches seules suffisent à démarrer utilement.</p>
        <h2>Prise en main</h2>
        <p>Deux entrées possibles. Le <strong>mode démo</strong> ouvre l'application complète sans inscription, pré-remplie de 12 mois de données : c'est la bonne façon d'explorer sans rien construire. Le <strong>compte gratuit</strong> se crée en trente secondes, par email ou via Google, et vos données vous suivent alors d'un appareil à l'autre.</p>
        <h2>Tâches</h2>
        <p>Le socle. Une tâche porte un nom, une description, une priorité de 1 à 5, une catégorie colorée, une échéance et une ou plusieurs listes. Les filtres se combinent pour isoler ce qui compte maintenant ; les listes servent aux regroupements durables (un client, un projet, un cours). Une tâche récurrente se régénère automatiquement quand vous la cochez, et les sous-tâches découpent ce qui est trop gros pour être commencé. Le partage se fait par email, en rôle Lecteur ou Éditeur, gratuitement.</p>
        <h2>Habitudes</h2>
        <p>Créez l'habitude, donnez-lui une durée, puis cochez-la au fil des jours. Une pause (vacances, maladie) préserve votre série. La heatmap 26 semaines montre la régularité réelle, le streak compte les jours consécutifs et le taux de complétion situe la période en cours. Conseil qui change tout : deux ou trois habitudes maximum au démarrage, quitte à en ajouter dans un mois. Une liste de quinze habitudes se solde à peu près toujours par un abandon global.</p>
        <h2>Agenda</h2>
        <p>L'agenda accepte des événements classiques, mais son intérêt est ailleurs : glissez une tâche depuis le panneau latéral vers un créneau, l'événement se crée et reste lié à la tâche. C'est le <a href="/blog/time-blocking-guide">time-blocking</a>, et c'est ce qui transforme une liste d'intentions en semaine réaliste. Vues jour, semaine et mois ; les événements récurrents se gèrent depuis la même fiche.</p>
        <h2>OKR</h2>
        <p>Un objectif qualitatif, 2 à 5 résultats clés chiffrés. Vous mettez à jour la valeur courante d'un résultat clé, Cosmo recalcule la progression de l'objectif et enregistre chaque complétion dans votre historique, c'est cette trace qui alimente le graphique du dashboard. Si vous débutez avec la méthode, l'article <a href="/blog/methode-okr-exemples">méthode OKR et 15 exemples</a> donne des formulations prêtes à adapter.</p>
        <h2>Statistiques</h2>
        <p>Temps investi par catégorie, évolution sur la période choisie, comparaison entre modules. C'est la page à ouvrir en fin de semaine ou de mois : elle répond à « où est parti mon temps ? » avec des chiffres plutôt qu'avec une impression, et c'est souvent là que se décide le prochain ajustement.</p>
        <p><a href="/">Retour à l'accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/blog">Le blog</a></p>`,
  en: `<h1>The Cosmo user guide</h1>
        <p>This guide covers the six areas of Cosmo, in the order you meet them in practice. Allow around fifteen minutes to read it all, but nothing obliges you to set everything up on day one: tasks alone are enough to start usefully.</p>
        <h2>Getting started</h2>
        <p>There are two ways in. <strong>Demo mode</strong> opens the complete application with no sign-up, pre-filled with 12 months of data: that is the right way to explore without building anything. A <strong>free account</strong> takes thirty seconds to create, by email or through Google, and your data then follows you from one device to another.</p>
        <h2>Tasks</h2>
        <p>The foundation. A task carries a name, a description, a priority from 1 to 5, a coloured category, a deadline and one or more lists. Filters combine to isolate what matters now, and lists serve lasting groupings (a client, a project, a course). A recurring task regenerates itself automatically when you tick it, and subtasks break down whatever is too big to start. Sharing is done by email, as Viewer or Editor, free of charge.</p>
        <h2>Habits</h2>
        <p>Create the habit, give it a duration, then tick it off as the days go by. A pause (holiday, illness) keeps your streak intact. The 26-week heatmap shows your real consistency, the streak counts consecutive days, and the completion rate situates the current period. The advice that changes everything: two or three habits at most when you start, even if you add more in a month. A list of fifteen habits almost always ends in giving up on all of them.</p>
        <h2>Calendar</h2>
        <p>The calendar accepts ordinary events, but its value lies elsewhere: drag a task from the side panel onto a slot and the event is created and stays linked to the task. That is <a href="/en/blog/time-blocking-guide">time-blocking</a>, and it is what turns a list of intentions into a realistic week. Day, week and month views, with recurring events managed from the same panel.</p>
        <h2>OKRs</h2>
        <p>One qualitative objective, 2 to 5 numeric key results. You update the current value of a key result, Cosmo recomputes the objective's progress and records each completion in your history, and that trace is what feeds the dashboard chart. If the method is new to you, the article <a href="/en/blog/methode-okr-exemples">the OKR method with 15 examples</a> gives you wordings ready to adapt.</p>
        <h2>Statistics</h2>
        <p>Time invested per category, how it evolves over the chosen period, comparison between modules. This is the page to open at the end of a week or a month: it answers "where did my time go?" with numbers rather than an impression, and that is often where the next adjustment gets decided.</p>
        <p><a href="/en/">Back to the home page</a> · <a href="/en/signup">Create a free account</a> · <a href="/en/blog">The blog</a></p>`,
};
