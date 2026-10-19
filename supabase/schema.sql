-- 뽑공 데이터베이스 스키마
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 Run 을 누르세요.
-- 여러 번 실행해도 안전하도록 작성되어 있습니다.

-- ───────────────────────── 프로필 ─────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  nickname         text not null check (char_length(nickname) between 1 and 20),
  interests        text[] not null default '{}',          -- 관심 분야(카테고리 id) 목록
  level            smallint not null default 0 check (level between 0 and 3),  -- 0=골고루, 1~3=Lv.1~3
  study_minutes    int  not null default 15 check (study_minutes between 1 and 120),
  explain_minutes  int  not null default 2  check (explain_minutes between 1 and 30),
  reminder_enabled boolean not null default true,
  reminder_time    text not null default '21:00' check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 이전 버전 스키마로 만든 표에 난이도 열 추가 (여러 번 실행해도 안전)
alter table public.profiles add column if not exists level smallint not null default 0 check (level between 0 and 3);

alter table public.profiles enable row level security;

drop policy if exists "profiles: 본인만 조회" on public.profiles;
create policy "profiles: 본인만 조회" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: 본인만 생성" on public.profiles;
create policy "profiles: 본인만 생성" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: 본인만 수정" on public.profiles;
create policy "profiles: 본인만 수정" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ───────────────────────── 공부 기록 ─────────────────────────
create table if not exists public.study_records (
  id           uuid primary key,                          -- 앱에서 만든 id (오프라인 저장 후 동기화)
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id     text not null,
  topic_ko     text not null,
  domain       text not null default 'it',
  category     text not null,
  level        text not null,
  memo         text not null default '' check (char_length(memo) <= 5000),
  rating       smallint not null check (rating between 1 and 5),
  good         text not null default '' check (char_length(good) <= 300),
  stuck        text not null default '' check (char_length(stuck) <= 300),
  study_sec    int not null default 0 check (study_sec >= 0),
  explain_sec  int not null default 0 check (explain_sec >= 0),
  studied_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists study_records_user_time on public.study_records (user_id, studied_at desc);

alter table public.study_records enable row level security;

drop policy if exists "records: 본인만 조회" on public.study_records;
create policy "records: 본인만 조회" on public.study_records
  for select using (auth.uid() = user_id);

drop policy if exists "records: 본인만 생성" on public.study_records;
create policy "records: 본인만 생성" on public.study_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "records: 본인만 수정" on public.study_records;
create policy "records: 본인만 수정" on public.study_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "records: 본인만 삭제" on public.study_records;
create policy "records: 본인만 삭제" on public.study_records
  for delete using (auth.uid() = user_id);

-- ───────────────────────── 회원 탈퇴 ─────────────────────────
-- 앱스토어 규정상 앱 안에서 탈퇴할 수 있어야 합니다.
-- 로그인한 본인 계정만 지우며, 프로필과 기록은 on delete cascade 로 함께 지워집니다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
