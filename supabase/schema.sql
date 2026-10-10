create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  trials jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.screening_sessions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed', 'needs_review')),
  elevenlabs_conversation_id text unique,
  answers jsonb not null default '{}'::jsonb,
  match_results jsonb not null default '[]'::jsonb,
  transcript jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists screening_sessions_study_id_idx on public.screening_sessions(study_id);
create index if not exists screening_sessions_conversation_id_idx on public.screening_sessions(elevenlabs_conversation_id);

-- The app accesses these tables only from server routes with the service role key.
-- Keep RLS enabled and do not add anonymous read/write policies.
alter table public.studies enable row level security;
alter table public.screening_sessions enable row level security;
