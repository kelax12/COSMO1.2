import { useEffect } from 'react';
import { resolveMessage } from '@/i18n/catalog';
import { BCP47_TAG, OG_LOCALE } from '@/i18n/locale';
import { canonicalUrl } from '@/i18n/routes';
import { localeStore } from '@/i18n/store';

interface SeoMeta {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * Méta de la racine, restaurées au démontage.
 *
 * Lues dans `src/locales/<locale>/seo.json` — le MÊME fichier que
 * `prerender.mjs`. C'est ce qui garantit qu'une page prérendue et la même page
 * rendue côté client annoncent exactement le même titre : une divergence entre
 * les deux ferait osciller le titre indexé par Google.
 */
function rootMeta() {
  const locale = localeStore.locale;
  return {
    title: resolveMessage('seo', 'root.title', locale) ?? '',
    description: resolveMessage('seo', 'root.description', locale) ?? '',
    canonical: canonicalUrl('/', locale),
    locale,
  };
}

function setMeta(name: string, content: string) {
  const el = document.querySelector(`meta[name="${name}"]`);
  if (el) el.setAttribute('content', content);
}

function setOgMeta(property: string, content: string) {
  const el = document.querySelector(`meta[property="${property}"]`);
  if (el) el.setAttribute('content', content);
}

function setCanonical(href: string) {
  const el = document.querySelector('link[rel="canonical"]');
  if (el) el.setAttribute('href', href);
}

export function useSeoMeta({ title, description, canonical, ogTitle, ogDescription }: SeoMeta) {
  useEffect(() => {
    const root = rootMeta();

    document.title = title;
    if (description) {
      setMeta('description', description);
      setOgMeta('og:description', ogDescription ?? description);
      document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', ogDescription ?? description);
    }
    if (ogTitle ?? title) {
      setOgMeta('og:title', ogTitle ?? title);
      document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', ogTitle ?? title);
    }
    if (canonical) setCanonical(canonical);

    // La locale du document peut différer de celle d'index.html quand l'app est
    // servie sous un préfixe (`/en/...`) : les balises Open Graph doivent suivre.
    setOgMeta('og:locale', OG_LOCALE[root.locale]);
    document.documentElement.setAttribute('lang', root.locale);

    return () => {
      document.title = root.title;
      setMeta('description', root.description);
      setOgMeta('og:description', root.description);
      setOgMeta('og:title', root.title);
      document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', root.title);
      document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', root.description);
      setCanonical(root.canonical);
    };
  }, [title, description, canonical, ogTitle, ogDescription]);
}

/**
 * Méta de la landing selon son parcours.
 *
 * Sans ce hook, le `<title>` statique d'`index.html`, écrit en français,
 * restait affiché sur `/en/` : `useSeoMeta` ne pose les méta racine qu'au
 * DÉMONTAGE, pour restaurer l'état d'origine.
 *
 * `/` et `/entreprise-presentation` rendent le MÊME composant. Avant le
 * 2026-10-12, les deux posaient les méta de la racine : le HTML prérendu de la
 * page entreprise était juste, puis React réécrivait son titre, sa description
 * et son canonical vers la HOME. Google, qui rend le JS, voyait donc la page
 * qui porte l'offre payante se déclarer doublon de l'accueil (Lighthouse :
 * audit `canonical` en échec, SEO 92). Le parcours perso garde les méta racine.
 */
export function useLandingSeoMeta(track: 'perso' | 'entreprise') {
  const root = rootMeta();
  const enterprise = track === 'entreprise';
  const key = enterprise ? 'enterprisePresentation' : 'root';
  useSeoMeta({
    title: resolveMessage('seo', `${key}.title`, root.locale) ?? root.title,
    description: resolveMessage('seo', `${key}.description`, root.locale) ?? root.description,
    canonical: enterprise ? canonicalUrl('/entreprise-presentation', root.locale) : root.canonical,
  });
}

/** Étiquette BCP 47 de la locale courante — pour les JSON-LD construits côté client. */
export function currentInLanguage(): string {
  return BCP47_TAG[localeStore.locale];
}
