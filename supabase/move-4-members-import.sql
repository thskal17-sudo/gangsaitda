-- 강사잇다 · 회원 옮기기 ② 넣기  ── [새 프로젝트 gangsaitda-seoul] 에서 실행
--
-- 쓰는 법
--   1) 아래 [[여기를 지우고 붙여넣기]] 줄을 지우고, move-3-members-export.sql 로 꺼낸 내용을 붙여넣습니다.
--      (Copy as JSON 으로 복사했든 칸 내용을 복사했든 괜찮습니다. 괄호가 조금 남아도 괜찮습니다.)
--   2) Run.  맨 아래에 옮긴 회원 수가 나오면 성공입니다.
-- 전체가 명령 하나라서, 오류가 나면 아무것도 들어가지 않습니다.
-- 새 사이트에 같은 이메일로 이미 다시 가입한 계정은 **그대로 두고 건너뜁니다** (새로 정한 비밀번호 유지).
-- 관리자 명단은 이메일로 찾아서, 다시 가입한 계정에도 관리자 표시를 붙입니다.

do $move$
declare
  pasted text := $data$
[[여기를 지우고 붙여넣기]]
$data$;
  b64 text;
  d jsonb;
  cols text;
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

  d := jsonb_set(d, '{all_users}', d -> 'users');

  -- 2) 새 프로젝트에 이미 있는 이메일(다시 가입한 계정)은 옮길 목록에서 뺀다.
  d := jsonb_set(d, '{users}', coalesce((
    select jsonb_agg(x) from jsonb_array_elements(d -> 'users') x
    where not exists (select 1 from auth.users u where lower(u.email) = lower(x ->> 'email') or u.id::text = x ->> 'id')
  ), '[]'::jsonb));
  d := jsonb_set(d, '{identities}', coalesce((
    select jsonb_agg(x) from jsonb_array_elements(d -> 'identities') x
    where x ->> 'user_id' in (select y ->> 'id' from jsonb_array_elements(d -> 'users') y)
  ), '[]'::jsonb));
  d := jsonb_set(d, '{members}', coalesce((
    select jsonb_agg(x) from jsonb_array_elements(d -> 'members') x
    where x ->> 'id' in (select y ->> 'id' from jsonb_array_elements(d -> 'users') y)
  ), '[]'::jsonb));

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

  -- 5) 관리자 명단: 옛 관리자의 이메일로 새 프로젝트의 계정을 찾아 붙인다 (다시 가입한 계정 포함).
  insert into public.admins (user_id)
  select u.id
  from jsonb_array_elements(d -> 'admins') a
  join jsonb_array_elements(d -> 'all_users') o on o ->> 'id' = a ->> 'user_id'
  join auth.users u on lower(u.email) = lower(o ->> 'email')
  on conflict (user_id) do nothing;
end
$move$;

select
  (select count(*) from auth.users)     as 옮긴_계정,
  (select count(*) from public.members) as 회원_정보,
  (select count(*) from public.admins)  as 관리자;
