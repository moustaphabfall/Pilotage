import { createClient } from 'npm:@supabase/supabase-js@2';

/* Envoi d'e-mails par Resend (clé RESEND_API_KEY dans les secrets du projet).
   Réservé aux utilisateurs connectés et validés ; le contenu est construit ici, jamais fourni tel quel par le navigateur. */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const FROM = 'Been11 <bienvenue@been11.com>';
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return J({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('profiles').select('approuve,nom').eq('id', user.id).maybeSingle();
    if (!me || !me.approuve) return J({ error: 'Compte non validé' }, 403);
    const b = await req.json();

    if (b.action === 'demande_lien') {
      const to = clean(b.to, 160).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return J({ error: 'Adresse e-mail invalide' }, 400);
      const url = String(b.url || '');
      if (!/^https:\/\/moustaphabfall\.github\.io\/[A-Za-z0-9_-]+\/demande\.html\?t=[A-Za-z0-9_-]+$/.test(url)) return J({ error: 'Lien de demande invalide' }, 400);
      const key = Deno.env.get('RESEND_API_KEY');
      if (!key) return J({ error: 'Envoi par e-mail non configuré (clé Resend absente)' }, 503);
      const nom = clean(b.nom, 80), resp = clean(b.responsable, 80) || me.nom || 'Votre contact', projet = clean(b.projet, 80);
      const subject = 'Votre demande de prestation' + (projet ? ' — ' + projet : '');
      const html =
        '<div style="background:#f4f1ea;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border-collapse:separate">' +
        '<tr><td style="background:#F5B000;height:10px;font-size:0;line-height:0">&nbsp;</td></tr>' +
        '<tr><td style="padding:24px 28px 0;color:#2b2f35;font-size:16px;line-height:1.55"><h1 style="margin:0 0 12px;font-size:21px;line-height:1.25;color:#111">Votre demande de prestation</h1>' +
        '<p style="margin:0 0 10px">Bonjour ' + esc(nom) + ',</p><p style="margin:0"><b>' + esc(resp) + '</b> vous invite à formaliser votre demande de prestation' + (projet ? ' pour le projet « ' + esc(projet) + ' »' : '') + '.</p></td></tr>' +
        '<tr><td align="center" style="padding:18px 28px 6px"><a href="' + esc(url) + '" style="display:block;background:#F5B000;color:#111;text-decoration:none;font-weight:700;font-size:16px;padding:15px 20px;border-radius:14px">Remplir ma demande</a></td></tr>' +
        '<tr><td style="padding:14px 28px 24px;color:#9a9da3;font-size:12px;line-height:1.5;text-align:center">Ce lien est personnel et valable 7 jours.<br>Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">' + esc(url) + '</span></td></tr></table></div>';
      const payload: Record<string, unknown> = { from: FROM, to: [to], subject, html };
      if (user.email) payload.reply_to = user.email;
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(payload) }).catch(() => null);
      if (!r || !r.ok) { const t = r ? await r.text().catch(() => '') : ''; return J({ error: 'E-mail non envoyé' + (t ? ' : ' + t.slice(0, 200) : '') }, 502); }
      return J({ ok: true });
    }
    return J({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return J({ error: String((e as Error).message || e) }, 500);
  }
});
