-- CONSERVALINGO — schema relacional (PostgreSQL / Supabase)
create extension if not exists "pgcrypto";

-- Contas e perfis familiares -------------------------------------------------
create table family_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,            -- auth.users.id (Supabase)
  parent_pin_hash text,                   -- hash (nunca o PIN em texto)
  created_at timestamptz not null default now()
);
create table profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family_accounts(id) on delete cascade,
  display_name text not null,
  is_child boolean not null default false,
  sex char(1) not null check (sex in ('M','F')),
  age smallint,
  talents integer not null default 0 check (talents >= 0),
  shields smallint not null default 5 check (shields between 0 and 5),
  shields_updated_at timestamptz not null default now(),
  xp integer not null default 0,
  streak_count integer not null default 0,
  streak_last_day date,
  best_streak integer not null default 0,
  anchor_phrase text,                     -- Frase-Âncora de PNL escolhida no onboarding
  league_tier smallint not null default 0 check (league_tier between 0 and 5),
  created_at timestamptz not null default now()
);

-- Catálogo de personagens ----------------------------------------------------
create table characters (
  id text primary key,                    -- ex.: 'ayrton'
  name text not null,
  role text not null check (role in ('mascot','protagonist','spouse','child')),
  sex char(1) check (sex in ('M','F')),
  age smallint,
  profession text,
  archetype text,
  pedagogical_focus text,
  family_head_id text references characters(id),   -- protagonista da família
  spouse_id text references characters(id),
  parent_id text references characters(id)
);

-- Currículo ------------------------------------------------------------------
-- dialect: 'en-US' (Módulo 1, inglês padrão americano). Inglês britânico = capítulo/curso próprio ('en-GB').
create table courses (id text primary key, title text not null, module smallint not null, dialect text not null default 'en-US' check (dialect in ('en-US','en-GB')));
create table levels (                    -- 5 níveis CEFR (A1–C1)
  level smallint primary key check (level between 1 and 5),
  cefr text not null unique, title text not null, tag text not null
);
create table units (
  id text primary key, course_id text not null references courses(id), level smallint not null references levels(level),
  position smallint not null, title text not null, icon text, topics text,
  unique (course_id, position)
);
create table unit_cast (
  unit_id text references units(id) on delete cascade,
  character_id text references characters(id),
  primary key (unit_id, character_id)
);
create table lessons (
  id text primary key, unit_id text not null references units(id),
  position smallint not null, title text not null, unique (unit_id, position)
);
create table vocab_items (
  id text primary key,                    -- chave SRS: '<lesson>:v:<en>'
  lesson_id text not null references lessons(id), position smallint not null,
  en text not null, pt text not null
);
create table dialogue_lines (
  id text primary key,                    -- chave SRS: '<lesson>:d:<n>'
  lesson_id text not null references lessons(id), position smallint not null,
  character_id text not null references characters(id), en text not null, pt text not null
);

-- Crônicas Interativas (4 pontos de parada) ---------------------------------
create table chronicles (
  id text primary key, title text not null, icon text, intro text,
  unlock_after_unit text not null references units(id)
);
create table chronicle_cast (chronicle_id text references chronicles(id) on delete cascade, character_id text references characters(id), primary key (chronicle_id, character_id));
create table chronicle_segments (
  id text primary key,                    -- '<crônica>:<n>'
  chronicle_id text not null references chronicles(id) on delete cascade, position smallint not null,
  lines jsonb not null,                   -- [{who,en,pt}]
  stop_kind text not null check (stop_kind in ('deduce','moral','complete')),
  stop_question text not null, stop_options jsonb not null, stop_answer text not null, stop_why text not null,
  unique (chronicle_id, position)
);

-- Estações de Escuta + roleplay falado --------------------------------------
create table listening_stations (
  unit_id text primary key references units(id), title text not null,
  lines jsonb not null, questions jsonb not null,   -- 3 perguntas de interpretação
  roleplay jsonb not null                            -- {who,ask,askPt,model,modelPt,accept[]}
);

-- Micro-dicas de pronúncia PT-BR -> EN e histórico por palavra/fonema -------
create table pronunciation_tips (
  id text primary key, title text not null, words jsonb not null, pattern text not null, tip_pt text not null
);

-- Sabedoria do Dia e Leitura Clássica ---------------------------------------
create table wisdom_quotes (
  id text primary key, kind text not null check (kind in ('bible','classic')),
  en text not null, pt text not null, source text not null
);
create table readings (
  id text primary key, title text not null, author text, level smallint, cost_talents integer not null default 0,
  words jsonb not null, source_note text
);

-- Progresso, SRS e inventário ------------------------------------------------
create table lesson_progress (
  profile_id uuid references profiles(id) on delete cascade,
  lesson_id text not null,                -- inclui 'u1rev' (desafio de revisão)
  stars smallint not null check (stars between 1 and 3),
  completed_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);
create table srs_cards (
  profile_id uuid references profiles(id) on delete cascade,
  item_key text not null,
  ease real not null default 2.5, interval_days integer not null default 0,
  reps integer not null default 0, due_at timestamptz not null default now(),
  primary key (profile_id, item_key)
);
create index srs_due_idx on srs_cards (profile_id, due_at);
create table talent_ledger (
  id bigserial primary key, profile_id uuid not null references profiles(id) on delete cascade,
  delta integer not null, reason text not null, created_at timestamptz not null default now()
);
create table inventory (
  profile_id uuid references profiles(id) on delete cascade,
  item_id text not null, acquired_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);
create table pronunciation_history (      -- histórico de pronúncia por palavra/fonema (SRS)
  id bigserial primary key, profile_id uuid not null references profiles(id) on delete cascade,
  word text not null, tip_id text references pronunciation_tips(id),
  status text not null check (status in ('good','near','bad')), heard text,
  accuracy real, created_at timestamptz not null default now()
);
create index pron_hist_idx on pronunciation_history (profile_id, word, created_at desc);
create table daily_missions (
  profile_id uuid references profiles(id) on delete cascade,
  day date not null, mission_id text not null, progress smallint not null default 0,
  goal smallint not null, reward integer not null, claimed boolean not null default false,
  primary key (profile_id, day, mission_id)
);
create table league_weeks (               -- ligas semanais de mérito (top 10 sobe, últimos 5 descem)
  iso_week text not null, tier smallint not null check (tier between 0 and 5),
  profile_id uuid references profiles(id) on delete cascade, xp integer not null default 0,
  result text check (result in ('promoted','stayed','demoted')),
  primary key (iso_week, tier, profile_id)
);
create table chests_opened (profile_id uuid references profiles(id) on delete cascade, unit_id text references units(id), reward integer not null, opened_at timestamptz not null default now(), primary key (profile_id, unit_id));
create table weekly_xp (
  profile_id uuid references profiles(id) on delete cascade,
  iso_week text not null, xp integer not null default 0,
  primary key (profile_id, iso_week)
);

-- Row Level Security (Supabase): cada família só enxerga seus próprios dados.
alter table family_accounts enable row level security;
alter table profiles enable row level security;
alter table lesson_progress enable row level security;
alter table srs_cards enable row level security;
alter table talent_ledger enable row level security;
alter table inventory enable row level security;
alter table weekly_xp enable row level security;
alter table pronunciation_history enable row level security;
alter table daily_missions enable row level security;
alter table league_weeks enable row level security;
alter table chests_opened enable row level security;
create policy fam_own on family_accounts using (owner_user_id = auth.uid());
create policy prof_own on profiles using (family_id in (select id from family_accounts where owner_user_id = auth.uid()));
create policy prog_own on lesson_progress using (profile_id in (select id from profiles));
create policy srs_own on srs_cards using (profile_id in (select id from profiles));
create policy ledger_own on talent_ledger using (profile_id in (select id from profiles));
create policy inv_own on inventory using (profile_id in (select id from profiles));
create policy wxp_own on weekly_xp using (profile_id in (select id from profiles));
create policy pron_own on pronunciation_history using (profile_id in (select id from profiles));
create policy mis_own on daily_missions using (profile_id in (select id from profiles));
create policy lg_own on league_weeks using (profile_id in (select id from profiles));
create policy chest_own on chests_opened using (profile_id in (select id from profiles));
