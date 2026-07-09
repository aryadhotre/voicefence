-- Fixes "permission denied for table analysis_history" for logged-in users.
--
-- Enabling Row Level Security restricts which *rows* a role can see/touch,
-- but it doesn't grant baseline table access — Postgres still checks the
-- normal GRANT system first. Creating a table via the SQL editor (as
-- opposed to the Table Editor UI, which grants automatically) leaves the
-- `authenticated` role with no privileges on it at all, so every request
-- was rejected before RLS policies were even evaluated. Run this after
-- 0001_analysis_history.sql.

grant select, insert on public.analysis_history to authenticated;
