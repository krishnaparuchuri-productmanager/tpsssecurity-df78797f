ALTER TABLE public.paysheets ADD CONSTRAINT paysheets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.paysheet_employees ADD CONSTRAINT paysheet_employees_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);
