ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
