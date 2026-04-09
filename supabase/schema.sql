-- Supabase database schema for Zola application
-- Extends auth.users with user profiles and defines tables for chats, messages, and agent states

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- User profiles table extending auth.users
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Additional user preferences or metadata can be added here
  constraint users_full_name_length check (char_length(full_name) <= 100)
);

-- Chats table for organizing conversations
create table if not exists public.chats (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_archived boolean default false,
  constraint chats_title_length check (char_length(title) <= 200)
);

-- Messages table for chat messages
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  chat_id uuid references public.chats on delete cascade not null,
  user_id uuid references auth.users on delete set null, -- Null if message is from agent
  content text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Metadata for agent messages (tool usage, reasoning steps, etc.)
  metadata jsonb default '{}'::jsonb,
  constraint messages_role_check check (role in ('user', 'assistant', 'system')),
  constraint messages_content_length check (char_length(content) <= 10000)
);

-- Agent states table for tracking agent interactions and states
create table if not exists public.agent_states (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id text unique not null,
  agent_type text not null,
  state_data jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone,
  constraint agent_states_session_id_unique unique (session_id),
  constraint agent_states_type_length check (char_length(agent_type) <= 50)
);

-- Leads table for storing discovered leads from discovery agents
create table if not exists public.leads (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null, -- Null if lead is not associated with a user
  type text not null check (type in ('person', 'company')),
  name text not null,
  title text,
  company text,
  industry text,
  funding text,
  location text,
  source text not null, -- e.g., 'linkedin', 'crunchbase'
  discovered_at timestamp with time zone not null,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'validated', 'rejected')),
  raw_data jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint leads_type_check check (type in ('person', 'company')),
  constraint leads_validation_status_check check (validation_status in ('pending', 'validated', 'rejected')),
  constraint leads_name_length check (char_length(name) <= 200),
  constraint leads_title_length check (char_length(title) <= 200),
  constraint leads_company_length check (char_length(company) <= 200),
  constraint leads_industry_length check (char_length(industry) <= 100),
  constraint leads_funding_length check (char_length(funding) <= 100),
  constraint leads_location_length check (char_length(location) <= 200),
  constraint leads_source_length check (char_length(source) <= 50)
);

-- Indexes for better query performance
create index if not exists idx_users_id on public.users(id);
create index if not exists idx_chats_user_id on public.chats(user_id);
create index if not exists idx_chats_created_at on public.chats(created_at desc);
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create index if not exists idx_agent_states_user_id on public.agent_states(user_id);
create index if not exists idx_agent_states_session_id on public.agent_states(session_id);
create index if not exists idx_agent_states_expires_at on public.agent_states(expires_at) where expires_at is not null;

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.agent_states enable row level security;

-- Policies for users table
create policy if not exists "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy if not exists "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Policies for chats table
create policy if not exists "Users can view own chats" on public.chats
  for select using (auth.uid() = user_id);

create policy if not exists "Users can create own chats" on public.chats
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users can update own chats" on public.chats
  for update using (auth.uid() = user_id);

create policy if not exists "Users can delete own chats" on public.chats
  for delete using (auth.uid() = user_id);

-- Policies for messages table
create policy if not exists "Users can view messages in own chats" on public.messages
  for select using (exists (
    select 1 from public.chats where chats.id = messages.chat_id and chats.user_id = auth.uid()
  ));

create policy if not exists "Users can insert messages in own chats" on public.messages
  for insert with check (exists (
    select 1 from public.chats where chats.id = messages.chat_id and chats.user_id = auth.uid()
  ));

create policy if not exists "Users can update own messages" on public.messages
  for update using (user_id = auth.uid());

create policy if not exists "Users can delete own messages" on public.messages
  for delete using (user_id = auth.uid());

-- Policies for agent_states table
create policy if not exists "Users can view own agent states" on public.agent_states
  for select using (auth.uid() = user_id);

create policy if not exists "Users can create own agent states" on public.agent_states
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users can update own agent states" on public.agent_states
  for update using (auth.uid() = user_id);

create policy if not exists "Users can delete own agent states" on public.agent_states
  for delete using (auth.uid() = user_id);

-- Trigger to update updated_at timestamp automatically
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language 'plpgsql';

create trigger if not exists update_users_updated_at before update on public.users
  for each row execute procedure update_updated_at_column();

create trigger if not exists update_chats_updated_at before update on public.chats
  for each row execute procedure update_updated_at_column();

create trigger if not exists update_agent_states_updated_at before update on public.agent_states
  for each row execute procedure update_updated_at_column();

-- Comments for documentation
comment on table public.users is 'User profiles extending Supabase auth.users';
comment on table public.chats is 'Chat conversations organized by user';
comment on table public.messages is 'Individual messages within chats';
comment on table public.agent_states is 'Temporary state tracking for AI agents';