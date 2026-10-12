-- Apply before deploying the linked Zalo callback. No existing accounts are merged.
begin;

create table public.user_zalo_identities (
  zalo_id text primary key check (zalo_id ~ '^[0-9]{1,64}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.user_zalo_identities enable row level security;
revoke all on public.user_zalo_identities from public, anon, authenticated;
grant select on public.user_zalo_identities to authenticated;
grant select, insert on public.user_zalo_identities to service_role;
create policy read_own_zalo_identity on public.user_zalo_identities
  for select to authenticated using (user_id = (select auth.uid()));

-- Only the trusted server may resolve a provider identity into an Auth account.
create function public.resolve_zalo_user(p_zalo_id text)
returns uuid language sql security definer set search_path = '' as $$
  select coalesce(
    (select user_id from public.user_zalo_identities where zalo_id = p_zalo_id),
    (select id from auth.users where email = p_zalo_id || '@zalo.app')
  );
$$;
revoke all on function public.resolve_zalo_user(text) from public, anon, authenticated;
grant execute on function public.resolve_zalo_user(text) to service_role;

-- Serialize competing callbacks and reject both forms of account reassignment.
create function public.link_zalo_identity(p_zalo_id text, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_other_zalo text;
begin
  if p_zalo_id is null or p_zalo_id !~ '^[0-9]{1,64}$' or p_user_id is null then
    raise exception 'INVALID_ZALO_ID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zalo:' || p_zalo_id, 0));
  -- Lock the target as well so two different Zalo identities cannot claim it.
  perform 1 from public.users where id = p_user_id and status = 'active' for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  select public.resolve_zalo_user(p_zalo_id) into v_owner;
  if v_owner is not null and v_owner <> p_user_id then
    raise exception 'ZALO_ALREADY_LINKED';
  end if;
  select zalo_id into v_other_zalo from public.user_zalo_identities where user_id = p_user_id;
  if v_other_zalo is not null and v_other_zalo <> p_zalo_id then
    raise exception 'ACCOUNT_ALREADY_HAS_ZALO';
  end if;
  insert into public.user_zalo_identities(zalo_id, user_id)
    values (p_zalo_id, p_user_id) on conflict (zalo_id) do nothing;
end;
$$;
revoke all on function public.link_zalo_identity(text, uuid) from public, anon, authenticated;
grant execute on function public.link_zalo_identity(text, uuid) to service_role;
commit;
