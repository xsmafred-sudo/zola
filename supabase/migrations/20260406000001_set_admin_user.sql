-- Step 1: Create users table with id referencing auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  profile_image text,
  role text default 'user',
  anonymous boolean default false,
  created_at timestamp with time zone default now(),
  last_active_at timestamp with time zone,
  message_count integer default 0,
  daily_message_count integer default 0,
  daily_reset date,
  daily_pro_message_count integer default 0,
  daily_pro_reset date,
  premium boolean default false,
  favorite_models text[],
  system_prompt text
);

-- Step 2: Enable Row Level Security
alter table public.users enable row level security;

-- Step 3: Drop existing policies if they exist
drop policy if exists "Users can read own data" on public.users;
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Admins can read all users" on public.users;
drop policy if exists "Admins can update all users" on public.users;

-- Step 4: Create policies
create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id);

create policy "Admins can read all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all users"
  on public.users for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Step 5: Create function to handle new user signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, role, anonymous)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'user',
    false
  );
  return new;
end;
$$;

-- Step 6: Create trigger for new user signups
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Step 7: Create profiles for existing auth users who don't have one
insert into public.users (id, email, display_name, role, anonymous)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  'user',
  false
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);

-- Step 8: Set xsmafred@gmail.com as admin
update public.users
set role = 'admin'
where email = 'xsmafred@gmail.com';
