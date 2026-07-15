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
import ForgotPassword from "@/pages/app/ForgotPassword";
import ResetPassword from "@/pages/app/ResetPassword";
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
import UniformAdvanceConfirmations from "@/pages/app/employees/UniformAdvanceConfirmations";
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
import ExpensesV2List from "@/pages/app/expenses/v2/ExpensesV2List";
import ExpenseV2Form from "@/pages/app/expenses/v2/ExpenseV2Form";
import CompliancePaymentsList from "@/pages/app/compliance/payments/CompliancePaymentsList";
import CompliancePaymentForm from "@/pages/app/compliance/payments/CompliancePaymentForm";
import StatementOfAccount from "@/pages/app/finance/StatementOfAccount";
import AgingReport from "@/pages/app/finance/AgingReport";
import GstReport from "@/pages/app/finance/GstReport";
import FollowupsList from "@/pages/app/finance/followups/FollowupsList";
import EcrEsiGenerator from "@/pages/app/compliance/EcrEsiGenerator";
import ExpenseCategoriesAdmin from "@/pages/app/masters/ExpenseCategoriesAdmin";
import BackupAdmin from "@/pages/app/admin/BackupAdmin";
import MomAnalysis from "@/pages/app/reports/MomAnalysis";
import ComparativeAnalysis from "@/pages/app/reports/ComparativeAnalysis";
import ClientBillingHistory from "@/pages/app/reports/ClientBillingHistory";
import EmployeeHistory from "@/pages/app/reports/EmployeeHistory";
import AnnualSummary from "@/pages/app/reports/AnnualSummary";
import ActivityLog from "@/pages/app/admin/ActivityLog";
import BranchSummary from "@/pages/app/admin/BranchSummary";
import BranchesAdmin from "@/pages/app/masters/BranchesAdmin";
import BankPayment from "@/pages/app/payroll/BankPayment";
import Payslip from "@/pages/app/payroll/Payslip";
import BankDisbursementReport from "@/pages/app/payroll/BankDisbursementReport";
import SupportingDocuments from "@/pages/app/reports/SupportingDocuments";
import TpssAccountsAdmin from "@/pages/app/admin/TpssAccountsAdmin";
import CrmDashboard from "@/pages/app/crm/CrmDashboard";
import LeadsList from "@/pages/app/crm/LeadsList";
import LeadForm from "@/pages/app/crm/LeadForm";
import LeadDetail from "@/pages/app/crm/LeadDetail";

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
              <Route path="/" element={<Index />} />
              <Route path="/site" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

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
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin", "coo_ops", "accountant"]} />}>
                    <Route path="employees/advances/uniform-confirm" element={<UniformAdvanceConfirmations />} />
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

                  {/* Phase 3B */}
                  <Route path="expenses/v2" element={<ExpensesV2List />} />
                  <Route path="expenses/v2/new" element={<ExpenseV2Form />} />
                  <Route path="compliance/payments" element={<CompliancePaymentsList />} />
                  <Route path="compliance/payments/new" element={<CompliancePaymentForm />} />
                  <Route path="compliance/ecr" element={<EcrEsiGenerator />} />
                  <Route path="finance/statement" element={<StatementOfAccount />} />
                  <Route path="finance/aging" element={<AgingReport />} />
                  <Route path="finance/gst" element={<GstReport />} />
                  <Route path="finance/followups" element={<FollowupsList />} />
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin"]} />}>
                    <Route path="masters/expense-categories" element={<ExpenseCategoriesAdmin />} />
                    <Route path="masters/branches/manage" element={<BranchesAdmin />} />
                    <Route path="admin/backup" element={<BackupAdmin />} />
                    <Route path="admin/activity-log" element={<ActivityLog />} />
                    <Route path="admin/branch-summary" element={<BranchSummary />} />
                    <Route path="admin/tpss-accounts" element={<TpssAccountsAdmin />} />
                  </Route>

                  {/* S5/S6 — Bank Payment */}
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin", "coo_ops", "accountant"]} />}>
                    <Route path="payroll/bank-payment" element={<BankPayment />} />
                    <Route path="payroll/payslip" element={<Payslip />} />
                    <Route path="payroll/bank-disbursement" element={<BankDisbursementReport />} />
                  </Route>

                  {/* Phase 3C — Reports */}
                  <Route path="dashboard/v3c" element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="reports/mom-analysis" element={<MomAnalysis />} />
                  <Route path="reports/comparative" element={<ComparativeAnalysis />} />
                  <Route path="reports/client-billing-history" element={<ClientBillingHistory />} />
                  <Route path="reports/employee-history" element={<EmployeeHistory />} />
                  <Route path="reports/annual-summary" element={<AnnualSummary />} />
                  <Route element={<ProtectedRoute requireRoles={["ceo_admin", "coo_ops", "accountant"]} />}>
                    <Route path="reports/supporting-documents" element={<SupportingDocuments />} />
                  </Route>

                  {/* CRM */}
                  <Route path="crm/dashboard" element={<CrmDashboard />} />
                  <Route path="crm/leads" element={<LeadsList />} />
                  <Route path="crm/leads/new" element={<LeadForm />} />
                  <Route path="crm/leads/:id" element={<LeadDetail />} />
                  <Route path="crm/leads/:id/edit" element={<LeadForm />} />
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