// Fonction publique (sans compte) : le client ouvre le lien reçu par e-mail, remplit sa demande, la clôture.
// Elle ne lit/écrit que la ligne identifiée par le jeton aléatoire (copie allégée des plans + réponse).
import { createClient } from 'npm:@supabase/supabase-js@2';
const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'GET, POST, OPTIONS' };
const J = (o:unknown, s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,'Content-Type':'application/json'}});
const OK_TOKEN = /^[A-Za-z0-9_-]{24,64}$/;
Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try{
    if(req.method==='GET'){
      const t = new URL(req.url).searchParams.get('t')||'';
      if(!OK_TOKEN.test(t)) return J({ok:false,error:'lien invalide'},400);
      const {data} = await sb.from('demande_liens').select('type,demandeur,societe,responsable,projet_id,snapshot,statut,expire').eq('token',t).maybeSingle();
      if(!data) return J({ok:false,error:'lien introuvable'},404);
      if(data.statut==='envoye' && new Date(data.expire).getTime()<Date.now()) return J({ok:false,error:'lien expiré'},410);
      const {data:pj} = await sb.from('projets').select('nom').eq('id',data.projet_id).maybeSingle();
      return J({ok:true, statut:data.statut, type:data.type, demandeur:data.demandeur, societe:data.societe, responsable:data.responsable, projet:(pj&&pj.nom)||'', snapshot:data.statut==='envoye'?data.snapshot:null});
    }
    if(req.method==='POST'){
      const raw = await req.text(); if(raw.length>400000) return J({ok:false,error:'réponse trop volumineuse'},413);
      const b = JSON.parse(raw||'{}'); const t = String(b.t||'');
      if(!OK_TOKEN.test(t)||typeof b.reponse!=='object'||!b.reponse) return J({ok:false,error:'requête invalide'},400);
      const {data} = await sb.from('demande_liens').select('statut,expire').eq('token',t).maybeSingle();
      if(!data) return J({ok:false,error:'lien introuvable'},404);
      if(data.statut!=='envoye') return J({ok:false,error:'demande déjà clôturée'},409);
      if(new Date(data.expire).getTime()<Date.now()) return J({ok:false,error:'lien expiré'},410);
      const {error} = await sb.from('demande_liens').update({reponse:b.reponse,statut:'clos',clos_le:new Date().toISOString()}).eq('token',t).eq('statut','envoye');
      if(error) return J({ok:false,error:'enregistrement impossible'},500);
      return J({ok:true});
    }
    return J({ok:false,error:'méthode non permise'},405);
  }catch(e){ return J({ok:false,error:'erreur'},500); }
});
