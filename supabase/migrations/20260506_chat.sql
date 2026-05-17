-- Live chat sessions and messages
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text,          -- localStorage fingerprint (anonymous)
  email text,
  name text,
  page_url text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);
create index if not exists chat_sessions_status_idx on chat_sessions(status);
create index if not exists chat_sessions_last_message_idx on chat_sessions(last_message_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('visitor', 'agent')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists chat_messages_session_idx on chat_messages(session_id, created_at);

-- Enable realtime on both tables
alter publication supabase_realtime add table chat_sessions;
alter publication supabase_realtime add table chat_messages;
