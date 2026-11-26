-- CONSERVALINGO v4 — schema relacional (PostgreSQL / Supabase)
-- 5 Eras × 26 níveis × 10 lições = 1.300 lições padronizadas na cadência oficial.
create extension if not exists "pgcrypto";

-- Conta familiar única, perfis e controle parental ----------------------------
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
  gold_talents integer not null default 0 check (gold_talents >= 0),     -- Talentos de Ouro (Checkpoints de Honra)
  streak_guards smallint not null default 0 check (streak_guards between 0 and 2), -- Escudos de Guarda
  shields smallint not null default 5 check (shields between 0 and 5),  -- Escudos de Atenção
  shields_updated_at timestamptz not null default now(),
  xp integer not null default 0,
  streak_count integer not null default 0,
  streak_last_day date,
  best_streak integer not null default 0,
  anchor_phrase text,                     -- Frase-Âncora de PNL escolhida no onboarding
  league_tier smallint not null default 0 check (league_tier between 0 and 5),
  created_at timestamptz not null default now()
);
create table parental_settings (           -- Painel Familiar: metas e permissões por perfil
  profile_id uuid primary key references profiles(id) on delete cascade,
  daily_goal_lessons smallint not null default 2 check (daily_goal_lessons between 1 and 10),
  asr_enabled boolean not null default true,      -- microfone / reconhecimento de fala
  updated_at timestamptz not null default now()
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
  family_head_id text references characters(id),
  spouse_id text references characters(id),
  parent_id text references characters(id)
);

-- Currículo v4 ------------------------------------------------------------------
-- dialect: 'en-US' (inglês padrão americano). Inglês britânico = curso próprio ('en-GB').
create table courses (id text primary key, title text not null, dialect text not null default 'en-US' check (dialect in ('en-US','en-GB')));
create table eras (
  era smallint primary key check (era between 1 and 5),
  course_id text not null references courses(id),
  cefr text not null unique check (cefr in ('A1','A2','B1','B2','C1')),
  title text not null, level_from smallint not null, level_to smallint not null
);
create table lesson_slot_types (           -- a cadência das 10 lições de todo nível
  slot smallint primary key check (slot between 1 and 10),
  type text not null unique, title text not null, icon text, description text
);
create table level_blocks (
  id smallint primary key, era smallint not null references eras(era),
  level_from smallint not null, level_to smallint not null, theme text not null, grammar text not null
);
create table level_block_cast (block_id smallint references level_blocks(id), character_id text references characters(id), primary key (block_id, character_id));
create table pronunciation_tips (
  id text primary key, title text not null, words jsonb not null, pattern text not null, tip_pt text not null
);
create table wisdom_quotes (
  id text primary key, kind text not null check (kind in ('bible','classic')),
  en text not null, pt text not null, source text not null
);
create table levels (
  id text primary key check (id ~ '^L[0-9]{3}$'),
  number smallint not null unique check (number between 1 and 130),
  era smallint not null references eras(era),
  block_id smallint not null references level_blocks(id),
  title text not null,
  status text not null check (status in ('available','planned')),
  origin text check (origin in ('autoral','adaptado')),
  grammar text,
  wisdom_id text references wisdom_quotes(id),
  pnl jsonb                                -- identidade, pressuposição e ensaio mental (future pacing)
);
create table level_lessons (               -- 1.300 linhas: 10 por nível
  id text primary key check (id ~ '^L[0-9]{3}-(0[1-9]|10)$'),
  level_id text not null references levels(id) on delete cascade,
  slot smallint not null references lesson_slot_types(slot),
  title text not null, objective text, intro text,  -- intro = microcopy de pressuposição (PNL)
  dialogue_ref text,
  steps jsonb not null default '[]',      -- passos do motor pedagógico (vazio = nível em preparação)
  unique (level_id, slot)
);
create table level_chunks (                -- blocos lexicais (lexical chunks) do nível
  id text primary key, level_id text not null references levels(id) on delete cascade, ref text not null,
  en text not null, pt text not null, note text, unique (level_id, ref)
);
create table level_sentences (
  id text primary key, level_id text not null references levels(id) on delete cascade, ref text not null,
  character_id text not null references characters(id), en text not null, pt text not null, alt jsonb, unique (level_id, ref)
);
create table level_dialogues (
  id text primary key, level_id text not null references levels(id) on delete cascade, ref text not null,
  title text not null, vocab jsonb, lines jsonb not null, unique (level_id, ref)
);
create table listening_stations (          -- Escuta Ativa / Estação de Rádio
  level_id text primary key references levels(id) on delete cascade,
  title text not null, lines jsonb not null, questions jsonb not null
);
create table chronicles (                  -- Crônica Interativa (lição 8)
  level_id text primary key references levels(id) on delete cascade,
  title text not null, icon text, intro text not null
);
create table chronicle_cast (level_id text references chronicles(level_id) on delete cascade, character_id text references characters(id), primary key (level_id, character_id));
create table chronicle_segments (
  id text primary key, level_id text not null references chronicles(level_id) on delete cascade, position smallint not null,
  lines jsonb not null,
  stop_kind text not null check (stop_kind in ('deduce','moral','complete')),
  stop_question text not null, stop_options jsonb not null, stop_answer text not null, stop_why text not null,
  stop_lang text not null default 'en' check (stop_lang in ('en','pt')),
  unique (level_id, position)
);
create table roleplays (
  level_id text primary key references levels(id) on delete cascade,
  character_id text not null references characters(id),
  ask text not null, ask_pt text not null, model text not null, model_pt text not null, accept jsonb not null
);
create table level_tips (level_id text references levels(id) on delete cascade, tip_id text references pronunciation_tips(id), primary key (level_id, tip_id));
create table readings (
  id text primary key, title text not null, author text, level smallint, cost_talents integer not null default 0,
  words jsonb not null, source_note text
);

-- Progresso e repetição espaçada (FSRS) -----------------------------------------
create table lesson_progress (
  profile_id uuid references profiles(id) on delete cascade,
  lesson_id text not null references level_lessons(id),
  stars smallint not null check (stars between 1 and 3),
  completed_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);
create table srs_cards (                   -- FSRS v4.5: estabilidade, dificuldade e próxima revisão
  profile_id uuid references profiles(id) on delete cascade,
  item_key text not null,                 -- 'L001:c3' (bloco), 'L001:s2' (frase), 'L001@2.5' (passo), 'L001@q1' (pergunta)
  stability real not null, difficulty real not null check (difficulty between 1 and 10),
  last_review_at timestamptz not null, due_at timestamptz not null,
  reps integer not null default 0, lapses integer not null default 0,
  primary key (profile_id, item_key)
);
create index srs_due_idx on srs_cards (profile_id, due_at);

-- Caderno de Campo & Acervo de Legado ------------------------------------------
create view notebook_expression_blocks as  -- aba "Blocos de Expressão"
  select s.profile_id, c.level_id, c.ref, c.en, c.pt, s.stability, s.due_at, s.last_review_at
  from srs_cards s join level_chunks c on c.id = s.item_key;
create table pronunciation_history (       -- aba "Registro de Fonemas": histórico por palavra/fonema
  id bigserial primary key, profile_id uuid not null references profiles(id) on delete cascade,
  word text not null, tip_id text references pronunciation_tips(id),   -- categoria fonética (TH, R, consoante final…)
  status text not null check (status in ('good','near','bad')), heard text,
  accuracy real, created_at timestamptz not null default now()
);
create index pron_hist_idx on pronunciation_history (profile_id, word, created_at desc);
create table proverbs_collected (          -- aba "Provérbios Memorizados"
  profile_id uuid references profiles(id) on delete cascade,
  wisdom_id text references wisdom_quotes(id),
  seen_count integer not null default 1, memorized boolean not null default false,
  first_seen_at timestamptz not null default now(),
  primary key (profile_id, wisdom_id)
);

-- Gamificação -----------------------------------------------------------------
create table talent_ledger (
  id bigserial primary key, profile_id uuid not null references profiles(id) on delete cascade,
  delta integer not null, gold_delta integer not null default 0, reason text not null, created_at timestamptz not null default now()
);
create table inventory (
  profile_id uuid references profiles(id) on delete cascade,
  item_id text not null, acquired_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);
create table chests_opened (               -- Arcas de Talentos (a cada 3 lições)
  profile_id uuid references profiles(id) on delete cascade,
  chest_id text not null check (chest_id ~ '^L[0-9]{3}-a[1-3]$'), reward integer not null,
  opened_at timestamptz not null default now(), primary key (profile_id, chest_id)
);
create table weekly_xp (
  profile_id uuid references profiles(id) on delete cascade,
  iso_week text not null, xp integer not null default 0,
  primary key (profile_id, iso_week)
);
create table league_weeks (                -- Ligas Semanais de Mérito: top 10 sobe, últimos 5 descem
  iso_week text not null, tier smallint not null check (tier between 0 and 5),
  profile_id uuid references profiles(id) on delete cascade, xp integer not null default 0,
  result text check (result in ('promoted','stayed','demoted')),
  primary key (iso_week, tier, profile_id)
);
create table daily_missions (              -- Missões Diárias Relâmpago (3 slots)
  profile_id uuid references profiles(id) on delete cascade,
  day date not null, mission_id text not null, progress smallint not null default 0,
  goal smallint not null, reward integer not null, claimed boolean not null default false,
  primary key (profile_id, day, mission_id)
);
create table daily_vault_claims (          -- Cofre Diário do Tio Bento (3 missões concluídas)
  profile_id uuid references profiles(id) on delete cascade,
  day date not null, talents integer not null, opened_at timestamptz not null default now(),
  primary key (profile_id, day)
);

-- Row Level Security (Supabase): cada família só enxerga os próprios dados.
alter table family_accounts enable row level security;
alter table profiles enable row level security;
alter table parental_settings enable row level security;
alter table lesson_progress enable row level security;
alter table srs_cards enable row level security;
alter table pronunciation_history enable row level security;
alter table proverbs_collected enable row level security;
alter table talent_ledger enable row level security;
alter table inventory enable row level security;
alter table chests_opened enable row level security;
alter table weekly_xp enable row level security;
alter table league_weeks enable row level security;
alter table daily_missions enable row level security;
alter table daily_vault_claims enable row level security;
create policy fam_own on family_accounts using (owner_user_id = auth.uid());
create policy prof_own on profiles using (family_id in (select id from family_accounts where owner_user_id = auth.uid()));
create policy par_own on parental_settings using (profile_id in (select id from profiles));
create policy prog_own on lesson_progress using (profile_id in (select id from profiles));
create policy srs_own on srs_cards using (profile_id in (select id from profiles));
create policy pron_own on pronunciation_history using (profile_id in (select id from profiles));
create policy prov_own on proverbs_collected using (profile_id in (select id from profiles));
create policy ledger_own on talent_ledger using (profile_id in (select id from profiles));
create policy inv_own on inventory using (profile_id in (select id from profiles));
create policy chest_own on chests_opened using (profile_id in (select id from profiles));
create policy wxp_own on weekly_xp using (profile_id in (select id from profiles));
create policy lg_own on league_weeks using (profile_id in (select id from profiles));
create policy mis_own on daily_missions using (profile_id in (select id from profiles));
create policy vault_own on daily_vault_claims using (profile_id in (select id from profiles));
-- A view do Caderno herda a RLS de srs_cards quando consultada com security_invoker.
alter view notebook_expression_blocks set (security_invoker = on);
