-- 강사잇다 · 회원 옮기기 ② 넣기  ── [새 프로젝트 gangsaitda-seoul] 에서 실행
--
-- 쓰는 법
--   1) 아래 [[여기를 지우고 붙여넣기]] 줄을 지우고, move-3-members-export.sql 로 꺼낸 내용을 붙여넣습니다.
--      (Copy as JSON 으로 복사했든 칸 내용을 복사했든 괜찮습니다. 괄호가 조금 남아도 괜찮습니다.)
--   2) Run.  맨 아래에 옮긴 회원 수가 나오면 성공입니다.
-- 전체가 명령 하나라서, 오류가 나면 아무것도 들어가지 않습니다.
-- 새 사이트에 같은 이메일로 이미 가입한 계정이 있으면, 겹치는 이메일을 알려 주고 멈춥니다.

do $move$
declare
  pasted text := $data$
[[여기를 지우고 붙여넣기]]
$data$;
  b64 text;
  d jsonb;
  cols text;
  dup text;
begin
  -- 1) 붙여넣은 내용에서 영문·숫자 부분만 골라 원래 내용으로 되돌린다 (복사 방식에 상관없이).
  b64 := regexp_replace(pasted, '[^A-Za-z0-9+/=]', '', 'g');
  begin
    d := convert_from(decode(b64, 'base64'), 'UTF8')::jsonb;
  exception when others then
    raise exception '붙여넣은 내용을 알아볼 수 없습니다. move-3-members-export.sql 결과를 처음부터 끝까지 붙여넣어 주세요.';
  end;
  if not (d ? 'users' and d ? 'identities' and d ? 'members' and d ? 'admins') then
    raise exception '붙여넣은 내용을 알아볼 수 없습니다. move-3-members-export.sql 결과가 맞는지 확인해 주세요.';
  end if;

  -- 2) 같은 이메일이 이미 있으면 멈춘다.
  select string_agg(u.email, ', ') into dup
  from auth.users u
  where u.email in (select x ->> 'email' from jsonb_array_elements(d -> 'users') x)
     or u.id::text in (select x ->> 'id' from jsonb_array_elements(d -> 'users') x);
  if dup is not null then
    raise exception '새 프로젝트에 이미 가입된 이메일이 있습니다: %. Authentication → Users 에서 그 계정을 지운 뒤 다시 실행해 주세요.', dup;
  end if;

  -- 3) 계정 (비밀번호는 암호화된 그대로). 새 프로젝트에 있는 칸 중 옛 내용에 있는 칸만 넣는다.
  if jsonb_array_length(d -> 'users') > 0 then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and is_generated = 'NEVER'
      and column_name in (select jsonb_object_keys(d -> 'users' -> 0));
    execute format('insert into auth.users (%1$s) select %1$s from jsonb_populate_recordset(null::auth.users, $1)', cols)
      using d -> 'users';
  end if;

  if jsonb_array_length(d -> 'identities') > 0 then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and is_generated = 'NEVER'
      and column_name in (select jsonb_object_keys(d -> 'identities' -> 0));
    execute format('insert into auth.identities (%1$s) select %1$s from jsonb_populate_recordset(null::auth.identities, $1)', cols)
      using d -> 'identities';
  end if;

  -- 4) 회원 정보: 계정을 넣으면 자동으로 한 줄씩 생기므로, 옛 내용(가입일·동의 시각 등)으로 덮어쓴다.
  insert into public.members (id, name, phone, email, grade, privacy_agreed_at, created_at)
  select id, name, phone, email, grade, privacy_agreed_at, created_at
  from jsonb_populate_recordset(null::public.members, d -> 'members')
  on conflict (id) do update set
    name = excluded.name, phone = excluded.phone, email = excluded.email, grade = excluded.grade,
    privacy_agreed_at = excluded.privacy_agreed_at, created_at = excluded.created_at;

  -- 5) 관리자 명단
  insert into public.admins (user_id, created_at)
  select user_id, created_at from jsonb_populate_recordset(null::public.admins, d -> 'admins')
  on conflict (user_id) do nothing;
end
$move$;

select
  (select count(*) from auth.users)     as 옮긴_계정,
  (select count(*) from public.members) as 회원_정보,
  (select count(*) from public.admins)  as 관리자;
