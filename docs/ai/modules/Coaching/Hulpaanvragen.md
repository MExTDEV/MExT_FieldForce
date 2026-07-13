# Hulpaanvragen

## Status

Workflow status: `DEFINED`

## Purpose

A Hulpaanvraag allows a Representative to ask the responsible Verkoopleider for support.

The request must result in help, a planned follow-up action or another concrete documented response.

It is not a chat system.

---

# Participants

## Requester

The Representative who asks for help.

## Responsible manager

Normally the requester's Verkoopleider.

## Higher-level visibility

Users above the responsible Verkoopleider may view or process the request only when effective permissions and scope allow it.

---

# Creation

A Representative creates a Hulpaanvraag with the information required by the current form.

The request is linked to:

- requester;
- responsible manager or team context;
- creation time;
- subject and description;
- current status.

Creating the request produces a persistent notification or attention item for the responsible manager and a best-effort e-mail notification.

The description is stored as sanitized rich text plus plain text. Empty rich-text markup, for example an empty paragraph or only whitespace, is not valid input.

---

# Support Obligation

A Hulpaanvraag may not be rejected without follow-up.

The responsible manager must:

- provide a concrete answer;
- plan a follow-up;
- or record another specific action.

A manager may not close the request with only a generic refusal.

---

# No Chat

The workflow does not become a free multi-message conversation.

The manager records:

- response;
- decision;
- planned follow-up;
- outcome.

The requester may view the request and the information that is shared according to the workflow.

A single controlled `Respons` step is allowed when the manager needs information from the requester before deciding the final outcome:

- the manager records a rich-text answer and chooses `Respons`;
- the request remains `IN_BEHANDELING`;
- the requester may add one rich-text answer;
- after that answer, the request returns to the manager for a next decision.

This is a workflow turn, not a chat thread.

---

# Requester Changes

The requester may edit or withdraw the request only while it has not yet been processed by the responsible manager.

Once the manager has started processing:

- the requester cannot alter the original request;
- the original manager notification remains in the audit trail;
- status and response are controlled by authorised managers.

Withdrawing before processing must not erase the fact that the notification was created.

---

# Processing

When a manager starts handling the request, it moves from New to In Treatment.

The manager reviews the request and chooses a result.

Possible results:

1. plan a Begeleiding;
2. plan a Contactmoment;
3. plan a Retraining when that workflow is defined;
4. plan a Salestraining when that workflow is defined;
5. close the request with a concrete answer;
6. request one controlled response from the requester;
7. record another concrete response.

Examples of another concrete response:

- include the topic in a future Salestraining;
- consult other colleagues;
- provide a documented instruction;
- arrange another suitable follow-up.

---

# Prefilled Follow-Up

When a follow-up is created from the Hulpaanvraag:

- the requester is automatically selected as the target person;
- the new record is linked back to the Hulpaanvraag;
- the normal permission and validation rules of the target workflow remain active;
- the manager does not manually reselect another person unless the business flow explicitly allows it.

Begeleiding from a Hulpaanvraag must continue through the existing Begeleiding planning wizard. Retraining and Salestraining may only use the currently implemented technical placeholder flow while their module documents remain `UNDEFINED`; no extra business workflow may be invented here.

---

# Notification Choice

When a request is created, answered, closed or linked to a follow-up, FieldForce creates the relevant in-app notification and sends best-effort e-mail when mail is configured.

Notification recipients are resolved server-side:

- new request: responsible manager;
- manager response, closure or follow-up: requester;
- requester response in a controlled `Respons` step: responsible manager.

The request and response remain visible according to permissions and scope. E-mail delivery failure must not roll back the stored workflow action.

---

# Visibility

The request is visible to:

- the requester;
- the responsible Verkoopleider;
- higher-level users with the correct permission and effective scope.

It is not visible to unrelated teams or Representatives.

Server-side queries must enforce this scope.

---

# Lifecycle

The existing functional status model may use:

```text
New
  ↓
In Treatment
  ↓
Follow-Up Planned
  ↓
Closed
```

A request may also become Cancelled when the requester withdraws it before manager processing or another documented cancellation rule applies.

There is no Rejected status.

Existing schema status names must be reused:

- `NIEUW`;
- `IN_BEHANDELING`;
- `VERVOLGACTIE_GEPLAND`;
- `AFGESLOTEN`;
- `GEANNULEERD`.

---

# Closing

A Hulpaanvraag may close when:

- a concrete response was recorded;
- a suitable follow-up was planned;
- the documented support outcome is clear.

Closing stores:

- responsible actor;
- outcome;
- linked follow-up where applicable;
- notification choice;
- completion time.

The closing answer is stored as sanitized rich text and plain text. A request may not be closed with a functionally empty rich-text answer.

---

# Planning and Dashboard

The responsible manager sees open requests in relevant attention views.

A planned follow-up appears in Planning through the newly created owning object.

The Hulpaanvraag itself should not masquerade as a calendar appointment unless a specific date-based presentation is documented.

---

# Audit

Retain:

- original request;
- requester;
- creation time;
- manager notification;
- processing actor and time;
- status changes;
- response;
- linked follow-up;
- requester notification choice.

Do not erase history when the requester withdraws before processing.

---

# Undefined Dependencies

Retrainingen and Salestrainingen are not yet defined.

Hulpaanvragen may offer these outcomes only when their workflows exist.

Until then:

- do not invent their forms;
- do not create incomplete placeholder records;
- allow another concrete response such as future training consideration.
