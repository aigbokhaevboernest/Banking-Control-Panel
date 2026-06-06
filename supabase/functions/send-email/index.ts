// Supabase Edge Function: send-email
// Sends transactional emails via Resend.
// Required secret in Supabase: RESEND_API_KEY
// Deploy: supabase functions deploy send-email --no-verify-jwt

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email?: string;
  to?: string;
  subject: string;
  html?: string;
  message?: string;
  text?: string;
  from?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as Payload;
    const recipient = body.email || body.to;
    const subject = body.subject;
    const html =
      body.html ||
      (body.message
        ? `<div style="font-family:Arial,sans-serif;white-space:pre-line;font-size:14px;line-height:1.6;color:#111">${body.message}</div>`
        : undefined);
    const text = body.text || body.message;

    if (!recipient || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email, subject, or html/message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: body.from || "Flexiq Verve <onboarding@resend.dev>",
        to: [recipient],
        subject,
        html,
        text,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data?.message || "Resend error", data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
