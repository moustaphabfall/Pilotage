import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ROLES = ['admin', 'editeur', 'lecteur'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
function plusMonth(from: string): string { const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return iso(d); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return J({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('profiles').select('role,approuve').eq('id', user.id).maybeSingle();
    if (!me || !me.approuve) return J({ error: 'Compte non validé' }, 403);
    const isGlobal = me.role === 'admin';
    const b = await req.json();
    const today = iso(new Date());

    /* ---------- Actions globales (administrateur général) ---------- */
    if (!String(b.action).startsWith('p_')) {
      if (!isGlobal) return J({ error: 'Réservé aux administrateurs' }, 403);
      if (b.action === 'list') {
        const { data: us, error } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (error) throw error;
        const { data: ps } = await admin.from('profiles').select('id,nom,role,approuve');
        const pm = new Map((ps || []).map((p) => [p.id, p]));
        return J({ users: us.users.map((u) => ({ id: u.id, email: u.email, nom: pm.get(u.id)?.nom || '', role: pm.get(u.id)?.role || 'editeur', approuve: !!pm.get(u.id)?.approuve, last_sign_in_at: u.last_sign_in_at, moi: u.id === user.id })) });
      }
      if (b.action === 'update') {
        if (b.id === user.id && (b.role !== undefined || b.approuve === false)) return J({ error: 'Vous ne pouvez pas modifier votre propre rôle ou accès' }, 400);
        const patch: Record<string, unknown> = {};
        if (b.role !== undefined && ROLES.includes(b.role)) patch.role = b.role;
        if (b.approuve !== undefined) patch.approuve = !!b.approuve;
        if (b.nom !== undefined) patch.nom = String(b.nom);
        const { error } = await admin.from('profiles').update(patch).eq('id', b.id);
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true });
      }
      if (b.action === 'password') {
        if (String(b.password || '').length < 8) return J({ error: 'Mot de passe : 8 caractères min.' }, 400);
        const { error } = await admin.auth.admin.updateUserById(b.id, { password: String(b.password) });
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true });
      }
      if (b.action === 'delete') {
        if (b.id === user.id) return J({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, 400);
        const { error } = await admin.auth.admin.deleteUser(b.id);
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true });
      }
      return J({ error: 'Action inconnue' }, 400);
    }

    /* ---------- Actions par projet ---------- */
    const pid = String(b.projet || 'SM');
    if (b.action === 'p_projets') {
      if (isGlobal) { const { data } = await admin.from('projets').select('id,nom').order('created_at'); return J({ projets: data || [] }); }
      const { data } = await admin.from('projet_membres').select('projet_id,projets(id,nom)').eq('user_id', user.id).eq('actif', true);
      return J({ projets: (data || []).map((r: any) => r.projets).filter(Boolean) });
    }
    if (b.action === 'p_projet_create') {
      if (!isGlobal) return J({ error: 'Réservé à l’administrateur général' }, 403);
      const id = String(b.id || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''), nom = String(b.nom || id).trim();
      if (!id) return J({ error: 'Identifiant du projet requis' }, 400);
      const { error } = await admin.from('projets').insert({ id, nom, cree_par: user.id });
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true, id });
    }

    /* droits sur le projet : administrateur général ou administrateur du projet */
    let canAdm = isGlobal;
    if (!canAdm) {
      const { data: m } = await admin.from('projet_membres').select('role,actif').eq('projet_id', pid).eq('user_id', user.id).maybeSingle();
      canAdm = !!(m && m.actif && m.role === 'admin');
    }
    if (!canAdm) return J({ error: 'Réservé à l’administrateur du projet' }, 403);

    if (b.action === 'p_projet_rename') {
      const { error } = await admin.from('projets').update({ nom: String(b.nom || '').trim() || pid }).eq('id', pid);
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true });
    }
    if (b.action === 'p_members') {
      await admin.rpc('pg_check_echeances');
      const { data: ms } = await admin.from('projet_membres').select('user_id,role,fonctions,valide_jusqu,actif').eq('projet_id', pid);
      const { data: ps } = await admin.from('profiles').select('id,nom');
      const pm = new Map((ps || []).map((p) => [p.id, p.nom]));
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      const em = new Map((us?.users || []).map((u) => [u.id, u.email]));
      const cf = new Map((us?.users || []).map((u) => [u.id, !!u.email_confirmed_at]));
      const { data: pay } = await admin.from('projet_paiements').select('user_id,valide_le,du,au,montant,reference').eq('projet_id', pid).order('valide_le', { ascending: false });
      const { data: nt } = await admin.from('projet_notifs').select('id,user_id,type,echeance,lu,traite').eq('projet_id', pid).eq('traite', false).order('echeance');
      return J({
        today,
        members: (ms || []).map((m) => ({ ...m, nom: pm.get(m.user_id) || '', email: em.get(m.user_id) || '', confirme: cf.get(m.user_id) !== false, moi: m.user_id === user.id, dernier_paiement: (pay || []).find((p) => p.user_id === m.user_id) || null })),
        notifs: (nt || []).map((n) => ({ ...n, nom: pm.get(n.user_id) || '', email: em.get(n.user_id) || '' })),
      });
    }
    if (b.action === 'p_create') {
      if (!b.paiement || b.paiement.valide !== true) return J({ error: 'Paiement non validé : l’accès ne peut pas être créé' }, 400);
      const email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
      if (!email) return J({ error: 'E-mail (identifiant) requis' }, 400);
      const role = ROLES.includes(b.role) ? b.role : 'editeur';
      let uid: string | null = null;
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      const ex = us?.users.find((u) => (u.email || '').toLowerCase() === email);
      if (ex) { uid = ex.id; }
      else if (b.invite === true) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: b.redirectTo ? String(b.redirectTo) : undefined, data: { nom: b.nom || email } });
        if (error) return J({ error: 'Invitation non envoyée : ' + error.message }, 400);
        uid = data.user!.id;
        await admin.from('profiles').upsert({ id: uid, nom: b.nom || email, role: 'editeur', approuve: true });
      } else {
        if (password.length < 8) return J({ error: 'Mot de passe : 8 caractères min.' }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nom: b.nom || email } });
        if (error) return J({ error: error.message }, 400);
        uid = data.user!.id;
        await admin.from('profiles').upsert({ id: uid, nom: b.nom || email, role: 'editeur', approuve: true });
      }
      const { data: dej } = await admin.from('projet_membres').select('user_id').eq('projet_id', pid).eq('user_id', uid).maybeSingle();
      if (dej) return J({ error: 'Cet utilisateur a déjà un accès à ce projet (utilisez « Prolonger »)' }, 400);
      const au = plusMonth(today);
      const { error: e1 } = await admin.from('projet_membres').insert({ projet_id: pid, user_id: uid, role, fonctions: b.fonctions || {}, valide_jusqu: au, actif: true });
      if (e1) return J({ error: e1.message }, 400);
      await admin.from('projet_paiements').insert({ projet_id: pid, user_id: uid, valide_par: user.id, du: today, au, montant: b.paiement.montant ?? null, reference: b.paiement.reference ?? null });
      return J({ ok: true, id: uid, valide_jusqu: au, existant: !!ex, invitation: b.invite === true && !ex });
    }
    if (b.action === 'p_resend') {
      const { data: m } = await admin.from('projet_membres').select('user_id').eq('projet_id', pid).eq('user_id', b.user_id).maybeSingle();
      if (!m) return J({ error: 'Membre introuvable' }, 404);
      const { data: gu, error: ge } = await admin.auth.admin.getUserById(b.user_id);
      if (ge || !gu?.user?.email) return J({ error: 'Utilisateur introuvable' }, 404);
      if (gu.user.email_confirmed_at) return J({ error: 'Ce compte est déjà activé : la personne peut utiliser « Mot de passe oublié » sur l’écran de connexion.' }, 400);
      const { error } = await admin.auth.admin.inviteUserByEmail(gu.user.email, { redirectTo: b.redirectTo ? String(b.redirectTo) : undefined, data: { nom: gu.user.user_metadata?.nom || gu.user.email } });
      if (error) return J({ error: 'Invitation non renvoyée : ' + error.message }, 400);
      return J({ ok: true });
    }
    if (b.action === 'p_update') {
      const patch: Record<string, unknown> = {};
      if (b.role !== undefined && ROLES.includes(b.role)) patch.role = b.role;
      if (b.fonctions !== undefined) patch.fonctions = b.fonctions;
      if (b.actif !== undefined) patch.actif = !!b.actif;
      if (b.user_id === user.id && !isGlobal && (patch.role !== undefined || patch.actif === false)) return J({ error: 'Vous ne pouvez pas modifier votre propre rôle' }, 400);
      const { error } = await admin.from('projet_membres').update(patch).eq('projet_id', pid).eq('user_id', b.user_id);
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true });
    }
    if (b.action === 'p_prolong') {
      if (!b.paiement || b.paiement.valide !== true) return J({ error: 'Paiement non validé : l’accès n’est pas prolongé' }, 400);
      const { data: m } = await admin.from('projet_membres').select('valide_jusqu').eq('projet_id', pid).eq('user_id', b.user_id).maybeSingle();
      if (!m) return J({ error: 'Membre introuvable' }, 404);
      const du = m.valide_jusqu && m.valide_jusqu >= today ? m.valide_jusqu : today;
      const au = plusMonth(du);
      await admin.from('projet_membres').update({ valide_jusqu: au, actif: true }).eq('projet_id', pid).eq('user_id', b.user_id);
      await admin.from('projet_paiements').insert({ projet_id: pid, user_id: b.user_id, valide_par: user.id, du, au, montant: b.paiement.montant ?? null, reference: b.paiement.reference ?? null });
      await admin.from('projet_notifs').update({ traite: true, lu: true }).eq('projet_id', pid).eq('user_id', b.user_id);
      return J({ ok: true, valide_jusqu: au });
    }
    if (b.action === 'p_expire') {
      await admin.from('projet_notifs').update({ traite: true, lu: true }).eq('projet_id', pid).eq('user_id', b.user_id);
      return J({ ok: true });
    }
    if (b.action === 'p_notif_lu') {
      await admin.from('projet_notifs').update({ lu: true }).eq('projet_id', pid);
      return J({ ok: true });
    }
    if (b.action === 'p_password') {
      if (String(b.password || '').length < 8) return J({ error: 'Mot de passe : 8 caractères min.' }, 400);
      const { data: m } = await admin.from('projet_membres').select('user_id').eq('projet_id', pid).eq('user_id', b.user_id).maybeSingle();
      if (!m) return J({ error: 'Membre introuvable' }, 404);
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: String(b.password) });
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true });
    }
    if (b.action === 'p_remove') {
      if (b.user_id === user.id) return J({ error: 'Vous ne pouvez pas retirer votre propre accès' }, 400);
      await admin.from('projet_membres').delete().eq('projet_id', pid).eq('user_id', b.user_id);
      const { count } = await admin.from('projet_membres').select('user_id', { count: 'exact', head: true }).eq('user_id', b.user_id);
      const { data: pr } = await admin.from('profiles').select('role').eq('id', b.user_id).maybeSingle();
      if (!count && pr && pr.role !== 'admin') await admin.auth.admin.deleteUser(b.user_id);
      return J({ ok: true });
    }
    return J({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return J({ error: String((e as Error).message || e) }, 500);
  }
});
