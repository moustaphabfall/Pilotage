-- Limite d'usage de l'assistant IA (fonction « fiche-ia »). À exécuter UNE FOIS dans l'éditeur SQL Supabase, AVANT de redéployer la fonction.
-- Principe : chaque utilisateur, sur chaque projet, a une ligne dans ia_acces. La première demande IA crée la ligne en « attente »
-- (c'est la demande d'autorisation vue par le super administrateur). Accord : la limite d'appels est fixée (réglable). Refus : bloqué.
-- Au-delà de la limite : refus. Le super administrateur (profiles.role = 'admin') n'est jamais limité. Tout passe par la clé de service :
-- aucune lecture ni écriture directe depuis le navigateur.

create table if not exists public.ia_reglages (
  id integer primary key default 1 check (id = 1),
  limite_defaut integer not null default 10 check (limite_defaut >= 0 and limite_defaut <= 100000),
  updated_at timestamptz not null default now()
);
insert into public.ia_reglages (id) values (1) on conflict (id) do nothing;

create table if not exists public.ia_acces (
  user_id uuid not null references auth.users(id) on delete cascade,
  projet_id text not null,
  statut text not null default 'attente' check (statut in ('attente', 'accepte', 'refuse')),
  limite integer not null default 0 check (limite >= 0 and limite <= 100000),
  utilise integer not null default 0 check (utilise >= 0),
  nom text not null default '',
  email text not null default '',
  demande_le timestamptz not null default now(),
  decide_le timestamptz,
  decide_par uuid,
  dernier_appel timestamptz,
  primary key (user_id, projet_id)
);
create index if not exists ia_acces_statut_idx on public.ia_acces (statut, demande_le);

alter table public.ia_reglages enable row level security;
alter table public.ia_acces enable row level security;
revoke all on public.ia_reglages from anon, authenticated;
revoke all on public.ia_acces from anon, authenticated;

-- Compte un appel de façon atomique. Renvoie {statut, limite, utilise, autorise, cree}.
-- La limite d'un accord donné sans chiffre est la limite par défaut (ia_reglages.limite_defaut).
create or replace function public.ia_consommer(p_user uuid, p_projet text, p_nom text, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.ia_acces; n integer := 0; cree boolean := false; ok boolean := false;
begin
  insert into public.ia_acces (user_id, projet_id, nom, email, limite)
    values (p_user, p_projet, coalesce(p_nom, ''), coalesce(p_email, ''), (select limite_defaut from public.ia_reglages where id = 1))
    on conflict (user_id, projet_id) do nothing;
  get diagnostics n = row_count;
  cree := (n > 0);
  select * into r from public.ia_acces where user_id = p_user and projet_id = p_projet for update;
  if r.statut = 'accepte' and r.utilise < r.limite then
    update public.ia_acces set utilise = utilise + 1, dernier_appel = now() where user_id = p_user and projet_id = p_projet returning * into r;
    ok := true;
  end if;
  return jsonb_build_object('statut', r.statut, 'limite', r.limite, 'utilise', r.utilise, 'autorise', ok, 'cree', cree);
end $$;

-- Rend un appel quand l'IA a échoué côté serveur (l'utilisateur n'est pas pénalisé).
create or replace function public.ia_rembourser(p_user uuid, p_projet text) returns void
language sql security definer set search_path = public as $$
  update public.ia_acces set utilise = greatest(utilise - 1, 0) where user_id = p_user and projet_id = p_projet and statut = 'accepte';
$$;

revoke all on function public.ia_consommer(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.ia_rembourser(uuid, text) from public, anon, authenticated;
grant execute on function public.ia_consommer(uuid, text, text, text) to service_role;
grant execute on function public.ia_rembourser(uuid, text) to service_role;
