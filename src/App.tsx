import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Login from "@/pages/app/Login";
import AppLayout from "@/components/app-shell/AppLayout";
import Dashboard from "@/pages/app/Dashboard";
import ClientsList from "@/pages/app/masters/ClientsList";
import ClientForm from "@/pages/app/masters/ClientForm";
import EmployeesList from "@/pages/app/masters/EmployeesList";
import EmployeeForm from "@/pages/app/masters/EmployeeForm";
import CompanyProfile from "@/pages/app/masters/CompanyProfile";
import UsersAdmin from "@/pages/app/admin/Users";
import Permissions from "@/pages/app/admin/Permissions";
import AuditLogs from "@/pages/app/admin/AuditLogs";
import Placeholder from "@/pages/app/Placeholder";
import HostRouter from "@/components/HostRouter";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <HostRouter />
          <Routes>
            {/* Public marketing site — UNCHANGED */}
            <Route path="/" element={<Index />} />

            {/* Internal app */}
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Dashboard />} />

                <Route path="masters/clients" element={<ClientsList />} />
                <Route path="masters/clients/new" element={<ClientForm />} />
                <Route path="masters/clients/:id/edit" element={<ClientForm />} />

                <Route path="masters/employees" element={<EmployeesList />} />
                <Route path="masters/employees/new" element={<EmployeeForm />} />
                <Route path="masters/employees/:id/edit" element={<EmployeeForm />} />

                <Route element={<ProtectedRoute requireRoles={["ceo_admin"]} />}>
                  <Route path="masters/company-profile" element={<CompanyProfile />} />
                  <Route path="admin/users" element={<UsersAdmin />} />
                  <Route path="admin/permissions" element={<Permissions />} />
                  <Route path="admin/audit-logs" element={<AuditLogs />} />
                </Route>

                <Route path="payroll/upload" element={<Placeholder title="Upload Paysheet" />} />
                <Route path="payroll/monthly" element={<Placeholder title="Monthly Payroll" />} />
                <Route path="payroll/approvals" element={<Placeholder title="Approval Queue" />} />
                <Route path="reports/financial" element={<Placeholder title="Financial Dashboard" />} />
                <Route path="reports/mom" element={<Placeholder title="Month-on-Month Analysis" />} />
                <Route path="expenses" element={<Placeholder title="Monthly Expenses" />} />
                <Route path="compliance" element={<Placeholder title="Compliance Calendar" />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
