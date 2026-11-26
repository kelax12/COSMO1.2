// Toutes les langues du contenu éditorial, enregistrées d'office : réservé au
// prérendu (Node), importé EN PREMIER par prerender/main.ts.
import { registerArticleLocale } from './blog/index.mjs';
import { registerUseCaseLocale } from './use-cases.mjs';
import { HR as BLOG_HR } from './blog/hr.mjs';
import { EN as BLOG_EN } from './blog/en.mjs';
import { HR as USE_CASES_HR } from './use-cases.hr.mjs';

registerArticleLocale('en', BLOG_EN);
registerArticleLocale('hr', BLOG_HR);
registerUseCaseLocale('hr', USE_CASES_HR);
