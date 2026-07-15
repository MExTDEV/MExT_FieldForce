# Contactmomenten

## Status

Workflow status: `DEFINED`

## Purpose

A Contactmoment is a planned management interaction comparable to a Begeleiding, but without the complete Coaching evaluation and score form.

It is used to document a meaningful contact, share the report with the target person and optionally create follow-up.

---

# Participants

## Planner and author

An authorised user who may plan a Contactmoment within effective scope.

## Target person

The employee with whom the Contactmoment takes place.

The target person receives the shared report.

---

# Permissions and Scope

Scheduling follows the existing hierarchy and effective permission model.

Examples:

- Verkoopleider → permitted users in own team;
- Country Manager or Admin → permitted users in assigned country scope;
- Sales Manager → permitted users in assigned countries;
- Super Admin → all permitted users.

Client and server must enforce the same scope.

---

# Planning

A Contactmoment can be planned with:

- target person;
- date;
- start time;
- end time;
- optional prior-notification choice;
- optional subject or context where supported.

The planner decides whether the target person is informed in advance.

The item appears in Planning and relevant overviews according to permissions and notification visibility.

---

# Report

A report must be created before the Contactmoment is shared.

The report uses WYSIWYG content.

The report records the outcome of the Contactmoment.

No approval by the target person is required.

The detail screen keeps planning metadata and status history compact above the
report. The report content is the primary focus of the page.

---

# Photos

Photos are optional.

Photo metadata is stored in `ContactMomentDetail.photosJson`.

Photo files are stored below `FIELD_FORCE_UPLOAD_ROOT/contact-moments/`.
When the variable is not set, the application falls back to `storage/uploads`.
The upload root must be private, persistent and included in backups.

During planning, an authorised planner may select multiple images before saving
the Contactmoment. The UI shows local thumbnails and allows removal before the
record is created. After the Contactmoment is persisted, the same private photo
API stores the selected images on the Contactmoment.

Before sharing:

- authorised users may add or remove photos.
- multiple photos may be added in one upload action;
- supported types are JPEG, PNG and WebP;
- each file is limited to 8 MB;
- a Contactmoment is limited to 20 photos;
- MIME type and image file signature are validated before storage;
- photo metadata includes ID, original filename, stored filename, MIME type,
  file size, uploader, upload timestamp and sort order.

After sharing:

- photos cannot be added;
- photos cannot be removed;
- the report and gallery are read-only.

The report view displays photos as a gallery.

The gallery opens photos in a larger read-only viewer. Missing or damaged image
files show a controlled unavailable state instead of a broken browser image.

PDF export includes all linked photos in stored order. Images are scaled
proportionally so the aspect ratio is preserved.

Photo access must go through the authenticated private API. Public/static file
serving is not allowed for Contactmoment photos.

---

# Action Points

A Contactmoment may create one or more Action Points when the current UI supports it.

An Action Point resulting from a Contactmoment is user-scoped to the target person.

It reuses the shared Action Point model.

The undefined general Action Point closure lifecycle must not be invented inside Contactmomenten.

---

# Sharing

When the report is shared:

- the target person gains access to the report;
- no approval task is created;
- the Contactmoment becomes locked for normal editing;
- photos become immutable;
- the shared timestamp and actor should be auditable;
- the item becomes part of the target person's history.

If a notification is generated, it must use the existing notification foundation and respect browser limitations.

---

# Lifecycle

Recommended functional lifecycle:

```text
Planned
  ↓
In Progress
  ↓
Report Ready
  ↓
Shared
```

A cancelled state may be supported when already present in the shared intervention model.

Technical names must align with existing enums and shared helpers.

Do not add new statuses without checking the Intervention model and existing lifecycle handling.

---

# Editing Rules

Before Shared:

- authorised users may update planning;
- authorised users may write the report;
- authorised users may manage optional photos;
- authorised users may create follow-up Action Points.

After Shared:

- normal editing is prohibited;
- report and photos are read-only;
- a future correction mechanism requires separate business approval.

---

# Visibility

The target person sees:

- an announced planned Contactmoment when prior notification is enabled;
- the shared report after sharing.

Management users see Contactmomenten only within effective scope and permissions.

---

# PDF

The PDF contains:

- Contactmoment metadata;
- target person;
- author;
- date and time;
- WYSIWYG report content;
- all linked photos;
- relevant user Action Points where the approved report design includes them.

Implementation:

- `lib/contact-moment-pdf.ts` creates the PDF from the final Contactmoment
  snapshot, metadata, linked action points and photo metadata;
- the detail screen downloads private photos through the existing photo API and
  embeds available photo bytes in the PDF;
- when a photo cannot be loaded, the PDF still contains the photo metadata and
  an explicit placeholder;
- the export is available for final Contactmomenten: shared, cancelled or not
  executed records.

Validation:

- `npm run test:contact-moment-pdf` verifies PDF creation and the PDF signature;
- browser/tablet visual acceptance remains a manual acceptance step because the
  local development server is managed externally.

---

# Open Technical Decisions

Implementation still depends on external acceptance for:

- real Microsoft Graph create/update/delete validation with delegated tokens;
- production upload-root path, backup retention and restore test evidence per
  environment.

These are acceptance checks, not permission to change the functional behaviour
above.
