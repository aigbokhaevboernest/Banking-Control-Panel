// AUTO LOGOUT: triggers after 30 minutes of inactivity
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const STORAGE_KEY = "lastActivity";

export function useIdleLogout() {
  const navigate = useNavigate();
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    const logout = async () => {
      try {
        await supabase.auth.signOut();
      } catch {}
      localStorage.removeItem(STORAGE_KEY);
      toast("Logged out due to inactivity");
      navigate("/login");
    };

    // Catch case where tab was closed and reopened after >30min
    const stored = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (stored && Date.now() - stored > IDLE_LIMIT_MS) {
      logout();
      return;
    }

    const touch = () => {
      const now = Date.now();
      lastActivity.current = now;
      localStorage.setItem(STORAGE_KEY, String(now));
    };
    touch();

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) {
        logout();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [navigate]);
}
