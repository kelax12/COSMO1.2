import { useEffect } from 'react';

interface SeoMeta {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
}

const ROOT_TITLE = 'Cosmo – Gestionnaire de tâches, habitudes et OKR | App productivité gratuite';
const ROOT_DESC = 'Cosmo centralise tâches, habitudes, agenda et OKR dans une seule application gratuite. Méthode OKR, heatmap habitudes, time-blocking, statistiques multi-modules. Essayez sans inscription.';
const ROOT_CANONICAL = 'https://thecosmo.app/';

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

    return () => {
      document.title = ROOT_TITLE;
      setMeta('description', ROOT_DESC);
      setOgMeta('og:description', ROOT_DESC);
      setOgMeta('og:title', ROOT_TITLE);
      document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', ROOT_TITLE);
      document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', ROOT_DESC);
      setCanonical(ROOT_CANONICAL);
    };
  }, [title, description, canonical, ogTitle, ogDescription]);
}
