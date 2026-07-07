# Step 9 release validation

Validation date: 2026-06-24

## Static and automated checks

- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run test:workflow`: passed
- `npm run test:data-access`: passed
- `npm run test:personal-criteria`: passed
- `npm run test:smart-coaching`: passed
- `npm run test:performance`: passed
- `npm run test:modules`: passed
- `npm run health:check`: passed

## API persistence checks

Reusable command:

```bash
npm run test:api-persistence
```

Validated through real HTTP API routes:

- coaching create, update and reload;
- coaching action point create, update and reload;
- contact moment create, update and reload;
- help request create, update and reload;
- retraining create, update and reload;
- sales training create, update and reload;
- personal criterion create, update and reload.

Persistent test runs:

- `step9-20260624100035`
- `step9-20260624100224`

These records are intentionally retained for the direct MariaDB/phpMyAdmin
verification in step 10.

## UI smoke checks

Confirmed in the production build:

- `/begeleidingen`
- `/contactmomenten`
- `/hulpaanvragen`
- `/retrainingen`
- `/sales-trainingen`
- `/actiepunten`
- `/vertegenwoordigers/rep-5`, personal criteria tab

## Finding corrected

The coaching list combined workflow and performance rows with the same database
ID. This caused duplicate coaching cards. The list now deduplicates historical
rows when the workflow dataset already contains the intervention ID.
