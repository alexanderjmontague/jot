-- Enable required extensions -------------------------------------------------
create extension if not exists "pgcrypto";

-- Helper function to keep updated_at current ---------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Clip threads ---------------------------------------------------------------
create table public.clip_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  favicon_url text,
  preview_image_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index clip_threads_user_updated_idx
  on public.clip_threads (user_id, updated_at desc);

create trigger handle_updated_at
  before update on public.clip_threads
  for each row
  execute procedure public.handle_updated_at();

alter table public.clip_threads enable row level security;

create policy "Users can insert their own threads"
  on public.clip_threads
  for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own threads"
  on public.clip_threads
  for select
  using (auth.uid() = user_id);

create policy "Users can update their own threads"
  on public.clip_threads
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own threads"
  on public.clip_threads
  for delete
  using (auth.uid() = user_id);

-- Clip comments --------------------------------------------------------------
create table public.clip_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.clip_threads(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index clip_comments_thread_created_idx
  on public.clip_comments (thread_id, created_at desc);

create trigger handle_updated_at
  before update on public.clip_comments
  for each row
  execute procedure public.handle_updated_at();

alter table public.clip_comments enable row level security;

create policy "Users can insert comments into their threads"
  on public.clip_comments
  for insert
  with check (
    exists (
      select 1
      from public.clip_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

create policy "Users can select comments from their threads"
  on public.clip_comments
  for select
  using (
    exists (
      select 1
      from public.clip_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

create policy "Users can update comments on their threads"
  on public.clip_comments
  for update
  using (
    exists (
      select 1
      from public.clip_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.clip_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

create policy "Users can delete comments on their threads"
  on public.clip_comments
  for delete
  using (
    exists (
      select 1
      from public.clip_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

-- Conversation snapshots -----------------------------------------------------
create table public.conversation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_id text not null,
  timeline_json jsonb not null,
  draft text,
  status text,
  stream_draft text,
  message_counter integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index conversation_snapshots_user_window_idx
  on public.conversation_snapshots (user_id, window_id);

create trigger handle_updated_at
  before update on public.conversation_snapshots
  for each row
  execute procedure public.handle_updated_at();

alter table public.conversation_snapshots enable row level security;

create policy "Users can insert their own conversation snapshots"
  on public.conversation_snapshots
  for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own conversation snapshots"
  on public.conversation_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users can update their own conversation snapshots"
  on public.conversation_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own conversation snapshots"
  on public.conversation_snapshots
  for delete
  using (auth.uid() = user_id);
