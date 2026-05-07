import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000;

export function useIdleLogout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await signOut();
        toast("Logged out due to inactivity");
        navigate("/admin/login");
      }, TIMEOUT_MS);
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, signOut, navigate]);
}
