ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.invoice_followups ADD CONSTRAINT invoice_followups_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.invoice_followups ADD CONSTRAINT invoice_followups_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);
