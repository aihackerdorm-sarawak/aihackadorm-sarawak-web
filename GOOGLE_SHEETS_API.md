# Google Sheets API — Registration Storage

The site's registration backend: hackathon + workshop submissions are validated,
sanitized, and appended to a Google Sheet via the official
[`@googleapis/sheets`](https://www.npmjs.com/package/@googleapis/sheets) SDK.

Work was done on the `Google-Sheets-API` branch. The frontend form does not
exist yet — this is the backend half, built and tested first.

## Spreadsheet

- **Title:** "AI Hackerdorm Sarawak Registration Form Data"
- **Tabs:** `Hackathon` and `Workshop` — created automatically (with header
  rows) on first write if they don't exist
- **Auth:** Google Cloud service account (Editor access, shared with the
  sheet)

## Files

| File | Purpose |
| --- | --- |
| `lib/registration-config.ts` | **Single source of truth** for both forms: every payload field (key, sheet column label, type, max length) declared in arrays. Adding/renaming a field later = one line here. |
| `lib/sheets.ts` | Google Sheets wrapper: service-account auth client (lazy singleton), `ensureTabWithHeaders()` (idempotent tab + header creation), `appendRows()`, tab-name resolution. |
| `app/api/register/route.ts` | `POST /api/register` — config-driven validation + sanitization, flattening, sheet append. `GET /api/register` — credentials/config smoke test. |
| `.env.local` | Real credentials (git-ignored, never commit). |
| `.env.example` | Credential setup template (currently also matched by the `.env*` gitignore rule — force-add it if you want it committed). |
| `package.json` | Added dependency: `@googleapis/sheets`. |

## API contract

`POST /api/register` with JSON body:

```jsonc
// Workshop — single person
{
  "formType": "workshop",
  "data": {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "whatsapp": "+60 12-345-6789",
    "university": "Swinburne University",
    "program": "Computer Science",
    "yearOfStudy": "Year 2"
  }
}

// Hackathon — team + leader + optional members (members = teamSize - 1)
{
  "formType": "hackathon",
  "data": {
    "teamName": "The Innovators",
    "teamUniversity": "Swinburne University",
    "teamSize": 3,
    "howDidYouHear": "Instagram",          // optional
    "teamLeader": {                        // no student ID
      "fullName": "Jane Leader",
      "email": "jane@example.com",
      "contact": "+60 11-222-3333",
      "university": "Swinburne University",
      "program": "Software Engineering",
      "yearOfStudy": "Year 3"
    },
    "teamMembers": [                       // members DO require studentId
      {
        "fullName": "John Member",
        "email": "john@example.com",
        "contact": "+60 12-444-5555",
        "studentId": "101234567",
        "university": "Swinburne University",
        "program": "Computer Science",
        "yearOfStudy": "Year 2"
      }
    ]
  }
}
```

### Success (200)

```json
{
  "success": true,
  "message": "Hackathon registration received.",
  "formType": "hackathon",
  "rowsAppended": 3,
  "updatedRange": "Hackathon!A2:M4"
}
```

### Errors (400 / 500)

```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR" | "INVALID_JSON" | "SERVER_ERROR",
  "message": "Human-readable reason",
  "field": "email"   // which field failed, where applicable
}
```

`GET /api/register` returns the spreadsheet title, existing tabs, and the
configured forms — useful as a connection smoke test while there's no form UI.

## Data layout

- **Workshop tab** — one row per registration:
  `Timestamp | Full Name | Email Address | WhatsApp Number | University / Institution | Program / Course | Year of Study`
- **Hackathon tab** — **one row per person** (leader + each member), with team
  info repeated, so the data is filterable/pivotable in Sheets:
  `Timestamp | Person Type (Leader/Member) | Team Name | Team University | Team Size | How did you hear about us? | Full Name | Email Address | Contact Number | Student ID | University / Institution | Program / Course | Year of Study`
- Timestamps are `Asia/Kuching` (UTC+8), 24h format (`2026-08-09 16:08:54`)

## Validation & sanitization

- All fields: HTML tags stripped, trimmed, length-capped (email 150, phone 20,
  others 200); emails lowercased
- Email regex + phone regex (`+60 12-345-6789` style, 7–15 digits)
- Hackathon: `teamSize` must be an integer 1–5; `teamMembers.length + 1` must
  equal `teamSize`; leader/member fields validated with the member-specific
  `studentId`
- Invalid input → 400 with `error_code`/`field` (mirrors the old Supabase
  edge-function conventions)

## Environment variables (`.env.local`)

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_SHEET_ID` | yes | ID from the spreadsheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | yes | `client_email` from the service-account JSON |
| `GOOGLE_PRIVATE_KEY` | yes | `private_key` — keep the surrounding double quotes; code converts `\n` escapes |
| `GOOGLE_HACKATHON_TAB` | no | default `Hackathon` |
| `GOOGLE_WORKSHOP_TAB` | no | default `Workshop` |
| `GOOGLE_WORKSHOP_1_TAB` | no | default `Workshop 1` |
| `GOOGLE_WORKSHOP_2_TAB` | no | default `Workshop 2` |

## Verified in testing (2026-08-09)

- Service-account auth against the live spreadsheet ✔
- Tabs + headers auto-created ✔
- Workshop append ✔; bad email rejected with field name ✔
- 3-person hackathon append (3 rows) ✔; team-size mismatch rejected ✔
- Fixed during testing:
  - `#ERROR!` in phone columns — `USER_ENTERED` parsed `+60…` as a formula;
    switched to `RAW` input
  - `teamSize` arriving as a JSON number failed the string sanitizer; now
    validated as an integer separately
- `tsc --noEmit` and `eslint` clean (only the pre-existing `CountdownLabels`
  warning); test rows were cleared from the spreadsheet afterwards

## Automated tests (`npm test`)

Jest + ts-jest (`jest.config.js`, suites in `tests/`). No real Google
credentials or network needed — `@googleapis/sheets` and `lib/sheets.ts` are
mocked.

| Suite | Covers |
| --- | --- |
| `tests/register-route.test.ts` | Route-level validation/sanitization/flattening: valid workshop + hackathon POSTs, bad email/phone/missing fields, team-size mismatch and range, member `studentId`, HTML stripping, length caps, invalid JSON/formType, 500 on sheet failure, GET smoke test — 21 tests |
| `tests/sheets.test.ts` | Auth wiring (private-key `\n` conversion, scopes, client reuse), tab creation + header writing (only when first row empty), RAW append (the `#ERROR!` regression), empty-rows guard — 10 tests |
| `tests/registration-config.test.ts` | The config-driven field lists and header rows stay in sync with the form spec — 8 tests |

Tests caught the leader `studentId` `undefined` → `null` serialization bug
(fixed with an explicit `""` in `flattenHackathon`).

## Not done yet / next steps

- **Registration form UI** (hackathon + workshop tabs) wired to this endpoint
- Captcha and rate limiting (was TODO in the earlier Supabase approach too)
- `.env.example` force-add on commit so teammates see the setup
