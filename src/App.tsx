import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigate } from "react-router-dom";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider } from "@/contexts/AuthContext";
import { EnvironmentProvider } from "@/contexts/EnvironmentContext";
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
import PaysheetCreate from "@/pages/app/payroll/PaysheetCreate";
import PaysheetList from "@/pages/app/payroll/PaysheetList";
import PaysheetApprovals from "@/pages/app/payroll/PaysheetApprovals";
import PaysheetView from "@/pages/app/payroll/PaysheetView";
import InvoicesList from "@/pages/app/invoices/InvoicesList";
import InvoiceForm from "@/pages/app/invoices/InvoiceForm";
import InvoiceView from "@/pages/app/invoices/InvoiceView";
import ReceiptsList from "@/pages/app/finance/ReceiptsList";
import ReceiptView from "@/pages/app/finance/ReceiptView";
import CashBook from "@/pages/app/finance/CashBook";
import MonthlySummary from "@/pages/app/finance/MonthlySummary";
import AdvancesList from "@/pages/app/employees/AdvancesList";
import AdvanceForm from "@/pages/app/employees/AdvanceForm";
import AdvanceApprovals from "@/pages/app/employees/AdvanceApprovals";
import EmployeeAdvances from "@/pages/app/employees/EmployeeAdvances";
import FfsList from "@/pages/app/employees/FfsList";
import FfsForm from "@/pages/app/employees/FfsForm";
import FfsView from "@/pages/app/employees/FfsView";
import FfsApprovals from "@/pages/app/employees/FfsApprovals";
import BranchesList from "@/pages/app/masters/BranchesList";
import ShiftsList from "@/pages/app/masters/ShiftsList";
import DeploymentsList from "@/pages/app/masters/DeploymentsList";
import ContractsList from "@/pages/app/masters/ContractsList";
import FinancialDashboard from "@/pages/app/reports/FinancialDashboard";
import MomReport from "@/pages/app/reports/MomReport";
import ExpensesIndex from "@/pages/app/expenses/ExpensesIndex";
import ComplianceCalendar from "@/pages/app/compliance/ComplianceCalendar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EnvironmentProvider>
            <HostRouter />
            <Routes>
              <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
              <Route path="/site" element={<Index />} />
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

                  {/* Payroll - Phase 2 */}
                  <Route path="payroll/create" element={<PaysheetCreate />} />
                  <Route path="payroll/list" element={<PaysheetList />} />
                  <Route path="payroll/:id/view" element={<PaysheetView />} />
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin", "coo_ops"]} />}>
                    <Route path="payroll/approvals" element={<PaysheetApprovals />} />
                  </Route>

                  {/* Legacy phase 1 placeholders kept */}
                  <Route path="payroll/upload" element={<Placeholder title="Upload Paysheet" />} />
                  <Route path="payroll/monthly" element={<PaysheetList />} />

                  {/* Invoices - Phase 2 */}
                  <Route path="invoices/list" element={<InvoicesList />} />
                  <Route path="invoices/new" element={<InvoiceForm />} />
                  <Route path="invoices/:id/edit" element={<InvoiceForm />} />
                  <Route path="invoices/:id/view" element={<InvoiceView />} />

                  {/* Finance - Phase 2 */}
                  <Route path="finance/cashbook" element={<CashBook />} />
                  <Route path="finance/summary" element={<MonthlySummary />} />
                  <Route path="finance/receipts" element={<ReceiptsList />} />
                  <Route path="finance/receipts/:id" element={<ReceiptView />} />

                  {/* Phase 3A — Advances */}
                  <Route path="employees/advances/list" element={<AdvancesList />} />
                  <Route path="employees/advances/new" element={<AdvanceForm />} />
                  <Route path="masters/employees/:id/advances" element={<EmployeeAdvances />} />
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin", "coo_ops"]} />}>
                    <Route path="employees/advances/approvals" element={<AdvanceApprovals />} />
                    <Route path="employees/ffs/approvals" element={<FfsApprovals />} />
                  </Route>

                  {/* Phase 3A — FFS */}
                  <Route path="employees/ffs/list" element={<FfsList />} />
                  <Route path="employees/ffs/new" element={<FfsForm />} />
                  <Route path="employees/ffs/:id/view" element={<FfsView />} />

                  {/* Phase 3A — Masters additions */}
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin", "coo_ops"]} />}>
                    <Route path="masters/branches" element={<BranchesList />} />
                    <Route path="masters/deployments/shifts" element={<ShiftsList />} />
                  </Route>
                  <Route path="masters/deployments" element={<DeploymentsList />} />
                  <Route path="masters/contracts/list" element={<ContractsList />} />

                  {/* Other Phase 1 placeholders */}
                  <Route path="reports/financial" element={<FinancialDashboard />} />
                  <Route path="reports/mom" element={<MomReport />} />
                  <Route path="expenses" element={<ExpensesIndex />} />
                  <Route path="compliance" element={<ComplianceCalendar />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </EnvironmentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
