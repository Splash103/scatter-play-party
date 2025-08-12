
-- Function to maintain updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles table: stores user display data and streaks
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  avatar_url text,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to maintain updated_at
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

-- Enable RLS and policies for profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select
to public
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

-- Match wins table: one row per match winner per user
create table if not exists public.match_wins (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create index if not exists idx_match_wins_user_id on public.match_wins (user_id);

-- Enable RLS and policies for match_wins
alter table public.match_wins enable row level security;

drop policy if exists "match_wins_select_all" on public.match_wins;
create policy "match_wins_select_all"
on public.match_wins
for select
to public
using (true);

drop policy if exists "match_wins_insert_self" on public.match_wins;
create policy "match_wins_insert_self"
on public.match_wins
for insert
to authenticated
with check (auth.uid() = user_id);

-- Leaderboard view (wins aggregated per user, with names and avatars)
drop view if exists public.v_leaderboard;
create view public.v_leaderboard as
select
  p.id as user_id,
  coalesce(p.display_name, 'Player') as name,
  p.avatar_url,
  coalesce(count(w.id), 0)::int as wins,
  p.best_streak,
  p.current_streak
from public.profiles p
left join public.match_wins w on w.user_id = p.id
group by p.id, p.display_name, p.avatar_url, p.best_streak, p.current_streak
order by wins desc, name asc;
