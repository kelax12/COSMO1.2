// Le « chrome » du prérendu : les quelques mots qui entourent le contenu des
// registres (fils d'Ariane, liens de bas de page, durée de lecture).
//
// Ils vivent ici et non dans src/locales/ parce qu'ils n'existent QUE dans le
// repli indexable : aucun composant React ne les rend. Les sortir dans un
// catalogue ajouterait des clés que `i18n:check` exigerait de tenir sans que
// personne ne les voie jamais à l'écran.
import type { Locale } from '@/i18n/locale';
import { CONTACT_EMAIL } from '../src/lib/contact.mjs';
import { INDEXABLE_LOCALES, localizePath } from '../src/i18n/seo-urls.mjs';
import { requis } from './types.ts';

/** Libellé de la racine dans le fil d'Ariane, par locale. */
export const HOME_LABEL: Record<Locale, string> = { fr: 'Accueil', en: 'Home', es: 'Inicio' };

export interface UiChrome {
  blogTitle: string;
  blogIntro: (n: number) => string;
  readArticle: string;
  readingTime: (n: number) => string;
  readNext: string;
  allArticles: string;
  tryFree: string;
  home: string;
  blog: string;
  signup: string;
  guide: string;
  rss: string;
}

const UI: Partial<Record<Locale, UiChrome>> = {
  fr: {
    blogTitle: 'Le blog Cosmo',
    blogIntro: (n) =>
      `Guides pratiques sur la méthode OKR, le suivi d'habitudes, le time-blocking et la productivité personnelle. ${n} articles, écrits pour être utiles sans avoir à installer quoi que ce soit.`,
    readArticle: "Lire l'article",
    readingTime: (n) => `${n} min de lecture`,
    readNext: 'À lire ensuite',
    allArticles: '← Tous les articles',
    tryFree: 'Essayer Cosmo gratuitement',
    home: 'Accueil',
    blog: 'Blog',
    signup: 'Créer un compte gratuit',
    guide: "Guide d'utilisation",
    rss: 'Flux RSS',
  },
  en: {
    blogTitle: 'The Cosmo blog',
    blogIntro: (n) =>
      `Practical guides on the OKR method, habit tracking, time-blocking and personal productivity. ${n} articles, written to be useful without installing anything.`,
    readArticle: 'Read the article',
    readingTime: (n) => `${n} min read`,
    readNext: 'Read next',
    allArticles: '← All articles',
    tryFree: 'Try Cosmo for free',
    home: 'Home',
    blog: 'Blog',
    signup: 'Create a free account',
    guide: 'User guide',
    rss: 'RSS feed',
  },
};

type FooterKey =
  | 'guide' | 'enterprise' | 'blog' | 'freelancers' | 'students' | 'managers' | 'teams'
  | 'about' | 'signup' | 'login' | 'legalNotice' | 'privacy' | 'terms';

/**
 * Libellés du maillage interne de bas de page. Les LIBELLÉS se traduisent comme
 * les `href` : des liens vers `/en/...` sous des mots français annonceraient à un
 * crawler une page anglaise décrite en français.
 */
const FOOTER_LABELS: Partial<Record<Locale, Record<FooterKey, string>>> = {
  fr: {
    guide: "Guide d'utilisation",
    enterprise: 'Cosmo Entreprise',
    blog: 'Blog',
    freelancers: 'Pour les freelances',
    students: 'Pour les étudiants',
    managers: 'Pour les managers',
    teams: 'Pour les équipes',
    about: 'À propos',
    signup: 'Inscription gratuite',
    login: 'Connexion',
    legalNotice: 'Mentions légales',
    privacy: 'Confidentialité',
    terms: 'CGU',
  },
  en: {
    guide: 'User guide',
    enterprise: 'Cosmo for companies',
    blog: 'Blog',
    freelancers: 'For freelancers',
    students: 'For students',
    managers: 'For managers',
    teams: 'For teams',
    about: 'About',
    signup: 'Free sign-up',
    login: 'Sign in',
    legalNotice: 'Legal notice',
    privacy: 'Privacy',
    terms: 'Terms',
  },
};

/** Le chrome d'une locale indexable (vérifié complet au démarrage). */
export const uiFor = (locale: Locale): UiChrome => requis(UI[locale], `UI de la locale « ${locale} »`);

/**
 * Une locale qu'on ouvre à l'indexation sans lui écrire ce chrome produirait un
 * `undefined` au milieu d'un fil d'Ariane, silencieusement. On échoue au build.
 */
export function verifierLocalesIndexables(): void {
  for (const locale of INDEXABLE_LOCALES) {
    if (!UI[locale]) {
      throw new Error(
        `prerender: la locale « ${locale} » est indexable mais n'a pas d'entrée dans UI (prerender/chrome.ts).`
      );
    }
    if (!HOME_LABEL[locale]) {
      throw new Error(
        `prerender: la locale « ${locale} » est indexable mais n'a pas de HOME_LABEL (prerender/chrome.ts).`
      );
    }
    if (!FOOTER_LABELS[locale]) {
      throw new Error(
        `prerender: la locale « ${locale} » est indexable mais n'a pas d'entrée dans FOOTER_LABELS (prerender/chrome.ts).`
      );
    }
  }
}

/**
 * Maillage interne statique ajouté au bas de #seo-fallback sur TOUTES les
 * routes : les crawlers sans JS ne suivent que ces liens pour établir les
 * entrantes. Les `href` sont localisés, sinon le crawler partirait sur la
 * version française et casserait le cloisonnement des langues.
 */
export const staticFooterNav = (locale: Locale): string => {
  const label = requis(FOOTER_LABELS[locale], `FOOTER_LABELS de la locale « ${locale} »`);
  const link = (path: string, key: FooterKey) => `<a href="${localizePath(path, locale)}">${label[key]}</a>`;
  return `<p>${[
    link('/guide', 'guide'),
    link('/entreprise-presentation', 'enterprise'),
    link('/blog', 'blog'),
    link('/pour-freelances', 'freelancers'),
    link('/pour-etudiants', 'students'),
    link('/pour-managers', 'managers'),
    link('/pour-equipes', 'teams'),
    link('/a-propos', 'about'),
    link('/signup', 'signup'),
    link('/login', 'login'),
    link('/mentions-legales', 'legalNotice'),
    link('/politique-confidentialite', 'privacy'),
    link('/cgu', 'terms'),
    // Adresse de contact : lisible par un crawler sans JS, comme le pied de page React.
    `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`,
  ].join(' · ')}</p>`;
};
