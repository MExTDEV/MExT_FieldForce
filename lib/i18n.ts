import nl from "@/locales/nl.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import type { Language } from "@/lib/types";

const dictionaries = { nl, fr, de } as const;

export type TranslationKey = keyof typeof nl;

export function translate(language: Language, key: TranslationKey) {
  return dictionaries[language][key] ?? dictionaries.nl[key] ?? key;
}
