-- 헌혈나눔 DB 스키마 — Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- (로그인 계정 자체는 Supabase가 auth.users 에 알아서 저장·암호화함. 여기서는 프로필만 만든다)

-- 회원 프로필: 가입할 때 입력한 닉네임/혈액형
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 20),
  blood_type  text check (blood_type in ('A', 'B', 'O', 'AB')),
  created_at  timestamptz not null default now()
);

-- RLS: 본인 프로필만 읽고 고칠 수 있다 (insert 는 아래 트리거만 하므로 정책 없음)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 가입(auth.users insert) 직후 프로필 행을 자동 생성.
-- 가입 폼의 값은 raw_user_meta_data 로 들어온다. 값이 이상해도 가입 자체가 실패하지 않도록 방어해 둔다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, blood_type)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(new.email, '@', 1), '회원'), 20),
    case when new.raw_user_meta_data ->> 'blood_type' in ('A', 'B', 'O', 'AB')
         then new.raw_user_meta_data ->> 'blood_type' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 회원별 데이터: 헌혈 기록 / 기부 약속 / 도움 요청
-- 공통 규칙
--  · user_id 는 보내지 않아도 로그인한 사용자(auth.uid())로 자동 채워진다
--  · RLS 정책: 본인 행만 읽기/쓰기/삭제 가능 (다른 사람 데이터는 보이지도 않는다)
--  · 입력 길이/범위는 check 로 한 번 더 막는다 (브라우저 검사를 우회해도 DB가 거절)
-- ============================================================

-- 내 헌혈 기록
create table if not exists public.donation_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  donated_on  date not null,
  type        text not null check (type in ('whole', 'plasma', 'platelet')),
  place       text not null default '' check (char_length(place) <= 30),
  created_at  timestamptz not null default now()
);
create index if not exists donation_records_user_idx on public.donation_records (user_id, donated_on desc);

-- 기부 약속 (request_id 는 화면의 예시 요청 id: s1, s2 ...)
create table if not exists public.pledges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id  text not null,
  amount      int  not null check (amount between 1 and 100),
  nickname    text not null check (char_length(nickname) between 1 and 12),
  message     text not null default '' check (char_length(message) <= 60),
  created_at  timestamptz not null default now()
);
create index if not exists pledges_user_idx on public.pledges (user_id, created_at);

-- 도움 요청 (검수 전 접수본)
create table if not exists public.help_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alias       text not null check (char_length(alias) between 1 and 20),
  region      text not null,
  reason      text not null,
  need        int  not null check (need between 1 and 100),
  story       text not null default '' check (char_length(story) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists help_requests_user_idx on public.help_requests (user_id, created_at);

alter table public.donation_records enable row level security;
alter table public.pledges          enable row level security;
alter table public.help_requests    enable row level security;

drop policy if exists "donation_records_own" on public.donation_records;
create policy "donation_records_own" on public.donation_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pledges_own" on public.pledges;
create policy "pledges_own" on public.pledges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "help_requests_own" on public.help_requests;
create policy "help_requests_own" on public.help_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 로그인한 사용자(authenticated)만 접근. 비로그인(anon)에게는 아무 권한도 주지 않는다.
-- (프로젝트 설정에 따라 새 테이블이 API에 자동 공개되지 않을 수 있어서 명시해 둔다)
grant select, update                 on public.profiles         to authenticated;
grant select, insert, update, delete on public.donation_records to authenticated;
grant select, insert, update, delete on public.pledges          to authenticated;
grant select, insert, update, delete on public.help_requests    to authenticated;


-- ============================================================
-- 게시판
--  · 글 읽기: 누구나(로그인 안 해도) / 글쓰기: 로그인한 회원 / 수정·삭제: 글쓴이 본인만
--  · 작성자 이름(author_name)은 DB가 회원의 닉네임(profiles)으로 채운다
--    → 브라우저에서 다른 사람 이름으로 속여 쓸 수 없다. 수정할 때도 작성자·작성일은 바뀌지 않는다
-- ============================================================
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name  text not null default '',
  category     text not null check (category in ('review', 'question', 'free')),
  title        text not null check (char_length(title) between 1 and 100),
  content      text not null check (char_length(content) between 1 and 5000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists posts_created_idx  on public.posts (created_at desc);
create index if not exists posts_category_idx on public.posts (category, created_at desc);

create or replace function public.posts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_name := coalesce((select nickname from public.profiles where id = new.user_id), '회원');
    new.created_at  := now();
    new.updated_at  := now();
  else
    new.user_id     := old.user_id;
    new.author_name := old.author_name;
    new.created_at  := old.created_at;
    new.updated_at  := now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_before_write on public.posts;
create trigger posts_before_write
  before insert or update on public.posts
  for each row execute function public.posts_before_write();

alter table public.posts enable row level security;

drop policy if exists "posts_read_all" on public.posts;
create policy "posts_read_all" on public.posts
  for select using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete to authenticated using (auth.uid() = user_id);

-- 읽기는 비로그인(anon)도 가능, 쓰기·수정·삭제는 로그인한 사용자만
grant select                         on public.posts to anon, authenticated;
grant insert, update, delete         on public.posts to authenticated;
