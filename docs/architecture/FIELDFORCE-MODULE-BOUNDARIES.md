# FieldForce module boundaries and integration contracts

Status: proposed architecture baseline  
Branch: `refactor/modular-fieldforce-architecture`  
Date: 2026-08-20

## Purpose

FieldForce is a multi-domain application. Each large business domain must remain a separate
module while using one shared platform for authentication, authorization, master data,
notifications, audit, synchronization and external integrations.

The existing SalesApp at `C:\Users\jand\Documents\Codex\SalesApp` is the functional
reference for Sales, Inventory, Service and PST. Its screens, workflows, validation rules and
role behaviour must be ported with functional parity. This document defines the target boundaries;
it does not change runtime behaviour.

## Top-level modules

- **Coaching** — coaching interventions, scores, criteria, reflections, action points and
  coaching reports.
- **Sales** — appointments, customers/prospects, preparation, sales documents, leads, follow-up,
  visit reports, sales reports, cash sheet and SalesDay synchronization.
- **Inventory** — representative stock, replenishment, consumables, stock history, carrier stock,
  receipt evidence and expiry controls.
- **Service** — service day, planning, interventions, work orders, maintenance, assets and
  service contracts.
- **PST** — PST dashboard, segments, routes, prospection, maps, approvals, representatives,
  planning and quality.
- **Contract** — contract models, calculations, imports, letters, signing and contract documents.

The visible product navigation uses these six names. `inventory` is the technical folder name;
the Dutch product label remains **Voorraad**.

## Shared platform

Shared code belongs under a platform or shared boundary and may be consumed by every module:

- `platform/auth` — Microsoft/NextAuth session and login lifecycle;
- `platform/permissions` — roles, scopes, module rights and server-side enforcement;
- `platform/users` — users, teams, countries, languages and representative levels;
- `platform/notifications` — in-app notifications and safe mail dispatch;
- `platform/audit` — immutable activity and security audit entries;
- `platform/sync` — device identity, outbox, retries and idempotency;
- `platform/integrations` — ERP, Outlook, Power BI and external adapters;
- `shared/master-data` — customers, products, addresses, contacts and reference data;
- `shared/ui` and `shared/types` — presentation primitives and stable cross-module types.

A module must not import another module's internal components, database helpers or private
business rules.

## Cross-module contracts

Modules communicate through stable application services, commands/events or read-only query
contracts.

- **Sales -> Inventory**: stock availability snapshot, delivery impact and consumption request.
- **Inventory -> Sales**: available stock, replenishment status and receipt evidence.
- **Sales -> Contract**: customer, product, price and contract-context lookup.
- **Contract -> Sales**: active contract terms, allowed products and calculation results.
- **Service -> Inventory**: consumed materials and replenishment requirements.
- **Inventory -> Service**: technician stock and article availability.
- **Service -> Contract**: entitlement, maintenance and service-contract context.
- **PST -> Sales**: prospects, route stops and planned visits.
- **Sales -> PST**: customer/prospect outcome and visit result.
- **Coaching -> platform**: users, teams, permissions, interventions and audit only. Coaching
  must not absorb Sales, Service, PST or Inventory business logic.

Every contract must define an owner, input/output types, authorization rule, audit requirement,
offline/idempotency behaviour and compatibility policy.

## SalesApp parity mapping

The existing SalesApp `AppView` registry maps as follows:

- Sales: `dashboard`, `myInfo`, `myPreparation`, `preparationDetail`, `agenda`,
  `myTeam`, `appointment`, `reports`, `cashSheet`, `sync`.
- Inventory: `inventory`, `stockReplenishments`, `consumables`, `stockHistory`.
- Service: `service`, `serviceMyDay`, `serviceInterventions`, `servicePlanning`,
  `serviceWorkOrders`, `serviceMaintenance`, `serviceContracts`, `serviceAssets`.
- PST: `pstDashboard`, `pstSegments`, `pstRoutes`, `pstProspection`, `pstMaps`,
  `pstApprovals`, `pstRepresentatives`, `pstPlanning`, `pstQuality`.
- Contract: `adminContractCalculator` is the starting reference; the final Contract module
  must no longer be hidden under Administration.

The parity rule is: every source screen, action, validation, status transition, role rule,
offline rule and synchronization outcome receives a corresponding FieldForce acceptance item.

## Migration guardrails

1. Do not merge the current `wip/salesday-inventory` branch into `main` as the target
   architecture.
2. Do not alter Coaching runtime files while extracting module boundaries.
3. Do not move or delete source files until a parity item exists and the baseline tests are green.
4. Database changes are additive and module-owned; no destructive migration is allowed.
5. Shared platform refactors require the full Coaching regression suite before and after the change.
6. Each module is migrated behind its own route boundary and feature flag where practical.
7. The original SalesApp remains the functional reference until the corresponding FieldForce
   module has passed parity review and browser UAT.

## Initial acceptance gates

Before the first runtime migration:

- Coaching baseline tag `coaching-stable-2026-08-20` remains available;
- `main` remains unchanged;
- typecheck, build and the Coaching baseline suite are green;
- module ownership and cross-module contracts are reviewed;
- no source or database deletion is performed.
