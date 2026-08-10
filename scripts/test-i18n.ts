import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readDictionary = (language: "nl" | "fr" | "de") =>
  JSON.parse(readFileSync(join(root, "locales", `${language}.json`), "utf8")) as Record<string, string>;

const dictionaries = {
  nl: readDictionary("nl"),
  fr: readDictionary("fr"),
  de: readDictionary("de"),
};
const sourceKeys = Object.keys(dictionaries.nl).sort();

for (const language of ["fr", "de"] as const) {
  const dictionary = dictionaries[language];
  assert.deepEqual(
    Object.keys(dictionary).sort(),
    sourceKeys,
    `${language} must contain exactly the Dutch source translation keys.`,
  );

  for (const key of sourceKeys) {
    assert.ok(dictionary[key]?.trim(), `${language} translation is empty for ${key}.`);
  }
}

const forbiddenFallbacks: Array<[key: string, value: string]> = [
  ["salesday.dashboard.readinessTitle", "Production readiness"],
  ["impersonation.role.SALES_MANAGER", "Sales Manager"],
  ["impersonation.role.COUNTRY_MANAGER", "Country Manager"],
  ["impersonation.role.GROUP_MANAGER", "Group Manager"],
  ["representativeLevel.SALES_EXECUTIVE", "Sales Executive"],
  ["representativeLevel.PROFESSIONAL", "Professional"],
];

for (const language of ["fr", "de"] as const) {
  for (const [key, fallback] of forbiddenFallbacks) {
    assert.notEqual(
      dictionaries[language][key],
      fallback,
      `${language} still contains the untranslated value for ${key}.`,
    );
  }
}

console.log("Nederlandse, Franse en Duitse woordenboeken zijn volledig en bevatten geen bekende onvertaalde waarden.");
