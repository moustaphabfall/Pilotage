/* Adaptateur Supabase de l'Artefact de pilotage : connexion par utilisateur, stockage partagé, signature des modifications.
   Actif seulement si config.js est renseigné. Fournit window.PILOTAGE_SB (stockage), window.PILOTAGE_USER (auteur) et window.PILOTAGE_RO (lecture seule). */
(function(){
  const cfg = window.PILOTAGE_CONFIG || {};
  if(!cfg.url || !cfg.anonKey || !window.supabase){ console.info('Pilotage : mode local (Supabase non configuré)'); return; }
    /* lien reçu par e-mail (invitation, réinitialisation) : repéré avant que la bibliothèque n'efface l'adresse */
  const RET = /[#&?]type=(invite|recovery|signup|magiclink)/.exec(location.hash+location.search);
  const DV = new URLSearchParams(location.search).get('dv');   // appareil à valider (lien de vérification reçu par e-mail)
  let DEV = null; try{ DEV = localStorage.getItem('pg_device'); if(!DEV){ DEV = (crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now())+'-'+Math.random().toString(36).slice(2); localStorage.setItem('pg_device', DEV); } }catch(e){ DEV = 'tmp-'+Math.random().toString(36).slice(2)+Date.now(); }
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  let me = null, ready = null, lastTs = null, PJ = null, store = null;

  const css = document.createElement('style');
  css.textContent = '#pgAuth{position:fixed;inset:0;z-index:99999;background:#2B2F33;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}#pgAuth form,#pgAuth .box{background:#fff;border-top:6px solid #F2A900;border-radius:10px;padding:22px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px}#pgAuth h2{margin:0;font-size:20px}#pgAuth input{padding:11px;border:1px solid #ccc;border-radius:6px;font-size:16px}#pgAuth button{padding:12px;border:0;border-radius:6px;background:#CC5F00;color:#fff;font-size:16px;font-weight:600}#pgAuth button.l{background:#eee;color:#222}#pgAuth .e{color:#B4432D;font-size:13px;min-height:16px}#pgAuth small{color:#666}';
  document.head.appendChild(css);

  /* œil : afficher le mot de passe temporairement (se remasque seul après 8 s, à l'envoi et en quittant le champ) */
  function eyes(d){
    d.querySelectorAll('input[type=password]').forEach(inp=>{
      const w = document.createElement('div'); w.style.cssText = 'position:relative;display:block'; inp.parentNode.insertBefore(w, inp); w.appendChild(inp); inp.style.paddingRight = '44px'; inp.style.boxSizing = 'border-box'; inp.style.width = '100%';
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label','Afficher le mot de passe'); b.title = 'Afficher / masquer';
      b.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:none;padding:0;cursor:pointer;opacity:.65;display:flex;align-items:center;justify-content:center;margin:0';
      const ON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16232B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
      const OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16232B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 4.1-5M9.9 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.1 3"/><path d="M1 1l22 22"/></svg>';
      let t = null; const hide = ()=>{ clearTimeout(t); inp.type = 'password'; b.innerHTML = ON; b.setAttribute('aria-label','Afficher le mot de passe'); };
      b.innerHTML = ON;
      b.onmousedown = e=>e.preventDefault();
      b.onclick = ()=>{ if(inp.type==='password'){ inp.type = 'text'; b.innerHTML = OFF; b.setAttribute('aria-label','Masquer le mot de passe'); clearTimeout(t); t = setTimeout(hide, 8000); } else hide(); };
      w.appendChild(b); const f = inp.form; if(f) f.addEventListener('submit', hide);
    });
  }
  function screen(html){ let d = document.getElementById('pgAuth'); if(!d){ d = document.createElement('div'); d.id = 'pgAuth'; document.body.appendChild(d); } d.innerHTML = html; try{ eyes(d); }catch(e){} return d; }
  function close(){ const d = document.getElementById('pgAuth'); if(d) d.remove(); }

  /* Connexion par un autre service (Google / Gmail, Microsoft / Outlook / compte professionnel) : proposée si activée côté serveur. */
  const SOCIAL = {google:'Continuer avec Google (Gmail)', azure:'Continuer avec Microsoft (Outlook / pro)'};
  async function socialList(){
    if(cfg.oauth===false) return [];
    try{ const r = await fetch(cfg.url+'/auth/v1/settings', {headers:{apikey:cfg.anonKey}}); const j = await r.json(); const ext = j.external||{};
      return Object.keys(SOCIAL).filter(k=>ext[k] && (!Array.isArray(cfg.oauth) || cfg.oauth.includes(k))); }catch(e){ return []; }
  }
  function loginUI(banner){
    return new Promise(async res=>{
      const social = await socialList();
      let mode = 'in', lastEmail = '';
      const draw = (err, good)=>{
        const msg = `<div class="e" ${good?'style="color:#2a7a3b"':''}>${err||''}</div>`;
        const d = mode==='in'
          ? screen(`<form><h2>🏗 Pilotage chantier</h2><small>Connexion</small>
          <input name="email" type="email" placeholder="E-mail" required autocomplete="email"><input name="pw" type="password" placeholder="Mot de passe" minlength="8" required autocomplete="current-password">
          ${social.length?social.map(k=>'<button type="button" class="l" data-oa="'+k+'">'+SOCIAL[k]+'</button>').join('')+'<small style="text-align:center">ou avec votre identifiant :</small>':''}
          ${msg}<button type="submit">Se connecter</button>
          <button type="button" class="l" id="pgFg">Mot de passe oublié ?</button>
          <small style="text-align:center;opacity:.8">L’accès se fait sur invitation : demandez-le à votre administrateur.</small></form>`)
          : screen(`<form><h2>🏗 Pilotage chantier</h2><small>Mot de passe oublié</small>
          <p style="margin:0;font-size:13.5px">Saisissez votre e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
          <input name="email" type="email" placeholder="E-mail" required autocomplete="email" value="${esc(lastEmail)}">
          ${msg}<button type="submit">Envoyer le lien</button>
          <button type="button" class="l" id="pgBk">‹ Retour à la connexion</button></form>`);
        d.querySelectorAll('[data-oa]').forEach(b=>b.onclick = async ()=>{ const {error} = await sb.auth.signInWithOAuth({provider:b.dataset.oa, options:{redirectTo:location.origin+location.pathname, scopes:b.dataset.oa==='azure'?'email':undefined}}); if(error) draw(error.message); });
        const fg = d.querySelector('#pgFg'); if(fg) fg.onclick = ()=>{ lastEmail = (d.querySelector('input[name=email]').value||'').trim(); mode = 'fg'; draw(); };
        const bk = d.querySelector('#pgBk'); if(bk) bk.onclick = ()=>{ lastEmail = (d.querySelector('input[name=email]').value||'').trim(); mode = 'in'; draw(); };
        d.querySelector('form').onsubmit = async ev=>{
          ev.preventDefault(); const f = new FormData(ev.target), email = f.get('email');
          if(mode==='fg'){ lastEmail = email; const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo:location.origin+location.pathname}); draw(error?error.message:'Si cette adresse a un accès, un e-mail vient d’être envoyé : cliquez sur le lien pour choisir un nouveau mot de passe.', !error); return; }
          const pw = f.get('pw');
          try{
            const {error} = await sb.auth.signInWithPassword({email, password:pw}); if(error) throw error;
            if(!(await verifAppareil(email, pw))){ draw('Connexion annulée.'); return; }
            res();
          }catch(e){ draw(e.message==='Email not confirmed' ? 'Confirmez votre e-mail (lien reçu), puis reconnectez-vous.' : (e.message==='Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : (e.message||'Erreur'))); }
        };
      };
      draw(banner, !!banner);
    });
  }

  /* Vérification de l'appareil : au premier appareil et à chaque nouvel appareil, un lien est envoyé à l'adresse e-mail de la personne ; l'accès n'est ouvert qu'après le clic. */
  async function verifAppareil(email, pw){
    const {data:{session}} = await sb.auth.getSession(); const uid = session && session.user.id;
    if(cfg.verifAdmin!==true && uid){ try{ const {data:pf} = await sb.from('profiles').select('role').eq('id', uid).maybeSingle(); if(pf && pf.role==='admin') return true; }catch(e){} }   /* administrateur général exempté : évite un blocage tant que l'envoi d'e-mails n'est pas réglé */
    try{ const {data:ok} = await sb.rpc('appareil_ok', {p_email:email, p_dev:DEV}); if(ok===true) return true; }catch(e){}
    await sb.auth.signOut();
    const send = async()=>{ const {error} = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:false, emailRedirectTo:location.origin+location.pathname+'?dv='+encodeURIComponent(DEV)}}); return error; };
    const err0 = await send();
    return new Promise(res=>{
      let timer = null;
      const d = screen('<div class="box"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">Pilotage Chantier</div><h2>✉ Vérifiez votre identité</h2><p>Pour protéger votre compte <b>Pilotage Chantier</b>, un e-mail de vérification a été envoyé à <b>'+esc(email)+'</b>. Cliquez sur le lien qu’il contient : l’accès s’ouvre ensuite automatiquement.</p><small>Nécessaire à la première connexion et à chaque nouvel appareil.</small><div class="e" id="pgVe">'+(err0?esc(err0.message):'')+'</div><button class="l" id="pgVr">Renvoyer l’e-mail</button><button class="l" id="pgVb">Retour</button></div>');
      d.querySelector('#pgVr').onclick = async ()=>{ const e = await send(); d.querySelector('#pgVe').textContent = e ? e.message : 'E-mail renvoyé.'; };
      d.querySelector('#pgVb').onclick = ()=>{ clearInterval(timer); res(false); };
      timer = setInterval(async()=>{ try{ const {data:ok} = await sb.rpc('appareil_ok', {p_email:email, p_dev:DEV}); if(ok===true){ clearInterval(timer); const {error} = await sb.auth.signInWithPassword({email, password:pw}); if(error){ d.querySelector('#pgVe').textContent = error.message; return; } res(true); } }catch(e){} }, 3000);
    });
  }

  /* arrivée par le lien de l'e-mail : l'adresse est ainsi vérifiée ; la personne choisit son mot de passe */
  async function passwordUI(){
    let md = {}, mail = ''; try{ const g = await sb.auth.getSession(); const u = g.data && g.data.session && g.data.session.user; md = (u && u.user_metadata) || {}; mail = (u && u.email) || ''; }catch(e){}
    const H = t=>String(t||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const who = md.invite_par ? '<p><b>'+H(md.invite_par)+'</b> vous a invité(e) à rejoindre <b>Pilotage Chantier</b>'+(md.projet?' sur le projet <b>'+H(md.projet)+'</b>':'')+'.</p>' : '<p>Vous avez été invité(e) à rejoindre <b>Pilotage Chantier</b>.</p>';
    return new Promise(res=>{
      const draw = err=>{
        const d = screen('<form><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">Pilotage Chantier</div><h2>🔐 Créez votre compte</h2>'+who+(mail?'<small>Identifiant : '+H(mail)+'</small><br>':'')+'<small>Votre adresse e-mail est vérifiée. Choisissez maintenant votre mot de passe (8 caractères minimum) : personne d’autre ne le verra, pas même l’administrateur.</small>'
          +'<input name="p1" type="password" placeholder="Nouveau mot de passe" minlength="8" required autocomplete="new-password"><input name="p2" type="password" placeholder="Confirmer le mot de passe" minlength="8" required autocomplete="new-password"><div class="e">'+(err||'')+'</div><button type="submit">Enregistrer et entrer</button></form>');
        d.querySelector('form').onsubmit = async ev=>{ ev.preventDefault(); const f = new FormData(ev.target), a = f.get('p1'), b = f.get('p2');
          if(a!==b){ draw('Les deux mots de passe ne sont pas identiques.'); return; }
          const {error} = await sb.auth.updateUser({password:a}); if(error){ draw(error.message); return; }
          try{ history.replaceState(null,'',location.pathname); }catch(e){}
          await sb.auth.signOut();   /* la personne se connecte ensuite elle-même avec son nouveau mot de passe */
          res(); };
      };
      draw();
    });
  }
  async function profile(user){
    for(;;){
      const {data, error} = await sb.from('profiles').select('nom,role,approuve').eq('id', user.id).maybeSingle();
      if(!error && data && data.approuve){ me = {id:user.id, nom:data.nom||user.email, role:data.role}; return; }
      await new Promise(res=>{
        const d = screen(`<div class="box"><h2>⏳ Accès en attente</h2><p>Votre compte (${user.email}) doit être validé par un administrateur du chantier.</p><button id="pgRe">Vérifier</button><button class="l" id="pgOut">Se déconnecter</button></div>`);
        d.querySelector('#pgRe').onclick = ()=>res(); d.querySelector('#pgOut').onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };
        setTimeout(res, 15000);
      });
    }
  }

  /* Projet : chaque utilisateur appartient à un ou plusieurs projets (rôle, fonctionnalités et validité propres à chacun). */
  async function chooseProjet(){
    const today = new Date().toISOString().slice(0,10), glob = me.role==='admin';
    let projets = [], mem = {};
    { const r = await sb.from('projets').select('id,nom,hebergement,type,types_autorises').order('created_at'); projets = r.data||[]; }
    { const r = await sb.from('projet_membres').select('projet_id,role,fonctions,valide_jusqu,actif,types_autorises,fonction').eq('user_id', me.id); (r.data||[]).forEach(m=>mem[m.projet_id]=m); }
    projets = projets.filter(p=>glob || (mem[p.id] && mem[p.id].actif));
    if(!projets.length){
      await new Promise(()=>{ const d = screen('<div class="box"><h2>🚫 Aucun projet</h2><p>Votre compte n’est rattaché à aucun projet actif. Contactez l’administrateur.</p><button class="l" id="pgOut">Se déconnecter</button></div>'); d.querySelector('#pgOut').onclick = async ()=>{ await sb.auth.signOut(); location.reload(); }; });
    }
    let id = null; try{ id = localStorage.getItem('pg_projet'); }catch(e){}
    const okP = p=>glob || (mem[p.id] && (mem[p.id].role==='admin' || !mem[p.id].valide_jusqu || mem[p.id].valide_jusqu>=today));
    let pr = projets.find(p=>p.id===id && okP(p)) || projets.find(okP);
    if(!pr){
      const p0 = projets[0], m = mem[p0.id];
      await new Promise(()=>{ const d = screen('<div class="box"><h2>⌛ Accès expiré</h2><p>Votre accès au projet « '+esc(p0.nom)+' » a expiré le '+esc(m.valide_jusqu)+'. Contactez l’administrateur pour le prolonger.</p><button id="pgRe">Vérifier</button><button class="l" id="pgOut">Se déconnecter</button></div>'); d.querySelector('#pgRe').onclick = ()=>location.reload(); d.querySelector('#pgOut').onclick = async ()=>{ await sb.auth.signOut(); location.reload(); }; });
    }
    const m = mem[pr.id] || {role:'admin', fonctions:{}, valide_jusqu:null};
    PJ = {id:pr.id, nom:pr.nom, type:pr.type||'entreprise_generale', hebergement:pr.hebergement||null, types_autorises:pr.types_autorises||null, types_membre:(mem[pr.id]&&mem[pr.id].types_autorises)||null, fonction:(mem[pr.id]&&mem[pr.id].fonction)||null, role: glob ? 'admin' : m.role, fonctions: (glob || m.role==='admin') ? {} : (m.fonctions||{}), valide_jusqu: m.valide_jusqu||null, global:glob, projets:projets.filter(okP)};
    window.PILOTAGE_PROJET = PJ;
    window.PILOTAGE_ADM = adm; window.PILOTAGE_GENPW = genPw;
    window.PILOTAGE_SET_TYPE = async (pid, type)=>{ const {error} = await sb.from('projets').update({type}).eq('id', pid); if(error) throw error; };
    window.PILOTAGE_SET_TYPES_OK = async (pid, arr)=>{ const {error} = await sb.from('projets').update({types_autorises: (arr&&arr.length)?arr:null}).eq('id', pid); if(error) throw error; };
    window.PILOTAGE_MEMBER_FN = {
      get: async pid=>{ const {data,error} = await sb.from('projet_membres').select('user_id,fonction').eq('projet_id',pid); if(error) throw error; const o={}; (data||[]).forEach(r=>o[r.user_id]=r.fonction||''); return o; },
      set: async (pid,uid,f)=>{ const {error} = await sb.rpc('set_membre_fonction',{p_projet:pid,p_user:uid,p_fonction:f||''}); if(error) throw error; }
    };
    window.PILOTAGE_MEMBER_TYPES = {
      get: async pid=>{ const {data,error} = await sb.from('projet_membres').select('user_id,types_autorises').eq('projet_id',pid); if(error) throw error; const o={}; (data||[]).forEach(r=>o[r.user_id]=r.types_autorises); return o; },
      set: async (pid,uid,arr)=>{ const {error} = await sb.from('projet_membres').update({types_autorises:arr}).eq('projet_id',pid).eq('user_id',uid); if(error) throw error; }
    };
    window.PILOTAGE_RESET_REQ = {
      create: async (pid, uid, email, nom)=>{ const {error} = await sb.from('demandes_reset').insert({projet_id:pid, user_id:uid, demandeur:me.id, email:email||null, nom:nom||null, demandeur_email:(me.email||null)}); if(error) throw error; },
      list: async ()=>{ const {data,error} = await sb.from('demandes_reset').select('*').eq('statut','en_attente').order('cree_le'); if(error) throw error; return data||[]; },
      done: async (id, ok)=>{ const {error} = await sb.from('demandes_reset').update({statut: ok?'validee':'refusee'}).eq('id', id); if(error) throw error; }
    };
    /* Demandes clients : lien de formulaire en ligne envoyé au demandeur (aucun plan copié ; la réponse est supprimée dès son import) */
    window.PILOTAGE_DEMANDES = {
      create: async o=>{ const b=new Uint8Array(24); crypto.getRandomValues(b); const tok=btoa(String.fromCharCode.apply(null,b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); const exp=new Date(Date.now()+7*864e5).toISOString();
        const {error} = await sb.from('demande_liens').insert({token:tok, projet_id:PJ.id, responsable:o.responsable||null, demandeur:o.demandeur||null, demandeur_email:o.email||null, societe:o.societe||null, type:'nouvelle', demande_id:o.demande_id||null, snapshot:o.snapshot||{}, statut:'envoye', expire:exp}); if(error) throw error;
        return new URL('demande.html?t='+tok, location.href).href; },
      list: async ()=>{ const {data,error} = await sb.from('demande_liens').select('token,demande_id,statut,reponse,expire').eq('projet_id',PJ.id); if(error) throw error; return data||[]; },
      remove: async tok=>{ const {error} = await sb.from('demande_liens').delete().eq('token',tok).eq('projet_id',PJ.id); if(error) throw error; }
    };
    window.pilotageSwitchProjet = id2=>{ try{ localStorage.setItem('pg_projet', id2); }catch(e){} location.reload(); };
  }

  /* ===== Réouverture hors réseau (mauvaise couverture sur chantier) =====
     Après une connexion réussie avec du réseau, un instantané du compte (identité, projet, droits) est gardé sur l'appareil jusqu'au vendredi soir de la semaine.
     Sans réseau, l'application ne se rouvre que si la personne a activé la biométrie du téléphone et la valide (empreinte / visage). Aucune donnée biométrique ne quitte le téléphone ni n'est stockée par l'outil.
     Déconnexion volontaire = instantané et repère biométrique effacés. */
  const SNAP = 'pg_offline', BIO = 'pg_bio2', BIO_DAYS = 183;   /* repère biométrique par personne et par appareil : à confirmer tous les 6 mois */
  const lsGet = k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
  const lsSet = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const lsDel = k=>{ try{ localStorage.removeItem(k); }catch(e){} };
  const b64 = buf=>btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = t=>Uint8Array.from(atob(t), c=>c.charCodeAt(0));
  const snapUntil = ts=>{ const d = new Date(ts), k = (5 - d.getDay() + 7) % 7; d.setDate(d.getDate()+k); d.setHours(23,59,59,999); return d.getTime(); };
  const snapOk = sn=>!!(sn && sn.me && sn.PJ && Date.now() <= snapUntil(sn.ts));
  const bioGet = uid=>{ const m = lsGet(BIO) || {}; const b = m[uid]; return (b && b.id && b.at && Date.now() - b.at < BIO_DAYS*864e5) ? b : null; };
  const bioOk = sn=>!!(sn && sn.me && bioGet(sn.me.id)) && !!window.PublicKeyCredential;
  async function reach(){
    if(navigator.onLine===false) return false;
    try{ const c = new AbortController(), t = setTimeout(()=>c.abort(), 3500); const r = await fetch(cfg.url+'/auth/v1/settings', {headers:{apikey:cfg.anonKey}, signal:c.signal, cache:'no-store'}); clearTimeout(t); return !!r; }catch(e){ return false; }
  }
  function snapSave(user){ try{ lsSet(SNAP, {ts:Date.now(), me, PJ, email:(user&&user.email)||me.email||''}); }catch(e){} }
  async function bioEnrol(){
    const user = {id:me.id, name:me.email||me.nom||'utilisateur', displayName:me.nom||me.email||'Utilisateur'};
    const ch = crypto.getRandomValues(new Uint8Array(32)), uid = new TextEncoder().encode(String(me.id)).slice(0,64);
    const cred = await navigator.credentials.create({publicKey:{rp:{name:'Pilotage Chantier'}, user:{id:uid, name:user.name, displayName:user.displayName}, challenge:ch, pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}], authenticatorSelection:{authenticatorAttachment:'platform', userVerification:'required', residentKey:'discouraged'}, timeout:60000, attestation:'none'}});
    const m = lsGet(BIO) || {}; m[me.id] = {id:b64(cred.rawId), at:Date.now()}; lsSet(BIO, m);
  }
  function bioOffer(){
    if(!window.PublicKeyCredential || bioGet(me.id)) return;
    const ask = ()=>{
      if(document.getElementById('pgBioOffer')) return;
      const d = document.createElement('div'); d.id = 'pgBioOffer';
      d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99998;max-width:460px;margin:0 auto;background:#222a30;color:#fff;border:2px solid #F2A900;border-radius:14px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)';
      const renew = !!((lsGet(BIO)||{})[me.id]); d.innerHTML = '<b>🔒 '+(renew?'Confirmer la biométrie (tous les 6 mois)':'Rouvrir sans réseau')+'</b><div style="margin:4px 0 8px;opacity:.9">Activez l’empreinte ou le visage de ce téléphone : vous pourrez rouvrir l’application sans internet jusqu’à vendredi soir. Rien de biométrique n’est envoyé ni stocké par l’outil.</div><div style="display:flex;gap:8px"><button id="pgBioOk" style="flex:1;padding:9px;border:0;border-radius:9px;background:#F2A900;font-weight:700;color:#16232B">Activer</button><button id="pgBioNo" style="padding:9px 12px;border:1px solid #666;border-radius:9px;background:none;color:#fff">Plus tard</button></div><div id="pgBioMsg" style="margin-top:6px;font-size:12.5px"></div>';
      document.body.appendChild(d);
      d.querySelector('#pgBioNo').onclick = ()=>{ d.remove(); try{ sessionStorage.setItem('pg_bio_later','1'); }catch(e){} };
      d.querySelector('#pgBioOk').onclick = async ()=>{ try{ await bioEnrol(); d.remove(); }catch(e){ d.querySelector('#pgBioMsg').textContent = 'Activation impossible : '+((e&&e.message)||'annulée')+'.'; } };
    };
    let later = false; try{ later = sessionStorage.getItem('pg_bio_later')==='1'; }catch(e){}
    if(!later) setTimeout(ask, 2500);
  }
  /* écran hors réseau : biométrie obligatoire */
  function bioGate(sn){
    return new Promise(res=>{
      const b = bioGet(sn.me.id);
      const d = screen('<div class="box"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">Pilotage Chantier</div><h2>📴 Mode hors réseau</h2><p>Pas de connexion internet. Validez avec l’empreinte ou le visage de ce téléphone pour rouvrir votre espace, <b>'+esc(sn.me.nom||sn.email||'')+'</b>.</p><button id="pgBioGo">🔒 Déverrouiller</button><div class="e" id="pgBioE" style="min-height:18px;margin-top:8px"></div><button class="l" id="pgBioX">Se connecter avec du réseau</button></div>');
      const go = async ()=>{
        d.querySelector('#pgBioE').textContent = '';
        try{ await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)), allowCredentials:[{type:'public-key', id:unb64(b.id), transports:['internal']}], userVerification:'required', timeout:60000}}); res(true); }
        catch(e){ d.querySelector('#pgBioE').textContent = 'Vérification refusée ou annulée. Réessayez.'; }
      };
      d.querySelector('#pgBioGo').onclick = go; d.querySelector('#pgBioX').onclick = ()=>res(false); go();
    });
  }
  /* Sans réseau : jamais d'entrée libre. Biométrie activée et instantané valide → déverrouillage ; sinon écran bloquant (il faut du réseau). */
  async function offlineEntry(){
    if(await reach()) return null;
    const sn = lsGet(SNAP);
    if(snapOk(sn) && bioOk(sn)){ if(await bioGate(sn)) return sn; }
    await new Promise(()=>{ const d = screen('<div class="box"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">Pilotage Chantier</div><h2>📴 Pas de connexion</h2><p>Sans internet, l’application ne se rouvre qu’avec l’empreinte ou le visage activés au préalable, et jusqu’à vendredi soir. Reconnectez-vous avec du réseau pour continuer.</p><button id="pgRt">Réessayer</button></div>'); d.querySelector('#pgRt').onclick = ()=>location.reload(); });
  }
  function startOffline(sn){
    me = sn.me; PJ = sn.PJ; window.PILOTAGE_PROJET = PJ; window.PILOTAGE_OFFLINE = true;
    try{ window.PILOTAGE_USER_EMAIL = sn.email; }catch(e){}
    window.PILOTAGE_USER = {id:me.id, nom:me.nom};
    close();
    try{ if(typeof userChipRender==='function') userChipRender(); }catch(e){}
    addMenu();
    window.addEventListener('online', ()=>setTimeout(()=>location.reload(), 1200));
    return db;
  }
  async function ensure(){
    { const sn = await offlineEntry(); if(sn) return startOffline(sn); }
    let {data:{session}} = await sb.auth.getSession();
    let banner = null;
    if(session && RET && /invite|recovery/.test(RET[1])){ await passwordUI(); session = null; banner = 'Mot de passe enregistré. Connectez-vous avec votre e-mail et ce nouveau mot de passe.'; }
    if(session && DV){ try{ await sb.rpc('appareil_valider', {p_dev:DV}); await sb.rpc('appareil_valider', {p_dev:DEV}); }catch(e){} try{ history.replaceState(null,'',location.pathname); }catch(e){} }   /* lien de vérification cliqué : cet appareil (et celui qui attend) sont validés */
    if(!session){ await loginUI(banner); ({data:{session}} = await sb.auth.getSession()); }
    await profile(session.user);
    await chooseProjet();
    try{ window.PILOTAGE_USER_EMAIL = session.user.email; }catch(e){}
    await openStore();
    close();
    window.PILOTAGE_USER = {id:me.id, nom:me.nom};
    if(PJ.role==='lecteur') window.PILOTAGE_RO = true;
    if(store && PJ.role!=='lecteur' && store.probe){ store.probe().then(ok=>{ if(!ok){ window.PILOTAGE_RO = true; console.warn('Hébergement en lecture seule pour ce compte'); } }); }
    try{ if(typeof userChipRender==='function') userChipRender(); }catch(e){}
    startWatch(); addMenu();
    try{ snapSave(session.user); bioOffer(); }catch(e){}
    return db;
  }

  /* Images (photos, plans) : l'artefact les garde en local (IndexedDB) et ne met dans le document que des références « idb:… ».
     Ici elles sont envoyées dans la table « media » de Supabase (et relues par les autres appareils). */
  async function sha(str){ const b = new TextEncoder().encode(str); const h = await crypto.subtle.digest('SHA-1', b); return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join(''); }
  const toURL = blob => new Promise((res,rej)=>{ const fr = new FileReader(); fr.onload = ()=>res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  /* Stockage des données du projet : par défaut la base de l'outil ; sinon le fournisseur choisi pour ce projet (SharePoint…). */
  const supaStore = {
    provider:'supabase',
    db:{ doc(path){ return {
      async get(){ const {data, error} = await sb.from('docs').select('data').eq('projet_id', PJ.id).eq('path', path).maybeSingle(); if(error) throw error; return {exists:!!data, data:()=>data.data}; },
      async set(obj){ const {error} = await sb.from('docs').upsert({projet_id:PJ.id, path, data:obj}, {onConflict:'projet_id,path'}); if(error) throw error; },
      async delete(){ const {error} = await sb.from('docs').delete().eq('projet_id', PJ.id).eq('path', path); if(error) throw error; } }; } },
    blobs:{
      async upload(blob){ const url = await toURL(blob), id = await sha(url);
        const {error} = await sb.from('media').upsert({projet_id:PJ.id, id, data:url}, {onConflict:'projet_id,id', ignoreDuplicates:true}); if(error) throw error; return {id}; },
      async fetch(id){ const {data, error} = await sb.from('media').select('data').eq('projet_id', PJ.id).eq('id', id).maybeSingle();
        if(error || !data) return {ok:false}; const b = await (await fetch(data.data)).blob(); return {ok:true, blob:async()=>b}; } },
    async list(){ const d = await sb.from('docs').select('path').eq('projet_id', PJ.id), m = await sb.from('media').select('id').eq('projet_id', PJ.id); return {docs:(d.data||[]).map(x=>x.path), media:(m.data||[]).map(x=>x.id)}; },
    async mark(){ const {data} = await sb.from('docs').select('data,updated_by').eq('projet_id', PJ.id).eq('path','pilotage/meta').maybeSingle(); return data ? {mark:data.data&&data.data.ts, by:data.updated_by} : null; }
  };
  const cur = ()=>store || supaStore;
  window.PILOTAGE_BLOBS = { upload:b=>cur().blobs.upload(b), fetch:id=>cur().blobs.fetch(id) };
  const db = { doc(path){ return cur().db.doc(path); } };
  window.PILOTAGE_SUPA_STORE = supaStore;

  async function openStore(){
    const h = PJ.hebergement, P = (window.PILOTAGE_PROVIDERS||{})[h&&h.provider];
    if(!h) return;
    for(;;){
      try{
        if(!P || !P.available()) throw new Error('Le fournisseur « '+h.provider+' » n’est pas disponible dans cette version de l’application.');
        store = await P.open(h); window.PILOTAGE_HOST = store; window.PILOTAGE_HOST_CFG = h; return;
      }catch(e){
        await new Promise(res=>{ const d = screen('<div class="box"><h2>☁ Hébergement indisponible</h2><p>'+esc(e.message)+'</p><button id="pgRe">Réessayer</button>'+(PJ.role==='admin'?'<button class="l" id="pgBase">Revenir à la base de l’outil (admin)</button>':'')+'<button class="l" id="pgOut">Se déconnecter</button></div>');
          d.querySelector('#pgRe').onclick = ()=>res(); d.querySelector('#pgOut').onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };
          const bb = d.querySelector('#pgBase'); if(bb) bb.onclick = async ()=>{ await sb.from('projets').update({hebergement:null}).eq('id', PJ.id); location.reload(); }; });
      }
    }
  }
  /* Changer d'hébergement : copie les données du projet vers le nouveau stockage (elles suivent), puis enregistre le choix. */
  window.PILOTAGE_SET_HOST = async function(newHosting, onProgress){
    const P = newHosting ? window.PILOTAGE_PROVIDERS[newHosting.provider] : null;
    const to = newHosting ? await P.open(newHosting) : supaStore, from = cur();
    const say = onProgress || (()=>{});
    const L = await from.list(); let n = 0, tot = L.docs.length + L.media.length;
    for(const path of L.docs){ const r = await from.db.doc(path).get(); if(r.exists) await to.db.doc(path).set(r.data()); say(++n, tot); }
    for(const id of L.media){ const r = await from.blobs.fetch(id); if(r.ok){ const b = await r.blob(); const nid = (await to.blobs.upload(b)).id; if(nid!==id) console.warn('identifiant d’image différent', id, nid); } say(++n, tot); }
    const {error} = await sb.from('projets').update({hebergement:newHosting||null}).eq('id', PJ.id); if(error) throw error;
    return true;
  };

  /* Collaboration : si un autre utilisateur a enregistré et que je n'ai rien en attente, je recharge pour récupérer ses modifications. */
  function startWatch(){
    if(store){ const chk = async ()=>{ try{ const m = await store.mark(); if(!m) return; if(lastTs===null){ lastTs = m.mark; return; } if(m.mark!==lastTs){ lastTs = m.mark; if(m.by!==store.userId){ let dirty = false; try{ dirty = localStorage.getItem('pilotage_dirty')==='1'; }catch(e){} if(!dirty && document.visibilityState==='visible') location.reload(); } } }catch(e){} }; chk(); setInterval(chk, 20000); return; }
    const check = async ()=>{
      try{
        const {data} = await sb.from('docs').select('data,updated_by').eq('projet_id', PJ.id).eq('path','pilotage/meta').maybeSingle(); if(!data) return;
        const ts = data.data && data.data.ts;
        if(lastTs===null){ lastTs = ts; return; }
        if(ts && ts!==lastTs){ lastTs = ts; if(data.updated_by!==me.id){ let dirty = false; try{ dirty = localStorage.getItem('pilotage_dirty')==='1'; }catch(e){} if(!dirty && document.visibilityState==='visible') location.reload(); } }
      }catch(e){}
    };
    check(); setInterval(check, 20000);
    sb.channel('pg-meta').on('postgres_changes', {event:'*', schema:'public', table:'docs', filter:'path=eq.pilotage/meta'}, check).subscribe();
  }


  /* ===== Menu « Données » : déconnexion pour tous, gestion des accès pour les administrateurs ===== */
  function addMenu(){
    const m = document.getElementById('dataMenu'); if(!m){ setTimeout(addMenu, 600); return; }
    if(m.querySelector('[data-pg]')) return;
    const mk = (txt, fn)=>{ const b = document.createElement('button'); b.type = 'button'; b.dataset.pg = '1'; b.textContent = txt; b.onclick = ()=>{ try{ dataMenuClose(); }catch(e){} fn(); }; m.appendChild(b); };
    if(PJ.role==='admin') mk('🔑 Gérer les accès', ()=>{ try{ showPage('projet'); }catch(e){} });
    mk('🚪 Se déconnecter ('+me.nom+')', ()=>window.pilotageLogout());
  }
  async function adm(body){
    const {data:{session}} = await sb.auth.getSession();
    const r = await fetch(cfg.url+'/functions/v1/admin-users', {method:'POST', headers:{'Content-Type':'application/json', apikey:cfg.anonKey, Authorization:'Bearer '+session.access_token}, body:JSON.stringify(body)});
    const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||('Erreur '+r.status)); return j;
  }
  const esc = t=>String(t==null?'':t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const genPw = ()=>{ const c='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let o=''; const a=new Uint32Array(10); crypto.getRandomValues(a); a.forEach(n=>o+=c[n%c.length]); return o; };
  window.PILOTAGE_SB = ()=> (ready = ready || ensure());
  window.pilotageLogout = async ()=>{ lsDel(SNAP); try{ await sb.auth.signOut(); }catch(e){} location.reload(); };
})();
