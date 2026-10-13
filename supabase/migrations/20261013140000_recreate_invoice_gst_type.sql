-- OF-11 follow-up: re-created invoices keep the original GST type (CGST+SGST / IGST).
CREATE OR REPLACE FUNCTION public.recreate_invoice(_old_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old record;
  v_new_id uuid;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admin can re-create invoices';
  END IF;

  SELECT * INTO v_old FROM public.invoices WHERE id = _old_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Original invoice not found'; END IF;
  IF v_old.status <> 'cancelled' THEN RAISE EXCEPTION 'Only cancelled invoices can be re-created'; END IF;
  IF v_old.replaced_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already re-created as another invoice';
  END IF;

  INSERT INTO public.invoices (
    client_id, paysheet_id, branch_id,
    invoice_number, invoice_date, month, month_date,
    service_period_from, service_period_to,
    billing_lines, deduction_rows,
    tds_percentage, gst_applicable, gst_rcm, gst_percentage, gst_type,
    invoice_notes, template_config,
    po_number, po_date,
    status, is_sandbox, created_by, replaces_id
  ) VALUES (
    v_old.client_id, v_old.paysheet_id, v_old.branch_id,
    '', CURRENT_DATE, v_old.month, v_old.month_date,
    v_old.service_period_from, v_old.service_period_to,
    v_old.billing_lines, v_old.deduction_rows,
    v_old.tds_percentage, v_old.gst_applicable, v_old.gst_rcm, v_old.gst_percentage, v_old.gst_type,
    v_old.invoice_notes, v_old.template_config,
    v_old.po_number, v_old.po_date,
    'draft', v_old.is_sandbox, v_uid, _old_id
  ) RETURNING id INTO v_new_id;

  UPDATE public.invoices SET replaced_by_id = v_new_id WHERE id = _old_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'RECREATE_INVOICE', 'invoices', v_new_id,
          jsonb_build_object('replaces_id', _old_id));

  RETURN v_new_id;
END $function$;
