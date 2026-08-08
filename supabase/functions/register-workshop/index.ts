import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WorkshopInput = {
  full_name: string;
  email: string;
  whatsapp_number: string;
  university: string;
  programme: string;
  year_of_study: string;
  captcha_token: string;
};

// Strip HTML tags / script content to prevent XSS
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

// Basic email format check
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Basic phone/WhatsApp number check (digits, spaces, +, - allowed, 7-15 digits)
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-]/g, "");
  const phoneRegex = /^\+?\d{7,15}$/;
  return phoneRegex.test(cleaned);
}

function sanitizeAndValidate(
  body: any
): { valid: true; data: WorkshopInput } | { valid: false; field: string; message: string } {
  const requiredFields = [
    "full_name",
    "email",
    "whatsapp_number",
    "university",
    "programme",
    "year_of_study",
    "captcha_token",
  ];

  for (const field of requiredFields) {
    if (!body[field] || typeof body[field] !== "string" || body[field].trim() === "") {
      return { valid: false, field, message: `${field} is required` };
    }
  }

  const full_name = stripHtml(body.full_name).slice(0, 100);
  const email = stripHtml(body.email).slice(0, 150).toLowerCase();
  const whatsapp_number = stripHtml(body.whatsapp_number).slice(0, 20);
  const university = stripHtml(body.university).slice(0, 150);
  const programme = stripHtml(body.programme).slice(0, 150);
  const year_of_study = stripHtml(body.year_of_study).slice(0, 20);
  const captcha_token = String(body.captcha_token);

  if (!isValidEmail(email)) {
    return { valid: false, field: "email", message: "Email format is invalid" };
  }

  if (!isValidPhone(whatsapp_number)) {
    return { valid: false, field: "whatsapp_number", message: "WhatsApp number format is invalid" };
  }

  return {
    valid: true,
    data: { full_name, email, whatsapp_number, university, programme, year_of_study, captcha_token },
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
    console.log("Sanitized workshop data:", result.data);

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