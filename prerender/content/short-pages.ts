// Corps indexables des pages courtes : inscription, connexion, trois pages légales.
// Gabarits HTML du prérendu, injectés tels quels dans #seo-fallback.
import type { LocaleContent } from '../types.ts';

export const SIGNUP_CONTENT: LocaleContent = {
  fr: `<h1>Créer un compte Cosmo gratuit</h1>
        <p>Inscrivez-vous gratuitement pour gérer vos tâches, habitudes, agenda et OKR dans une seule application. Connexion possible via Google.</p>
        <p><a href="/">Accueil</a> · <a href="/login">J'ai déjà un compte</a></p>`,
  en: `<h1>Create a free Cosmo account</h1>
        <p>Sign up free to manage your tasks, habits, calendar and OKRs in a single application. You can also sign in with Google.</p>
        <p><a href="/en/">Home</a> · <a href="/en/login">I already have an account</a></p>`,
};

export const LOGIN_CONTENT: LocaleContent = {
  fr: `<h1>Connexion à Cosmo</h1>
        <p>Connectez-vous pour retrouver vos tâches, habitudes, agenda et objectifs OKR.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
  en: `<h1>Sign in to Cosmo</h1>
        <p>Sign in to find your tasks, habits, calendar and OKR goals again.</p>
        <p><a href="/en/">Home</a> · <a href="/en/signup">Create a free account</a></p>`,
};

export const TERMS_CONTENT: LocaleContent = {
  fr: `<h1>Conditions Générales d'Utilisation</h1>
        <p>Conditions générales d'utilisation de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
  // ⚠️ Le francais fait foi : chaque document contractuel porte une clause de
  // langue le disant. Ce bloc est un resume indexable, pas le contrat.
  en: `<h1>Terms of Service</h1>
        <p>Terms of service for the Cosmo application. The French version prevails. <a href="/en/">Back to the home page</a></p>`,
};

export const LEGAL_NOTICE_CONTENT: LocaleContent = {
  fr: `<h1>Mentions légales</h1>
        <p>Mentions légales de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
  en: `<h1>Legal notice</h1>
        <p>Legal notice for the Cosmo application. The French version prevails. <a href="/en/">Back to the home page</a></p>`,
};

export const PRIVACY_CONTENT: LocaleContent = {
  fr: `<h1>Politique de confidentialité</h1>
        <p>Politique de confidentialité de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
  en: `<h1>Privacy policy</h1>
        <p>Privacy policy for the Cosmo application. The French version prevails. <a href="/en/">Back to the home page</a></p>`,
};
