import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TeamMemberInput = {
  full_name: string;
  email: string;
  contact_number: string;
  student_id: string;
  university: string;
  programme: string;
  year_of_study: string;
};

type TeamLeaderInput = {
  full_name: string;
  email: string;
  contact_number: string;
  university: string;
  programme: string;
  year_of_study: string;
};

type HackathonInput = {
  team_name: string;
  university: string;
  team_size: number;
  how_did_you_hear?: string;
  team_leader: TeamLeaderInput;
  team_members: TeamMemberInput[];
  captcha_token: string;
};

// Strip HTML tags / script content to prevent XSS
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-]/g, "");
  const phoneRegex = /^\+?\d{7,15}$/;
  return phoneRegex.test(cleaned);
}

// Validate + sanitize a single person's fields (shared by leader and members)
function sanitizePerson(
  person: any,
  requireStudentId: boolean,
  label: string
): { valid: true; data: any } | { valid: false; field: string; message: string } {
  const requiredFields = ["full_name", "email", "contact_number", "university", "programme", "year_of_study"];
  if (requireStudentId) requiredFields.push("student_id");

  for (const field of requiredFields) {
    if (!person || !person[field] || typeof person[field] !== "string" || person[field].trim() === "") {
      return { valid: false, field: `${label}.${field}`, message: `${label} ${field} is required` };
    }
  }

  const full_name = stripHtml(person.full_name).slice(0, 100);
  const email = stripHtml(person.email).slice(0, 150).toLowerCase();
  const contact_number = stripHtml(person.contact_number).slice(0, 20);
  const university = stripHtml(person.university).slice(0, 150);
  const programme = stripHtml(person.programme).slice(0, 150);
  const year_of_study = stripHtml(person.year_of_study).slice(0, 20);
  const student_id = requireStudentId ? stripHtml(person.student_id).slice(0, 50) : undefined;

  if (!isValidEmail(email)) {
    return { valid: false, field: `${label}.email`, message: `${label} email format is invalid` };
  }
  if (!isValidPhone(contact_number)) {
    return { valid: false, field: `${label}.contact_number`, message: `${label} contact number format is invalid` };
  }

  const data: any = { full_name, email, contact_number, university, programme, year_of_study };
  if (requireStudentId) data.student_id = student_id;

  return { valid: true, data };
}

function sanitizeAndValidate(
  body: any
): { valid: true; data: HackathonInput } | { valid: false; field: string; message: string } {
  // Top-level required fields
  const topLevelRequired = ["team_name", "university", "team_size", "team_leader", "team_members", "captcha_token"];
  for (const field of topLevelRequired) {
    if (body[field] === undefined || body[field] === null) {
      return { valid: false, field, message: `${field} is required` };
    }
  }

  if (typeof body.team_size !== "number" || body.team_size < 1) {
    return { valid: false, field: "team_size", message: "team_size must be a positive number" };
  }

  if (!Array.isArray(body.team_members)) {
    return { valid: false, field: "team_members", message: "team_members must be an array" };
  }

  // Team size consistency check: leader + members should equal team_size
  if (body.team_members.length + 1 !== body.team_size) {
    return {
      valid: false,
      field: "team_size",
      message: `team_size (${body.team_size}) does not match number of members provided (${body.team_members.length + 1} including leader)`,
    };
  }

  const team_name = stripHtml(body.team_name).slice(0, 100);
  const university = stripHtml(body.university).slice(0, 150);
  const how_did_you_hear = body.how_did_you_hear ? stripHtml(body.how_did_you_hear).slice(0, 200) : undefined;
  const captcha_token = String(body.captcha_token);

  if (!team_name) {
    return { valid: false, field: "team_name", message: "team_name is required" };
  }

  // Validate team leader
  const leaderResult = sanitizePerson(body.team_leader, false, "team_leader");
  if (!leaderResult.valid) return leaderResult;

  // Validate each team member
  const sanitizedMembers: TeamMemberInput[] = [];
  for (let i = 0; i < body.team_members.length; i++) {
    const memberResult = sanitizePerson(body.team_members[i], true, `team_member[${i}]`);
    if (!memberResult.valid) return memberResult;
    sanitizedMembers.push(memberResult.data);
  }

  return {
    valid: true,
    data: {
      team_name,
      university,
      team_size: body.team_size,
      how_did_you_hear,
      team_leader: leaderResult.data,
      team_members: sanitizedMembers,
      captcha_token,
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error_code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const result = sanitizeAndValidate(body);

    if (!result.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: "VALIDATION_ERROR",
          message: result.message,
          field: result.field,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO next: captcha verification, rate limiting, DB insert
    console.log("Sanitized hackathon data:", JSON.stringify(result.data, null, 2));

    return new Response(
      JSON.stringify({ success: true, message: "Validation passed (captcha/rate-limit/DB not yet implemented)" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error_code: "SERVER_ERROR", message: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});