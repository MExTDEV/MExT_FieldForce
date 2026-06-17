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
import { representatives } from "@/lib/mock-data";
import type {
  MockUser,
  PersonalCoachingCriterion,
  Representative,
} from "@/lib/types";

const STORAGE_KEY = "mext:personal-kapstok-criteria:v1";

const seedPersonalCriteria: PersonalCoachingCriterion[] = [
  {
    id: "personal-criterion-rep-1-1",
    title: "Doorvragen op verborgen bezwaar",
    description: "Gericht oefenen op het tweede en derde verdiepende antwoord voordat de demo start.",
    focusName: "Behoefteanalyse",
    representativeId: "rep-1",
    createdByUserId: "user-leader-be",
    teamId: "be-1",
    country: "BE",
    isActive: true,
    createdAt: "2026-05-20T08:30:00.000Z",
    updatedAt: "2026-05-20T08:30:00.000Z",
  },
  {
    id: "personal-criterion-rep-1-2",
    title: "Tablet afsluitflow zelfstandig gebruiken",
    description: "De volledige afsluiting zonder overname door de verkoopleider uitvoeren.",
    focusName: "Afsluiten",
    representativeId: "rep-1",
    createdByUserId: "user-leader-be",
    teamId: "be-1",
    country: "BE",
    isActive: true,
    createdAt: "2026-05-27T09:00:00.000Z",
    updatedAt: "2026-05-27T09:00:00.000Z",
  },
];

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

function persist(criteria: PersonalCoachingCriterion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(criteria));
}

export function PersonalCriteriaProvider({ children }: { children: React.ReactNode }) {
  const [criteria, setCriteria] = useState<PersonalCoachingCriterion[]>(seedPersonalCriteria);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      persist(seedPersonalCriteria);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as PersonalCoachingCriterion[];
      setCriteria(Array.isArray(parsed) ? parsed : seedPersonalCriteria);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      persist(seedPersonalCriteria);
    }
  }, []);

  const value = useMemo<PersonalCriteriaContextValue>(() => ({
    criteria,
    visibleCriteria: (actor) => visiblePersonalCriteria(actor, criteria),
    activeForRepresentative: (actor, representativeId) =>
      activePersonalCriteriaForRepresentative(actor, representativeId, criteria),
    canManageForRepresentative: canManagePersonalCriterionForRepresentative,
    createCriterion: (actor, input) => {
      const error = validatePersonalCriterionInput(actor, criteria, input);
      if (error) return { ok: false, error };
      const representative = representatives.find((item) => item.id === input.representativeId)!;
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
        persist(next);
        return next;
      });
      return { ok: true, criterion };
    },
    updateCriterion: (actor, id, input) => {
      const existing = criteria.find((criterion) => criterion.id === id);
      if (!existing) return { ok: false, error: "Criterium niet gevonden." };
      if (!canManagePersonalCriterion(actor, existing)) {
        return { ok: false, error: "Je mag dit criterium niet wijzigen." };
      }
      const error = validatePersonalCriterionInput(actor, criteria, input, id);
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
        persist(next);
        return next;
      });
      return updated
        ? { ok: true, criterion: updated }
        : { ok: false, error: "Criterium niet gevonden." };
    },
    deactivateCriterion: (actor, id) => {
      const existing = criteria.find((criterion) => criterion.id === id);
      if (!existing) return { ok: false, error: "Criterium niet gevonden." };
      if (!canManagePersonalCriterion(actor, existing)) {
        return { ok: false, error: "Je mag dit criterium niet deactiveren." };
      }
      setCriteria((current) => {
        const next = current.map((criterion) =>
          criterion.id === id
            ? { ...criterion, isActive: false, updatedAt: new Date().toISOString() }
            : criterion
        );
        persist(next);
        return next;
      });
      return { ok: true };
    },
  }), [criteria]);

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
