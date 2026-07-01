create extension if not exists pgcrypto;

-- Profiles (1:1 with auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text,
  avatar text,
  title text,
  rating int not null default 1200,
  xp bigint not null default 0,
  level int not null default 1,
  timezone text default 'UTC',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Streaks
create table if not exists streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_played_date date,
  freeze_tokens int not null default 0
);

-- Per-topic stats
create table if not exists user_topic_stats (
  user_id uuid references profiles(id) on delete cascade,
  topic_id text not null,
  attempts int not null default 0,
  correct int not null default 0,
  avg_time_ms int not null default 0,
  mastery numeric(5,2) not null default 0,
  primary key (user_id, topic_id)
);

-- Problem bank
create table if not exists problems (
  id text primary key,
  topic_id text not null,
  group_id text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  prompt_latex text not null,
  answer_format text not null check (answer_format in ('mc','numeric','exact')),
  choices jsonb,
  correct_choice text,
  correct_answer text not null,
  answer_type text not null,
  accepted_forms jsonb not null default '[]',
  solution_latex text not null,
  complexity_factor numeric(3,2) not null default 1.0,
  source_section text,
  tags jsonb not null default '[]',
  checksum text unique not null,
  status text not null default 'valid'
);
create index if not exists idx_problems_topic_difficulty on problems (topic_id, difficulty);

-- Sessions
create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('solo','mp','race')),
  ranked boolean not null default false,
  host_id uuid references profiles(id),
  room_code text,
  config jsonb not null,
  state text not null default 'lobby',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists session_players (
  session_id uuid references game_sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score int not null default 0,
  correct_count int not null default 0,
  total_time_ms int not null default 0,
  placement int,
  primary key (session_id, user_id)
);

create table if not exists session_rounds (
  session_id uuid references game_sessions(id) on delete cascade,
  round_index int not null,
  problem_id text references problems(id),
  server_start_ts timestamptz,
  duration_ms int not null,
  primary key (session_id, round_index)
);

create table if not exists round_answers (
  session_id uuid references game_sessions(id) on delete cascade,
  round_index int not null,
  user_id uuid references profiles(id) on delete cascade,
  submitted text,
  is_correct boolean not null default false,
  time_ms int,
  points int not null default 0,
  primary key (session_id, round_index, user_id)
);

-- Rooms / parties
create table if not exists rooms (
  code text primary key,
  host_id uuid references profiles(id) on delete cascade,
  status text not null default 'open',
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Ratings log
create table if not exists rating_events (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references game_sessions(id),
  delta int not null,
  new_rating int not null,
  created_at timestamptz not null default now()
);

-- Achievements
create table if not exists achievements (
  key text primary key,
  name text not null,
  description text
);

create table if not exists user_achievements (
  user_id uuid references profiles(id) on delete cascade,
  achievement_key text references achievements(key),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

-- Speed multiplication race scores
create table if not exists race_scores (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  mode text not null check (mode in ('sprint','first_to_n')),
  config jsonb not null,
  correct int not null,
  duration_ms int not null,
  created_at timestamptz not null default now()
);

-- Trigger to create profile and streak rows for new auth users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (id) do nothing;

  insert into public.streaks (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Drop then create trigger to make the migration idempotent
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table profiles enable row level security;
alter table streaks enable row level security;
alter table user_topic_stats enable row level security;
alter table problems enable row level security;
alter table game_sessions enable row level security;
alter table session_players enable row level security;
alter table session_rounds enable row level security;
alter table round_answers enable row level security;
alter table rooms enable row level security;
alter table rating_events enable row level security;
alter table user_achievements enable row level security;
alter table race_scores enable row level security;

-- Profiles: read all, write own
create policy "Profiles are publicly readable"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Streaks: read own, service writes via edge functions (no client writes)
create policy "Users can read own streaks"
  on streaks for select using (auth.uid() = user_id);

-- User topic stats: read own
create policy "Users can read own topic stats"
  on user_topic_stats for select using (auth.uid() = user_id);

-- Problems: read valid only, no client writes
create policy "Users can read valid problems"
  on problems for select using (status = 'valid');

-- Game sessions: participants can read
create policy "Session participants can read sessions"
  on game_sessions for select using (
    exists (
      select 1 from session_players
      where session_players.session_id = game_sessions.id
        and session_players.user_id = auth.uid()
    )
  );

-- Session players: participants can read
create policy "Session participants can read players"
  on session_players for select using (
    exists (
      select 1 from session_players as sp
      where sp.session_id = session_players.session_id
        and sp.user_id = auth.uid()
    )
  );

-- Session rounds: participants can read
create policy "Session participants can read rounds"
  on session_rounds for select using (
    exists (
      select 1 from session_players
      where session_players.session_id = session_rounds.session_id
        and session_players.user_id = auth.uid()
    )
  );

-- Round answers: participants can read
create policy "Session participants can read answers"
  on round_answers for select using (
    exists (
      select 1 from session_players
      where session_players.session_id = round_answers.session_id
        and session_players.user_id = auth.uid()
    )
  );

-- Rooms: host writes, participants read
create policy "Room host can update"
  on rooms for all using (auth.uid() = host_id);

create policy "Room participants can read"
  on rooms for select using (
    auth.uid() = host_id
    or exists (
      select 1 from session_players
      where session_players.user_id = auth.uid()
        and session_players.session_id in (
          select id from game_sessions where room_code = rooms.code
        )
    )
  );

-- Ratings log: read own
create policy "Users can read own rating events"
  on rating_events for select using (auth.uid() = user_id);

-- Achievements: read all
create policy "Achievements are readable"
  on achievements for select using (true);

-- User achievements: read own
create policy "Users can read own achievements"
  on user_achievements for select using (auth.uid() = user_id);

-- Race scores: read own
create policy "Users can read own race scores"
  on race_scores for select using (auth.uid() = user_id);
