import { supabase, supabaseAdmin } from "@/lib/supabase";
import { toast } from "sonner";

/** Convert an email body (which may contain HTML) to plain text for the Inbox. */
export function toPlainText(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Guards against the same message being written twice when a call site both
// pushes explicitly and passes user_id to sendEmail().
const recent = new Map<string, number>();
const DEDUPE_MS = 8000;

/**
 * Posts a message to the user's Inbox (Messages tab in the user app, which
 * reads public.notifications). Never throws and never blocks the caller:
 * on failure it logs and shows a toast, but the admin action still stands.
 * Returns true when the row was saved.
 */
export async function pushToInbox(
  userId: string | null | undefined,
  title: string,
  body: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const cleanTitle = toPlainText(title) || "Notification";
    const cleanBody = toPlainText(body);

    const key = `${userId}|${cleanTitle}|${cleanBody}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return true;
    recent.set(key, now);

    const row = { user_id: userId, title: cleanTitle, body: cleanBody, read: false } as any;

    // Service-role client first: it bypasses RLS, so the message is saved even if
    // the signed-in admin's session lacks an insert policy on notifications.
    let { error } = await supabaseAdmin.from("notifications").insert(row);
    if (error) {
      console.warn("Inbox insert via admin client failed, retrying with session:", error.message);
      ({ error } = await supabase.from("notifications").insert(row));
    }
    if (error) {
      recent.delete(key);
      console.error("Inbox message failed:", error.message);
      toast.error(`Inbox message could not be saved: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Inbox message failed:", e);
    return false;
  }
}
