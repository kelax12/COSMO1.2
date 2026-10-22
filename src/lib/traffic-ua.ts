// Lecture grossière d'un user-agent : navigateur, système, type d'appareil.
// Partagée par le collecteur (`api/collect.ts`) et ses tests. Volontairement
// sans dépendance : une mesure d'audience n'a pas besoin de plus que des
// familles, et la version n'est jamais retenue.

export interface UaFacts {
  browser: string;
  os: string;
  device: 'mobile' | 'tablet' | 'desktop';
  bot: boolean;
}

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|monitor|curl|wget|python|node-fetch|axios/i;

export function parseUserAgent(ua: string): UaFacts {
  const s = ua || '';
  const bot = s === '' || BOT_RE.test(s);

  // L'ordre compte : Edge et Opera se déclarent aussi « Chrome », Chrome se
  // déclare aussi « Safari ».
  const browser =
    /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /SamsungBrowser/.test(s) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(s) ? 'Firefox'
    : /CriOS|Chrome\//.test(s) ? 'Chrome'
    : /Safari\//.test(s) ? 'Safari'
    : 'Autre';

  const os =
    /iPhone|iPad|iPod/.test(s) ? 'iOS'
    : /Android/.test(s) ? 'Android'
    : /Windows/.test(s) ? 'Windows'
    : /Mac OS X|Macintosh/.test(s) ? 'macOS'
    : /CrOS/.test(s) ? 'ChromeOS'
    : /Linux/.test(s) ? 'Linux'
    : 'Autre';

  const device: UaFacts['device'] =
    /iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s)) ? 'tablet'
    : /Mobi|iPhone|iPod|Android/.test(s) ? 'mobile'
    : 'desktop';

  return { browser, os, device, bot };
}
