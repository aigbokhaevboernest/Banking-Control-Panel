import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// TESTING value. Set back to 30 * 60 * 1000 before shipping.
const TIMEOUT_MS = 2 * 60 * 1000;
const DEBUG = true; // logs "[idle] ..." in the console; set false when done

// Where to land after logout.
const LOGIN_PATH = "/login";

const LAST_ACTIVITY_KEY = "idle:last-activity";
const FORCE_LOGOUT_KEY = "idle:force-logout";

const AUTH_STORAGE_PATTERNS = [/supabase\.auth/i, /^sb-.*-auth-token$/i, /^sb-.*-code-verifier$/i];
const isAuthStorageKey = (key: string) => AUTH_STORAGE_PATTERNS.some((p) => p.test(key));

const log = (...args: unknown[]) => {
  if (DEBUG) console.log("[idle]", ...args);
};

const clearIdleKeys = () => {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(FORCE_LOGOUT_KEY);
  } catch {
    /* ignore */
  }
};

const clearAuthStorage = () => {
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key) keys.push(key);
      }
      keys.forEach((key) => {
        if (isAuthStorageKey(key)) storage.removeItem(key);
      });
    } catch {
      /* ignore */
    }
  });
  clearIdleKeys();
};

const clearAuthCookies = () => {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !isAuthStorageKey(name)) return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
};

let loggingOut = false;

/**
 * The ONE logout path (Logout buttons + idle expiry).
 * Sign out, wipe auth + idle keys, hard-navigate to /login.
 */
export async function performLogout(reason = "manual") {
  if (loggingOut) return;
  loggingOut = true;
  log("logging out:", reason);

  try {
    localStorage.setItem(FORCE_LOGOUT_KEY, String(Date.now())); // tells other tabs
  } catch {
    /* ignore */
  }

  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "global" }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    /* ignore */
  }

  clearAuthStorage();
  clearAuthCookies();
  window.location.replace(LOGIN_PATH);
}

// In-memory clock = source of truth. localStorage only shares activity
// between tabs, so blocked storage can't make a session immortal.
let lastActivity = Date.now();

function useIdleController(enabled: boolean, loading: boolean) {
  useEffect(() => {
    if (loading) return;

    // Logged out: make sure no stale timestamp survives to the next login.
    if (!enabled) {
      clearIdleKeys();
      lastActivity = Date.now();
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const readStored = (): number | null => {
      try {
        const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    };

    const writeStored = (t: number) => {
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(t));
      } catch {
        /* ignore */
      }
    };

    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, Math.max(ms, 0));
    };

    // Wall-clock recheck. Never grants free time.
    function check() {
      const stored = readStored();
      const last = Math.max(lastActivity, stored ?? 0); // another tab's activity counts
      lastActivity = last;

      const idleFor = Date.now() - last;
      log(`idle ${Math.round(idleFor / 1000)}s / ${Math.round(TIMEOUT_MS / 1000)}s`);

      if (idleFor >= TIMEOUT_MS) {
        void performLogout("idle timeout");
        return;
      }
      arm(TIMEOUT_MS - idleFor);
    }

    const onActivity = () => {
      const now = Date.now();
      // An expired window can't be revived by a tap (e.g. right after wake).
      if (now - lastActivity >= TIMEOUT_MS) {
        void performLogout("idle timeout (activity after expiry)");
        return;
      }
      lastActivity = now;
      writeStored(now);
      arm(TIMEOUT_MS);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === FORCE_LOGOUT_KEY && e.newValue) {
        clearAuthStorage();
        clearAuthCookies();
        window.location.replace(LOGIN_PATH);
      }
    };

    // Seed the clock.
    const now = Date.now();
    const stored = readStored();
    if (stored != null && now - stored >= TIMEOUT_MS) {
      // Returning to a persisted session that sat idle past the limit
      // (e.g. tab closed and reopened).
      void performLogout("stale session on load");
      return;
    }
    lastActivity = stored != null ? stored : now;
    if (stored == null) writeStored(now);
    log("armed, timeout =", TIMEOUT_MS / 1000, "s");

    // Discrete user actions ONLY. scroll / touchmove / mousemove are excluded:
    // layout shifts, tickers and charts fire them with nobody there.
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "click"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);

    check();
    const heartbeat = setInterval(check, 10000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(heartbeat);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [enabled, loading]);
}

/**
 * Same call style as before: useIdleLogout() with no arguments.
 * Reads the Supabase session itself, so it needs no auth hook and no
 * useNavigate (logout is a hard redirect to /login).
 */
export function useIdleLogout() {
  const [state, setState] = useState({ loading: true, loggedIn: false });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setState({ loading: false, loggedIn: !!session });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ loading: false, loggedIn: !!session });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useIdleController(state.loggedIn, state.loading);
}
