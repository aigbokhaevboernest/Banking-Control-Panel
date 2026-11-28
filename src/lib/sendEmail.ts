import { supabase } from "@/lib/supabase";
import { pushToInbox } from "@/lib/inbox";

export interface SendEmailArgs {
 email: string;
 subject: string;
 first_name?: string;
 html?: string;
 message?: string;
 /** When set, the message is also saved to this user's Inbox (never blocks). */
 user_id?: string | null;
}

export interface SendEmailResult {
 success: boolean;
 error?: string;
}

/**
* Invokes the `send-email` Supabase Edge Function.
* Never throws — returns { success, error } so callers can show a toast
* without rolling back the preceding DB update.
*/
export async function sendEmail({
 email,
 subject,
 first_name,
 html,
 message,
 user_id,
}: SendEmailArgs): Promise<SendEmailResult> {
 // Always save to the user's Inbox first, even if the email fails or is missing
 if (user_id) await pushToInbox(user_id, subject, message || html || "");
 try {
   if (!email) return { success: false, error: "Missing recipient email" };
   // Always send as message — edge function expects "message" field
const body: Record<string, string> = {
  to: email,
  subject,
  first_name: first_name ?? "",
  message: message || html || "",
};

   const { data, error } = await supabase.functions.invoke("send-email", { body });
   if (error) {
     console.error("send-email invoke error:", error);
     return { success: false, error: error.message };
   }
   if (data && (data as any).success === false) {
     console.error("send-email failed:", data);
     return { success: false, error: (data as any).error };
   }
   return { success: true };
 } catch (err) {
   console.error("send-email exception:", err);
   return { success: false, error: (err as Error).message };
 }
}

/** Fetch a user's email and first_name from profiles by user_id. */
export async function getUserEmail(userId: string | null | undefined): Promise<string | null> {
 if (!userId) return null;
 const { data } = await supabase
   .from("profiles")
   .select("email")
   .eq("id", userId)
   .maybeSingle();
 return (data?.email as string) ?? null;
}

/** Fetch a user's first_name from profiles by user_id. */
export async function getUserFirstName(userId: string | null | undefined): Promise<string | null> {
 if (!userId) return null;
 const { data } = await supabase
   .from("profiles")
   .select("first_name")
   .eq("id", userId)
   .maybeSingle();
 return (data?.first_name as string) ?? null;
}
