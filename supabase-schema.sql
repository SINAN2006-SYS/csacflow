-- Run this in the Supabase SQL Editor.
-- Create each person's email/password in Authentication > Users first.
-- Passwords belong to Supabase Auth and must never be stored in profiles.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique not null,
    name text not null default '',
    role text not null default 'Member' check (role in ('Admin', 'Head', 'Member')),
    position text not null default 'Team Member',
    team text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null default '',
    assignee_id uuid not null references public.profiles(id) on delete restrict,
    team text not null,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
    due_date date,
    progress integer not null default 0 check (progress between 0 and 100),
    status text not null default 'pending' check (status in ('pending', 'in-progress', 'completed')),
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.activity (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    team text not null default '',
    message text not null,
    created_at timestamptz not null default now()
);

alter table public.activity add column if not exists team text not null default '';

update public.activity activity
set team = profiles.team
from public.profiles profiles
where activity.user_id = profiles.id
    and activity.team = '';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, name, role, position, team)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data ->> 'role', 'Member'),
        coalesce(new.raw_user_meta_data ->> 'position', 'Team Member'),
        coalesce(new.raw_user_meta_data ->> 'team', '')
    )
    on conflict (id) do update set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.activity enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_team()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select team from public.profiles where id = auth.uid();
$$;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles for select
to authenticated using (
    id = auth.uid()
    or public.current_user_role() = 'Admin'
    or (
        public.current_user_role() = 'Head'
        and team = public.current_user_team()
    )
);

drop policy if exists "Users can read tasks" on public.tasks;
create policy "Users can read tasks"
on public.tasks for select
to authenticated using (
    public.current_user_role() = 'Admin'
    or (
        public.current_user_role() = 'Head'
        and team = public.current_user_team()
    )
    or (
        public.current_user_role() = 'Member'
        and assignee_id = auth.uid()
    )
);

drop policy if exists "Users can create tasks" on public.tasks;
create policy "Users can create tasks"
on public.tasks for insert
to authenticated with check (
    auth.uid() = created_by
    and (
        public.current_user_role() = 'Admin'
        or (
            public.current_user_role() = 'Head'
            and team = public.current_user_team()
        )
    )
);

drop policy if exists "Users can update tasks" on public.tasks;
create policy "Users can update tasks"
on public.tasks for update
to authenticated
using (
    public.current_user_role() = 'Admin'
    or (
        public.current_user_role() = 'Head'
        and team = public.current_user_team()
    )
    or (
        public.current_user_role() = 'Member'
        and assignee_id = auth.uid()
    )
)
with check (
    public.current_user_role() = 'Admin'
    or (
        public.current_user_role() = 'Head'
        and team = public.current_user_team()
    )
    or (
        public.current_user_role() = 'Member'
        and assignee_id = auth.uid()
    )
);

drop policy if exists "Users can delete tasks" on public.tasks;
create policy "Users can delete tasks"
on public.tasks for delete
to authenticated using (
    public.current_user_role() = 'Admin'
    or (
        public.current_user_role() = 'Head'
        and team = public.current_user_team()
    )
);

drop policy if exists "Authenticated users can read activity" on public.activity;
create policy "Authenticated users can read activity"
on public.activity for select
to authenticated using (
    public.current_user_role() = 'Admin'
    or user_id = auth.uid()
    or (
        public.current_user_role() = 'Head'
        and team = public.current_user_team()
    )
);

drop policy if exists "Authenticated users can create activity" on public.activity;
create policy "Authenticated users can create activity"
on public.activity for insert
to authenticated with check (
    auth.uid() = user_id
    and team = public.current_user_team()
);

-- After creating Auth users, update their profiles with your real team details.
-- Example:
-- update public.profiles
-- set name = 'Person Name', role = 'Head', position = 'Design Head', team = 'Design'
-- where email = 'person@example.com';
