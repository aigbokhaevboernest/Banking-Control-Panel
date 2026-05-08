import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const checkedUserId = useRef<string | null>(null);

  const checkAdmin = async (uid: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (error) console.error("Admin role check failed:", error.message);
    setIsAdmin(!!data);
    checkedUserId.current = uid;
  };

  useEffect(() => {
    // Initial bootstrap
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await checkAdmin(s.user.id);
      else setIsAdmin(false);
      setLoading(false);
    });

    // Subsequent auth events: update session/user but DO NOT toggle loading.
    // Only re-check admin role if the user identity actually changed
    // (prevents flicker on TOKEN_REFRESHED / tab-focus events).
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      const uid = s?.user?.id ?? null;
      if (!uid) {
        setIsAdmin(false);
        checkedUserId.current = null;
        return;
      }
      if (uid !== checkedUserId.current) {
        checkAdmin(uid);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user!.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) {
      await supabase.auth.signOut();
      return { error: `Admin role check failed: ${roleError.message}` };
    }
    if (!roleData) {
      await supabase.auth.signOut();
      return { error: "Access denied. Admins only." };
    }
    setIsAdmin(true);
    checkedUserId.current = data.user!.id;
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, isAdmin, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
