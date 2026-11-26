// Textes du bandeau qui propose une autre langue (LocaleSuggestionBanner).
// Écrits dans la langue PROPOSÉE, pas dans celle de la page : un anglophone sur
// la page française doit lire « This page is also available in English ». Ils
// ne peuvent donc pas venir du catalogue de la page en cours.
export const LOCALE_SUGGESTION = {
  fr: { message: 'Cette page existe aussi en français.', action: 'Passer en français', fermer: 'Fermer' },
  en: { message: 'This page is also available in English.', action: 'Switch to English', fermer: 'Close' },
  hr: { message: 'Ova stranica postoji i na hrvatskom.', action: 'Prijeđi na hrvatski', fermer: 'Zatvori' },
};
