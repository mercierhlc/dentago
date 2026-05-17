create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text, -- 'clinic', 'supplier', 'outreach', 'order', 'decision', 'product', 'search'
  entity_id text,
  payload jsonb default '{}',
  metrics jsonb default '{}',
  kpi_impact jsonb default '{}',
  source text, -- which system/agent created this
  session_id text,
  created_at timestamptz default now()
);

create index events_event_type_idx on events(event_type);
create index events_created_at_idx on events(created_at desc);
create index events_entity_idx on events(entity_type, entity_id);

-- Loop tracking table
create table if not exists loop_runs (
  id uuid primary key default gen_random_uuid(),
  loop_name text not null,
  triggered_by text,
  status text default 'running', -- running, completed, failed
  input jsonb default '{}',
  output jsonb default '{}',
  kpis_measured jsonb default '{}',
  feedback_applied jsonb default '{}',
  duration_ms int,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index loop_runs_name_idx on loop_runs(loop_name, created_at desc);

-- KPI snapshots table
create table if not exists kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  kpis jsonb not null default '{}',
  vs_previous jsonb default '{}',
  created_at timestamptz default now()
);

-- Decisions log
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  decision text not null,
  rationale text,
  expected_outcome text,
  actual_outcome text,
  outcome_measured_at timestamptz,
  prediction_accurate boolean,
  tags text[],
  created_at timestamptz default now()
);
