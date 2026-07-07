import { mockUsers, representatives } from "@/lib/mock-data";
import {
  normalizeManagedUser,
  roleTemplates,
} from "@/lib/user-management";
import type { ManagedUser, Role } from "@/lib/types";

export const developmentTeamOptions = Array.from(
  new Map(
    representatives.map((representative) => [
      representative.teamId,
      {
        id: representative.teamId,
        name: representative.team,
        country: representative.country,
      },
    ])
  ).values()
);

function splitName(name: string) {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/);
  return { firstName, lastName: lastNameParts.join(" ") };
}

function teamName(teamId?: string) {
  return developmentTeamOptions.find((team) => team.id === teamId)?.name ?? "";
}

export function developmentManagedUsers(): ManagedUser[] {
  const profiles = representatives.map((representative) => {
    const account = mockUsers.find(
      (user) =>
        user.representativeId === representative.id ||
        user.email.toLowerCase() === representative.email.toLowerCase()
    );
    const role: Role = account?.role ?? "REPRESENTATIVE";
    return normalizeManagedUser({
      id: account?.id ?? `managed-${representative.id}`,
      firstName: representative.firstName,
      lastName: representative.lastName,
      email: representative.email,
      mobile: representative.phone,
      language: account?.language ?? (representative.country === "DE" ? "de" : "nl"),
      country: representative.country,
      countryAccess: account?.countryAccess ?? [representative.country],
      teamId: representative.teamId,
      teamName: representative.team,
      role,
      teamSupervisor: false,
      branchNumber: `${representative.country}-${String(
        Number(representative.id.replace("rep-", "")) + 100
      ).padStart(3, "0")}`,
      active: true,
      avatarUrl: "",
      permissions: { ...roleTemplates[role].permissions },
      representativeId: representative.id,
    });
  });

  for (const account of mockUsers) {
    if (profiles.some((profile) => profile.id === account.id)) continue;
    const name = splitName(account.name);
    profiles.push(
      normalizeManagedUser({
        id: account.id,
        ...name,
        email: account.email,
        mobile: "",
        language: account.language,
        country: account.country,
        countryAccess: account.countryAccess ?? [account.country],
        teamId: account.teamId ?? "",
        teamName: teamName(account.teamId),
        role: account.role,
        teamSupervisor: account.role === "SALES_LEADER",
        branchNumber: `${account.country}-001`,
        active: true,
        avatarUrl: "",
        permissions: { ...roleTemplates[account.role].permissions },
        representativeId: account.representativeId,
      })
    );
  }
  return profiles;
}
