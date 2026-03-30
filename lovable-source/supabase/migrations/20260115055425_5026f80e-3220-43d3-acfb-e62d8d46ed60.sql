-- Remove the materialized views from API exposure by revoking access
REVOKE ALL ON public.dashboard_stats FROM anon, authenticated;
REVOKE ALL ON public.low_stock_parts FROM anon, authenticated;

-- Revoke direct access to infrastructure tables (accessed via security definer functions only)
REVOKE ALL ON public.job_queue FROM anon, authenticated;
REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;
REVOKE ALL ON public.cache_store FROM anon, authenticated;

-- Grant only to service_role for edge functions
GRANT ALL ON public.job_queue TO service_role;
GRANT ALL ON public.api_rate_limits TO service_role;
GRANT ALL ON public.cache_store TO service_role;
GRANT SELECT ON public.dashboard_stats TO service_role;
GRANT SELECT ON public.low_stock_parts TO service_role;