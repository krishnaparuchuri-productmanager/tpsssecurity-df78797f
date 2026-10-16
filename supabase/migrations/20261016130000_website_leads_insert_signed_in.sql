-- The public contact form failed ("Something went wrong") for anyone signed in to the
-- portal in the same browser on the same site: the insert policy covered anon only.
-- Website enquiries are accepted from signed-out and signed-in visitors alike.

DROP POLICY IF EXISTS anon_insert_website_leads ON public.website_lead_submissions;
CREATE POLICY anon_insert_website_leads ON public.website_lead_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
