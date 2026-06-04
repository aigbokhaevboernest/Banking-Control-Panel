import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AdminGuard } from "@/components/AdminGuard";
import AdminLayout from "@/components/AdminLayout";
import Login from "./pages/Login";
import Overview from "./pages/admin/Overview";
import Users from "./pages/admin/Users";
import UserProfile from "./pages/admin/UserProfile";
import Transactions from "./pages/admin/Transactions";
import Deposits from "./pages/admin/Deposits";
import Loans from "./pages/admin/Loans";
import History from "./pages/admin/History";
import Cards from "./pages/admin/Cards";
import SettingsPage from "./pages/admin/Settings";
import { WireTransfers, DigitalPayments, LocalTransfers } from "./pages/admin/StatusManager";
import CreateTransaction from "./pages/admin/CreateTransaction";
import AppSettings from "./pages/admin/AppSettings";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              }
            >
              <Route index element={<Overview />} />
              <Route path="users" element={<Users />} />
              <Route path="users/:id" element={<UserProfile />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="create-transaction" element={<CreateTransaction />} />
              <Route path="deposits" element={<Deposits />} />
              <Route path="loans" element={<Loans />} />
              <Route path="history" element={<History />} />
              <Route path="transfers" element={<Navigate to="/admin/history" replace />} />
              <Route path="wire-transfers" element={<WireTransfers />} />
              <Route path="local-transfers" element={<LocalTransfers />} />
              <Route path="international-transfers" element={<Navigate to="/admin/wire-transfers" replace />} />
              <Route path="loan-applications" element={<Navigate to="/admin/loans" replace />} />
              <Route path="digital-payments" element={<DigitalPayments />} />
              <Route path="cards" element={<Cards />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="app-settings" element={<AppSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
