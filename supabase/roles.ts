import { createClient } from 'npm:@supabase/supabase-js@2';

/* Réglages par défaut des fonctionnalités de chaque rôle (table role_defaults). Lecture : tout utilisateur validé ; écriture : administrateur général. */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return J({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('profiles').select('role,approuve').eq('id', user.id).maybeSingle();
    if (!me || !me.approuve) return J({ error: 'Compte non validé' }, 403);
    const b = await req.json();
    if (b.action === 'roles_get') {
      const { data } = await admin.from('role_defaults').select('role,no');
      return J({ roles: data || [] });
    }
    if (b.action === 'roles_set') {
      if (me.role !== 'admin') return J({ error: 'Réservé à l’administrateur général' }, 403);
      const role = String(b.role || '').trim().slice(0, 80);
      if (!role) return J({ error: 'Rôle requis' }, 400);
      const no = Array.isArray(b.no) ? b.no.slice(0, 200).map((x: unknown) => String(x).slice(0, 80)) : [];
      const { error } = await admin.from('role_defaults').upsert({ role, no, updated_at: new Date().toISOString() });
      if (error) return J({ error: error.message }, 400);
      return J({ ok: true });
    }
    return J({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return J({ error: String((e as Error).message || e) }, 500);
  }
});
