/**
 * Public boundary for Coaching.
 *
 * Coaching implementation remains in its existing application paths. This
 * facade is deliberately type-only until a later, separately tested migration.
 */
import type { ModuleActorContext, ModuleId } from "../contracts";

export type CoachingModuleBoundary = {
  readonly id: Extract<ModuleId, "coaching">;
  readonly actor: ModuleActorContext;
};