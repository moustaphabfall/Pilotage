-- Artefact de pilotage — schéma Supabase (multi-utilisateurs, accès par compte, modifications signées)
-- À exécuter dans Supabase → SQL Editor (ou via migration).

-- 1) Profils : un par compte ; l'administrateur valide l'accès et choisit le rôle
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text,
  role text not null default 'editeur' check (role in ('admin','editeur','lecteur')),
  approuve boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) Données de l'artefact (le même découpage en blocs que l'artefact utilise déjà)
create table if not exists public.docs (
  path text primary key,
  data jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.docs enable row level security;

-- Aides (security definer : évite la récursion des règles)
create or replace function public.pg_role() returns text language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and approuve $$;

-- Création automatique du profil à l'inscription (le 1er compte devient administrateur approuvé)
create or replace function public.pg_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare premier boolean;
begin
  select not exists(select 1 from public.profiles) into premier;
  insert into public.profiles(id, nom, role, approuve)
  values (new.id, coalesce(new.raw_user_meta_data->>'nom', new.email), case when premier then 'admin' else 'editeur' end, premier);
  return new;
end $$;
drop trigger if exists pg_on_signup on auth.users;
create trigger pg_on_signup after insert on auth.users for each row execute function public.pg_new_user();

-- Signature automatique de chaque écriture
create or replace function public.pg_stamp() returns trigger language plpgsql as $$
begin new.updated_by := auth.uid(); new.updated_at := now(); return new; end $$;
drop trigger if exists pg_docs_stamp on public.docs;
create trigger pg_docs_stamp before insert or update on public.docs for each row execute function public.pg_stamp();

-- Règles d'accès
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.pg_role() = 'admin');
drop policy if exists profiles_admin_upd on public.profiles;
create policy profiles_admin_upd on public.profiles for update using (public.pg_role() = 'admin') with check (public.pg_role() = 'admin');

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select using (public.pg_role() is not null);
drop policy if exists docs_write on public.docs;
create policy docs_write on public.docs for insert with check (public.pg_role() in ('admin','editeur'));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update using (public.pg_role() in ('admin','editeur')) with check (public.pg_role() in ('admin','editeur'));
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete using (public.pg_role() in ('admin','editeur'));

-- Temps réel sur les données
alter publication supabase_realtime add table public.docs;

-- Valider un collaborateur (en tant qu'admin) :
--   update public.profiles set approuve = true, role = 'editeur' where id = '<uuid>';
