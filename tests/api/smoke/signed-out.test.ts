// S-04 (data) — a signed-out visitor gets nothing back from business tables.
import { describe, expect, it } from "vitest";
import { anonClient } from "../../support/clients";

const TABLES = [
  "clients", "employees", "invoices", "paysheets", "paysheet_employees", "payments", "user_profiles",
  "user_roles", "crm_leads", "website_lead_submissions", "audit_logs", "company_profile", "app_config",
  "financial_ledger", "role_permissions", "client_wage_config", "client_billing_lines", "employee_advances",
];

describe("S-04 signed-out data access @smoke", () => {
  it.each(TABLES.map((t) => [t]))("%s returns no rows to a signed-out visitor", async (table) => {
    const { data, error } = await anonClient().from(table).select("*").limit(1);
    // Either refused outright or an empty result — never a row.
    expect(error ? [] : data).toEqual([]);
  });

  it("the internal secrets table is refused outright", async () => {
    const { data, error } = await anonClient().from("cron_secrets").select("*").limit(1);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
