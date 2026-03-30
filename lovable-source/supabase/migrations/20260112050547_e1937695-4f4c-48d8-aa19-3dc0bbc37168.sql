-- Fix RLS policies for qbo_sync_log to be more specific
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.qbo_sync_log;
DROP POLICY IF EXISTS "Service role can update sync logs" ON public.qbo_sync_log;

-- The sync log is written by edge functions using service_role key which bypasses RLS
-- So we don't need INSERT/UPDATE policies for regular users
-- The SELECT policy already restricts viewing to authenticated users

-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;