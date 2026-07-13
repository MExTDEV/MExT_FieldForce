import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const component = readFileSync(join(root, "components", "contact-help-workflows.tsx"), "utf8");
const locales = {
  nl: JSON.parse(readFileSync(join(root, "locales", "nl.json"), "utf8")) as Record<string, string>,
  fr: JSON.parse(readFileSync(join(root, "locales", "fr.json"), "utf8")) as Record<string, string>,
  de: JSON.parse(readFileSync(join(root, "locales", "de.json"), "utf8")) as Record<string, string>,
};

const requiredKeys = [
  "contactHelp.contact.unavailableTitle",
  "contactHelp.contact.pageTitle",
  "contactHelp.contact.newAction",
  "contactHelp.contact.sectionOpenTitle",
  "contactHelp.contact.sectionClosedTitle",
  "contactHelp.contact.newTitle",
  "contactHelp.contact.save",
  "contactHelp.contact.detailUpdatedTitle",
  "contactHelp.contact.start",
  "contactHelp.contact.share",
  "contactHelp.contact.photosTitle",
  "contactHelp.contact.addPhoto",
  "contactHelp.contact.cancel",
  "contactHelp.contact.notExecuted",
  "contactHelp.help.unavailableTitle",
  "contactHelp.help.pageTitle",
  "contactHelp.help.newAction",
  "contactHelp.help.newTitle",
  "contactHelp.help.submit",
  "contactHelp.help.detailUpdatedTitle",
  "contactHelp.help.questionTitle",
  "contactHelp.help.followUpTitle",
  "contactHelp.help.send",
  "contactHelp.help.yourAnswer",
  "contactHelp.help.sendRepresentativeAnswer",
  "contactHelp.help.descriptionPlaceholder",
  "contactHelp.help.answerPlaceholder",
  "contactHelp.help.chooseFollowUpPlaceholder",
  "contactHelp.followUp.close",
  "contactHelp.followUp.response",
  "contactHelp.editor.bold",
  "contactHelp.editor.italic",
  "contactHelp.editor.bulletList",
  "contactHelp.editor.numberedList",
  "contactHelp.form.optional",
  "contactHelp.form.richTextPlaceholder",
  "contactHelp.form.richTextHelp",
] as const;

const forbiddenFragments = [
  "Contactmoment niet beschikbaar",
  "Nieuw contactmoment",
  "Nieuwe en lopende contactmomenten",
  "Contactmoment voorbereiden",
  "Afronden en delen",
  "Foto toevoegen",
  "Hulpaanvraag niet beschikbaar",
  "Nieuwe hulpaanvraag",
  "Hulpaanvraag toevoegen",
  "Hulpaanvraag indienen",
  "Antwoord versturen",
  "Vervolgactie opslaan",
  "HTML-opmaak wordt bij opslag server-side opgeschoond.",
] as const;

const failures: string[] = [];

for (const key of requiredKeys) {
  for (const [language, dictionary] of Object.entries(locales)) {
    if (!dictionary[key]?.trim()) {
      failures.push(`Missing ${language} translation for ${key}`);
    }
  }
}

if (!component.includes("translate(")) {
  failures.push("components/contact-help-workflows.tsx must use translate() for fixed UI copy.");
}

for (const fragment of forbiddenFragments) {
  if (component.includes(fragment)) {
    failures.push(`Hardcoded UI copy remains in contact-help-workflows.tsx: ${fragment}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Contactmomenten/Hulpaanvragen i18n coverage looks complete.");
