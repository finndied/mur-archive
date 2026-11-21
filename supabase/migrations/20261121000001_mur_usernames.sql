begin;

create table public.mur_account_names (
  username text primary key check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade
);

alter table public.mur_account_names enable row level security;
revoke all on public.mur_account_names from public, anon, authenticated, service_role;
grant select on public.mur_account_names to service_role;

create function public.mur_register_account_name() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  requested_name text := new.raw_app_meta_data ->> 'mur_username';
  previous_name text;
begin
  if tg_op = 'UPDATE' then
    previous_name := old.raw_app_meta_data ->> 'mur_username';
    if previous_name is not null then
      if requested_name is distinct from previous_name then
        raise exception 'An account name has already been assigned' using errcode = '23514';
      end if;
      return new;
    end if;
  end if;
  if requested_name is not null then
    insert into public.mur_account_names (username, user_id) values (requested_name, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.mur_register_account_name() from public, anon, authenticated, service_role;
create trigger mur_register_account_name
after insert or update of raw_app_meta_data on auth.users
for each row execute function public.mur_register_account_name();

create table public.mur_auth_attempts (
  attempt_key text primary key check (attempt_key ~ '^[0-9a-f]{64}$'),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);

create index mur_auth_attempts_expiry on public.mur_auth_attempts (expires_at);
alter table public.mur_auth_attempts enable row level security;
revoke all on public.mur_auth_attempts from public, anon, authenticated, service_role;

create function public.mur_allow_auth_attempt(p_key text, p_action text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  current_timepoint timestamptz := statement_timestamp();
  current_hits integer;
  max_hits integer := case p_action when 'login' then 40 when 'signup' then 8 when 'link' then 10 end;
begin
  if max_hits is null then return false; end if;

  delete from public.mur_auth_attempts where expires_at <= current_timepoint;
  insert into public.mur_auth_attempts (attempt_key, hits, expires_at)
  values (p_key, 1, current_timepoint + interval '15 minutes')
  on conflict (attempt_key) do update set hits = least(mur_auth_attempts.hits + 1, max_hits + 1)
  returning hits into current_hits;
  return current_hits <= max_hits;
end;
$$;

revoke all on function public.mur_allow_auth_attempt(text, text) from public, anon, authenticated;
grant execute on function public.mur_allow_auth_attempt(text, text) to service_role;

commit;
