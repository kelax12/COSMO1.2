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
 * Applique les méta de la RACINE (titre, description, canonical) à la page.
 *
 * Pour la landing, qui n'a pas de méta propres : sans ce hook, le `<title>`
 * statique d'`index.html` — écrit en français — restait affiché sur `/en/`.
 * `useSeoMeta` ne les posait qu'au DÉMONTAGE, pour restaurer l'état d'origine.
 */
export function useRootSeoMeta() {
  const root = rootMeta();
  useSeoMeta({ title: root.title, description: root.description, canonical: root.canonical });
}

/** Étiquette BCP 47 de la locale courante — pour les JSON-LD construits côté client. */
export function currentInLanguage(): string {
  return BCP47_TAG[localeStore.locale];
}
