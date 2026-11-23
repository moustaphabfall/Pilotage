import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ROLES = ['admin', 'editeur', 'lecteur'];
const PROGRAMMES = ['basique', 'medium', 'premium'];
const TYPES_UTILISATEUR = ['manager', 'collaborateur'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
function plusMonth(from: string): string { const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return iso(d); }
const clean2 = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const esc2 = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
const LOGO2 = Deno.env.get('SUPABASE_URL')! + '/functions/v1/logo';
const FROM2 = 'Been11 <bienvenue@been11.com>';
const APP2 = 'https://moustaphabfall.github.io/Pilotage/';

function calcHT(lignes: any[]): number { let ht = 0; (lignes || []).forEach((l: any) => { ht += (Number(l.qte) || 0) * (Number(l.prix) || 0) * (1 - (Number(l.remise) || 0) / 100); }); return Math.round(ht * 100) / 100; }
function numDevis(): string { const d = new Date(); return 'D-' + d.toISOString().slice(0, 7).replace('-', '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function numFacture(): string { const d = new Date(); return 'F-' + d.toISOString().slice(0, 7).replace('-', '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }

const shell2 = (inner: string) =>
  '<div style="background:#f4f1ea;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border-collapse:separate">' +
  '<tr><td style="background:#F5B000;height:10px;font-size:0;line-height:0">&nbsp;</td></tr>' +
  '<tr><td align="center" style="padding:24px 24px 4px"><img src="' + LOGO2 + '" width="92" height="92" alt="Been11" style="display:block;border-radius:20px;border:0"></td></tr>' + inner + '</table></div>';
const btn2 = (href: string, label: string) => '<tr><td align="center" style="padding:18px 28px 6px"><a href="' + href + '" style="display:block;background:#F5B000;color:#111;text-decoration:none;font-weight:700;font-size:16px;padding:15px 20px;border-radius:14px">' + label + '</a></td></tr>';
const mailDevis = (numero: string, montant: number) => shell2(
  '<tr><td style="padding:16px 28px 0;color:#2b2f35;font-size:16px;line-height:1.55;text-align:center"><h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#111">Nouveau devis Been11</h1><p style="margin:0">Le devis <b>' + esc2(numero) + '</b> (' + montant.toFixed(2) + ' € HT) vous attend dans votre espace Been11, rubrique « Mes devis & factures ».</p></td></tr>' +
  btn2(APP2, 'Me connecter à Been11') + '<tr><td style="height:24px"></td></tr>');
const mailFacture = (numero: string, montant: number) => shell2(
  '<tr><td style="padding:16px 28px 0;color:#2b2f35;font-size:16px;line-height:1.55;text-align:center"><h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#111">Nouvelle facture Been11</h1><p style="margin:0">La facture <b>' + esc2(numero) + '</b> (' + montant.toFixed(2) + ' € TTC) est disponible dans votre espace Been11, rubrique « Mes devis & factures ».</p></td></tr>' +
  btn2(APP2, 'Me connecter à Been11') + '<tr><td style="height:24px"></td></tr>');
async function sendResend2(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY'); if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ from: FROM2, to: [to], subject, html }) }).catch(() => null);
  return !!r && r.ok;
}

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
        const { data: ps } = await admin.from('profiles').select('id,nom,role,approuve,programme,programme_valide_jusqu');
        const pm = new Map((ps || []).map((p) => [p.id, p]));
        return J({ users: us.users.map((u) => ({ id: u.id, email: u.email, nom: pm.get(u.id)?.nom || '', role: pm.get(u.id)?.role || 'editeur', approuve: !!pm.get(u.id)?.approuve, programme: pm.get(u.id)?.programme || 'basique', programme_valide_jusqu: pm.get(u.id)?.programme_valide_jusqu || null, last_sign_in_at: u.last_sign_in_at, moi: u.id === user.id })) });
      }
      if (b.action === 'update') {
        if (b.id === user.id && (b.role !== undefined || b.approuve === false)) return J({ error: 'Vous ne pouvez pas modifier votre propre rôle ou accès' }, 400);
        const patch: Record<string, unknown> = {};
        if (b.role !== undefined && ROLES.includes(b.role)) patch.role = b.role;
        if (b.approuve !== undefined) patch.approuve = !!b.approuve;
        if (b.nom !== undefined) patch.nom = String(b.nom);
        /* forfait (crédits de projets/missions actifs) : réglable par le super-administrateur,
           normalement mis à jour automatiquement au paiement d'une facture (voir facture_payer) */
        if (b.programme !== undefined && PROGRAMMES.includes(b.programme)) patch.programme = b.programme;
        const { error } = await admin.from('profiles').update(patch).eq('id', b.id);
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true });
      }
      if (b.action === 'delete') {
        if (b.id === user.id) return J({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, 400);
        const { error } = await admin.auth.admin.deleteUser(b.id);
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true });
      }
      if (b.action === 'stats') {
        const { data: us, error } = await admin.auth.admin.listUsers({ perPage: 500 });
        if (error) throw error;
        const { data: ps } = await admin.from('profiles').select('id,nom,role,approuve,programme,programme_valide_jusqu');
        const pm = new Map((ps || []).map((p) => [p.id, p]));
        const users = us.users.map((u) => ({ id: u.id, email: u.email, nom: pm.get(u.id)?.nom || '', role: pm.get(u.id)?.role || 'editeur', approuve: !!pm.get(u.id)?.approuve, programme: pm.get(u.id)?.programme || 'basique', programme_valide_jusqu: pm.get(u.id)?.programme_valide_jusqu || null, last_sign_in_at: u.last_sign_in_at, moi: u.id === user.id }));
        const { data: projets } = await admin.from('projets').select('id,nom,cree_par,archive').order('created_at');
        const { data: membres } = await admin.from('projet_membres').select('projet_id,user_id,role,actif');
        const { data: activiteRaw } = await admin.from('pj_activite').select('user_id,projet_id,jour,clics,secondes,sessions,derniere');
        const activite = (activiteRaw || []).map((a) => ({ user_id: a.user_id, projet_id: a.projet_id, jour: a.jour, clics: a.clics || 0, secondes: a.secondes || 0, sessions: a.sessions || 0, derniere: a.derniere }));
        const { data: docsRaw } = await admin.from('docs').select('projet_id,data');
        const { data: mediaRaw } = await admin.from('media').select('projet_id,data');
        const rMap = new Map<string, { nb_docs: number; octets_donnees: number; nb_fichiers: number; octets_fichiers: number }>();
        const getR = (pid: string) => { let r = rMap.get(pid); if (!r) { r = { nb_docs: 0, octets_donnees: 0, nb_fichiers: 0, octets_fichiers: 0 }; rMap.set(pid, r); } return r; };
        (docsRaw || []).forEach((d) => { const r = getR(d.projet_id); r.nb_docs++; try { r.octets_donnees += JSON.stringify(d.data || {}).length; } catch (_e) { /* noop */ } });
        (mediaRaw || []).forEach((m) => { const r = getR(m.projet_id); r.nb_fichiers++; r.octets_fichiers += (m.data || '').length; });
        const ressources = Array.from(rMap.entries()).map(([projet_id, r]) => ({ projet_id, ...r }));
        return J({ users, projets: projets || [], membres: membres || [], activite, ressources });
      }
      /* ---------- Facturation (devis & factures) : un suivi par client payant (administrateur), accessible
         depuis la fiche de l'utilisateur dans le tableau de bord ---------- */
      if (b.action === 'devis_list') {
        const uid = String(b.user_id || ''); if (!uid) return J({ error: 'Client requis' }, 400);
        const { data: devis } = await admin.from('devis').select('*').eq('user_id', uid).order('created_at', { ascending: false });
        const { data: factures } = await admin.from('factures').select('*').eq('user_id', uid).order('created_at', { ascending: false });
        const { data: prof } = await admin.from('profiles').select('programme,programme_valide_jusqu').eq('id', uid).maybeSingle();
        return J({ devis: devis || [], factures: factures || [], profile: prof || null, today });
      }
      if (b.action === 'devis_create') {
        const uid = String(b.user_id || ''); if (!uid) return J({ error: 'Client requis' }, 400);
        const row = { numero: numDevis(), user_id: uid, cree_par: user.id, objet: clean2(b.objet, 200), periode_debut: b.periode_debut || null, periode_fin: b.periode_fin || null, programme_cible: PROGRAMMES.includes(b.programme_cible) ? b.programme_cible : null, lignes: Array.isArray(b.lignes) ? b.lignes : [], tva_taux: Number(b.tva_taux) || 0, notes: clean2(b.notes, 2000) };
        const { data, error } = await admin.from('devis').insert(row).select('*').single();
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true, devis: data });
      }
      if (b.action === 'devis_update') {
        const { data: d } = await admin.from('devis').select('statut').eq('id', b.id).maybeSingle();
        if (!d) return J({ error: 'Devis introuvable' }, 404);
        if (!['brouillon', 'envoye'].includes(d.statut)) return J({ error: 'Ce devis ne peut plus être modifié' }, 400);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (b.objet !== undefined) patch.objet = clean2(b.objet, 200);
        if (b.notes !== undefined) patch.notes = clean2(b.notes, 2000);
        if (b.periode_debut !== undefined) patch.periode_debut = b.periode_debut || null;
        if (b.periode_fin !== undefined) patch.periode_fin = b.periode_fin || null;
        if (b.programme_cible !== undefined) patch.programme_cible = PROGRAMMES.includes(b.programme_cible) ? b.programme_cible : null;
        if (b.lignes !== undefined) patch.lignes = Array.isArray(b.lignes) ? b.lignes : [];
        if (b.tva_taux !== undefined) patch.tva_taux = Number(b.tva_taux) || 0;
        const { error } = await admin.from('devis').update(patch).eq('id', b.id);
        if (error) return J({ error: error.message }, 400);
        return J({ ok: true });
      }
      if (b.action === 'devis_envoyer') {
        const { data: d } = await admin.from('devis').select('*').eq('id', b.id).maybeSingle();
        if (!d) return J({ error: 'Devis introuvable' }, 404);
        await admin.from('devis').update({ statut: 'envoye', envoye_le: new Date().toISOString() }).eq('id', b.id);
        const { data: gu } = await admin.auth.admin.getUserById(d.user_id);
        let envoi = false; if (gu?.user?.email) envoi = await sendResend2(gu.user.email, 'Been11 : devis ' + d.numero, mailDevis(d.numero, calcHT(d.lignes)));
        return J({ ok: true, envoi });
      }
      if (b.action === 'devis_contre_decision') {
        const { data: d } = await admin.from('devis').select('*').eq('id', b.id).maybeSingle();
        if (!d) return J({ error: 'Devis introuvable' }, 404);
        if (d.statut !== 'contre_propose') return J({ error: 'Pas de contre-proposition en attente' }, 400);
        if (b.accepter) {
          const lignes = (d.contre_proposition && d.contre_proposition.lignes) || d.lignes;
          await admin.from('devis').update({ statut: 'valide', lignes, valide_le: new Date().toISOString() }).eq('id', b.id);
        } else {
          await admin.from('devis').update({ statut: 'envoye' }).eq('id', b.id);
        }
        return J({ ok: true });
      }
      if (b.action === 'devis_valider_direct') {
        const { data: d } = await admin.from('devis').select('statut').eq('id', b.id).maybeSingle();
        if (!d) return J({ error: 'Devis introuvable' }, 404);
        if (d.statut === 'facture') return J({ error: 'Ce devis est déjà facturé' }, 400);
        await admin.from('devis').update({ statut: 'valide', valide_le: new Date().toISOString() }).eq('id', b.id);
        return J({ ok: true });
      }
      if (b.action === 'devis_facturer') {
        const { data: d } = await admin.from('devis').select('*').eq('id', b.id).maybeSingle();
        if (!d) return J({ error: 'Devis introuvable' }, 404);
        if (d.statut !== 'valide') return J({ error: 'Le devis doit être validé avant d’être facturé' }, 400);
        const ht = calcHT(d.lignes), tva = Math.round(ht * (d.tva_taux || 0)) / 100, ttc = Math.round((ht + tva) * 100) / 100;
        const row = { numero: numFacture(), devis_id: d.id, user_id: d.user_id, cree_par: user.id, lignes: d.lignes, tva_taux: d.tva_taux || 0, montant_ht: ht, montant_tva: tva, montant_ttc: ttc, periode_debut: d.periode_debut, periode_fin: d.periode_fin, programme_cible: d.programme_cible };
        const { data: f, error } = await admin.from('factures').insert(row).select('*').single();
        if (error) return J({ error: error.message }, 400);
        await admin.from('devis').update({ statut: 'facture' }).eq('id', b.id);
        const { data: gu } = await admin.auth.admin.getUserById(d.user_id);
        let envoi = false; if (gu?.user?.email) envoi = await sendResend2(gu.user.email, 'Been11 : facture ' + f.numero, mailFacture(f.numero, ttc));
        return J({ ok: true, facture: f, envoi });
      }
      if (b.action === 'facture_payer') {
        const { data: f } = await admin.from('factures').select('*').eq('id', b.id).maybeSingle();
        if (!f) return J({ error: 'Facture introuvable' }, 404);
        if (f.statut === 'payee') return J({ ok: true });
        await admin.from('factures').update({ statut: 'payee', payee_le: new Date().toISOString(), validee_par: user.id }).eq('id', b.id);
        const patch: Record<string, unknown> = {};
        if (f.programme_cible) patch.programme = f.programme_cible;
        if (f.periode_fin) {
          const { data: pr } = await admin.from('profiles').select('programme_valide_jusqu').eq('id', f.user_id).maybeSingle();
          const cur = pr?.programme_valide_jusqu as string | null;
          patch.programme_valide_jusqu = (cur && cur > f.periode_fin) ? cur : f.periode_fin;
        }
        if (Object.keys(patch).length) await admin.from('profiles').update(patch).eq('id', f.user_id);
        return J({ ok: true });
      }
      return J({ error: 'Action inconnue' }, 400);
    }

    /* ---------- Actions par projet ---------- */
    const pid = String(b.projet || 'SM');
    /* contexte affiché à la personne invitée : application, projet, administrateur qui l'invite */
    const { data: _ap } = await admin.from('profiles').select('nom').eq('id', user.id).maybeSingle();
    const { data: _pj } = await admin.from('projets').select('nom').eq('id', pid).maybeSingle();
    const invMeta = { app: 'Pilotage Chantier', projet: _pj?.nom || pid, invite_par: _ap?.nom || user.email || '', invite_par_email: user.email || '' };
    const ROLE_LBL: Record<string, string> = { admin: 'Administrateur du workspace', editeur: 'Éditeur', lecteur: 'Lecteur' };
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
      const { data: ms } = await admin.from('projet_membres').select('user_id,role,fonctions,valide_jusqu,actif,type_utilisateur').eq('projet_id', pid);
      const { data: ps } = await admin.from('profiles').select('id,nom');
      const pm = new Map((ps || []).map((p) => [p.id, p.nom]));
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      const em = new Map((us?.users || []).map((u) => [u.id, u.email]));
      const cf = new Map((us?.users || []).map((u) => [u.id, !!u.email_confirmed_at]));
      const { data: pay } = await admin.from('projet_paiements').select('user_id,valide_le,du,au,montant,reference').eq('projet_id', pid).order('valide_le', { ascending: false });
      const { data: nt } = await admin.from('projet_notifs').select('id,user_id,type,echeance,lu,traite').eq('projet_id', pid).eq('traite', false).order('echeance');
      /* quota de facturation (manager/collaborateur) : porté par le compte payant propriétaire du
         workspace (projets.cree_par) — un siège classé par espace ouvert de ce compte, voir dictée
         Moustapha du 23/11/2026 */
      let quota: { ouverts: number; classes: number } | null = null;
      const { data: pjOwn } = await admin.from('projets').select('cree_par').eq('id', pid).maybeSingle();
      if (pjOwn?.cree_par) {
        const { data: mesProjets } = await admin.from('projets').select('id').eq('cree_par', pjOwn.cree_par).eq('archive', false);
        const ids = (mesProjets || []).map((p) => p.id);
        let classes = 0;
        if (ids.length) {
          const { count } = await admin.from('projet_membres').select('user_id', { count: 'exact', head: true }).in('projet_id', ids).not('type_utilisateur', 'is', null);
          classes = count || 0;
        }
        quota = { ouverts: ids.length, classes };
      }
      return J({
        today,
        quota,
        members: (ms || []).map((m) => ({ ...m, nom: pm.get(m.user_id) || '', email: em.get(m.user_id) || '', confirme: cf.get(m.user_id) !== false, moi: m.user_id === user.id, dernier_paiement: (pay || []).find((p) => p.user_id === m.user_id) || null })),
        notifs: (nt || []).map((n) => ({ ...n, nom: pm.get(n.user_id) || '', email: em.get(n.user_id) || '' })),
      });
    }
    if (b.action === 'p_create') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!email) return J({ error: 'E-mail (identifiant) requis' }, 400);
      const role = ROLES.includes(b.role) ? b.role : 'editeur';
      let uid: string | null = null;
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      const ex = us?.users.find((u) => (u.email || '').toLowerCase() === email);
      if (ex) { uid = ex.id; }
      else if (b.invite === true) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: b.redirectTo ? String(b.redirectTo) : undefined, data: { nom: b.nom || '', role, role_label: ROLE_LBL[role] || role, ...invMeta } });
        if (error) return J({ error: 'Invitation non envoyée : ' + error.message }, 400);
        uid = data.user!.id;
        await admin.from('profiles').upsert({ id: uid, nom: b.nom || email, role: 'editeur', approuve: true });
      } else {
        const rnd = crypto.randomUUID() + crypto.randomUUID();   // jamais communiqué à personne
        const { data, error } = await admin.auth.admin.createUser({ email, password: rnd, email_confirm: true, user_metadata: { nom: b.nom || email } });
        if (error) return J({ error: error.message }, 400);
        uid = data.user!.id;
        await admin.from('profiles').upsert({ id: uid, nom: b.nom || email, role: 'editeur', approuve: true });
      }
      const { data: dej } = await admin.from('projet_membres').select('user_id').eq('projet_id', pid).eq('user_id', uid).maybeSingle();
      if (dej) return J({ error: 'Cet utilisateur a déjà un accès à ce projet (utilisez « Prolonger »)' }, 400);
      const au = plusMonth(today);
      const fonctionTxt = (b.fonctions && b.fonctions._role) || null;
      const { error: e1 } = await admin.from('projet_membres').insert({ projet_id: pid, user_id: uid, role, fonctions: b.fonctions || {}, fonction: fonctionTxt, valide_jusqu: au, actif: true });
      if (e1) return J({ error: e1.message }, 400);
      await admin.from('projet_paiements').insert({ projet_id: pid, user_id: uid, valide_par: user.id, du: today, au, montant: b.paiement?.montant ?? null, reference: b.paiement?.reference ?? null });
      return J({ ok: true, id: uid, valide_jusqu: au, existant: !!ex, invitation: b.invite === true && !ex });
    }
    if (b.action === 'p_resend') {
      const { data: m } = await admin.from('projet_membres').select('user_id,role').eq('projet_id', pid).eq('user_id', b.user_id).maybeSingle();
      if (!m) return J({ error: 'Membre introuvable' }, 404);
      const { data: gu, error: ge } = await admin.auth.admin.getUserById(b.user_id);
      if (ge || !gu?.user?.email) return J({ error: 'Utilisateur introuvable' }, 404);
      if (gu.user.email_confirmed_at) return J({ error: 'Ce compte est déjà activé : utilisez « Réinitialiser le compte » pour que la personne choisisse un nouveau mot de passe.' }, 400);
      const { error } = await admin.auth.admin.inviteUserByEmail(gu.user.email, { redirectTo: b.redirectTo ? String(b.redirectTo) : undefined, data: { nom: gu.user.user_metadata?.nom || '', role: m.role, role_label: ROLE_LBL[m.role] || m.role, ...invMeta } });
        if (error) return J({ error: 'Invitation non renvoyée : ' + error.message }, 400);
      return J({ ok: true });
    }
    if (b.action === 'p_update') {
      const patch: Record<string, unknown> = {};
      if (b.role !== undefined && ROLES.includes(b.role)) patch.role = b.role;
      if (b.fonctions !== undefined) { patch.fonctions = b.fonctions; patch.fonction = b.fonctions._role || null; }
      if (b.actif !== undefined) patch.actif = !!b.actif;
      /* classification Manager / Collaborateur (tarification) : réglée par l'administrateur du
         workspace lui-même, membre par membre — plus par le super-administrateur, voir dictée du 23/11/2026 */
      if (b.type_utilisateur !== undefined) {
        if (b.type_utilisateur === null || b.type_utilisateur === '') patch.type_utilisateur = null;
        else if (TYPES_UTILISATEUR.includes(b.type_utilisateur)) patch.type_utilisateur = b.type_utilisateur;
      }
      if (b.user_id === user.id && !isGlobal && (patch.role !== undefined || patch.actif === false)) return J({ error: 'Vous ne pouvez pas modifier votre propre rôle' }, 400);
      const { error } = await admin.from('projet_membres').update(patch).eq('projet_id', pid).eq('user_id', b.user_id);
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true });
    }
    if (b.action === 'p_prolong') {
      const { data: m } = await admin.from('projet_membres').select('valide_jusqu').eq('projet_id', pid).eq('user_id', b.user_id).maybeSingle();
      if (!m) return J({ error: 'Membre introuvable' }, 404);
      const du = m.valide_jusqu && m.valide_jusqu >= today ? m.valide_jusqu : today;
      const au = plusMonth(du);
      await admin.from('projet_membres').update({ valide_jusqu: au, actif: true }).eq('projet_id', pid).eq('user_id', b.user_id);
      await admin.from('projet_paiements').insert({ projet_id: pid, user_id: b.user_id, valide_par: user.id, du, au, montant: b.paiement?.montant ?? null, reference: b.paiement?.reference ?? null });
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
    if (b.action === 'p_reset') {
      /* l'administrateur ne voit ni ne choisit jamais un mot de passe : il déclenche seulement l'envoi d'un lien de réinitialisation à la personne */
      const { data: m } = await admin.from('projet_membres').select('user_id').eq('projet_id', pid).eq('user_id', b.user_id).maybeSingle();
      if (!m) return J({ error: 'Membre introuvable' }, 404);
      const { data: gu, error: ge } = await admin.auth.admin.getUserById(b.user_id);
      if (ge || !gu?.user?.email) return J({ error: 'Utilisateur introuvable' }, 404);
      const { error } = await admin.auth.resetPasswordForEmail(gu.user.email, { redirectTo: b.redirectTo ? String(b.redirectTo) : undefined });
      if (error) return J({ error: 'E-mail non envoyé : ' + error.message }, 400);
      return J({ ok: true, email: gu.user.email });
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
