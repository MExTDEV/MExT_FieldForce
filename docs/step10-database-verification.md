# Step 10 direct MariaDB verification

Validation date: 2026-06-24

Command:

```bash
npm run test:db-verification
```

Result:

```text
STEP10_DATABASE_VERIFICATION_PASSED
```

## Verified runs

- `step9-20260624100035`
- `step9-20260624100224`

## Verified per run

- coaching intervention in a valid persisted workflow state (initially
  `GEPLAND`, possibly progressed later);
- coaching focus, focus score and dossier score rows;
- updated coaching action point with representative and a valid current owner
  relation;
- contact moment with status `AFGESLOTEN` and detail row;
- retraining with status `GEPLAND` and training detail row;
- sales training with status `GEPLAND`, detail row and participants;
- help request with status `IN_BEHANDELING`;
- active updated personal criterion with representative, original creator and
  team relations;
- timestamps where `updatedAt >= createdAt`;
- twelve audit rows per run.

## Database totals

- Interventions: 8
- Help requests: 2
- Personal criteria: 2
- Coaching action points: 2
- Audit rows: 24

The records remain available for visual inspection in phpMyAdmin. The read-only
queries are in `docs/step10-phpmyadmin.sql`.
