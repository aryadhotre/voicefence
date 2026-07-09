-- Voicefence: saved analysis history, one row per completed /analyze
-- upload or finished live-listen session, for logged-in users only.
--
-- Run this in the Supabase dashboard's SQL editor (Project -> SQL Editor
-- -> New query), or via `supabase db push` if you use the Supabase CLI
-- with this repo's supabase/ directory linked to your project.

create table if not exists public.analysis_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  verdict       text not null check (verdict in ('bonafide-like', 'spoof-like')),
  score_mean    double precision not null,
  score_min     double precision not null,
  duration_sec  double precision not null,
  -- Nullable: live-listen sessions have no source file.
  filename      text,
  source        text not null check (source in ('upload', 'live'))
);

create index if not exists analysis_history_user_id_created_at_idx
  on public.analysis_history (user_id, created_at desc);

alter table public.analysis_history enable row level security;

-- Users may only read their own rows.
create policy "Users can view their own analysis history"
  on public.analysis_history
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users may only insert rows attributed to themselves (the client always
-- sends user_id = the logged-in user's id — see src/lib/history.ts — but
-- RLS enforces it server-side regardless of what the client sends).
create policy "Users can insert their own analysis history"
  on public.analysis_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No update/delete policies: history rows are append-only from the app's
-- point of view. Add policies here later if editing/deleting is wanted.
