/**
 * Data-driven registration configuration.
 *
 * Both registration forms (workshop + hackathon) are described declaratively
 * here: every payload field, its sheet column label, its type (for validation)
 * and its limits. The API route validates, sanitizes and flattens payloads
 * purely from these definitions — adding/renaming a field later is a one-line
 * change here, no route logic to touch.
 */

export type RegistrationFormType = "workshop" | "hackathon" | "Workshop 1" | "Workshop 2";

export type FieldType = "text" | "email" | "tel";

export type RegistrationField = {
  /** Key of the field in the JSON payload (camelCase). */
  key: string;
  /** Human-readable label — used as the sheet column header. */
  label: string;
  type: FieldType;
  required?: boolean;
  maxLength?: number;
};

const MAX_LENGTH = {
  text: 200,
  email: 150,
  tel: 20,
} as const;

function field(key: string, label: string, type: FieldType): RegistrationField {
  return { key, label, type, required: true, maxLength: MAX_LENGTH[type] };
}

/** Workshop registration — single person. */
export const WORKSHOP_FIELDS: RegistrationField[] = [
  field("name", "Full Name", "text"),
  field("email", "Email Address", "email"),
  field("whatsapp", "WhatsApp Number", "tel"),
  field("university", "University / Institution", "text"),
  field("program", "Program / Course", "text"),
  field("yearOfStudy", "Year of Study", "text"),
];

/** Base person fields for hackathon leader + members. */
const PERSON_BASE_FIELDS: RegistrationField[] = [
  field("fullName", "Full Name", "text"),
  field("email", "Email Address", "email"),
  field("contact", "Contact Number", "tel"),
  field("university", "University / Institution", "text"),
  field("program", "Program / Course", "text"),
  field("yearOfStudy", "Year of Study", "text"),
];

/**
 * Team leader fields — no student ID (matches the form spec; leaders supply
 * the other contact details, members are the ones who need IDs).
 */
export const HACKATHON_LEADER_FIELDS: RegistrationField[] = PERSON_BASE_FIELDS;

/** Team member fields plus legacy storage columns retained for sheet alignment. */
export const HACKATHON_MEMBER_FIELDS: RegistrationField[] = [
  ...PERSON_BASE_FIELDS.slice(0, 3),
  // Optional legacy column keeps historical and new sheet rows aligned.
  { key: "studentId", label: "Student ID", type: "text", required: false, maxLength: MAX_LENGTH.text },
  ...PERSON_BASE_FIELDS.slice(3),
];

/** Hackathon meta columns that prefix every person row in the sheet. */
export const HACKATHON_META_FIELDS: RegistrationField[] = [
  field("teamName", "Team Name", "text"),
  // University is collected per person; this legacy column remains blank.
  { key: "teamUniversity", label: "Team University", type: "text", required: false, maxLength: MAX_LENGTH.text },
  // teamSize arrives as a JSON number and is validated as an integer in the
  // route — not through the generic string sanitizer — so it's optional here.
  { key: "teamSize", label: "Team Size", type: "text", required: false, maxLength: 3 },
  { key: "howDidYouHear", label: "How did you hear about us?", type: "text", required: false, maxLength: MAX_LENGTH.text },
];

export const TEAM_SIZE_MIN = 3;
export const TEAM_SIZE_MAX = 5;

export const FORMS: Record<
  RegistrationFormType,
  {
    tabName: string;
    description: string;
  }
> = {
  workshop: {
    tabName: "Workshop",
    description: "Single-person workshop participation",
  },
  "Workshop 1": {
    tabName: "Workshop 1",
    description: "Participation for Workshop 1"
  },
  "Workshop 2": {
    tabName: "Workshop 2",
    description: "Participation for Workshop 2"
  },
  hackathon: {
    tabName: "Hackathon",
    description: "Team registration with leader + optional members",
  },
};

export function getFormConfig(formType: RegistrationFormType) {
  return FORMS[formType];
}

/** Header row for the workshop tab. */
export function workshopHeaderRow(): string[] {
  return ["Timestamp", ...WORKSHOP_FIELDS.map((f) => f.label)];
}

/** Header row for the hackathon tab — one row per person. */
export function hackathonHeaderRow(): string[] {
  return [
    "Timestamp",
    "Person Type",
    ...HACKATHON_META_FIELDS.map((f) => f.label),
    ...HACKATHON_MEMBER_FIELDS.map((f) => f.label),
  ];
}

export function headerRowFor(formType: RegistrationFormType): string[] {
  return formType === "hackathon" ? hackathonHeaderRow() : workshopHeaderRow();
}
