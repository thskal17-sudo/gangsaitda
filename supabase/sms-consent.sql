-- 강사잇다 · 교육·강의 섭외 소식 문자 수신 동의 (선택)
-- member-type.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 가입할 때 [선택] 문자 수신 동의를 체크할 수 있다 (체크하지 않아도 가입된다).
-- - 회원은 '문자 수신 설정'(/account/sms) 화면에서 언제든 켜고 끈다 (이 파일의 set_my_sms_consent).
-- - 문자는 동의한 회원(sms_agreed_at 이 비어 있지 않음)에게만 보낸다. 이미 가입한 회원은 모두 '동의 안 함'으로 시작한다.

-- 1) 회원 표에 칸 더하기 ----------------------------------------------------------------
alter table public.members add column if not exists sms_agreed_at  timestamptz; -- 동의한 시각. 비어 있으면 동의 안 함
alter table public.members add column if not exists sms_updated_at timestamptz; -- 마지막으로 동의·거부를 처리한 시각

comment on column public.members.sms_agreed_at is '교육·강의 섭외 소식 문자(광고성 정보) 수신 동의 시각. null 이면 동의 안 함';
comment on column public.members.sms_updated_at is '문자 수신 동의·거부를 마지막으로 처리한 시각';

-- 2) 가입하면 자동으로 회원 정보 만들기: 문자 수신 동의도 함께 ----------------------------
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_name  text := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  member_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g');
  member_kind  text := coalesce(nullif(new.raw_user_meta_data ->> 'member_type', ''), '강사');
  member_org   text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'org_name', '')), '');
  member_sms   boolean := coalesce(new.raw_user_meta_data ->> 'sms_agreed', '') = 'true';
begin
  if coalesce(new.raw_user_meta_data ->> 'privacy_agreed', '') <> 'true' then
    raise exception '개인정보 수집·이용 동의가 필요합니다';
  end if;
  if member_name = '' or member_phone = '' then
    raise exception '이름과 연락처가 필요합니다';
  end if;
  if member_kind not in ('강사', '기관') then
    raise exception '회원 종류는 강사 또는 기관이어야 합니다';
  end if;
  if member_kind = '기관' and member_org is null then
    raise exception '기관명이 필요합니다';
  end if;

  insert into public.members (id, name, phone, email, privacy_agreed_at, member_type, org_name, sms_agreed_at, sms_updated_at)
  values (new.id, member_name, member_phone, new.email, now(), member_kind,
          case when member_kind = '기관' then left(member_org, 50) end,
          case when member_sms then now() end,
          now());
  return new;
end;
$$;

revoke execute on function public.handle_new_member() from public, anon, authenticated;

-- 3) 회원 본인: 문자 수신 켜기·끄기 -------------------------------------------------------
-- 회원은 회원 표를 직접 고칠 수 없어서(등급·종류 보호) 이 함수로만 바꾼다. 처리한 시각을 돌려준다.
create or replace function public.set_my_sms_consent(p_agreed boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  done_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다';
  end if;
  update public.members
  set sms_agreed_at  = case when p_agreed then done_at end,
      sms_updated_at = done_at
  where id = (select auth.uid());
  if not found then
    raise exception '회원 정보가 없습니다';
  end if;
  return done_at;
end;
$$;

revoke execute on function public.set_my_sms_consent(boolean) from public, anon;
grant execute on function public.set_my_sms_consent(boolean) to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '문자 수신 동의 준비 완료' as 결과,
       count(*) filter (where sms_agreed_at is not null) as 문자_동의_회원
from public.members;
