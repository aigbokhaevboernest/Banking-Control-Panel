import { supabase } from "@/lib/supabase";

/**
 * Sends an email notification via a Supabase Edge Function named `send-email`.
 * Expected payload: { to, subject, html, text }.
 *
 * If you haven't deployed the edge function yet, calls will fail silently
 * (logged to console) so admin actions still complete.
 *
 * Also inserts into a `notifications` table if present so the user sees an
 * in-app message even before email is wired up.
 */
export async function sendEmail(opts: {
  to: string | null | undefined;
  subject: string;
  html?: string;
  text?: string;
  user_id?: string | null;
}) {
  const { to, subject, html, text, user_id } = opts;
  if (!to) return { ok: false, error: "Missing recipient" };

  // Try edge function (no-op if not deployed)
  try {
    await supabase.functions.invoke("send-email", {
      body: { to, subject, html: html ?? text ?? subject, text: text ?? subject },
    });
  } catch (e) {
    console.warn("send-email edge function not available", e);
  }

  // Best-effort in-app notification (ignore if table doesn't exist)
  if (user_id) {
    try {
      await supabase.from("notifications").insert({
        user_id,
        title: subject,
        body: text ?? html ?? subject,
        read: false,
      });
    } catch (e) {
      // ignore
    }
  }

  return { ok: true };
}
