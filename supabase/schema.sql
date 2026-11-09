-- TrajectAI — schéma Supabase
-- À exécuter une fois dans Supabase > SQL Editor.
-- Principe de minimisation : aucun trajet, aucune position. Seules les préférences sont stockées.
-- L'email et le mot de passe (haché en bcrypt) sont gérés par Supabase Auth (table auth.users).

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_priority text not null default 'time' check (default_priority in ('time', 'cost', 'co2')),
  default_mode text not null default 'transit' check (default_mode in ('car', 'transit', 'bike', 'walk')),
  voice_enabled boolean not null default true,
  -- Lieux favoris : enregistrés UNIQUEMENT si l'usager active l'option (save_favorites).
  save_favorites boolean not null default false,
  favorites jsonb not null default '[]'::jsonb check (jsonb_typeof(favorites) = 'array' and jsonb_array_length(favorites) <= 10),
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

-- Chaque usager ne voit et ne modifie que sa propre ligne.
drop policy if exists "preferences_select_own" on public.preferences;
create policy "preferences_select_own" on public.preferences
  for select using (auth.uid() = user_id);

drop policy if exists "preferences_insert_own" on public.preferences;
create policy "preferences_insert_own" on public.preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_update_own" on public.preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "preferences_delete_own" on public.preferences;
create policy "preferences_delete_own" on public.preferences
  for delete using (auth.uid() = user_id);

-- Les favoris so   nt effacés automatiquement si l'usager désactive l'option.
create or replace function public.preferences_enforce_consent()
returns trigger language plpgsql as $$
begin
  if not new.save_favorites then
    new.favorites := '[]'::jsonb;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists preferences_consent on public.preferences;
create trigger preferences_consent
  before insert or update on public.preferences
  for each row execute function public.preferences_enforce_consent();

-- Droit à l'effacement (RGPD art. 17) : l'usager supprime lui-même son compte.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
