import { NextResponse } from "next/server";
import { appendRows, ensureTabWithHeaders, getSheetsClient, getSheetsEnv, getTabName } from "@/lib/sheets";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  FORMS,
  HACKATHON_LEADER_FIELDS,
  HACKATHON_MEMBER_FIELDS,
  HACKATHON_META_FIELDS,
  TEAM_SIZE_MAX,
  TEAM_SIZE_MIN,
  WORKSHOP_FIELDS,
  type RegistrationField,
  type RegistrationFormType,
} from "@/lib/registration-config";

export const runtime = "nodejs";

type ApiError = {
  success: false;
  error_code: string;
  message: string;
  field?: string;
};

type ApiSuccess = {
  success: true;
  message: string;
  formType: RegistrationFormType;
  rowsAppended: number;
  updatedRange: string;
};

function errorResponse(body: ApiError, status = 400): NextResponse {
  return NextResponse.json(body, { status });
}

function stripHtml(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.replace(/<[^>]*>/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned);
}

/**
 * Validates + sanitizes an object against a config field list. Returns the
 * sanitized values, or an ApiError describing the first invalid field.
 */
function validateFields(
  object: Record<string, unknown>,
  fields: RegistrationField[],
  prefix = ""
): { ok: true; values: Record<string, string> } | { ok: false; error: ApiError } {
  const values: Record<string, string> = {};

  for (const config of fields) {
    const raw = object[config.key];
    const sanitized = stripHtml(raw).slice(0, config.maxLength ?? 200);
    const fieldPath = prefix ? `${prefix}.${config.key}` : config.key;

    if (config.required && !sanitized) {
      return {
        ok: false,
        error: {
          success: false,
          error_code: "VALIDATION_ERROR",
          message: `${config.label} is required`,
          field: fieldPath,
        },
      };
    }

    if (sanitized) {
      if (config.type === "email" && !isValidEmail(sanitized)) {
        return {
          ok: false,
          error: {
            success: false,
            error_code: "VALIDATION_ERROR",
            message: `${config.label} is not a valid email address`,
            field: fieldPath,
          },
        };
      }

      if (config.type === "tel" && !isValidPhone(sanitized)) {
        return {
          ok: false,
          error: {
            success: false,
            error_code: "VALIDATION_ERROR",
            message: `${config.label} is not a valid phone number (e.g. +60 12-345-6789)`,
            field: fieldPath,
          },
        };
      }
    }

    values[config.key] = config.type === "email" ? sanitized.toLowerCase() : sanitized;
  }

  return { ok: true, values };
}

function timestamp(): string {
  // "2026-08-09 16:05:42" in Kuching time (UTC+8), where the event lives.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")}`;
}

/** Workshop → one row: Timestamp + field values in config order. */
function flattenWorkshop(values: Record<string, string>): string[][] {
  return [[timestamp(), ...WORKSHOP_FIELDS.map((f) => values[f.key])]];
}

/** Hackathon → one row per person: meta prefix + person values in config order. */
function flattenHackathon(
  meta: Record<string, string>,
  leader: Record<string, string>,
  members: Record<string, string>[]
): string[][] {
  const personColumns = HACKATHON_MEMBER_FIELDS.map((f) => f.key);
  const metaColumns = HACKATHON_META_FIELDS.map((f) => f.key);

  // Leader has no studentId key — pad with "" so every row has the same width
  // (undefined would serialize to null in the JSON response).
  const personValues = (person: Record<string, string>) =>
    personColumns.map((key) => person[key] ?? "");

  const rows = [
    [timestamp(), "Leader", ...metaColumns.map((k) => meta[k]), ...personValues(leader)],
  ];

  for (const member of members) {
    rows.push([timestamp(), "Member", ...metaColumns.map((k) => meta[k]), ...personValues(member)]);
  }

  return rows;
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function handleWorkshop(data: unknown): Promise<NextResponse> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return errorResponse({ success: false, error_code: "VALIDATION_ERROR", message: "Invalid payload shape" });
  }

  const validated = validateFields(data as Record<string, unknown>, WORKSHOP_FIELDS);
  if (!validated.ok) {
    return errorResponse(validated.error);
  }

  const rows = flattenWorkshop(validated.values);
// 1. Grab the workshop ID 
const submittedWorkshopId = String(validated.values.yearOfStudy);

// 2. Make it bulletproof by checking if it contains the number 1
const sheetTabName = submittedWorkshopId.includes("1") ? "Workshop 1" : "Workshop 2";

// 3. Send the data to the correct tab
const updatedRange = await appendRows(sheetTabName, rows);

  return NextResponse.json<ApiSuccess>({
    success: true,
    message: "Workshop registration received.",
    formType: "workshop",
    rowsAppended: rows.length,
    updatedRange,
  });
}

async function handleHackathon(data: unknown): Promise<NextResponse> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return errorResponse({ success: false, error_code: "VALIDATION_ERROR", message: "Invalid payload shape" });
  }

  const body = data as Record<string, unknown>;

  if (body.termsAccepted !== true) {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: "You must agree to the Terms & Conditions",
      field: "termsAccepted",
    });
  }

  if (body.teamConsentAccepted !== true) {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: "You must confirm that all listed team members have agreed to participate",
      field: "teamConsentAccepted",
    });
  }

  const meta = validateFields(body, HACKATHON_META_FIELDS);
  if (!meta.ok) {
    return errorResponse(meta.error);
  }

  const rawTeamSize =
    typeof body.teamSize === "number" ? String(body.teamSize) : stripHtml(body.teamSize);
  const teamSize = Number(rawTeamSize);
  if (!Number.isInteger(teamSize) || teamSize < TEAM_SIZE_MIN || teamSize > TEAM_SIZE_MAX) {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: `Team size must be a number between ${TEAM_SIZE_MIN} and ${TEAM_SIZE_MAX}`,
      field: "teamSize",
    });
  }
  meta.values.teamSize = String(teamSize);

  const leader = validateFields(
    (body.teamLeader ?? {}) as Record<string, unknown>,
    HACKATHON_LEADER_FIELDS,
    "teamLeader"
  );
  if (!leader.ok) {
    return errorResponse(leader.error);
  }

  if (!Array.isArray(body.teamMembers)) {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: "teamMembers must be an array",
      field: "teamMembers",
    });
  }

  if (body.teamMembers.length !== teamSize - 1) {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: `Team size (${teamSize}) does not match the number of members provided (${body.teamMembers.length} plus the leader)`,
      field: "teamSize",
    });
  }

  const members: Record<string, string>[] = [];
  for (let i = 0; i < body.teamMembers.length; i += 1) {
    const member = validateFields(
      body.teamMembers[i] as Record<string, unknown>,
      HACKATHON_MEMBER_FIELDS,
      `teamMembers[${i}]`
    );
    if (!member.ok) {
      return errorResponse(member.error);
    }
    members.push(member.values);
  }

  const rows = flattenHackathon(meta.values, leader.values, members);
  const updatedRange = await appendRows("hackathon", rows);

  return NextResponse.json<ApiSuccess>({
    success: true,
    message: "Hackathon registration received.",
    formType: "hackathon",
    rowsAppended: rows.length,
    updatedRange,
  });
}

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);

  // Rate limit check FIRST — before parsing/validating anything,
  // so malformed requests can't bypass it
  const allowed = await checkRateLimit(ipAddress);
  if (!allowed) {
    return errorResponse(
      {
        success: false,
        error_code: "RATE_LIMITED",
        message: "Too many attempts. Please try again in a few minutes.",
      },
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse({ success: false, error_code: "INVALID_JSON", message: "Request body must be valid JSON" }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse({ success: false, error_code: "VALIDATION_ERROR", message: "Invalid payload shape" });
  }

  // --- START CLOUDFLARE SECURITY CHECK ---
  const turnstileToken = (body as Record<string, unknown>).turnstileToken as string | undefined;

  if (!turnstileToken) {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: "Security verification missing. Please complete the CAPTCHA."
    }, 400);
  }

  const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });

  const verifyResult = await verifyResponse.json();

  if (!verifyResult.success) {
    return errorResponse({
      success: false,
      error_code: "FORBIDDEN",
      message: "Security verification failed."
    }, 403);
  }
  // --- END CLOUDFLARE SECURITY CHECK ---
  
  const formType = (body as Record<string, unknown>).formType;
  if (formType !== "workshop" && formType !== "hackathon") {
    return errorResponse({
      success: false,
      error_code: "VALIDATION_ERROR",
      message: "formType must be \"workshop\" or \"hackathon\"",
      field: "formType",
    });
  }

  try {
    if (formType === "workshop") {
      return await handleWorkshop((body as Record<string, unknown>).data);
    }
    return await handleHackathon((body as Record<string, unknown>).data);
  } catch (err) {
    console.error("Registration append failed:", err);
    return errorResponse(
      {
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to save the registration. Please try again in a moment.",
      },
      500
    );
  }
}

/**
 * Smoke-test / health-check helper for the API-only phase: verifies the
 * service account can read the spreadsheet and reports the config so you can
 * confirm tabs/columns line up. Not used by the (future) form.
 */
export async function GET() {
  try {
    const env = getSheetsEnv();
    const sheets = getSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: env.sheetId });

    await Promise.all(
      (Object.keys(FORMS) as RegistrationFormType[]).map((formType) =>
        ensureTabWithHeaders(formType)
      )
    );

    const refreshed = await sheets.spreadsheets.get({ spreadsheetId: env.sheetId });

    return NextResponse.json({
      ok: true,
      spreadsheetId: env.sheetId,
      spreadsheetTitle: spreadsheet.data.properties?.title,
      tabs: refreshed.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean),
      forms: Object.entries(FORMS).map(([type, config]) => ({
        formType: type,
        tabName: getTabName(type as RegistrationFormType),
        description: config.description,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error_code: "SHEETS_CONNECTION_ERROR",
        message: err instanceof Error ? err.message : "Could not connect to Google Sheets",
      },
      { status: 500 }
    );
  }
}
