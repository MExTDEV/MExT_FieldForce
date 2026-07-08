import {
  ActionScope,
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
import { loadEnvFile } from "node:process";
import {
  fieldForcePermissionGroups,
  roleTemplates,
} from "../lib/user-management";
let developmentManagedUsers: typeof import("../lib/development-seed").developmentManagedUsers;
let developmentTeamOptions: typeof import("../lib/development-seed").developmentTeamOptions;
let developmentRepresentatives: typeof import("../lib/mock-data").representatives;

loadEnvFile();

const prisma = new PrismaClient();
const seedMode = process.argv.includes("--dev-demo") ? "dev-demo" : "config";
const destructiveSeedAllowed = process.env.SEED_ALLOW_DESTRUCTIVE === "true";

const appModules = [
  { code: "PLANNING", naam: "Planning", actief: true },
  { code: "BEGELEIDINGEN", naam: "Begeleidingen", actief: true },
  { code: "CONTACTMOMENTEN", naam: "Contactmomenten", actief: false },
  { code: "RETRAININGEN", naam: "Retrainingen", actief: false },
  { code: "SALESTRAININGEN", naam: "Salestrainingen", actief: false },
  { code: "HULPAANVRAGEN", naam: "Hulpaanvragen", actief: false },
  { code: "ACTIEPUNTEN", naam: "Actiepunten", actief: false },
  { code: "RAPPORTERING", naam: "Rapportering", actief: false },
] as const;

const actionPointTargetTypes = [
  { id: "apt_global", code: ActionScope.GLOBAL, name: "Globaal", description: "Actiepunt voor alle relevante gebruikers.", sortOrder: 10 },
  { id: "apt_country", code: ActionScope.COUNTRY, name: "Land", description: "Actiepunt voor gebruikers binnen een land.", sortOrder: 20 },
  { id: "apt_team", code: ActionScope.TEAM, name: "Team", description: "Actiepunt voor gebruikers binnen een team.", sortOrder: 30 },
  { id: "apt_user", code: ActionScope.USER, name: "Gebruiker", description: "Actiepunt voor een individuele gebruiker.", sortOrder: 40 },
] as const;

const countryConfig = {
  BE: { representatives: 30, leaders: 3, teams: 3, language: Language.nl },
  NL: { representatives: 20, leaders: 3, teams: 3, language: Language.nl },
  DE: { representatives: 35, leaders: 4, teams: 4, language: Language.de },
} satisfies Record<Country, { representatives: number; leaders: number; teams: number; language: Language }>;

const firstNames = ["Alex", "Sam", "Robin", "Noa", "Lou", "Milan", "Emma", "Lina", "Lucas", "Sofie", "Max", "Anna"];
const lastNames = ["Peeters", "Janssen", "Willems", "De Smet", "Bakker", "Visser", "Schneider", "Weber", "Fischer", "Wagner"];

async function main() {
  if (seedMode === "config") {
    await seedConfiguration();
    console.log("Configuration seed complete. No existing business data was deleted.");
    return;
  }

  if (process.env.NODE_ENV === "production" || !destructiveSeedAllowed) {
    throw new Error(
      "Development demo seed is destructive. Run only outside production with SEED_ALLOW_DESTRUCTIVE=true npm run db:seed:dev."
    );
  }

  ({ developmentManagedUsers, developmentTeamOptions } = await import("../lib/development-seed"));
  ({ representatives: developmentRepresentatives } = await import("../lib/mock-data"));

  await prisma.userPermission.deleteMany();
  await prisma.userCountryAccess.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.appModule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.productAnalysis.deleteMany();
  await prisma.product.deleteMany();
  await prisma.helpRequest.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.reflection.deleteMany();
  await prisma.actionDefinitionProduct.deleteMany();
  await prisma.actionTargetOverride.deleteMany();
  await prisma.actionDefinition.deleteMany();
  await prisma.actionPointAssignment.deleteMany();
  await prisma.actionPoint.deleteMany();
  await prisma.actionPointTargetType.deleteMany();
  await prisma.score.deleteMany();
  await prisma.trainingParticipant.deleteMany();
  await prisma.interventionParticipant.deleteMany();
  await prisma.interventionFocus.deleteMany();
  await prisma.coachingAppointment.deleteMany();
  await prisma.coachingDetail.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.personalCoachingCriterion.deleteMany();
  await prisma.coachingCriterion.deleteMany();
  await prisma.coachingFocus.deleteMany();
  await prisma.kpiSnapshot.deleteMany();
  await prisma.kpiDefinition.deleteMany();
  await prisma.teamLeader.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.level.deleteMany();

  await prisma.appModule.createMany({
    data: [...appModules],
  });
  await seedActionPointTargetTypes();
  await seedPermissions();

  const levels = await Promise.all(
    [
      ["Starter", "Nieuwe vertegenwoordiger in onboarding", "#F59E0B"],
      ["Vertegenwoordiger", "Zelfstandig in de basisrol", "#0EA5E9"],
      ["Professional", "Consistent sterke uitvoering", "#6366F1"],
      ["Expert", "Voorbeeldrol en coachende senior", "#10B981"],
    ].map(([name, description, color]) => prisma.level.create({ data: { name, description, color } }))
  );

  const kpiData = [
    ["PV_PERCENT", "PV %", "%", 75],
    ["KV_PERCENT", "KV %", "%", 75],
    ["Q_PERCENT", "Q %", "%", 75],
    ["SALES_DAY", "Sales / Day", "EUR", 7500],
    ["FM_ORDER", "FM / Order", "number", 1],
    ["SALES_ORDER", "Sales / Order", "EUR", 750],
    ["TOTAL_SALES", "Total Sales", "EUR", 7500],
    ["LEADS", "Leadgeneratie", "count", 12],
    ["PROSPECT_CUSTOMER", "Prospect vs Klant verkoop", "%", 50],
    ["CASH_TRANSFER", "Cash vs Overschrijving", "%", 75],
  ];
  const kpis = await Promise.all(
    kpiData.map(([code, name, unit, targetValue]) =>
      prisma.kpiDefinition.create({ data: { code: String(code), name: String(name), description: `${name} coaching KPI`, unit: String(unit), targetValue: Number(targetValue) } })
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

  for (let index = 0; index < 3; index++) {
    const primaryCountry = Object.values(Country)[index % 3];
    const salesManager = await prisma.user.create({
      data: {
        firstName: "Sales",
        lastName: `Manager ${index + 1}`,
        email: `sales.manager.${index + 1}@mext.local`,
        role: Role.SALES_MANAGER,
        country: primaryCountry,
        language: primaryCountry === Country.DE ? Language.de : Language.nl,
      },
    });
    await prisma.userCountryAccess.createMany({
      data: Object.values(Country).slice(0, index + 1).map((country) => ({
        userId: salesManager.id,
        country,
      })),
    });
  }

  const teamsByCountry = new Map<Country, { id: string; primaryLeaderId: string | null }[]>();
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
      newValue: JSON.stringify({ representatives: representatives.length, generatedAt: new Date().toISOString() }),
    },
  });

  console.log(`Seed complete: ${representatives.length} representatives, ${kpis.length} KPIs, ${focuses.length} coaching phases.`);
}

async function seedConfiguration() {
  for (const appModule of appModules) {
    await prisma.appModule.upsert({
      where: { code: appModule.code },
      update: { naam: appModule.naam },
      create: appModule,
    });
  }
  await seedPermissions();
  await seedActionPointTargetTypes();

  const levels = [
    ["Starter", "Nieuwe vertegenwoordiger in onboarding", "#F59E0B"],
    ["Vertegenwoordiger", "Zelfstandig in de basisrol", "#0EA5E9"],
    ["Professional", "Consistent sterke uitvoering", "#6366F1"],
    ["Expert", "Voorbeeldrol en coachende senior", "#10B981"],
  ] as const;

  for (const [name, description, color] of levels) {
    await prisma.level.upsert({
      where: { name },
      update: { description, color, active: true },
      create: { name, description, color },
    });
  }

  const kpis = [
    ["PV_PERCENT", "PV %", "%", 75],
    ["KV_PERCENT", "KV %", "%", 75],
    ["Q_PERCENT", "Q %", "%", 75],
    ["SALES_DAY", "Sales / Day", "EUR", 7500],
    ["FM_ORDER", "FM / Order", "number", 1],
    ["SALES_ORDER", "Sales / Order", "EUR", 750],
    ["TOTAL_SALES", "Total Sales", "EUR", 7500],
    ["LEADS", "Leadgeneratie", "count", 12],
    ["PROSPECT_CUSTOMER", "Prospect vs Klant verkoop", "%", 50],
    ["CASH_TRANSFER", "Cash vs Overschrijving", "%", 75],
  ] as const;

  for (const [code, name, unit, targetValue] of kpis) {
    await prisma.kpiDefinition.upsert({
      where: { code },
      update: { name, description: `${name} coaching KPI`, unit, targetValue, active: true },
      create: { code, name, description: `${name} coaching KPI`, unit, targetValue },
    });
  }

  const framework = [
    ["INTRO", "Introductie", ["Zichzelf en MExT voorstellen", "Bedanken voor de tijd"]],
    ["NEED", "Behoefteanalyse", ["IJsbreken", "Goede atmosfeer creeren", "MExT voorstelling", "Service uitleggen", "Praktisch en wettelijk gamma uitleggen", "MExT voordelen uitleggen", "Open vragen stellen", "Gesloten vragen / bevestiging gebruiken"]],
    ["DEMO", "Demonstratie", ["Pancarte gebruiken", "Showroom gebruiken", "Aantal producten / brede verkoop", "Koppelverkoop", "Voordelen producten uitleggen", "Interactie met klant"]],
    ["CLOSE", "Afsluiten", ["Herhalen voordelen", "Reactie op bezwaren", "Q en prijs verdedigen", "Tablet gebruiken", "Order noteren"]],
    ["CASE", "Koffercontrole", ["Controlelijst", "Non-conforme producten", "Tevredenheid bij klant", "Contant innen", "Controle order / levering", "Directe levering / aanvulling koffer", "Repeat atmosfeer"]],
  ] as const;

  for (const [focusIndex, [code, name, criteria]] of framework.entries()) {
    const focus = await prisma.coachingFocus.upsert({
      where: { code },
      update: { name, sortOrder: focusIndex + 1, active: true },
      create: { code, name, sortOrder: focusIndex + 1 },
    });
    for (const [criterionIndex, criterion] of criteria.entries()) {
      await prisma.coachingCriterion.upsert({
        where: { focusId_name: { focusId: focus.id, name: criterion } },
        update: { sortOrder: criterionIndex + 1, active: true },
        create: { focusId: focus.id, name: criterion, sortOrder: criterionIndex + 1 },
      });
    }
  }
}

async function seedActionPointTargetTypes() {
  for (const targetType of actionPointTargetTypes) {
    await prisma.actionPointTargetType.upsert({
      where: { code: targetType.code },
      update: {
        name: targetType.name,
        description: targetType.description,
        isActive: true,
        sortOrder: targetType.sortOrder,
      },
      create: {
        id: targetType.id,
        code: targetType.code,
        name: targetType.name,
        description: targetType.description,
        sortOrder: targetType.sortOrder,
      },
    });
  }
}

async function seedPermissions() {
  for (const group of fieldForcePermissionGroups) {
    for (const permission of group.permissions) {
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          label: permission.label,
          group: group.title,
          description: group.description,
        },
        create: {
          key: permission.key,
          label: permission.label,
          group: group.title,
          description: group.description,
        },
      });
    }
  }

  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.key, permission])
  );

  for (const [role, template] of Object.entries(roleTemplates)) {
    await prisma.roleConfiguration.upsert({
      where: { role: role as Role },
      update: {},
      create: { role: role as Role, active: true },
    });

    for (const [permissionKey, enabled] of Object.entries(template.permissions)) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as Role,
            permissionId: permission.id,
          },
        },
        update: { enabled: Boolean(enabled) },
        create: {
          role: role as Role,
          permissionId: permission.id,
          enabled: Boolean(enabled),
        },
      });
    }
  }
}

async function seedPrototypeUsers() {
  const managedUsers = developmentManagedUsers();
  for (const profile of managedUsers) {
    await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        mobile: profile.mobile || null,
        avatarUrl: profile.avatarUrl || null,
        branchNumber: profile.branchNumber || null,
        representativeId: profile.representativeId ?? null,
        role: profile.role as Role,
        country: profile.country as Country,
        language: profile.language as Language,
        active: profile.active,
        teamSupervisor: profile.teamSupervisor,
      },
      create: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        mobile: profile.mobile || null,
        avatarUrl: profile.avatarUrl || null,
        branchNumber: profile.branchNumber || null,
        representativeId: profile.representativeId ?? null,
        role: profile.role as Role,
        country: profile.country as Country,
        language: profile.language as Language,
        active: profile.active,
        teamSupervisor: profile.teamSupervisor,
      },
    });
  }

  const users = await prisma.user.findMany();
  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const fallbackLeader =
    users.find((user) => user.role === Role.SUPER_ADMIN) ??
    users.find((user) => user.role === Role.ADMIN) ??
    users[0];
  if (!fallbackLeader) return;

  for (const team of developmentTeamOptions) {
    const leaderProfile =
      managedUsers.find(
        (profile) => profile.teamId === team.id && profile.role === "SALES_LEADER"
      ) ??
      managedUsers.find(
        (profile) => profile.teamId === team.id && profile.teamSupervisor
      );
    const leader = leaderProfile
      ? usersByEmail.get(leaderProfile.email) ?? fallbackLeader
      : fallbackLeader;

    await prisma.team.upsert({
      where: { country_name: { country: team.country as Country, name: team.name } },
      update: {
        primaryLeaderId: leader.id,
        active: true,
      },
      create: {
        id: team.id,
        name: team.name,
        country: team.country as Country,
        primaryLeaderId: leader.id,
      },
    });
  }

  const teams = await prisma.team.findMany();
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const levels = await prisma.level.findMany();
  const levelByName = new Map(levels.map((level) => [level.name, level]));
  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.key, permission])
  );

  for (const profile of managedUsers) {
    const user = usersByEmail.get(profile.email);
    if (!user) continue;
    const team = profile.teamId ? teamById.get(profile.teamId) : undefined;
    const representative = profile.representativeId
      ? developmentRepresentatives.find((item) => item.id === profile.representativeId)
      : undefined;
    const level = representative ? levelByName.get(representative.level) : undefined;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        teamId: team?.id ?? null,
        levelId: level?.id ?? null,
      },
    });
    await prisma.userCountryAccess.deleteMany({ where: { userId: user.id } });
    const countryAccess = [...new Set(profile.countryAccess.length ? profile.countryAccess : [profile.country])];
    if (countryAccess.length) {
      await prisma.userCountryAccess.createMany({
        data: countryAccess.map((country) => ({ userId: user.id, country: country as Country })),
      });
    }

    for (const [permissionKey, enabled] of Object.entries(profile.permissions)) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) continue;
      await prisma.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId: user.id,
            permissionId: permission.id,
          },
        },
        update: { enabled: Boolean(enabled) },
        create: {
          userId: user.id,
          permissionId: permission.id,
          enabled: Boolean(enabled),
        },
      });
    }
  }

  await seedRepresentativeKpis();
}

async function seedRepresentativeKpis() {
  const kpiDefinitions = await prisma.kpiDefinition.findMany();
  const byName = new Map(kpiDefinitions.map((kpi) => [kpi.name, kpi]));
  const users = await prisma.user.findMany({
    where: { representativeId: { not: null } },
  });
  const userByRepresentativeId = new Map(
    users.flatMap((user) =>
      user.representativeId ? [[user.representativeId, user] as const] : []
    )
  );
  const periodStart = new Date("2026-06-01T00:00:00.000Z");
  const periodEnd = new Date("2026-06-30T23:59:59.999Z");
  const previousPeriodStart = new Date("2026-05-01T00:00:00.000Z");
  const previousPeriodEnd = new Date("2026-05-31T23:59:59.999Z");

  for (const representative of developmentRepresentatives) {
    const user = userByRepresentativeId.get(representative.id);
    if (!user) continue;
    for (const kpi of representative.kpis) {
      const definition = byName.get(kpi.label);
      if (!definition) continue;
      const current = parseKpiValue(kpi.value);
      const target = parseKpiValue(kpi.target);
      const previous = current - kpi.trend * Math.max(1, current * 0.03);
      await prisma.kpiSnapshot.upsert({
        where: {
          userId_kpiDefinitionId_periodStart_periodEnd: {
            userId: user.id,
            kpiDefinitionId: definition.id,
            periodStart,
            periodEnd,
          },
        },
        update: { value: current, target, source: "config-seed" },
        create: {
          userId: user.id,
          kpiDefinitionId: definition.id,
          periodStart,
          periodEnd,
          value: current,
          target,
          source: "config-seed",
        },
      });
      await prisma.kpiSnapshot.upsert({
        where: {
          userId_kpiDefinitionId_periodStart_periodEnd: {
            userId: user.id,
            kpiDefinitionId: definition.id,
            periodStart: previousPeriodStart,
            periodEnd: previousPeriodEnd,
          },
        },
        update: { value: previous, target, source: "config-seed" },
        create: {
          userId: user.id,
          kpiDefinitionId: definition.id,
          periodStart: previousPeriodStart,
          periodEnd: previousPeriodEnd,
          value: previous,
          target,
          source: "config-seed",
        },
      });
    }
  }
}

function parseKpiValue(value: string) {
  return Number.parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
