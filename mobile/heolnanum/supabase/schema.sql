-- 헌혈나눔 DB 스키마 — Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- (로그인 계정 자체는 Supabase가 auth.users 에 알아서 저장·암호화함. 여기서는 프로필부터 만든다)
-- · 몇 번을 다시 실행해도 안전하다: 있는 테이블은 건너뛰고 데이터는 지우지 않는다.
--   예전 버전으로 만든 DB도 이 파일을 실행하면 새 컬럼·정책이 더해져 최신 구조가 된다.
-- · 관리자 지정 방법은 파일 맨 아래에 있다.

-- ============================================================
-- 1. 회원 프로필: 가입할 때 입력한 닉네임/혈액형
-- ============================================================
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
-- 2. 관리자: 도움 요청 승인, 혈액 보유량 입력, 글·댓글 정리
--  · 이 테이블에는 사이트(브라우저)에서 아무도 쓸 수 없다 → 관리자는 SQL Editor 에서만 지정 (맨 아래 참고)
--  · 다른 정책들은 is_admin() 으로 "지금 로그인한 사람이 관리자인가"를 확인한다
-- ============================================================
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;


-- ============================================================
-- 3. 회원별 데이터: 헌혈 기록 / 도움 요청 / 기부 약속
--  · user_id 는 보내지 않아도 로그인한 사용자(auth.uid())로 자동 채워진다
--  · 입력 길이/범위는 check 로 한 번 더 막는다 (브라우저 검사를 우회해도 DB가 거절)
-- ============================================================

-- 내 헌혈 기록 (본인만)
create table if not exists public.donation_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  donated_on  date not null,
  type        text not null check (type in ('whole', 'plasma', 'platelet')),
  place       text not null default '' check (char_length(place) <= 30),
  created_at  timestamptz not null default now()
);
create index if not exists donation_records_user_idx on public.donation_records (user_id, donated_on desc);

alter table public.donation_records enable row level security;
drop policy if exists "donation_records_own" on public.donation_records;
create policy "donation_records_own" on public.donation_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 도움 요청: 회원이 접수(pending) → 관리자가 승인(approved)하면 누구나 보는 기부 요청 목록에 공개
create table if not exists public.help_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alias       text not null check (char_length(alias) between 1 and 20),
  region      text not null,
  reason      text not null,
  need        int  not null check (need between 1 and 100),
  story       text not null default '' check (char_length(story) <= 300),
  urgent      boolean not null default false,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);
-- 예전 버전 DB 업그레이드: 없던 컬럼 추가 (기존 요청은 '검수 대기'가 된다)
alter table public.help_requests add column if not exists urgent boolean not null default false;
alter table public.help_requests add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
create index if not exists help_requests_user_idx   on public.help_requests (user_id, created_at);
create index if not exists help_requests_status_idx on public.help_requests (status, created_at desc);

alter table public.help_requests enable row level security;
drop policy if exists "help_requests_own" on public.help_requests;   -- 예전 정책(본인만 보기) 제거

-- 읽기: 승인된 요청은 누구나(로그인 안 해도), 내 요청은 상태와 상관없이, 관리자는 전부
drop policy if exists "help_requests_read" on public.help_requests;
create policy "help_requests_read" on public.help_requests
  for select using (status = 'approved' or auth.uid() = user_id or public.is_admin());

-- 접수: 회원 본인 이름으로, 반드시 '검수 대기' 상태로만 (스스로 승인 불가)
drop policy if exists "help_requests_insert_own" on public.help_requests;
create policy "help_requests_insert_own" on public.help_requests
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

-- 수정(승인/반려): 관리자만
drop policy if exists "help_requests_update_admin" on public.help_requests;
create policy "help_requests_update_admin" on public.help_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 삭제: 요청한 본인 또는 관리자
drop policy if exists "help_requests_delete_own" on public.help_requests;
create policy "help_requests_delete_own" on public.help_requests
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

-- 기부 약속: 승인된 도움 요청에 "헌혈증 N장 보낼게요" 약속 (내 약속은 나만 본다, 요청별 합계는 누구나)
create table if not exists public.pledges (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  help_request_id  uuid references public.help_requests (id) on delete cascade,
  amount           int  not null check (amount between 1 and 100),
  nickname         text not null check (char_length(nickname) between 1 and 12),
  message          text not null default '' check (char_length(message) <= 60),
  created_at       timestamptz not null default now()
);
-- 예전 버전 DB 업그레이드: 예시 요청용 request_id(s1, s2 …) 대신 실제 요청을 가리키는 help_request_id 사용.
-- 예전 약속 행은 지우지 않고 남겨 두되(request_id 값 유지), 화면에는 나오지 않는다.
alter table public.pledges add column if not exists help_request_id uuid references public.help_requests (id) on delete cascade;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'pledges' and column_name = 'request_id') then
    alter table public.pledges alter column request_id drop not null;
  end if;
end;
$$;
create index if not exists pledges_user_idx    on public.pledges (user_id, created_at);
create index if not exists pledges_request_idx on public.pledges (help_request_id);

alter table public.pledges enable row level security;
drop policy if exists "pledges_own" on public.pledges;
create policy "pledges_own" on public.pledges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 약속을 넣기 전에 검사: 승인된 요청인지, 내 요청이 아닌지, 남은 장수를 넘지 않는지
-- (다른 사람 약속까지 합산해야 해서 security definer 로 실행. 요청 행을 잠가 동시에 넘치는 것도 막는다)
create or replace function public.pledges_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  req    record;
  total  int;
begin
  select id, user_id, need, status into req
    from public.help_requests where id = new.help_request_id for update;
  if not found or req.status <> 'approved' then
    raise exception '공개된 요청에만 기부할 수 있어요.';
  end if;
  if req.user_id = new.user_id then
    raise exception '내가 올린 요청에는 기부할 수 없어요.';
  end if;
  select coalesce(sum(amount), 0) into total from public.pledges where help_request_id = new.help_request_id;
  if total + new.amount > req.need then
    raise exception '남은 장수(%장)보다 많이 약속할 수 없어요.', req.need - total;
  end if;
  return new;
end;
$$;

drop trigger if exists pledges_before_insert on public.pledges;
create trigger pledges_before_insert
  before insert on public.pledges
  for each row execute function public.pledges_before_insert();

-- 공개된 요청별 약속 합계 (누가 얼마나 약속했는지는 숨기고 합계만 알려준다)
create or replace function public.pledge_totals()
returns table (help_request_id uuid, total int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.help_request_id, sum(p.amount)::int
    from public.pledges p
    join public.help_requests r on r.id = p.help_request_id
   where r.status = 'approved'
   group by p.help_request_id;
$$;


-- ============================================================
-- 4. 혈액 보유량: 관리자가 혈액관리본부 발표 수치를 기준일별로 입력, 누구나 읽기
-- ============================================================
create table if not exists public.blood_stock (
  base_date   date primary key,
  a_days      numeric(4, 1) not null check (a_days  between 0 and 99),
  b_days      numeric(4, 1) not null check (b_days  between 0 and 99),
  o_days      numeric(4, 1) not null check (o_days  between 0 and 99),
  ab_days     numeric(4, 1) not null check (ab_days between 0 and 99),
  updated_at  timestamptz not null default now()
);
alter table public.blood_stock enable row level security;

drop policy if exists "blood_stock_read" on public.blood_stock;
create policy "blood_stock_read" on public.blood_stock
  for select using (true);

drop policy if exists "blood_stock_admin_write" on public.blood_stock;
create policy "blood_stock_admin_write" on public.blood_stock
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 5. 게시판
--  · 글 읽기: 누구나(로그인 안 해도) / 글쓰기: 로그인한 회원 / 수정: 글쓴이 / 삭제: 글쓴이 또는 관리자
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
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

-- 댓글: 읽기 누구나 / 쓰기 회원 / 수정 쓴 사람 / 삭제 쓴 사람 또는 관리자. 글이 지워지면 댓글도 지워진다
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name  text not null default '',
  content      text not null check (char_length(content) between 1 and 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz            -- 수정한 적 없으면 비어 있다
);
alter table public.comments add column if not exists updated_at timestamptz;   -- 예전 버전 DB 업그레이드
create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- 쓸 때: 작성자 이름은 프로필 닉네임으로. 고칠 때: 내용만 바뀌고 글·작성자·작성일은 그대로, 수정 시각 기록
create or replace function public.comments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_name := coalesce((select nickname from public.profiles where id = new.user_id), '회원');
    new.created_at  := now();
    new.updated_at  := null;
  else
    new.post_id     := old.post_id;
    new.user_id     := old.user_id;
    new.author_name := old.author_name;
    new.created_at  := old.created_at;
    new.updated_at  := now();
  end if;
  return new;
end;
$$;

drop trigger if exists comments_before_insert on public.comments;   -- 예전 버전(쓰기 전용) 트리거 정리
drop function if exists public.comments_before_insert();
drop trigger if exists comments_before_write on public.comments;
create trigger comments_before_write
  before insert or update on public.comments
  for each row execute function public.comments_before_write();

alter table public.comments enable row level security;

drop policy if exists "comments_read_all" on public.comments;
create policy "comments_read_all" on public.comments
  for select using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());


-- ============================================================
-- 6. 권한: 비로그인(anon)은 공개 데이터 읽기만, 로그인(authenticated)은 정책이 허락하는 만큼
--    (프로젝트 설정에 따라 새 테이블이 API에 자동 공개되지 않을 수 있어서 명시해 둔다)
-- ============================================================
grant select, update                 on public.profiles         to authenticated;
grant select                         on public.admins           to authenticated;
grant select, insert, update, delete on public.donation_records to authenticated;
grant select                         on public.help_requests    to anon;
grant select, insert, update, delete on public.help_requests    to authenticated;
grant select, insert, update, delete on public.pledges          to authenticated;
grant select                         on public.blood_stock      to anon, authenticated;
grant insert, update, delete         on public.blood_stock      to authenticated;
grant select                         on public.posts            to anon, authenticated;
grant insert, update, delete         on public.posts            to authenticated;
grant select                         on public.comments         to anon, authenticated;
grant insert, update, delete         on public.comments         to authenticated;
grant execute on function public.is_admin()      to anon, authenticated;
grant execute on function public.pledge_totals() to anon, authenticated;


-- ============================================================
-- 관리자 지정 (처음 한 번만)
--  1) 사이트에서 회원가입한 뒤
--  2) 아래 줄의 이메일을 내 가입 이메일로 바꾸고, 맨 앞의 "-- " 를 지운 뒤 그 줄만 선택해서 Run
--
-- insert into public.admins (user_id) select id from auth.users where email = 'me@example.com' on conflict do nothing;
--
--  관리자 확인:  select u.email from public.admins a join auth.users u on u.id = a.user_id;
-- ============================================================
