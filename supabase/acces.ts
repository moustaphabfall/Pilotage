import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const APP = 'https://moustaphabfall.github.io/Pilotage/';
const LOGO = Deno.env.get('SUPABASE_URL')! + '/functions/v1/logo';
const FROM = 'Been11 <bienvenue@been11.com>';
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
const baseUrl = (r: unknown) => { const s = String(r || ''); return s.startsWith('https://moustaphabfall.github.io/') ? s.split('?')[0].split('#')[0] : APP; };

/* Types d'espace (workspace) proposés dans la demande d'accès publique et affichés à l'administrateur */
const TY_ACR: Record<string, string> = { architecte: 'ARC', bureau_etudes: 'BE', entreprise_generale: 'EG', ces: 'CES', nettoyage: 'NET' };
const TY_LBL: Record<string, string> = { architecte: 'Architecte', bureau_etudes: 'Bureau d’études', entreprise_generale: 'Entreprise générale', ces: 'Corps d’état secondaire', nettoyage: 'Nettoyage industriel' };
const tyTxt = (t: string) => t && TY_LBL[t] ? TY_ACR[t] + ' (' + TY_LBL[t] + ')' : '';

const shell = (inner: string) =>
  '<div style="background:#f4f1ea;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border-collapse:separate">' +
  '<tr><td style="background:#F5B000;height:10px;font-size:0;line-height:0">&nbsp;</td></tr>' +
  '<tr><td align="center" style="padding:24px 24px 4px"><img src="' + LOGO + '" width="92" height="92" alt="Been11" style="display:block;border-radius:20px;border:0"></td></tr>' + inner + '</table></div>';
const btn = (href: string, label: string) => '<tr><td align="center" style="padding:18px 28px 6px"><a href="' + href + '" style="display:block;background:#F5B000;color:#111;text-decoration:none;font-weight:700;font-size:16px;padding:15px 20px;border-radius:14px">' + label + '</a></td></tr>';

const mailDemande = (email: string, tel: string, nom: string, type: string, link: string) => shell(
  '<tr><td style="padding:16px 28px 0;color:#2b2f35;font-size:16px;line-height:1.55"><h1 style="margin:0 0 12px;font-size:21px;line-height:1.25;color:#111;text-align:center">Nouvelle demande d’accès</h1>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5ef;border-radius:14px"><tr><td style="padding:14px 16px;font-size:15px;line-height:1.7">' +
  (nom && nom !== '-' ? '<span style="color:#6b6f76">Nom</span><br><b>' + esc(nom) + '</b><br>' : '') + '<span style="color:#6b6f76">E-mail</span><br><b>' + esc(email) + '</b>' + (tel ? '<br><span style="color:#6b6f76">Téléphone</span><br><b>' + esc(tel) + '</b>' : '') +
  (tyTxt(type) ? '<br><span style="color:#6b6f76">Type d’espace souhaité</span><br><b>' + esc(tyTxt(type)) + '</b>' : '') +
  '</td></tr></table></td></tr>' + btn(link, 'Ouvrir et accorder l’accès') + '<tr><td style="height:24px"></td></tr>');

const mailInvit = (par: string, link: string) => shell(
  '<tr><td style="padding:16px 28px 0;color:#2b2f35;font-size:16px;line-height:1.55;text-align:center"><h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#111">Invitation à rejoindre Been11</h1><p style="margin:0">' +
  (par ? '<b>' + esc(par) + '</b> vous invite' : 'Vous êtes invité(e)') + ' à rejoindre <b>Been11</b>.</p></td></tr>' + btn(link, 'Accepter l’invitation') +
  '<tr><td style="padding:14px 28px 24px;color:#9a9da3;font-size:12px;line-height:1.5;text-align:center">Ce lien est valable 24 heures, jusqu’à ce que vous ayez choisi votre mot de passe.<br>Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">' + esc(link) + '</span></td></tr>');

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

async function sendResend(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY'); if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ from: FROM, to: [to], subject, html }) }).catch(() => null);
  return !!r && r.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const b = await req.json();
    const today = iso(new Date());

    /* ---------- Public : demande d'accès ---------- */
    if (b.action === 'demande') {
      const email = clean(b.email, 160).toLowerCase(), tel = clean(b.telephone, 40), nom = clean(b.nom, 80), type = TY_LBL[clean(b.type, 40)] ? clean(b.type, 40) : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return J({ error: 'Adresse e-mail invalide' }, 400);
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await admin.from('acces_demandes').select('id', { count: 'exact', head: true }).gte('created_at', since);
      if ((count || 0) > 30) return J({ error: 'Trop de demandes pour le moment, réessayez plus tard' }, 429);
      const { data: dej } = await admin.from('acces_demandes').select('id').eq('email', email).eq('statut', 'nouvelle').maybeSingle();
      if (dej) return J({ ok: true });
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      if (us?.users.some((u) => (u.email || '').toLowerCase() === email)) return J({ ok: true, existe: true });
      const { data: row, error } = await admin.from('acces_demandes').insert({ email, telephone: tel || null, nom: nom || null, type: type || null }).select('id').single();
      if (error) return J({ error: error.message }, 400);
      let envoi = 'aucun';
      try {
        const { data: ps } = await admin.from('profiles').select('id').eq('role', 'admin').eq('approuve', true);
        const link = baseUrl(b.redirectTo) + '?demande=' + row.id;
        for (const p of ps || []) {
          const { data: gu } = await admin.auth.admin.getUserById(p.id);
          const to = gu?.user?.email; if (!to) continue;
          let ok = await sendResend(to, 'Been11 : demande d’accès de ' + (nom || email), mailDemande(email, tel, nom, type, link));
          if (ok) envoi = 'resend';
          if (!ok) {
            await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
              method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ _subject: 'Been11 : demande d’accès de ' + (nom || email), _template: 'box', _captcha: 'false', e_mail: email, nom: nom || '-', type_d_espace: tyTxt(type) || '-', ouvrir_et_accorder: link }),
            }).catch(() => null);
            if (envoi === 'aucun') envoi = 'formsubmit';
          }
        }
      } catch (_) { /* la notification dans l'application reste disponible */ }
      return J({ ok: true, envoi });
    }

    /* ---------- Public : lien d'invitation (valable 24 h, tant qu'aucun mot de passe n'est choisi) ---------- */
    if (b.action === 'invit_info' || b.action === 'invit_set') {
      const tok = clean(b.token, 80);
      const { data: iv } = await admin.from('invitations').select('user_id,expire,utilise').eq('token', tok).maybeSingle();
      if (!iv) return J({ error: 'Lien invalide' }, 400);
      if (iv.utilise) return J({ error: 'Ce lien a déjà été utilisé : votre mot de passe est choisi. Connectez-vous.', code: 'utilise' }, 400);
      if (new Date(iv.expire).getTime() < Date.now()) return J({ error: 'Ce lien a expiré (24 heures). Demandez un nouveau lien à l’administrateur.', code: 'expire' }, 400);
      const { data: gu } = await admin.auth.admin.getUserById(iv.user_id);
      const u = gu?.user; if (!u) return J({ error: 'Compte introuvable' }, 404);
      if (b.action === 'invit_info') return J({ ok: true, email: u.email, nom: (u.user_metadata as any)?.nom || '', par: (u.user_metadata as any)?.invite_par || '' });
      const pw = String(b.password || '');
      if (pw.length < 8) return J({ error: 'Mot de passe : 8 caractères minimum' }, 400);
      const { error } = await admin.auth.admin.updateUserById(iv.user_id, { password: pw, email_confirm: true, user_metadata: { ...(u.user_metadata || {}), mdp_ok: true } });
      if (error) return J({ error: error.message }, 400);
      await admin.from('invitations').update({ utilise: true }).eq('user_id', iv.user_id);
      return J({ ok: true, email: u.email });
    }

    /* ---------- Authentifié ---------- */
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return J({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('profiles').select('role,approuve,nom,essai,programme').eq('id', user.id).maybeSingle();
    if (!me || !me.approuve) return J({ error: 'Compte non validé' }, 403);
    const isGlobal = me.role === 'admin';

    /* crédits par forfait : nombre de projets/missions actifs en même temps (l'administrateur
       général n'est jamais limité) — basique 5, medium 15, premium illimité */
    const CREDITS: Record<string, number> = { basique: 5, medium: 15 };
    if (b.action === 'essai_projet_create') {
      if (!isGlobal) {
        const programme = me.programme || 'basique';
        if (programme !== 'premium') {
          const { count: actifs } = await admin.from('projets').select('id', { count: 'exact', head: true }).eq('cree_par', user.id).eq('archive', false);
          const max = CREDITS[programme] ?? 5;
          if ((actifs || 0) >= max) return J({ error: 'Vous avez atteint la limite de ' + max + ' projets/missions actifs de votre forfait « ' + programme + ' ». Archivez un projet existant ou passez à une offre supérieure pour en créer un nouveau.', code: 'limite_credits', programme, max, actifs: actifs || 0 }, 403);
        }
      }
      const nom = clean(b.nom, 80); if (!nom) return J({ error: 'Nom du projet requis' }, 400);
      const base = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PROJET';
      let id = base;
      for (let i = 0; i < 6; i++) { const { data: ex } = await admin.from('projets').select('id').eq('id', id).maybeSingle(); if (!ex) break; id = base + Math.floor(100 + Math.random() * 900); }
      const { error } = await admin.from('projets').insert({ id, nom, cree_par: user.id });
      if (error) return J({ error: error.message }, 400);
      const { error: e2 } = await admin.from('projet_membres').upsert({ projet_id: id, user_id: user.id, role: 'admin', fonctions: {}, valide_jusqu: null, actif: true });
      if (e2) return J({ error: e2.message }, 400);
      return J({ ok: true, id });
    }

    if (!isGlobal) return J({ error: 'Réservé à l’administrateur général' }, 403);
    const invPar = me.nom || user.email || '';

    if (b.action === 'resume') {
      const a = await admin.from('acces_demandes').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle');
      const e = await admin.from('evaluations').select('id', { count: 'exact', head: true }).eq('lu', false);
      return J({ demandes: a.count || 0, evaluations: e.count || 0 });
    }
    if (b.action === 'demandes') {
      const { data } = await admin.from('acces_demandes').select('*').order('created_at', { ascending: false }).limit(100);
      return J({ demandes: data || [] });
    }
    if (b.action === 'demande_refuser') {
      await admin.from('acces_demandes').update({ statut: 'refusee', lu: true, traite_le: new Date().toISOString() }).eq('id', b.id);
      return J({ ok: true });
    }
    /* crée un lien d'invitation (24 h) et l'envoie par e-mail */
    const envoyerLien = async (uid: string, email: string, redirectTo?: string) => {
      await admin.from('invitations').delete().eq('user_id', uid);
      const tok = hex(32), expire = new Date(Date.now() + 24 * 3600_000).toISOString();
      const { error } = await admin.from('invitations').insert({ token: tok, user_id: uid, expire });
      if (error) return { error: error.message };
      const link = baseUrl(redirectTo) + '?invit=' + tok;
      const ok = await sendResend(email, 'Invitation à rejoindre Been11', mailInvit(invPar, link));
      if (!ok) return { error: 'Invitation non envoyée : l’e-mail n’a pas pu partir' };
      return { ok: true };
    };
    const ouvrir = async (emailIn: string, nomIn: string, tel: string | null, redirectTo?: string) => {
      const email = clean(emailIn, 160).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Adresse e-mail invalide' };
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      if (us?.users.some((u) => (u.email || '').toLowerCase() === email)) return { error: 'Un compte existe déjà avec cette adresse' };
      const nom = clean(nomIn, 80) || email;
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nom, app: 'Been11', invite_par: invPar, invite_par_email: user.email || '' } });
      if (error) return { error: 'Compte non créé : ' + error.message };
      const uid = data.user!.id;
      await admin.from('profiles').upsert({ id: uid, nom, role: 'editeur', approuve: true, essai: true, essai_debut: null, essai_fin: null, telephone: tel });
      const r = await envoyerLien(uid, email, redirectTo);
      if ((r as any).error) { await admin.auth.admin.deleteUser(uid); return r; }
      return { ok: true, id: uid, email };
    };
    if (b.action === 'demande_accorder') {
      const { data: d } = await admin.from('acces_demandes').select('*').eq('id', b.id).maybeSingle();
      if (!d) return J({ error: 'Demande introuvable' }, 404);
      const r = await ouvrir(d.email, b.nom || d.nom || d.email, d.telephone, b.redirectTo);
      if ((r as any).error) return J(r, 400);
      await admin.from('acces_demandes').update({ statut: 'accordee', lu: true, traite_le: new Date().toISOString(), user_id: (r as any).id }).eq('id', b.id);
      return J(r);
    }
    /* renvoie un lien à une personne qui n'a pas encore choisi son mot de passe */
    if (b.action === 'renvoyer') {
      const email = clean(b.email, 160).toLowerCase();
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      const u = us?.users.find((x) => (x.email || '').toLowerCase() === email);
      if (!u) return J({ error: 'Compte introuvable' }, 404);
      if (u.last_sign_in_at || (u.user_metadata as any)?.mdp_ok) return J({ error: 'Cette personne a déjà choisi son mot de passe : utilisez « Mot de passe oublié »' }, 400);
      const r = await envoyerLien(u.id, email, b.redirectTo);
      return J(r, (r as any).error ? 400 : 200);
    }
    if (b.action === 'essai_create') {
      const r = await ouvrir(b.email, b.nom || '', b.telephone || null, b.redirectTo);
      return J(r, (r as any).error ? 400 : 200);
    }
    if (b.action === 'essais') {
      const { data: ps } = await admin.from('profiles').select('id,nom,essai,essai_debut,essai_fin,telephone,approuve').eq('essai', true);
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 });
      const em = new Map((us?.users || []).map((u) => [u.id, u]));
      return J({ today, essais: (ps || []).map((p) => ({ ...p, email: em.get(p.id)?.email || '', derniere: em.get(p.id)?.last_sign_in_at || null })) });
    }
    if (b.action === 'essai_rouvrir') {
      const d = new Date(today + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + Math.max(1, Math.min(12, Number(b.mois) || 1)));
      const { error } = await admin.from('profiles').update({ approuve: true, essai: true, essai_fin: iso(d) }).eq('id', b.id);
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true, fin: iso(d) });
    }
    if (b.action === 'evaluations') {
      const { data } = await admin.from('evaluations').select('*').order('created_at', { ascending: false }).limit(200);
      return J({ evaluations: data || [] });
    }
    if (b.action === 'evaluations_lues') {
      await admin.from('evaluations').update({ lu: true }).eq('lu', false);
      await admin.from('acces_demandes').update({ lu: true }).eq('lu', false);
      return J({ ok: true });
    }
    return J({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return J({ error: String((e as Error).message || e) }, 500);
  }
});
