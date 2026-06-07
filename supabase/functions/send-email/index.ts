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
 first_name?: string;
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
   const first_name = body.first_name || "";

   const html =
     body.html ||
     (body.message
       ? `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f9f9f9;">
       <div style="background-color:#F5A623;padding:24px;text-align:center;">
         <img src="https://nzideivdechbxhepmlvz.supabase.co/storage/v1/object/public/app-assets/Flexiqverve.PNG" style="height:50px;width:auto;" alt="Flexiq Verve"/>
       </div>
       <div style="background-color:#ffffff;padding:32px;max-width:600px;margin:0 auto;">
         <p style="font-size:16px;color:#111827;">Hello ${first_name},</p>
         <p style="font-size:15px;color:#374151;line-height:1.6;">${body.message.replace(/\n/g, "<br/>")}</p>
       </div>
       <div style="background-color:#FEF3D0;padding:20px;text-align:center;font-size:13px;color:#6B7280;">
         Need more help? We're here to help you out —
         <a href="mailto:support@flexiqverve.com" style="color:#F5A623;text-decoration:none;">support@flexiqverve.com</a>
       </div>
     </body></html>`
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
