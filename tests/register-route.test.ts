import { GET, POST } from "@/app/api/register/route";
import {
  appendRows,
  ensureTabWithHeaders,
  getSheetsClient,
  getSheetsEnv,
  getTabName,
} from "@/lib/sheets";
import type { NextResponse } from "next/server";

jest.mock("@/lib/sheets", () => ({
  appendRows: jest.fn(),
  ensureTabWithHeaders: jest.fn(),
  getSheetsClient: jest.fn(),
  getSheetsEnv: jest.fn(),
  getTabName: jest.fn(),
}));

const mockedAppendRows = appendRows as jest.Mock;
const mockedGetSheetsEnv = getSheetsEnv as jest.Mock;
const mockedGetSheetsClient = getSheetsClient as jest.Mock;
const mockedEnsureTabWithHeaders = ensureTabWithHeaders as jest.Mock;
const mockedGetTabName = getTabName as jest.Mock;

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const validWorkshop = {
  formType: "workshop",
  turnstileToken: "test-turnstile-token",
  data: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    whatsapp: "+60 12-345-6789",
    university: "Swinburne University",
    program: "Computer Science",
    yearOfStudy: "Year 2",
  },
};

const validHackathon = {
  formType: "hackathon",
  turnstileToken: "test-turnstile-token",
  data: {
    teamName: "The Innovators",
    teamSize: 3,
    howDidYouHear: "Instagram",
    termsAccepted: true,
    teamConsentAccepted: true,
    teamLeader: {
      fullName: "Jane Leader",
      email: "jane@example.com",
      contact: "+60 11-222-3333",
      university: "Swinburne University",
      program: "Software Engineering",
      yearOfStudy: "Year 3",
    },
    teamMembers: [
      {
        fullName: "John Member",
        email: "john@example.com",
        contact: "+60 12-444-5555",
        university: "Swinburne University",
        program: "Computer Science",
        yearOfStudy: "Year 2",
      },
      {
        fullName: "Jill Member",
        email: "jill@example.com",
        contact: "+60 13-666-7777",
        university: "Swinburne University",
        program: "IT",
        yearOfStudy: "Year 1",
      },
    ],
  },
};

function post(body: unknown): Promise<NextResponse> {
  return POST(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

async function postJson(body: unknown) {
  const response = await post(body);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({ success: true }),
  }) as jest.Mock;
  mockedAppendRows.mockResolvedValue("Workshop!A2:G2");
});

describe("POST /api/register — workshop", () => {
  it("appends one sanitized row and reports success", async () => {
    const { status, body } = await postJson(validWorkshop);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, formType: "workshop", rowsAppended: 1 });
    expect(mockedAppendRows).toHaveBeenCalledWith("Workshop 2", expect.any(Array));

    const row = mockedAppendRows.mock.calls[0][1][0];
    expect(row).toHaveLength(7);
    expect(row[0]).toMatch(TIMESTAMP_PATTERN);
    expect(row.slice(1)).toEqual([
      "Ada Lovelace",
      "ada@example.com",
      "+60 12-345-6789",
      "Swinburne University",
      "Computer Science",
      "Year 2",
    ]);
  });

  it("rejects an invalid email with the offending field", async () => {
    const { status, body } = await postJson({
      ...validWorkshop,
      data: { ...validWorkshop.data, email: "not-an-email" },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error_code: "VALIDATION_ERROR",
      field: "email",
    });
    expect(mockedAppendRows).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number", async () => {
    const { status, body } = await postJson({
      ...validWorkshop,
      data: { ...validWorkshop.data, whatsapp: "not-a-phone" },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ field: "whatsapp" });
  });

  it("rejects a missing required field", async () => {
    const { status, body } = await postJson({
      ...validWorkshop,
      data: { ...validWorkshop.data, name: "" },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ field: "name" });
  });

  it("strips HTML tags from field values", async () => {
    await postJson({
      ...validWorkshop,
      data: { ...validWorkshop.data, name: "<script>alert(1)</script>Ada" },
    });

    const row = mockedAppendRows.mock.calls[0][1][0];
    // The tag is removed; inner text (harmless, unparsed) remains. The key
    // guarantee is that no markup survives into the sheet.
    expect(row[1]).toContain("Ada");
    expect(row[1]).not.toMatch(/<[^>]*>/);
  });

  it("truncates over-long values to the field max length", async () => {
    await postJson({
      ...validWorkshop,
      data: { ...validWorkshop.data, name: "x".repeat(500) },
    });

    const row = mockedAppendRows.mock.calls[0][1][0];
    expect(row[1]).toHaveLength(200);
  });

  it("routes Workshop 1 registrations to the first numbered tab", async () => {
    await postJson({
      ...validWorkshop,
      data: { ...validWorkshop.data, yearOfStudy: "workshop1" },
    });

    expect(mockedAppendRows).toHaveBeenCalledWith("Workshop 1", expect.any(Array));
  });
});

describe("POST /api/register — hackathon", () => {
  it.each([
    ["termsAccepted", "Terms & Conditions"],
    ["teamConsentAccepted", "team members"],
  ])("rejects when %s is not confirmed", async (field, messageFragment) => {
    const { status, body } = await postJson({
      ...validHackathon,
      data: { ...validHackathon.data, [field]: false },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false, field });
    expect(String(body.message)).toContain(messageFragment);
    expect(mockedAppendRows).not.toHaveBeenCalled();
  });

  it("appends one row per person (leader + members) with team meta repeated", async () => {
    const { status, body } = await postJson(validHackathon);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, formType: "hackathon", rowsAppended: 3 });

    const rows = mockedAppendRows.mock.calls[0][1];
    expect(rows).toHaveLength(3);

    const [leader, member1, member2] = rows;
    for (const row of rows) {
      expect(row).toHaveLength(13);
      expect(row[0]).toMatch(TIMESTAMP_PATTERN);
      // Meta columns (2..5) are repeated verbatim on every row.
      expect(row.slice(2, 6)).toEqual(["The Innovators", "", "3", "Instagram"]);
    }

    expect(leader).toEqual([
      expect.stringMatching(TIMESTAMP_PATTERN),
      "Leader",
      "The Innovators",
      "",
      "3",
      "Instagram",
      "Jane Leader",
      "jane@example.com",
      "+60 11-222-3333",
      "", // Student ID — leaders don't provide one, but the cell stays empty (not null)
      "Swinburne University",
      "Software Engineering",
      "Year 3",
    ]);

    expect(member1[1]).toBe("Member");
    expect(member1[9]).toBe("");
    expect(member2[1]).toBe("Member");
    expect(member2[9]).toBe("");
  });

  it("accepts teamSize as a JSON number or a numeric string", async () => {
    await postJson(validHackathon);

    await postJson({
      ...validHackathon,
      data: { ...validHackathon.data, teamSize: "4", teamMembers: [...validHackathon.data.teamMembers, validHackathon.data.teamMembers[0]] },
    });

    expect(mockedAppendRows).toHaveBeenCalledTimes(2);
    const rows = mockedAppendRows.mock.calls;
    expect(rows[0][1][0][4]).toBe("3");
    expect(rows[1][1][0][4]).toBe("4");
  });

  it("rejects when team size does not match the number of members", async () => {
    const { status, body } = await postJson({
      ...validHackathon,
      data: { ...validHackathon.data, teamSize: 4 },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false, field: "teamSize" });
    expect(String(body.message)).toContain("does not match");
  });

  it("rejects team sizes outside 3–5", async () => {
    for (const teamSize of [2, 6, "abc"]) {
      const { status, body } = await postJson({
        ...validHackathon,
        data: { ...validHackathon.data, teamSize },
      });

      expect(status).toBe(400);
      expect(body).toMatchObject({ field: "teamSize" });
    }
  });

  it("rejects an invalid leader email with a prefixed field path", async () => {
    const { status, body } = await postJson({
      ...validHackathon,
      data: {
        ...validHackathon.data,
        teamLeader: { ...validHackathon.data.teamLeader, email: "nope" },
      },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ field: "teamLeader.email" });
  });

  it("accepts a member without studentId", async () => {
    const { status, body } = await postJson({
      ...validHackathon,
      data: {
        ...validHackathon.data,
        teamMembers: validHackathon.data.teamMembers,
      },
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, rowsAppended: 3 });
  });

  it("rejects non-array teamMembers", async () => {
    const { status, body } = await postJson({
      ...validHackathon,
      data: { ...validHackathon.data, teamMembers: "nope" },
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ field: "teamMembers" });
  });
});

describe("POST /api/register — envelope", () => {
  it("rejects an unknown formType", async () => {
    const { status, body } = await postJson({
      formType: "sponsor",
      turnstileToken: "test-turnstile-token",
      data: {},
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ field: "formType" });
  });

  it("rejects invalid JSON bodies", async () => {
    const { status, body } = await postJson("{not json");

    expect(status).toBe(400);
    expect(body).toMatchObject({ error_code: "INVALID_JSON" });
  });

  it("rejects non-object payloads", async () => {
    const { status, body } = await postJson(["workshop"]);

    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false });
  });

  it("returns 500 when the sheet write fails", async () => {
    mockedAppendRows.mockRejectedValue(new Error("boom"));

    const { status, body } = await postJson(validWorkshop);

    expect(status).toBe(500);
    expect(body).toMatchObject({ success: false, error_code: "SERVER_ERROR" });
  });
});

describe("GET /api/register — smoke test", () => {
  it("reports spreadsheet details and configured forms", async () => {
    mockedGetSheetsEnv.mockReturnValue({ sheetId: "abc123" });
    mockedEnsureTabWithHeaders.mockResolvedValue(undefined);
    mockedGetTabName.mockImplementation((type: string) => {
      if (type === "workshop") return "Workshop";
      if (type === "hackathon") return "Hackathon";
      return type;
    });
    mockedGetSheetsClient.mockReturnValue({
      spreadsheets: {
        get: jest.fn().mockResolvedValue({
          data: {
            properties: { title: "Test Spreadsheet" },
            sheets: [
              { properties: { title: "Sheet1" } },
              { properties: { title: "Hackathon" } },
              { properties: { title: "Workshop" } },
            ],
          },
        }),
      },
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      spreadsheetId: "abc123",
      spreadsheetTitle: "Test Spreadsheet",
      forms: [
        { formType: "workshop", tabName: "Workshop" },
        { formType: "Workshop 1", tabName: "Workshop 1" },
        { formType: "Workshop 2", tabName: "Workshop 2" },
        { formType: "hackathon", tabName: "Hackathon" },
      ],
    });
    expect(mockedEnsureTabWithHeaders.mock.calls.map(([formType]) => formType)).toEqual([
      "workshop",
      "Workshop 1",
      "Workshop 2",
      "hackathon",
    ]);
  });

  it("returns 500 when credentials or the connection are broken", async () => {
    mockedGetSheetsEnv.mockImplementation(() => {
      throw new Error("Missing Google Sheets credentials");
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ ok: false, error_code: "SHEETS_CONNECTION_ERROR" });
  });
});
