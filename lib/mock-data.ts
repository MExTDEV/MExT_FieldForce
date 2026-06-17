import type { MockUser, Representative, Status } from "@/lib/types";

export const mockUsers: MockUser[] = [
  {
    id: "user-leader-be",
    name: "Sophie Vermeulen",
    email: "sophie.vermeulen@mext.local",
    role: "SALES_LEADER",
    country: "BE",
    language: "nl",
    teamId: "be-1",
  },
  {
    id: "user-rep-be",
    name: "Jonas Peeters",
    email: "jonas.peeters@mext.local",
    role: "REPRESENTATIVE",
    country: "BE",
    language: "nl",
    teamId: "be-1",
    representativeId: "rep-1",
  },
  {
    id: "user-country-de",
    name: "Anna Weber",
    email: "anna.weber@mext.local",
    role: "COUNTRY_MANAGER",
    country: "DE",
    language: "de",
  },
  {
    id: "user-group",
    name: "Marc Dubois",
    email: "marc.dubois@mext.local",
    role: "GROUP_MANAGER",
    country: "BE",
    language: "fr",
  },
  {
    id: "user-admin",
    name: "Lena Janssen",
    email: "lena.janssen@mext.local",
    role: "ADMIN",
    country: "NL",
    language: "nl",
  },
  {
    id: "user-super",
    name: "Alex Morgan",
    email: "alex.morgan@mext.local",
    role: "SUPER_ADMIN",
    country: "BE",
    language: "nl",
  },
];

const people = [
  ["Jonas", "Peeters", "BE", "BE Team 1", "be-1", "Professional"],
  ["Lotte", "Jacobs", "BE", "BE Team 1", "be-1", "Starter"],
  ["Bram", "Willems", "BE", "BE Team 1", "be-1", "Expert"],
  ["Emma", "Maes", "BE", "BE Team 2", "be-2", "Vertegenwoordiger"],
  ["Noah", "De Smet", "BE", "BE Team 2", "be-2", "Professional"],
  ["Mila", "Verhoeven", "NL", "NL Team 1", "nl-1", "Professional"],
  ["Daan", "Bakker", "NL", "NL Team 1", "nl-1", "Starter"],
  ["Sophie", "De Jong", "NL", "NL Team 2", "nl-2", "Expert"],
  ["Lukas", "Schneider", "DE", "DE Team 1", "de-1", "Professional"],
  ["Mia", "Fischer", "DE", "DE Team 1", "de-1", "Vertegenwoordiger"],
  ["Leon", "Wagner", "DE", "DE Team 2", "de-2", "Starter"],
  ["Clara", "Becker", "DE", "DE Team 3", "de-3", "Expert"],
] as const;

const levelColors: Record<string, string> = {
  Starter: "bg-amber-100 text-amber-800",
  Vertegenwoordiger: "bg-sky-100 text-sky-800",
  Professional: "bg-indigo-100 text-indigo-800",
  Expert: "bg-emerald-100 text-emerald-800",
};

export const representatives: Representative[] = people.map((person, index) => ({
  id: `rep-${index + 1}`,
  firstName: person[0],
  lastName: person[1],
  initials: `${person[0][0]}${person[1][0]}`,
  country: person[2],
  team: person[3],
  teamId: person[4],
  level: person[5],
  levelColor: levelColors[person[5]],
  lastCoaching: index % 4 === 1 ? "Nog niet" : `${4 + index} mei 2026`,
  openActions: (index * 3) % 5,
  email: `${person[0].toLowerCase()}.${person[1].toLowerCase().replace(" ", "")}@mext.local`,
  phone: `+${person[2] === "BE" ? "32" : person[2] === "NL" ? "31" : "49"} 4${70 + index} 12 34 56`,
  kpis: [
    { label: "PV %", value: `${71 + (index % 12)}%`, target: "80%", trend: index % 3 - 1 },
    { label: "Sales / Day", value: `€ ${1180 + index * 35}`, target: "€ 1.350", trend: index % 2 ? 1 : -1 },
    { label: "Q %", value: `${43 + (index % 9)}%`, target: "50%", trend: 1 },
    { label: "FM / Order", value: `${2.4 + (index % 5) / 10}`, target: "2,8", trend: index % 3 - 1 },
  ],
}));

export const interventions = [
  { id: "int-1", type: "begeleiding", person: "Jonas Peeters", date: "12 jun 2026", owner: "Sophie Vermeulen", status: "gepland" },
  { id: "int-2", type: "begeleiding", person: "Lotte Jacobs", date: "14 jun 2026", owner: "Sophie Vermeulen", status: "wacht_op_vt" },
  { id: "int-3", type: "contactmoment", person: "Bram Willems", date: "9 jun 2026", owner: "Sophie Vermeulen", status: "afgesloten" },
  { id: "int-4", type: "retraining", person: "Emma Maes", date: "18 jun 2026", owner: "Thomas Martens", status: "gepland" },
  { id: "int-5", type: "sales_training", person: "BE Team 1", date: "24 jun 2026", owner: "Sophie Vermeulen", status: "gepland" },
  { id: "int-6", type: "hulpaanvraag", person: "Jonas Peeters", date: "Vandaag", owner: "Sophie Vermeulen", status: "in_uitvoering" },
  { id: "int-7", type: "begeleiding", person: "Noah De Smet", date: "7 jun 2026", owner: "Thomas Martens", status: "wacht_op_akkoord" },
] satisfies { id: string; type: string; person: string; date: string; owner: string; status: Status }[];

export const actionPoints = [
  { id: "ap-1", person: "Jonas Peeters", title: "PV verhogen naar 80%", type: "kpi", priority: "hoog", status: "in_uitvoering", due: "30 jun 2026", progress: 64 },
  { id: "ap-2", person: "Lotte Jacobs", title: "Meer open vragen stellen", type: "vaardigheid", priority: "normaal", status: "nieuw", due: "18 jun 2026", progress: 15 },
  { id: "ap-3", person: "Bram Willems", title: "Tablet bij elke afsluiting", type: "gedrag", priority: "normaal", status: "behaald", due: "8 jun 2026", progress: 100 },
  { id: "ap-4", person: "Emma Maes", title: "Koppelverkoop toepassen", type: "vaardigheid", priority: "hoog", status: "in_uitvoering", due: "21 jun 2026", progress: 45 },
  { id: "ap-5", person: "Noah De Smet", title: "Sales per order naar € 310", type: "kpi", priority: "laag", status: "niet_behaald", due: "31 mei 2026", progress: 72 },
];

export const coachingFramework = [
  { name: "Introductie", color: "bg-blue-500", criteria: ["Zichzelf en MExT voorstellen", "Bedanken voor de tijd"] },
  {
    name: "Behoefteanalyse",
    color: "bg-violet-500",
    criteria: [
      "IJsbreken",
      "Goede atmosfeer creëren",
      "MExT voorstelling",
      "Service uitleggen",
      "Praktisch en wettelijk gamma uitleggen",
      "MExT voordelen uitleggen",
      "Open vragen stellen",
      "Gesloten vragen / bevestiging gebruiken",
    ],
  },
  {
    name: "Demonstratie",
    color: "bg-cyan-500",
    criteria: [
      "Pancarte gebruiken",
      "Showroom gebruiken",
      "Aantal producten / brede verkoop",
      "Koppelverkoop",
      "Voordelen producten uitleggen",
      "Interactie met klant",
    ],
  },
  {
    name: "Afsluiten",
    color: "bg-amber-500",
    criteria: ["Herhalen voordelen", "Reactie op bezwaren", "Q en prijs verdedigen", "Tablet gebruiken", "Order noteren"],
  },
  {
    name: "Koffercontrole",
    color: "bg-emerald-500",
    criteria: [
      "Controlelijst",
      "Non-conforme producten",
      "Tevredenheid bij klant",
      "Contant innen",
      "Controle order / levering",
      "Directe levering / aanvulling koffer",
      "Repeat atmosfeer",
    ],
  },
];

export const kpiDefinitions = [
  "PV %",
  "KV %",
  "Q %",
  "Sales / Day",
  "FM / Order",
  "Sales / Order",
  "Total Sales",
  "Leadgeneratie",
  "Prospect vs Klant verkoop",
  "Cash vs Overschrijving",
];
