import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  PlusCircle,
  Wallet,
  Landmark,
  FileText,
  Send,
  Globe,
  Smartphone,
  CreditCard,
  Settings,
  SlidersHorizontal,
  LogOut,
  Menu,
  Shield,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/admin/create-transaction", label: "Create Transaction", icon: PlusCircle },
  { to: "/admin/deposits", label: "Deposits", icon: Wallet },
  { to: "/admin/loans", label: "Loans", icon: Landmark },
  { to: "/admin/history", label: "History", icon: FileText },
  { to: "/admin/wire-transfers", label: "Wire Transfers", icon: Send },
  { to: "/admin/local-transfers", label: "Local Transfers", icon: Send },
  { to: "/admin/digital-payments", label: "Digital Payments", icon: Smartphone },
  { to: "/admin/cards", label: "Edit Cards", icon: CreditCard },
  { to: "/admin/app-settings", label: "App Settings", icon: SlidersHorizontal },

];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useIdleLogout();

  const currentTitle =
    navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))
      ?.label ?? "Admin";

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 overflow-y-auto p-3">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70 hover:bg-secondary hover:text-foreground"
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
      <button
        onClick={() => {
          onNavigate?.();
          handleSignOut();
        }}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-2 border-b px-4 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Shield className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Nova Admin</div>
        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{user?.email}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur md:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <Brand />
            <NavList onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-base font-semibold md:text-lg">{currentTitle}</h1>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-card md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)]">
          <Brand />
          <NavList />
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
