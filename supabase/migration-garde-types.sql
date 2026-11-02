-- À exécuter dans l'éditeur SQL Supabase : seul le super administrateur peut autoriser des types d'espace.
create or replace function public.projets_garde_types() returns trigger language plpgsql security definer set search_path=public as $$
declare glob boolean;
begin
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.approuve) into glob;
  if glob or auth.uid() is null then return new; end if;
  if new.types_autorises is distinct from old.types_autorises then
    raise exception 'Seul le super administrateur peut autoriser des types d''espace';
  end if;
  if new.type is distinct from old.type and new.types_autorises is not null and not (new.type = any(new.types_autorises)) then
    raise exception 'Ce type d''espace n''est pas autorisé pour ce projet';
  end if;
  return new;
end $$;
drop trigger if exists projets_garde_types on public.projets;
create trigger projets_garde_types before update on public.projets for each row execute function public.projets_garde_types();
