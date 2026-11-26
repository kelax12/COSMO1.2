import type { Locale } from '@/i18n/locale';
export interface LocaleSuggestionText { message: string; action: string; fermer: string }
export declare const LOCALE_SUGGESTION: Partial<Record<Locale, LocaleSuggestionText>>;
