"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  activePersonalCriteriaForRepresentative,
  canManagePersonalCriterion,
  canManagePersonalCriterionForRepresentative,
  createPersonalCriterionId,
  validatePersonalCriterionInput,
  visiblePersonalCriteria,
  type PersonalCriterionInput,
} from "@/lib/personal-criteria";
import { useRepresentatives } from "@/components/representatives-provider";
import { useSession } from "@/components/session-provider";
import type {
  MockUser,
  PersonalCoachingCriterion,
  Representative,
} from "@/lib/types";

type PersonalCriteriaContextValue = {
  criteria: PersonalCoachingCriterion[];
  visibleCriteria: (actor: MockUser) => PersonalCoachingCriterion[];
  activeForRepresentative: (
    actor: MockUser,
    representativeId: string
  ) => PersonalCoachingCriterion[];
  canManageForRepresentative: (
    actor: MockUser,
    representative: Representative
  ) => boolean;
  createCriterion: (
    actor: MockUser,
    input: PersonalCriterionInput
  ) => { ok: true; criterion: PersonalCoachingCriterion } | { ok: false; error: string };
  updateCriterion: (
    actor: MockUser,
    id: string,
    input: PersonalCriterionInput
  ) => { ok: true; criterion: PersonalCoachingCriterion } | { ok: false; error: string };
  deactivateCriterion: (
    actor: MockUser,
    id: string
  ) => { ok: true } | { ok: false; error: string };
};

const PersonalCriteriaContext = createContext<PersonalCriteriaContextValue | null>(null);

export function PersonalCriteriaProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const { representatives } = useRepresentatives();
  const [criteria, setCriteria] = useState<PersonalCoachingCriterion[]>([]);

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setCriteria([]);
      return;
    }
    let active = true;
    async function loadCriteria() {
      try {
        const response = await fetch("/api/personal-criteria", { cache: "no-store" });
        const payload = (await response.json()) as {
          criteria?: PersonalCoachingCriterion[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Persoonlijke criteria konden niet worden geladen.");
        }
        if (active) setCriteria(payload.criteria ?? []);
      } catch (error) {
        console.error("[personal-criteria-provider]", error);
      }
    }
    loadCriteria();
    return () => {
      active = false;
    };
  }, [sessionLoading, user.id]);

  async function persistCreate(criterion: PersonalCoachingCriterion) {
    const response = await fetch("/api/personal-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterion }),
    });
    if (!response.ok) throw new Error("Persoonlijk criterium kon niet worden opgeslagen.");
  }

  async function persistUpdate(
    id: string,
    criterion: Pick<PersonalCoachingCriterion, "title" | "description" | "focusName">
  ) {
    const response = await fetch(`/api/personal-criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterion }),
    });
    if (!response.ok) throw new Error("Persoonlijk criterium kon niet worden gewijzigd.");
  }

  async function persistDeactivate(id: string) {
    const response = await fetch(`/api/personal-criteria/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Persoonlijk criterium kon niet worden gedeactiveerd.");
  }

  const value = useMemo<PersonalCriteriaContextValue>(() => ({
    criteria,
    visibleCriteria: (actor) => visiblePersonalCriteria(actor, criteria, representatives),
    activeForRepresentative: (actor, representativeId) =>
      activePersonalCriteriaForRepresentative(actor, representativeId, criteria, representatives),
    canManageForRepresentative: canManagePersonalCriterionForRepresentative,
    createCriterion: (actor, input) => {
      const error = validatePersonalCriterionInput(actor, criteria, input, representatives);
      if (error) return { ok: false, error };
      const representative = representatives.find((item) => item.id === input.representativeId);
      if (!representative) return { ok: false, error: "Vertegenwoordiger niet gevonden." };
      const now = new Date().toISOString();
      const criterion: PersonalCoachingCriterion = {
        id: createPersonalCriterionId(),
        title: input.title.trim(),
        description: input.description.trim(),
        focusName: input.focusName,
        representativeId: representative.id,
        createdByUserId: actor.id,
        teamId: representative.teamId,
        country: representative.country,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      setCriteria((current) => {
        const next = [...current, criterion];
        return next;
      });
      void persistCreate(criterion).catch((persistError) => console.error("[personal-criteria:create]", persistError));
      return { ok: true, criterion };
    },
    updateCriterion: (actor, id, input) => {
      const existing = criteria.find((criterion) => criterion.id === id);
      if (!existing) return { ok: false, error: "Criterium niet gevonden." };
      if (!canManagePersonalCriterion(actor, existing, representatives)) {
        return { ok: false, error: "Je mag dit criterium niet wijzigen." };
      }
      const error = validatePersonalCriterionInput(actor, criteria, input, representatives, id);
      if (error) return { ok: false, error };
      let updated: PersonalCoachingCriterion | undefined;
      setCriteria((current) => {
        const next = current.map((criterion) => {
          if (criterion.id !== id) return criterion;
          updated = {
            ...criterion,
            title: input.title.trim(),
            description: input.description.trim(),
            focusName: input.focusName,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        });
        return next;
      });
      if (updated) {
        void persistUpdate(id, {
          title: updated.title,
          description: updated.description,
          focusName: updated.focusName,
        }).catch((persistError) => console.error("[personal-criteria:update]", persistError));
      }
      return updated
        ? { ok: true, criterion: updated }
        : { ok: false, error: "Criterium niet gevonden." };
    },
    deactivateCriterion: (actor, id) => {
      const existing = criteria.find((criterion) => criterion.id === id);
      if (!existing) return { ok: false, error: "Criterium niet gevonden." };
      if (!canManagePersonalCriterion(actor, existing, representatives)) {
        return { ok: false, error: "Je mag dit criterium niet deactiveren." };
      }
      setCriteria((current) => {
        const next = current.map((criterion) =>
          criterion.id === id
            ? { ...criterion, isActive: false, updatedAt: new Date().toISOString() }
            : criterion
        );
        return next;
      });
      void persistDeactivate(id).catch((persistError) => console.error("[personal-criteria:deactivate]", persistError));
      return { ok: true };
    },
  }), [criteria, representatives]);

  return (
    <PersonalCriteriaContext.Provider value={value}>
      {children}
    </PersonalCriteriaContext.Provider>
  );
}

export function usePersonalCriteria() {
  const context = useContext(PersonalCriteriaContext);
  if (!context) {
    throw new Error("usePersonalCriteria must be used within PersonalCriteriaProvider");
  }
  return context;
}
