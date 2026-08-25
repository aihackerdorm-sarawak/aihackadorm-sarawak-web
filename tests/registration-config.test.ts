import {
  FORMS,
  HACKATHON_LEADER_FIELDS,
  HACKATHON_MEMBER_FIELDS,
  HACKATHON_META_FIELDS,
  WORKSHOP_FIELDS,
  hackathonHeaderRow,
  headerRowFor,
  workshopHeaderRow,
} from "@/lib/registration-config";

describe("registration-config", () => {
  describe("workshop fields", () => {
    it("defines the six spec fields in order", () => {
      expect(WORKSHOP_FIELDS.map((field) => field.key)).toEqual([
        "name",
        "email",
        "whatsapp",
        "university",
        "program",
        "yearOfStudy",
      ]);
    });

    it("requires every workshop field", () => {
      expect(WORKSHOP_FIELDS.every((field) => field.required)).toBe(true);
    });
  });

  describe("hackathon person fields", () => {
    it("keeps studentId only as an optional legacy sheet column", () => {
      const memberKeys = HACKATHON_MEMBER_FIELDS.map((field) => field.key);
      const leaderKeys = HACKATHON_LEADER_FIELDS.map((field) => field.key);
      const studentId = HACKATHON_MEMBER_FIELDS.find((field) => field.key === "studentId");

      expect(memberKeys).toContain("studentId");
      expect(studentId?.required).toBe(false);
      expect(leaderKeys).not.toContain("studentId");
      expect(leaderKeys).toContain("fullName");
      expect(leaderKeys).toContain("contact");
    });

    it("teamSize is not a required string field (it arrives as a number)", () => {
      const teamSize = HACKATHON_META_FIELDS.find((field) => field.key === "teamSize");
      expect(teamSize?.required).toBe(false);
    });

    it("keeps teamUniversity only as an optional legacy sheet column", () => {
      const teamUniversity = HACKATHON_META_FIELDS.find((field) => field.key === "teamUniversity");
      expect(teamUniversity?.required).toBe(false);
    });
  });

  describe("header rows", () => {
    it("workshop header matches the spec columns", () => {
      expect(workshopHeaderRow()).toEqual([
        "Timestamp",
        "Full Name",
        "Email Address",
        "WhatsApp Number",
        "University / Institution",
        "Program / Course",
        "Year of Study",
      ]);
    });

    it("hackathon header is Timestamp + Person Type + meta + person columns", () => {
      expect(hackathonHeaderRow()).toEqual([
        "Timestamp",
        "Person Type",
        ...HACKATHON_META_FIELDS.map((field) => field.label),
        ...HACKATHON_MEMBER_FIELDS.map((field) => field.label),
      ]);
    });

    it("header labels derive from the field configs (single source of truth)", () => {
      expect(workshopHeaderRow().slice(1)).toEqual(WORKSHOP_FIELDS.map((field) => field.label));
      expect(hackathonHeaderRow().slice(2, 2 + HACKATHON_META_FIELDS.length)).toEqual(
        HACKATHON_META_FIELDS.map((field) => field.label)
      );
    });

    it("uses workshop headers for both numbered workshop forms", () => {
      expect(headerRowFor("Workshop 1")).toEqual(workshopHeaderRow());
      expect(headerRowFor("Workshop 2")).toEqual(workshopHeaderRow());
    });
  });

  it("registers all form types", () => {
    expect(Object.keys(FORMS).sort()).toEqual([
      "Workshop 1",
      "Workshop 2",
      "hackathon",
      "workshop",
    ]);
    expect(FORMS.workshop.tabName).toBe("Workshop");
    expect(FORMS["Workshop 1"].tabName).toBe("Workshop 1");
    expect(FORMS["Workshop 2"].tabName).toBe("Workshop 2");
    expect(FORMS.hackathon.tabName).toBe("Hackathon");
  });
});
