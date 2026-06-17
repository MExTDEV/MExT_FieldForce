import {
  ActionPointStatus,
  ActionPointType,
  Country,
  InterventionStatus,
  InterventionType,
  Language,
  PrismaClient,
  Priority,
  Role,
  TeamLeaderType,
  type User,
} from "@prisma/client";

const prisma = new PrismaClient();

const countryConfig = {
  BE: { representatives: 30, leaders: 3, teams: 3, language: Language.nl },
  NL: { representatives: 20, leaders: 3, teams: 3, language: Language.nl },
  DE: { representatives: 35, leaders: 4, teams: 4, language: Language.de },
} satisfies Record<Country, { representatives: number; leaders: number; teams: number; language: Language }>;

const firstNames = ["Alex", "Sam", "Robin", "Noa", "Lou", "Milan", "Emma", "Lina", "Lucas", "Sofie", "Max", "Anna"];
const lastNames = ["Peeters", "Janssen", "Willems", "De Smet", "Bakker", "Visser", "Schneider", "Weber", "Fischer", "Wagner"];

async function main() {
  await prisma.appModule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.productAnalysis.deleteMany();
  await prisma.product.deleteMany();
  await prisma.helpRequest.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.reflection.deleteMany();
  await prisma.actionPoint.deleteMany();
  await prisma.score.deleteMany();
  await prisma.interventionFocus.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.coachingCriterion.deleteMany();
  await prisma.coachingFocus.deleteMany();
  await prisma.kpiSnapshot.deleteMany();
  await prisma.kpiDefinition.deleteMany();
  await prisma.teamLeader.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.level.deleteMany();

  await prisma.appModule.createMany({
    data: [
      { code: "PLANNING", naam: "Planning", actief: true },
      { code: "BEGELEIDINGEN", naam: "Begeleidingen", actief: true },
      { code: "CONTACTMOMENTEN", naam: "Contactmomenten", actief: false },
      { code: "RETRAININGEN", naam: "Retrainingen", actief: false },
      { code: "SALESTRAININGEN", naam: "Salestrainingen", actief: false },
      { code: "HULPAANVRAGEN", naam: "Hulpaanvragen", actief: false },
      { code: "ACTIEPUNTEN", naam: "Actiepunten", actief: false },
      { code: "RAPPORTERING", naam: "Rapportering", actief: false },
    ],
  });

  const levels = await Promise.all(
    [
      ["Starter", "Nieuwe vertegenwoordiger in onboarding", "#F59E0B"],
      ["Vertegenwoordiger", "Zelfstandig in de basisrol", "#0EA5E9"],
      ["Professional", "Consistent sterke uitvoering", "#6366F1"],
      ["Expert", "Voorbeeldrol en coachende senior", "#10B981"],
    ].map(([name, description, color]) => prisma.level.create({ data: { name, description, color } }))
  );

  const kpiData = [
    ["PV_PERCENT", "PV %", "%"],
    ["KV_PERCENT", "KV %", "%"],
    ["Q_PERCENT", "Q %", "%"],
    ["SALES_DAY", "Sales / Day", "EUR"],
    ["FM_ORDER", "FM / Order", "number"],
    ["SALES_ORDER", "Sales / Order", "EUR"],
    ["TOTAL_SALES", "Total Sales", "EUR"],
    ["LEADS", "Leadgeneratie", "number"],
    ["PROSPECT_CUSTOMER", "Prospect vs Klant verkoop", "%"],
    ["CASH_TRANSFER", "Cash vs Overschrijving", "%"],
  ];
  const kpis = await Promise.all(
    kpiData.map(([code, name, unit]) =>
      prisma.kpiDefinition.create({ data: { code, name, description: `${name} coaching KPI`, unit } })
    )
  );

  const leadersByCountry = new Map<Country, { id: string }[]>();
  for (const country of Object.values(Country)) {
    const config = countryConfig[country];
    const leaders = [];
    for (let index = 0; index < config.leaders; index++) {
      leaders.push(
        await prisma.user.create({
          data: {
            firstName: `Leader ${country}`,
            lastName: `${index + 1}`,
            email: `leader.${country.toLowerCase()}.${index + 1}@mext.local`,
            role: Role.SALES_LEADER,
            country,
            language: config.language,
          },
        })
      );
    }
    leadersByCountry.set(country, leaders);
  }

  const teamsByCountry = new Map<Country, { id: string; primaryLeaderId: string }[]>();
  for (const country of Object.values(Country)) {
    const config = countryConfig[country];
    const leaders = leadersByCountry.get(country)!;
    const teams = [];
    for (let index = 0; index < config.teams; index++) {
      const leader = leaders[index % leaders.length];
      const team = await prisma.team.create({
        data: {
          name: `${country} Team ${index + 1}`,
          country,
          primaryLeaderId: leader.id,
          leaders: { create: { userId: leader.id, type: TeamLeaderType.PRIMARY } },
        },
      });
      teams.push(team);
    }
    teamsByCountry.set(country, teams);
  }

  const representatives: User[] = [];
  for (const country of Object.values(Country)) {
    const config = countryConfig[country];
    const teams = teamsByCountry.get(country)!;
    for (let index = 0; index < config.representatives; index++) {
      const sequence: number = representatives.length + 1;
      representatives.push(
        await prisma.user.create({
          data: {
            firstName: firstNames[index % firstNames.length],
            lastName: `${lastNames[index % lastNames.length]} ${sequence}`,
            email: `representative.${sequence}@mext.local`,
            role: Role.REPRESENTATIVE,
            country,
            language: config.language,
            teamId: teams[index % teams.length].id,
            levelId: levels[index % levels.length].id,
          },
        })
      );
    }
  }

  for (const country of Object.values(Country)) {
    for (let index = 0; index < 5; index++) {
      await prisma.user.create({
        data: {
          firstName: `Country ${country}`,
          lastName: `Manager ${index + 1}`,
          email: `country.${country.toLowerCase()}.${index + 1}@mext.local`,
          role: Role.COUNTRY_MANAGER,
          country,
          language: countryConfig[country].language,
        },
      });
    }
  }

  for (let index = 0; index < 10; index++) {
    await prisma.user.create({
      data: {
        firstName: "Group",
        lastName: `Manager ${index + 1}`,
        email: `group.${index + 1}@mext.local`,
        role: Role.GROUP_MANAGER,
        country: (Object.values(Country)[index % 3]),
        language: index % 3 === 2 ? Language.de : Language.nl,
      },
    });
  }

  const superAdmin = await prisma.user.create({
    data: {
      firstName: "Super",
      lastName: "Admin",
      email: "super.admin@mext.local",
      role: Role.SUPER_ADMIN,
      country: Country.BE,
      language: Language.nl,
    },
  });

  const framework = [
    ["INTRO", "Introductie", ["Zichzelf en MExT voorstellen", "Bedanken voor de tijd"]],
    ["NEED", "Behoefteanalyse", ["IJsbreken", "Goede atmosfeer creëren", "MExT voorstelling", "Service uitleggen", "Praktisch en wettelijk gamma uitleggen", "MExT voordelen uitleggen", "Open vragen stellen", "Gesloten vragen / bevestiging gebruiken"]],
    ["DEMO", "Demonstratie", ["Pancarte gebruiken", "Showroom gebruiken", "Aantal producten / brede verkoop", "Koppelverkoop", "Voordelen producten uitleggen", "Interactie met klant"]],
    ["CLOSE", "Afsluiten", ["Herhalen voordelen", "Reactie op bezwaren", "Q en prijs verdedigen", "Tablet gebruiken", "Order noteren"]],
    ["CASE", "Koffercontrole", ["Controlelijst", "Non-conforme producten", "Tevredenheid bij klant", "Contant innen", "Controle order / levering", "Directe levering / aanvulling koffer", "Repeat atmosfeer"]],
  ] as const;
  const focuses = [];
  for (const [code, name, criteria] of framework) {
    focuses.push(
      await prisma.coachingFocus.create({
        data: {
          code,
          name,
          sortOrder: focuses.length + 1,
          criteria: { create: criteria.map((criterion, index) => ({ name: criterion, sortOrder: index + 1 })) },
        },
        include: { criteria: true },
      })
    );
  }

  const periodStart = new Date("2026-05-01");
  const periodEnd = new Date("2026-05-31");
  for (let repIndex = 0; repIndex < representatives.length; repIndex++) {
    const representative = representatives[repIndex];
    for (let kpiIndex = 0; kpiIndex < kpis.length; kpiIndex++) {
      await prisma.kpiSnapshot.create({
        data: {
          userId: representative.id,
          kpiDefinitionId: kpis[kpiIndex].id,
          periodStart,
          periodEnd,
          value: 45 + ((repIndex * 7 + kpiIndex * 11) % 55),
          target: kpiData[kpiIndex][2] === "EUR" ? 1350 : 80,
          source: "seed-demo",
        },
      });
    }
  }

  const interventionTypes = [
    InterventionType.BEGELEIDING,
    InterventionType.CONTACTMOMENT,
    InterventionType.RETRAINING,
    InterventionType.SALES_TRAINING,
    InterventionType.HULPAANVRAAG,
  ];
  const statuses = [
    InterventionStatus.GEPLAND,
    InterventionStatus.WACHT_OP_VT,
    InterventionStatus.WACHT_OP_AKKOORD,
    InterventionStatus.AFGESLOTEN,
  ];
  for (let index = 0; index < 24; index++) {
    const representative = representatives[index % representatives.length];
    const owner = leadersByCountry.get(representative.country)![0];
    const intervention = await prisma.intervention.create({
      data: {
        type: interventionTypes[index % interventionTypes.length],
        status: statuses[index % statuses.length],
        representativeId: representative.id,
        initiatorId: owner.id,
        ownerId: owner.id,
        country: representative.country,
        title: `Demo interventie ${index + 1}`,
        description: "Voorbeelddata voor het klikbare prototype.",
        plannedAt: new Date(2026, 5, 12 + index),
        focuses: index % 5 === 0 ? undefined : { create: focuses.slice(0, 2).map((focus) => ({ focusId: focus.id })) },
      },
    });
    if (index < 12) {
      await prisma.actionPoint.create({
        data: {
          representativeId: representative.id,
          interventionId: intervention.id,
          ownerId: owner.id,
          title: index % 2 ? "Meer open vragen stellen" : "PV verhogen naar doel",
          description: "Concreet opvolgpunt uit de begeleiding.",
          type: index % 2 ? ActionPointType.VAARDIGHEID : ActionPointType.KPI,
          status: index % 3 === 0 ? ActionPointStatus.BEHAALD : ActionPointStatus.IN_UITVOERING,
          priority: index % 4 === 0 ? Priority.HIGH : Priority.NORMAL,
          kpiDefinitionId: index % 2 ? null : kpis[0].id,
          startValue: index % 2 ? null : 68,
          targetValue: index % 2 ? null : 80,
          currentValue: index % 2 ? null : 74,
          dueDate: new Date(2026, 5, 30),
        },
      });
    }
  }

  for (let index = 0; index < 8; index++) {
    const representative = representatives[index];
    await prisma.helpRequest.create({
      data: {
        requesterId: representative.id,
        representativeId: representative.id,
        subject: index % 2 ? "Hulp bij bezwaren" : "Prijsverdediging",
        difficulty: "Ik wil dit onderdeel zekerder kunnen uitvoeren.",
        desiredResult: "Een kort contactmoment of gerichte retraining.",
        urgency: index % 3 === 0 ? Priority.HIGH : Priority.NORMAL,
        status: index % 2 ? "NIEUW" : "IN_BEHANDELING",
        followUpType: index % 2 ? null : InterventionType.CONTACTMOMENT,
      },
    });
  }

  for (const [index, name] of ["Handreiniger", "Werkhandschoenen", "Reinigingsdoeken", "Veiligheidsspray", "Montagekit"].entries()) {
    await prisma.product.create({ data: { name, sortOrder: index + 1 } });
  }

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      entityType: "Seed",
      entityId: "initial",
      action: "CREATE",
      newValue: { representatives: representatives.length, generatedAt: new Date().toISOString() },
    },
  });

  console.log(`Seed complete: ${representatives.length} representatives, ${kpis.length} KPIs, ${focuses.length} coaching phases.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
