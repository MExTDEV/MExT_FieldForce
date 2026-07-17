# Milestone 2 Preparation

## Status

Implemented in source on 17 July 2026. Migration `0049_salesday_preparation` is additive and has not been applied to production.

## Window and calendar

`Mijn voorbereiding` resolves the next effective workday from the Representative's country-local date, skips weekends and active records in the shared `Holiday` table, and returns only that day's appointments in binding ERP sequence.

The visibility threshold is stored in `AppSetting` key `salesday.preparation.v1`. Defaults for Belgium, the Netherlands and Germany are `16:30` in their IANA timezone. Only `salesday.settings.manage` can read or update this configuration; updates are audited.

The server enforces the window, active personal device and day-minus-one gate. Client-side hiding is not an authorization boundary.

## Preparation records

- `SalesPreparationState` records the explicit prepared actor and timestamp. It does not block the later agenda.
- `SalesPreparationNote` stores the Representative's appointment note for later own and scoped management viewing.
- `SalesPreparationRecommendationFeedback` records relevant/not-relevant feedback and manual marking per appointment/article.

All writes revalidate the Representative, next-workday appointment and visibility window inside server code and write an `AuditLog` record.

## Commercial history and recommendations

`SalesCommercialHistoryDocument` and immutable line snapshots replicate the complete ERP customer history without creating a second article master. The initial recommendation algorithm uses invoiced positive-quantity lines only, preventing quote/order/delivery duplicates.

Per article it calculates:

1. unique purchase dates;
2. average interval between purchases, or the configured `180`-day fallback after one purchase;
3. expected reorder date from the last purchase;
4. inclusion when that date falls within the configured `30`-day preparation horizon.

The API returns the source dates, purchase count, interval, expected date, days until expected and average quantity. The UI can therefore explain every recommendation; no opaque model is involved.

Until the shared ERP article replica is added, feedback/manual marking is restricted to article identities already present in the customer's ERP history. The later catalogue picker must reuse the shared article replica and must not create another article table.

## Validation

Run `npm run test:salesday-preparation`. It covers country time, threshold boundary, weekend/holiday selection, recommendation arithmetic, additive migration, immutable sequence, day gate and audit integration.
