-- OF-11: optional IGST. Each client chooses its GST type (owner decision
-- 2026-10-13: master-data choice on the client screen). Invoices copy it at
-- creation so issued invoices keep the split they were issued with.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gst_type text NOT NULL DEFAULT 'cgst_sgst'
  CHECK (gst_type IN ('cgst_sgst', 'igst'));
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS gst_type text NOT NULL DEFAULT 'cgst_sgst'
  CHECK (gst_type IN ('cgst_sgst', 'igst'));
COMMENT ON COLUMN public.clients.gst_type IS 'cgst_sgst = intra-state (CGST+SGST); igst = inter-state (IGST)';
COMMENT ON COLUMN public.invoices.gst_type IS 'Copied from client at creation';
