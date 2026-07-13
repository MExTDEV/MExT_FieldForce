# Hulpaanvragen

This document defines the implemented Help Request workflow inside the Coaching module.

Hulpaanvragen are a support workflow between a `Vertegenwoordiger` and the responsible manager. They are not a chat and they must not duplicate the Coaching, Contactmoment, Retraining or Salestraining workflows.

---

## Functional scope

A `Vertegenwoordiger` can create a help request for themselves.

Required fields:

- subject;
- rich-text description.

The responsible manager is determined server-side from the representative's organisational context:

1. the team's `primaryLeaderId`;
2. a primary `TeamLeader` relation;
3. an active manager-level user in the same country.

The requester cannot manually select a different representative or manager.

---

## Roles

### Vertegenwoordiger

Allowed:

- create a help request for themselves;
- edit subject and description while the request is still untreated;
- withdraw the request while it is still untreated;
- read manager answers and final status.

Not allowed:

- create help requests for another user;
- answer a help request;
- reply to a manager answer;
- edit or withdraw after the request has been answered or linked to follow-up.

### Manager roles

The responsible manager, and users with higher in-scope management roles, can:

- answer a help request;
- answer and close a help request;
- select one primary follow-up action:
  - Begeleiding;
  - Contactmoment;
  - Retraining;
  - Salestraining.

Manager roles may not change the original request content.

---

## Lifecycle

Canonical statuses:

- `open`
- `in_behandeling`
- `begeleiding`
- `contactmoment`
- `retraining`
- `salestraining`
- `gesloten`
- `ingetrokken`

Legacy statuses remain readable for older records:

- `nieuw`
- `vervolgactie_gepland`
- `afgesloten`
- `geannuleerd`

Rules:

- A new help request starts as `open`.
- Editing and withdrawal are only allowed while untreated.
- The first manager answer moves the request to `in_behandeling`.
- `gesloten` requires a closing answer.
- A selected follow-up changes the request status to the follow-up type.
- A request may have one primary follow-up only.
- Representatives cannot reopen or reply to handled requests.

### Follow-up: Begeleiding

When a manager selects `Begeleiding`, FieldForce opens the existing
`/begeleidingen/nieuw` planning wizard with the help request id.

Rules:

- selecting `Begeleiding` does not create a synthetic follow-up record;
- the coached representative is fixed to the representative from the help request;
- the help request remains open if the wizard is cancelled;
- only confirmation in the existing coaching wizard creates a real
  `Intervention` with type `BEGELEIDING` and status `GEPLAND`;
- the help request is linked to that real coaching through
  `followUpType = begeleiding` and `linkedInterventionId`;
- the coaching and help-request update are persisted together.

---

## Persistence

Help requests are stored in `HelpRequest`.

The handling contract adds:

- `responsibleUserId`;
- sanitized `descriptionHtml`;
- plain-text `descriptionText`;
- first-handling metadata;
- withdrawal metadata;
- a one-to-many `HelpRequestAnswer` relation.

Answers are immutable business entries. They store the author, sanitized rich-text body, plain-text body, close flag and creation time.

---

## Visibility and scope

Visibility follows the existing workflow scope helpers.

Representative visibility is limited to own help requests. Manager visibility follows team/country/user scope.

If a help request is linked to a Contactmoment that is hidden from the representative, the representative-facing help request view does not expose the hidden Contactmoment id or follow-up type.

---

## Notifications

The current in-app notification centre is still approval-based and uses `Approval.openedAt` as read-state.

Hulpaanvragen therefore require a generic notification/read-state extension before reliable request-created, answer-created or follow-up-created bell notifications can be delivered. Do not bolt Help Request notifications onto `Approval`.

---

## Validation

Automated coverage:

- `npm run test:help-requests`
- `npm run test:workflow`

Browser-based validation is outside Codex unless explicitly requested, because the local devserver is managed externally.
