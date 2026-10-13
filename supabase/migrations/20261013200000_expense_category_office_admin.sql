-- OF-32: add a general "OFFICE & ADMIN" category (ledger: admin_expense).
-- Production's expense_categories was empty (the sandbox seed of 2026-06-20 was
-- never promoted), so seed the full sandbox list. Idempotent: only names that
-- don't exist yet are inserted.
INSERT INTO public.expense_categories (category_name, is_active, sort_order, ledger_category)
SELECT v.category_name, v.is_active, v.sort_order, v.ledger_category::public.ledger_category
  FROM (VALUES
    ('EPF', true, 1, 'epf_payment'),
    ('ESI', true, 2, 'esi_payment'),
    ('GST-RCM', true, 3, 'gst_payment'),
    ('PT Payment', false, 4, 'pt_payment'),
    ('Staff Salary', true, 5, 'staff_salary'),
    ('Salary Advance', true, 6, 'salary_advance'),
    ('Advance Recovery', true, 7, 'advance_recovery'),
    ('Other Income', false, 8, 'other_income'),
    ('FREE UNIFORMS ISSUING', true, 9, 'admin_expense'),
    ('NIGHT ROUNDING PETROL ALLOW', true, 10, 'vehicle_expense'),
    ('UNIFORM ADVANCE & RECOVERY', true, 11, 'other_expense'),
    ('CANTEEN', true, 12, 'other_expense'),
    ('SECURITY/SAFETY MATERIALS', true, 13, 'other_expense'),
    ('OFFICE & ADMIN', true, 14, 'admin_expense')
  ) AS v(category_name, is_active, sort_order, ledger_category)
 WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories c
                    WHERE upper(c.category_name) = upper(v.category_name));
