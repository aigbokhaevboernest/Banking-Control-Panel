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
import Transfers from "./pages/admin/Transfers";
import Cards from "./pages/admin/Cards";
import SettingsPage from "./pages/admin/Settings";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              }
            >
              <Route path="/" element={<Overview />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/:id" element={<UserProfile />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/deposits" element={<Deposits />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
