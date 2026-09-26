-- Proposed PostgreSQL / Supabase schema for a production migration.
-- Not executed by the static hackathon demo.
create extension if not exists pgcrypto;

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null, age_years integer check (age_years between 17 and 120),
  school text, height_cm numeric(5,1), routine text, bedtime time, wake_time time,
  conditions_note text, injuries_note text, updated_at timestamptz not null default now()
);
create table goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  name text not null, priority integer not null check (priority > 0), active boolean not null default true,
  unique (user_id, priority)
);
create table lifestyle_factors (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  label text not null, note text, updated_at timestamptz not null default now()
);
create table timetables (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  label text not null, temporary_period_id uuid, confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create table timetable_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  timetable_id uuid not null references timetables(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6), event_date date,
  starts_at time not null, ends_at time not null, title text not null, location text,
  is_fixed boolean not null default true, replaces_event_id uuid references timetable_events(id),
  check (ends_at > starts_at)
);
create table temporary_periods (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  label text not null, learning_mode text not null check (learning_mode in ('pause','temporary_baseline')),
  starts_on date not null, ends_on date
);
alter table timetables add constraint timetables_temporary_period_fk foreign key (temporary_period_id) references temporary_periods(id);
create table health_metrics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  measured_at timestamptz not null, source text not null,
  sleep_duration_hours numeric(4,2), sleep_start timestamptz, sleep_end timestamptz,
  resting_heart_rate integer, average_heart_rate integer, steps integer,
  active_minutes integer, workouts jsonb not null default '[]'::jsonb,
  calories_burned numeric(8,1), recovery_score numeric(5,2), hrv_ms numeric(7,2),
  stress_rating smallint check (stress_rating between 1 and 5),
  temporary_period_id uuid references temporary_periods(id), created_at timestamptz not null default now()
);
create table tracker_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  provider text not null, scopes text[] not null default '{}', token_reference text,
  status text not null default 'disconnected', connected_at timestamptz,
  unique (user_id, provider)
);
create table plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  starts_on date not null, ends_on date not null, status text not null default 'draft',
  context_summary text, temporary_period_id uuid references temporary_periods(id), created_at timestamptz not null default now()
);
create table recommendations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  plan_id uuid references plans(id) on delete cascade, advice text not null,
  rationale text, evidence_source_id uuid, created_at timestamptz not null default now()
);
create table plan_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, title text not null,
  kind text not null check (kind in ('fixed','suggestion','recovery')),
  approved_for_calendar boolean not null default false, recommendation_id uuid references recommendations(id),
  check (ends_at > starts_at)
);
create table user_actions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  plan_item_id uuid references plan_items(id), status text not null,
  detected_from_tracker boolean not null default false, note text, acted_at timestamptz not null default now()
);
create table personal_patterns (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  observation text not null, sample_days integer not null, temporary_period_id uuid references temporary_periods(id),
  generated_at timestamptz not null default now()
);
create table evidence_sources (
  id uuid primary key default gen_random_uuid(), title text not null, organisation text not null,
  source_url text not null, publication_year integer, summary text, reviewed_at timestamptz
);
alter table recommendations add constraint recommendations_evidence_fk foreign key (evidence_source_id) references evidence_sources(id);
create table weight_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  measured_on date not null, weight_kg numeric(5,1) not null, temporary_period_id uuid references temporary_periods(id),
  unique (user_id, measured_on)
);
create table mood_feeling_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  recorded_at timestamptz not null default now(), feeling text, note text,
  temporary_period_id uuid references temporary_periods(id)
);
create table calendar_preferences (
  user_id uuid primary key references profiles(user_id) on delete cascade,
  auto_add_approved boolean not null default false, provider text, oauth_connection_reference text,
  updated_at timestamptz not null default now()
);
create table context_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(user_id) on delete cascade,
  label text not null, effective_on date not null, note text
);

-- Every private table carries user_id. Backend requests must authenticate before querying.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','goals','lifestyle_factors','timetables','timetable_events','temporary_periods',
    'health_metrics','tracker_connections','plans','recommendations','plan_items','user_actions',
    'personal_patterns','weight_entries','mood_feeling_entries','calendar_preferences','context_history'
  ] loop
    execute format('alter table %I enable row level security', table_name);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name);
  end loop;
end $$;
