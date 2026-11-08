// Corps indexable de /a-propos (fr, en).
// Gabarits HTML du prérendu, injectés tels quels dans #seo-fallback.
import type { LocaleContent } from '../types.ts';

export const ABOUT_CONTENT: LocaleContent = {
  fr: `<h1>À propos de Cosmo</h1>
        <p>Cosmo est une application de productivité française, gratuite et tout-en-un : tâches, habitudes, agenda avec time-blocking et OKR connectés dans un seul écosystème. Produit indépendant, développé en France.</p>

        <h2>Pourquoi Cosmo existe</h2>
        <p>La plupart des gens organisés utilisent trois ou quatre outils : un gestionnaire de tâches, un traqueur d'habitudes, un agenda, et un tableur pour les objectifs annuels qu'on rouvre deux fois par an. Chacun fait bien son travail, aucun ne voit l'ensemble. Résultat : les objectifs de fond n'ont aucun poids face à l'urgence du jour, parce qu'ils ne sont écrits nulle part où on regarde tous les matins.</p>
        <p>Cosmo est né de ce constat. Réunir les quatre dans un seul produit ne relève pas de la commodité : c'est ce qui permet à un objectif trimestriel de descendre en tâches concrètes, à une tâche de recevoir un vrai créneau dans l'agenda, et aux statistiques de montrer l'écart entre ce que vous visez et ce que vous faites. Aucun de ces liens n'est possible quand les données vivent dans quatre applications séparées.</p>

        <h2>Nos partis pris</h2>
        <ul>
          <li><strong>Gratuit pour l'essentiel.</strong> Tâches, habitudes, agenda, OKR, statistiques et partage de tâches sont gratuits, sans carte bancaire ni essai à durée limitée. La collaboration en particulier restera gratuite : une app d'organisation qui fait payer le fait d'inviter quelqu'un se prive de la seule chose qui la rend utile à plusieurs.</li>
          <li><strong>Utilisable en deux minutes.</strong> Le mode démo ouvre l'application complète, pré-remplie de 12 mois de données réalistes, sans compte ni email. On juge un outil d'organisation chargé, pas devant un écran vide.</li>
          <li><strong>Mobile d'abord.</strong> Cosmo se conçoit d'abord pour un téléphone tenu à une main, puis s'élargit à l'écran d'ordinateur, pas l'inverse. Aucune installation : tout fonctionne dans le navigateur.</li>
          <li><strong>Vos données vous appartiennent.</strong> Stockage Supabase avec Row Level Security : chaque ligne est cloisonnée à son propriétaire au niveau de la base, pas seulement dans l'interface. En mode démo, rien ne quitte votre navigateur. Suppression de compte définitive et complète, sur demande depuis les réglages.</li>
        </ul>

        <h2>Cosmo, The Cosmo App ou thecosmo ?</h2>
        <p>Les trois désignent la même application : Cosmo, accessible à l'adresse thecosmo.app. On nous cherche aussi sous « Cosmo app », « The Cosmo » ou « thecosmo app », c'est toujours nous. Plusieurs autres produits sans rapport portent le nom « Cosmo » (une radio allemande, des applications mobiles diverses) : Cosmo est une application web de productivité, sans téléchargement, et son seul site officiel est thecosmo.app.</p>

        <h2>Nous écrire</h2>
        <p>Le projet est développé par une équipe indépendante, en France. Une question, un bug, une idée de fonctionnalité, une demande presse : écrivez à contact@thecosmo.app : les retours d'utilisateurs orientent réellement la feuille de route.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/blog">Blog</a> · <a href="/guide">Guide d'utilisation</a></p>`,
  en: `<h1>About Cosmo</h1>
        <p>Cosmo is a free, all-in-one productivity application built in France: tasks, habits, a calendar with time-blocking and OKRs connected in a single ecosystem. An independent product, developed in France.</p>

        <h2>Why Cosmo exists</h2>
        <p>Most organised people use three or four tools: a task manager, a habit tracker, a calendar, and a spreadsheet for the annual goals they reopen twice a year. Each does its job well, none sees the whole. The result is that underlying goals carry no weight against the urgency of the day, because they are not written anywhere you look every morning.</p>
        <p>Cosmo came out of that observation. Bringing the four together in one product is not a convenience: it is what lets a quarterly goal come down into concrete tasks, a task receive a real slot in the calendar, and the statistics show the gap between what you are aiming at and what you actually do. None of those links is possible when the data lives in four separate applications.</p>

        <h2>What we have chosen</h2>
        <ul>
          <li><strong>Free for the essentials.</strong> Tasks, habits, calendar, OKRs, statistics and task sharing are free, with no credit card and no time-limited trial. Collaboration in particular will stay free: an organisation app that charges you for inviting somebody removes the one thing that makes it useful with other people.</li>
          <li><strong>Usable in two minutes.</strong> Demo mode opens the complete application, pre-filled with 12 months of realistic data, with no account and no email. You judge an organisation tool loaded, not in front of an empty screen.</li>
          <li><strong>Mobile first.</strong> Cosmo is designed first for a phone held in one hand, then widened to a desktop screen, not the other way round. Nothing to install: it all works in the browser.</li>
          <li><strong>Your data belongs to you.</strong> Storage on Supabase with Row Level Security: every row is partitioned to its owner at database level, not just in the interface. In demo mode nothing leaves your browser. Account deletion is permanent and complete, on request from the settings.</li>
        </ul>

        <h2>Cosmo, The Cosmo App or thecosmo?</h2>
        <p>All three refer to the same application: Cosmo, available at thecosmo.app. People also look for us as "Cosmo app", "The Cosmo" or "thecosmo app", and that is always us. Several unrelated products carry the name Cosmo (a German radio station, various mobile apps): Cosmo is a web productivity application, with nothing to download, and its only official site is thecosmo.app.</p>

        <h2>Write to us</h2>
        <p>The project is developed by an independent team, in France. A question, a bug, a feature idea, a press request: write to contact@thecosmo.app, because user feedback genuinely steers the roadmap.</p>
        <p><a href="/en/">Home</a> · <a href="/en/signup">Create a free account</a> · <a href="/en/blog">Blog</a> · <a href="/en/guide">User guide</a></p>`,
};
