import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Users, Building2, Wallet, BarChart3, Receipt, ShieldCheck,
  Settings, FileText, UserCog, History, Briefcase, CheckCircle2,
} from "lucide-react";
import TopBar from "./TopBar";
import SandboxBanner from "./SandboxBanner";
import EnvBadge from "./EnvBadge";
import Breadcrumbs from "./Breadcrumbs";
import tpssLogo from "@/assets/tpss-logo-portal.jpg";

const SESSION_TIMEOUT = 30 * 60 * 1000;
const SESSION_WARNING = 5 * 60 * 1000; // warn 5 mins before

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  screen?: string;
  roles?: Array<"ceo_admin" | "coo_ops" | "accountant">;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
    ],
  },
  {
    label: "Masters",
    items: [
      { to: "/app/masters/clients", label: "Clients", icon: Briefcase, screen: "clients" },
      { to: "/app/masters/employees", label: "Employees", icon: Users, screen: "employees" },
      { to: "/app/masters/company-profile", label: "Company Profile", icon: Building2, roles: ["ceo_admin"] },
      { to: "/app/masters/branches", label: "Branches", icon: Building2, roles: ["ceo_admin", "coo_ops"] },
      { to: "/app/masters/deployments/shifts", label: "Shifts", icon: ShieldCheck, roles: ["ceo_admin", "coo_ops"] },
      { to: "/app/masters/deployments", label: "Deployments", icon: Users },
      { to: "/app/masters/contracts/list", label: "Contracts", icon: FileText },
    ],
  },
  {
    label: "Employee Lifecycle",
    items: [
      { to: "/app/employees/advances/list", label: "Advances", icon: Wallet },
      { to: "/app/employees/advances/approvals", label: "Advance Approvals", icon: ShieldCheck, roles: ["ceo_admin", "coo_ops"] },
      { to: "/app/employees/advances/uniform-confirm", label: "Uniform Adv. Confirm", icon: CheckCircle2, roles: ["ceo_admin", "coo_ops", "accountant"] },
      { to: "/app/employees/ffs/list", label: "Full & Final", icon: FileText },
      { to: "/app/employees/ffs/approvals", label: "FFS Approvals", icon: ShieldCheck, roles: ["ceo_admin", "coo_ops"] },
    ],
  },
  {
    label: "Payroll",
    items: [
      { to: "/app/payroll/create", label: "Create Paysheet", icon: Wallet, screen: "payroll" },
      { to: "/app/payroll/list", label: "Monthly Paysheets", icon: FileText, screen: "payroll" },
      { to: "/app/payroll/approvals", label: "Approval Queue", icon: ShieldCheck, roles: ["ceo_admin", "coo_ops"] },
      { to: "/app/payroll/bank-payment", label: "Bank Payment", icon: Wallet, roles: ["ceo_admin", "coo_ops", "accountant"] },
      { to: "/app/payroll/payslip", label: "Payslips", icon: FileText, roles: ["ceo_admin", "coo_ops", "accountant"] },
      { to: "/app/payroll/bank-disbursement", label: "Bank Disbursement", icon: FileText, roles: ["ceo_admin", "coo_ops", "accountant"] },
    ],
  },
  {
    label: "Invoices",
    items: [
      { to: "/app/invoices/list", label: "All Invoices", icon: FileText },
      { to: "/app/invoices/new", label: "Create Invoice", icon: FileText },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/app/finance/cashbook", label: "Cash Book", icon: BarChart3 },
      { to: "/app/finance/summary", label: "Monthly Summary", icon: BarChart3 },
      { to: "/app/finance/receipts", label: "Receipts", icon: Receipt },
      { to: "/app/finance/statement", label: "Statement of Account", icon: FileText },
      { to: "/app/finance/aging", label: "Aging Report", icon: BarChart3 },
      { to: "/app/finance/gst", label: "GST Report", icon: FileText },
      { to: "/app/finance/followups", label: "Invoice Followups", icon: ShieldCheck },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/app/reports/mom-analysis", label: "MoM Analysis", icon: BarChart3 },
      { to: "/app/reports/comparative", label: "Comparative", icon: BarChart3 },
      { to: "/app/reports/client-billing-history", label: "Client History", icon: FileText },
      { to: "/app/reports/employee-history", label: "Employee History", icon: FileText },
      { to: "/app/reports/annual-summary", label: "Annual Summary", icon: FileText },
      { to: "/app/reports/supporting-documents", label: "Statutory Documents", icon: FileText },
    ],
  },
  {
    label: "Expenses",
    items: [
      { to: "/app/expenses/v2", label: "Expenses", icon: Receipt },
    ],
  },
  {
    label: "Compliance",
    items: [
      { to: "/app/compliance", label: "Compliance Calendar", icon: ShieldCheck, screen: "compliance" },
      { to: "/app/compliance/payments", label: "Payments", icon: Wallet },
      { to: "/app/compliance/ecr", label: "ECR / ESI Challan", icon: FileText },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/app/admin/users", label: "User Management", icon: UserCog, roles: ["ceo_admin"] },
      { to: "/app/admin/permissions", label: "Role Permissions", icon: Settings, roles: ["ceo_admin"] },
      { to: "/app/admin/audit-logs", label: "Audit Logs", icon: History, roles: ["ceo_admin"] },
      { to: "/app/admin/activity-log", label: "Activity Log", icon: History, roles: ["ceo_admin"] },
      { to: "/app/admin/branch-summary", label: "Branch Summary", icon: Building2, roles: ["ceo_admin"] },
      { to: "/app/admin/backup", label: "Backups", icon: History, roles: ["ceo_admin"] },
      { to: "/app/masters/expense-categories", label: "Expense Categories", icon: Settings, roles: ["ceo_admin"] },
      { to: "/app/masters/branches/manage", label: "Branches Management", icon: Building2, roles: ["ceo_admin"] },
      { to: "/app/admin/tpss-accounts", label: "TPSS Bank Accounts", icon: Wallet, roles: ["ceo_admin"] },
    ],
  },
];

function AppSidebar() {
  const { role, can } = useAuth();
  return (
    <Sidebar collapsible="icon" className="border-r border-app-border">
      <SidebarContent className="bg-app-navy text-white">
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
          <img src={tpssLogo} alt="TPSS Logo" className="h-10 w-10 rounded-full object-contain bg-white shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-lg leading-tight">Trinetra</div>
            <div className="text-xs text-white/70">Internal Portal</div>
          </div>
        </div>
        {NAV.map((group) => {
          const visible = group.items.filter((i) => {
            if (i.roles && (!role || !i.roles.includes(role))) return false;
            if (i.screen && !can(i.screen, "can_view")) return false;
            return true;
          });
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-white/60">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.to}
                          className="flex items-center gap-2 px-2 py-2 rounded-md text-white/85 hover:bg-white/10"
                          activeClassName="bg-app-saffron/20 text-white border-l-2 border-app-saffron"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
        <EnvBadge />
      </SidebarContent>
    </Sidebar>
  );
}

export default function AppLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [warned, setWarned] = useState(false);

  const { remainingMs } = useIdleTimer({
    timeoutMs: SESSION_TIMEOUT,
    warningMs: SESSION_WARNING,
    enabled: !!user,
    onWarn: () => {
      if (!warned) {
        setWarned(true);
        toast.warning("Your session will expire in 5 minutes due to inactivity.");
      }
    },
    onTimeout: async () => {
      await signOut();
      toast.error("Session expired. Please sign in again.");
      navigate("/login", { replace: true });
    },
  });

  // reset warning flag when fresh activity gives time back
  useEffect(() => {
    if (remainingMs > SESSION_TIMEOUT - SESSION_WARNING && warned) setWarned(false);
  }, [remainingMs, warned]);

  return (
    <SidebarProvider>
      <div className="app-shell min-h-screen flex w-full bg-app-bg text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-app-border bg-white flex items-center justify-between px-3 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <img src={tpssLogo} alt="TPSS" className="h-8 w-8 rounded-full object-contain bg-white border border-app-border" />
              <span className="hidden md:inline text-sm font-semibold text-app-navy">
                Trinetra Professional Security Services
              </span>
            </div>
            <TopBar remainingMs={remainingMs} />
          </header>
          <SandboxBanner />
          <Breadcrumbs />
          <main className="flex-1 p-4 md:p-6 bg-app-surface overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
