/**
 * Thin wrapper around the official Google Sheets API (@googleapis/sheets).
 *
 * Authentication uses a service account (see .env.example for setup). The
 * client is created once per process and reused across requests.
 */
import { auth, sheets } from "@googleapis/sheets";
import type { sheets_v4 } from "@googleapis/sheets";
import { headerRowFor, type RegistrationFormType } from "./registration-config";

type SheetsEnv = {
  sheetId: string;
  clientEmail: string;
  privateKey: string;
};

export function getSheetsEnv(): SheetsEnv {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Google Sheets credentials. Check GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env.local"
    );
  }

  return {
    sheetId,
    clientEmail,
    // .env values keep \n as literal backslash-n; the key needs real newlines.
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

let cachedClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getSheetsEnv();

  const googleAuth = new auth.GoogleAuth({
    credentials: {
      client_email: env.clientEmail,
      private_key: env.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = sheets({ version: "v4", auth: googleAuth });
  return cachedClient;
}

export function getTabName(formType: RegistrationFormType): string {
  switch (formType) {
    case "hackathon":
      return process.env.GOOGLE_HACKATHON_TAB ?? "Hackathon";
    case "workshop":
      return process.env.GOOGLE_WORKSHOP_TAB ?? "Workshop";
    case "Workshop 1":
      return process.env.GOOGLE_WORKSHOP_1_TAB ?? "Workshop 1";
    case "Workshop 2":
      return process.env.GOOGLE_WORKSHOP_2_TAB ?? "Workshop 2";
  }
}

/** Quotes a sheet title for use in A1 notation, including embedded apostrophes. */
function a1SheetName(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

/**
 * Makes sure the form's tab exists with a header row, creating either when
 * missing. Idempotent — safe to call before every write.
 */
export async function ensureTabWithHeaders(formType: RegistrationFormType): Promise<string> {
  const env = getSheetsEnv();
  const sheets = getSheetsClient();
  const tabName = getTabName(formType);

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: env.sheetId,
    fields: "sheets(properties(title,sheetId))",
  });

  const exists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === tabName
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  const headers = headerRowFor(formType);
  const range = `${a1SheetName(tabName)}!A1:${columnLetter(headers.length)}1`;

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: env.sheetId,
    range,
  });

  // Only write headers when the first row is missing or entirely empty —
  // an existing non-empty row is assumed to already be (or contain) the
  // header row, so we never overwrite user data.
  const existing = current.data.values?.[0];
  const rowIsEmpty = !existing || existing.every((cell) => !cell?.trim());

  if (rowIsEmpty) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  return tabName;
}

/** Appends rows to the tab, returning the range that was written. */
export async function appendRows(
  formType: RegistrationFormType,
  rows: string[][]
): Promise<string> {
  if (rows.length === 0) {
    throw new Error("No rows to append");
  }

  const env = getSheetsEnv();
  const sheets = getSheetsClient();
  const tabName = await ensureTabWithHeaders(formType);

  const width = headerRowFor(formType).length;
  const startColumn = columnLetter(width);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: env.sheetId,
    range: `${a1SheetName(tabName)}!A2:${startColumn}`,
    // RAW (not USER_ENTERED): phone numbers like "+60 12-345-6789" start with
    // '+' which USER_ENTERED parses as a formula — every contact column ended
    // up as #ERROR! until this was switched to RAW.
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  return response.data.updates?.updatedRange ?? `${a1SheetName(tabName)}!A2:${startColumn}`;
}

/** 1 -> A, 2 -> B, ... 26 -> Z, 27 -> AA. */
function columnLetter(index: number): string {
  let remaining = index;
  let result = "";
  while (remaining > 0) {
    const mod = (remaining - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return result || "A";
}

export function resetSheetsClientForTests() {
  cachedClient = null;
}
