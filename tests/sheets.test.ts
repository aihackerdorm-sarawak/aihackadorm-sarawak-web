import { auth, sheets } from "@googleapis/sheets";
import {
  appendRows,
  ensureTabWithHeaders,
  getSheetsEnv,
  getTabName,
  resetSheetsClientForTests,
} from "@/lib/sheets";

const mockValuesApi = {
  get: jest.fn(),
  update: jest.fn(),
  append: jest.fn(),
};

const mockSpreadsheetsApi = {
  get: jest.fn(),
  batchUpdate: jest.fn(),
  values: mockValuesApi,
};

jest.mock("@googleapis/sheets", () => ({
  sheets: jest.fn(() => ({ spreadsheets: mockSpreadsheetsApi })),
  auth: { GoogleAuth: jest.fn() },
}));

const WORKSHOP_HEADERS = [
  "Timestamp",
  "Full Name",
  "Email Address",
  "WhatsApp Number",
  "University / Institution",
  "Program / Course",
  "Year of Study",
];

function setEnv(overrides: Record<string, string> = {}) {
  process.env.GOOGLE_SHEET_ID = "test-sheet-id";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@test.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = '"-----BEGIN PRIVATE KEY-----\\nabc\\ndef\\n-----END PRIVATE KEY-----\\n"';
  process.env.GOOGLE_HACKATHON_TAB = "Hackathon";
  process.env.GOOGLE_WORKSHOP_TAB = "Workshop";
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

function clearEnv() {
  delete process.env.GOOGLE_SHEET_ID;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_HACKATHON_TAB;
  delete process.env.GOOGLE_WORKSHOP_TAB;
}

const mockedSheets = sheets as jest.Mock;
const mockedGoogleAuth = auth.GoogleAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetSheetsClientForTests();
  setEnv();
});

afterEach(() => {
  clearEnv();
});

describe("getSheetsEnv", () => {
  it("throws a helpful error when credentials are missing", () => {
    clearEnv();
    expect(() => getSheetsEnv()).toThrow(/GOOGLE_SHEET_ID/);
  });
});

describe("getTabName", () => {
  it("uses the default tab names", () => {
    expect(getTabName("workshop")).toBe("Workshop");
    expect(getTabName("hackathon")).toBe("Hackathon");
  });

  it("honors env-var overrides", () => {
    setEnv({ GOOGLE_WORKSHOP_TAB: "WS", GOOGLE_HACKATHON_TAB: "HK" });
    expect(getTabName("workshop")).toBe("WS");
    expect(getTabName("hackathon")).toBe("HK");
  });
});

describe("sheets client", () => {
  it("converts escaped newlines in the private key and passes the service account credentials", () => {
    mockSpreadsheetsApi.values.append.mockResolvedValue({ data: { updates: { updatedRange: "Workshop!A2:G2" } } });
    mockSpreadsheetsApi.get.mockResolvedValue({ data: { sheets: [{ properties: { title: "Workshop" } }] } });
    mockSpreadsheetsApi.values.get.mockResolvedValue({ data: {} });

    return appendRows("workshop", [["2026-08-09 10:00:00", "A", "a@b.com", "+60 12-345-6789", "U", "P", "Y"]]).then(
      () => {
        const credentials = mockedGoogleAuth.mock.calls[0][0].credentials;
        expect(credentials.client_email).toBe("svc@test.iam.gserviceaccount.com");
        expect(credentials.private_key).toContain("\n");
        expect(credentials.private_key).not.toContain("\\n");
        expect(mockedGoogleAuth.mock.calls[0][0].scopes).toEqual([
          "https://www.googleapis.com/auth/spreadsheets",
        ]);
      }
    );
  });

  it("reuses the same client instance across calls", () => {
    mockSpreadsheetsApi.values.append.mockResolvedValue({ data: { updates: { updatedRange: "X" } } });
    mockSpreadsheetsApi.get.mockResolvedValue({ data: { sheets: [{ properties: { title: "Workshop" } }] } });
    mockSpreadsheetsApi.values.get.mockResolvedValue({ data: {} });

    return Promise.all([
      appendRows("workshop", [WORKSHOP_HEADERS.slice(1).map((_, i) => `v${i}`)]),
      appendRows("workshop", [WORKSHOP_HEADERS.slice(1).map((_, i) => `v${i}`)]),
    ]).then(() => {
      expect(mockedSheets).toHaveBeenCalledTimes(1);
    });
  });
});

describe("ensureTabWithHeaders", () => {
  it("creates the tab and writes headers when the tab is missing", async () => {
    mockSpreadsheetsApi.get.mockResolvedValueOnce({ data: { sheets: [{ properties: { title: "Sheet1" } }] } });
    mockSpreadsheetsApi.batchUpdate.mockResolvedValue({ data: {} });
    mockSpreadsheetsApi.values.get.mockResolvedValue({ data: {} });

    const tab = await ensureTabWithHeaders("workshop");

    expect(tab).toBe("Workshop");
    expect(mockSpreadsheetsApi.batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          requests: [{ addSheet: { properties: { title: "Workshop" } } }],
        },
      })
    );
    expect(mockValuesApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        range: "Workshop!A1:G1",
        valueInputOption: "RAW",
        requestBody: { values: [WORKSHOP_HEADERS] },
      })
    );
  });

  it("writes headers into an existing tab whose first row is empty", async () => {
    mockSpreadsheetsApi.get.mockResolvedValue({ data: { sheets: [{ properties: { title: "Workshop" } }] } });
    mockSpreadsheetsApi.values.get.mockResolvedValue({ data: { values: [[""]] } });

    await ensureTabWithHeaders("workshop");

    expect(mockSpreadsheetsApi.batchUpdate).not.toHaveBeenCalled();
    expect(mockValuesApi.update).toHaveBeenCalled();
  });

  it("never overwrites an existing non-empty header row", async () => {
    mockSpreadsheetsApi.get.mockResolvedValue({ data: { sheets: [{ properties: { title: "Workshop" } }] } });
    mockSpreadsheetsApi.values.get.mockResolvedValue({ data: { values: [WORKSHOP_HEADERS] } });

    await ensureTabWithHeaders("workshop");

    expect(mockSpreadsheetsApi.batchUpdate).not.toHaveBeenCalled();
    expect(mockValuesApi.update).not.toHaveBeenCalled();
  });
});

describe("appendRows", () => {
  beforeEach(() => {
    mockSpreadsheetsApi.get.mockResolvedValue({ data: { sheets: [{ properties: { title: "Workshop" } }] } });
    mockSpreadsheetsApi.values.get.mockResolvedValue({ data: { values: [WORKSHOP_HEADERS] } });
  });

  it("appends with RAW input so phone numbers are not parsed as formulas", async () => {
    mockValuesApi.append.mockResolvedValue({ data: { updates: { updatedRange: "Workshop!A2:G2" } } });

    await appendRows("workshop", [["2026-08-09 10:00:00", "A", "a@b.com", "+60 12-345-6789", "U", "P", "Y"]]);

    expect(mockValuesApi.append).toHaveBeenCalledWith(
      expect.objectContaining({
        range: "Workshop!A2:G",
        valueInputOption: "RAW",
        requestBody: {
          values: [["2026-08-09 10:00:00", "A", "a@b.com", "+60 12-345-6789", "U", "P", "Y"]],
        },
      })
    );
  });

  it("returns the updated range reported by the API", async () => {
    mockValuesApi.append.mockResolvedValue({ data: { updates: { updatedRange: "Workshop!A2:G2" } } });

    await expect(
      appendRows("workshop", [["2026-08-09 10:00:00", "A", "a@b.com", "+60 12-345-6789", "U", "P", "Y"]])
    ).resolves.toBe("Workshop!A2:G2");
  });

  it("throws when given no rows", async () => {
    await expect(appendRows("workshop", [])).rejects.toThrow("No rows to append");
    expect(mockValuesApi.append).not.toHaveBeenCalled();
  });

  it("uses the hackathon tab width (13 columns) for hackathon rows", async () => {
    mockSpreadsheetsApi.get.mockResolvedValue({ data: { sheets: [{ properties: { title: "Hackathon" } }] } });
    mockSpreadsheetsApi.values.get.mockResolvedValue({
      data: { values: [["Timestamp", "Person Type"]] },
    });
    mockValuesApi.append.mockResolvedValue({ data: { updates: { updatedRange: "Hackathon!A2:M3" } } });

    const row = Array.from({ length: 13 }, (_, i) => `cell${i}`);
    await appendRows("hackathon", [row, row]);

    expect(mockValuesApi.append).toHaveBeenCalledWith(
      expect.objectContaining({ range: "Hackathon!A2:M" })
    );
  });
});
