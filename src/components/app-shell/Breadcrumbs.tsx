import { useLocation, Link } from "react-router-dom";
import { ChevronRight, LayoutDashboard } from "lucide-react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PATH_LABELS: Record<string, string[]> = {
  "/app/masters/clients": ["Masters", "Clients"],
  "/app/masters/clients/new": ["Masters", "Clients", "New"],
  "/app/masters/employees": ["Masters", "Employees"],
  "/app/masters/employees/new": ["Masters", "Employees", "New"],
  "/app/masters/employees/:id/edit": ["Masters", "Employees", "Edit"],
  "/app/masters/company-profile": ["Masters", "Company Profile"],
  "/app/masters/branches": ["Masters", "Branches"],
  "/app/masters/branches/manage": ["Masters", "Branches", "Manage"],
  "/app/masters/deployments": ["Masters", "Deployments"],
  "/app/masters/deployments/shifts": ["Masters", "Shifts"],
  "/app/masters/contracts/list": ["Masters", "Contracts"],
  "/app/masters/expense-categories": ["Masters", "Expense Categories"],
  "/app/payroll/create": ["Payroll", "Create Paysheet"],
  "/app/payroll/list": ["Payroll", "Monthly Paysheets"],
  "/app/payroll/approvals": ["Payroll", "Approval Queue"],
  "/app/payroll/:id/view": ["Payroll", "View Paysheet"],
  "/app/invoices/list": ["Invoices", "All Invoices"],
  "/app/invoices/new": ["Invoices", "New Invoice"],
  "/app/invoices/:id/view": ["Invoices", "View Invoice"],
  "/app/invoices/:id/edit": ["Invoices", "Edit Invoice"],
  "/app/finance/cashbook": ["Finance", "Cash Book"],
  "/app/finance/summary": ["Finance", "Monthly Summary"],
  "/app/finance/receipts": ["Finance", "Receipts"],
  "/app/finance/statement": ["Finance", "Statement of Account"],
  "/app/finance/aging": ["Finance", "Aging Report"],
  "/app/finance/gst": ["Finance", "GST Report"],
  "/app/finance/followups": ["Finance", "Invoice Followups"],
  "/app/employees/advances/list": ["Employee Lifecycle", "Advances"],
  "/app/employees/advances/new": ["Employee Lifecycle", "New Advance"],
  "/app/employees/advances/approvals": ["Employee Lifecycle", "Advance Approvals"],
  "/app/employees/ffs/list": ["Employee Lifecycle", "Full & Final"],
  "/app/employees/ffs/new": ["Employee Lifecycle", "New Settlement"],
  "/app/employees/ffs/approvals": ["Employee Lifecycle", "FFS Approvals"],
  "/app/reports/mom-analysis": ["Reports", "MoM Analysis"],
  "/app/reports/comparative": ["Reports", "Comparative"],
  "/app/reports/client-billing-history": ["Reports", "Client History"],
  "/app/reports/employee-history": ["Reports", "Employee History"],
  "/app/reports/annual-summary": ["Reports", "Annual Summary"],
  "/app/expenses/v2": ["Expenses"],
  "/app/expenses/v2/new": ["Expenses", "New Expense"],
  "/app/compliance": ["Compliance", "Calendar"],
  "/app/compliance/payments": ["Compliance", "Payments"],
  "/app/compliance/payments/new": ["Compliance", "New Payment"],
  "/app/compliance/ecr": ["Compliance", "ECR / ESI Challan"],
  "/app/admin/users": ["Administration", "Users"],
  "/app/admin/permissions": ["Administration", "Role Permissions"],
  "/app/admin/audit-logs": ["Administration", "Audit Logs"],
  "/app/admin/activity-log": ["Administration", "Activity Log"],
  "/app/admin/branch-summary": ["Administration", "Branch Summary"],
  "/app/admin/backup": ["Administration", "Backups"],
};

function normalizePath(path: string): string {
  return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id");
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = PATH_LABELS[normalizePath(pathname)];
  if (!crumbs || crumbs.length === 0) return null;

  return (
    <nav className="px-4 md:px-6 py-1.5 flex items-center gap-1 text-xs text-app-muted bg-white border-b border-app-border">
      <Link to="/app/dashboard" className="flex items-center gap-1 hover:text-app-navy">
        <LayoutDashboard className="h-3 w-3" />
        <span>Dashboard</span>
      </Link>
      {crumbs.map((label, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className={i === crumbs.length - 1 ? "text-app-navy font-medium" : ""}>{label}</span>
        </span>
      ))}
    </nav>
  );
}
