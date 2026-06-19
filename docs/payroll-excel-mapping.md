# TPSS Payroll — Excel → App Mapping

## Sheet → App Module

| Excel Sheet | App Module / DB Table |
|---|---|
| Clients | `public.clients` |
| Client_Wage_Config | `public.client_wage_config` |
| Client_Billing_Lines | `public.client_billing_lines` |
| Employees | `public.employees` |

---

## Client_Wage_Config — Column Mapping

| Excel Column | DB Column | App Field | Notes |
|---|---|---|---|
| Client Name * | `client_id` (FK) | client selector | Matched by name |
| Designation * | `designation` | designation | Dropdown |
| Basic (INR) * | `basic` | basic | |
| DA (INR) * | `da` | da | |
| TA (INR) * | `ta` | ta | |
| SPL Allowance (INR) | `spl_allowance` | spl_allowance | |
| Conveyance (INR) | `conveyance_allowance` | conveyance_allowance | Added to ClientForm UI |
| Washing Allow. (INR) | `washing_allowance` | washing_allowance | Added to ClientForm UI |
| Weekly Off Allow.(INR) | `weekly_off_allowance` | weekly_off_allowance | |
| **4-Hr OT Rate (INR)** ★ | `four_hour_ot_rate` | four_hour_ot_rate | **RED mandatory** |
| **Bonus Amount (INR)** ★ | `bonus_amount` | bonus_amount | **RED mandatory** — Added to ClientForm UI |
| **Relieving Charges(INR)** ★ | `relieving_charges` | relieving_charges | **RED mandatory** — Added to ClientForm UI |
| **Leave Wages (INR)** ★ | `leave_wages` | leave_wages | **RED mandatory** — Added to ClientForm UI |
| EPF Applic. Wages(INR) * | `epf_mw_wages` | epf_mw_wages | |
| ESI Applic. Wages(INR) * | `esi_mw_wages` | esi_mw_wages | |
| Effective From * | `effective_from` | effective_from | |
| Notes | `notes` | notes | |

---

## Employees Sheet — Column Mapping

| Excel Column | DB Column | App Field | Notes |
|---|---|---|---|
| Full Name * | `full_name` | full_name | |
| Designation * | `designation` | designation | |
| Date of Joining * | `date_of_joining` | date_of_joining | |
| Status * | `status` | status | Active/Relieved/Absconded |
| Assigned Client | `client_id` (FK) | client selector | |
| Basic (INR) * | `basic` | basic | |
| DA (INR) * | `da` | da | |
| TA (INR) * | `ta` | ta | |
| SPL Allowance (INR) | `spl_allowance` | spl_allowance | |
| Conveyance (INR) | `conveyance_allowance` | conveyance_allowance | |
| Washing Allow.(INR) | `washing_allowance` | washing_allowance | |
| Wkly Off Allow.(INR) | `weekly_off_allowance` | weekly_off_allowance | |
| **4-Hr OT Rate (INR)** ★ | `four_hour_ot_rate` | four_hour_ot_rate | **RED mandatory** — New column added to DB + EmployeeForm |
| **Bonus Amount (INR)** ★ | `bonus_amount` | bonus_amount | **RED mandatory** — New column added to DB + EmployeeForm |
| **Relieving Charges(INR)** ★ | `relieving_charges` | relieving_charges | **RED mandatory** — New column added to DB + EmployeeForm |
| **Leave Wages (INR)** ★ | `leave_wages` | leave_wages | **RED mandatory** — New column added to DB + EmployeeForm |
| EPF Exempt * | `epf_exempt` | epf_exempt | |
| ESI Exempt * | `esi_exempt` | esi_exempt | |
| UAN Number | `uan_number` | uan_number | |
| ESI Number | `esi_number` | esi_number | |
| Aadhaar Number | `aadhaar_number` | aadhaar_number | |
| Mobile | `mobile` | mobile | |
| Bank Account No. | `bank_account_number` | bank_account_number | |
| Bank IFSC | `bank_ifsc` | bank_ifsc | |
| Bank Name | `bank_name` | bank_name | |
| Date of Leaving | `date_of_leaving` | date_of_leaving | |
| Notes | `notes` | notes | |

---

## Red-Marked Mandatory Fields

Detected via `openpyxl` font color `FFFF0000` in Employees sheet headers (M5:P5):

| Excel Cell | Field | Flows Through |
|---|---|---|
| M5 — 4-Hr OT Rate (INR) | `four_hour_ot_rate` | employees table → PaysheetCreate → paysheet_employees.four_hour_ot → calc → export |
| N5 — Bonus Amount (INR) | `bonus_amount` | employees table → PaysheetCreate → paysheet_employees.bonus → calc → export |
| O5 — Relieving Charges(INR) | `relieving_charges` | employees table → PaysheetCreate → paysheet_employees.relieving_charges → calc → export |
| P5 — Leave Wages (INR) | `leave_wages` | leave_wages | employees table → PaysheetCreate → paysheet_employees.leave_wages → calc → export |

**Priority rule in PaysheetCreate:** Employee-level value takes precedence; falls back to `client_wage_config` value if employee field is 0.

---

## Test Data — Sandbox

### JP (Jewel Park 916)
- 2 wage configs: `S.GUARD` (8-hour), `S.GUARD (12H)` (12-hour with 4-hr OT rate = 5721)
- 1 billing line: Security Guard (8 HRS) @ ₹14,469/month
- 5 employees: 3 on 8-hour duty, 2 on 12-hour duty

### SMOF (Santhoshimathaa Oils and Fats Pvt Ltd)
- 3 wage configs: `ASO`, `S.GUARD`, `WRITER`
- 1 billing line: ASO @ ₹20,936/month
- 19 employees across ASO, S.GUARD, WRITER designations; most have UAN + ESI numbers

---

## Ambiguities / Decisions

| Item | Decision |
|---|---|
| SMOF S.GUARD and WRITER not in Excel wage config sheet | Derived from employee row data — same allowances as ASO, basic = 4000 for S.GUARD |
| JP client name in billing sheet has trailing space | Normalised to `JEWEL PARK 916` |
| Some employee join dates are Excel date serials | Converted to ISO dates during seed |
| `payable_gross` in client_wage_config | Computed at seed time (sum of all allowances); recalculated live in app |
