INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export) VALUES
('ceo_admin','payslips',true,true,true,true,true,true),
('coo_ops','payslips',true,true,false,false,false,true),
('accountant','payslips',true,true,false,false,false,true),

('ceo_admin','bank_payment',true,true,true,true,true,true),
('coo_ops','bank_payment',true,true,true,true,true,true),
('accountant','bank_payment',true,true,true,true,true,true),

('ceo_admin','salary_register',true,true,true,true,true,true),
('coo_ops','salary_register',true,true,true,true,true,true),
('accountant','salary_register',true,true,false,false,false,true),

('ceo_admin','pf_statement',true,true,true,true,true,true),
('coo_ops','pf_statement',true,true,true,true,true,true),
('accountant','pf_statement',true,true,false,false,false,true),

('ceo_admin','esi_statement',true,true,true,true,true,true),
('coo_ops','esi_statement',true,true,true,true,true,true),
('accountant','esi_statement',true,true,false,false,false,true),

('ceo_admin','pt_report',true,true,true,true,true,true),
('coo_ops','pt_report',true,true,true,true,true,true),
('accountant','pt_report',true,true,false,false,false,true),

('ceo_admin','full_and_final_settlement',true,true,true,true,true,true),
('coo_ops','full_and_final_settlement',true,false,false,false,true,false),
('accountant','full_and_final_settlement',true,false,false,false,false,false),

('ceo_admin','uniform_advance',true,true,true,true,true,true),
('coo_ops','uniform_advance',true,true,true,true,true,true),
('accountant','uniform_advance',true,false,false,false,true,false),

('ceo_admin','canteen_deductions',true,true,true,true,true,true),
('coo_ops','canteen_deductions',true,true,true,true,true,true),
('accountant','canteen_deductions',true,false,false,false,false,false)
ON CONFLICT DO NOTHING;
