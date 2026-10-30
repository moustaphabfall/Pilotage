/* Adaptateur Supabase de l'Artefact de pilotage : connexion par utilisateur, stockage partagé, signature des modifications.
   Actif seulement si config.js est renseigné. Fournit window.PILOTAGE_SB (stockage), window.PILOTAGE_USER (auteur) et window.PILOTAGE_RO (lecture seule). */
(function(){
  const cfg = window.PILOTAGE_CONFIG || {};
  if(!cfg.url || !cfg.anonKey || !window.supabase){ console.info('Pilotage : mode local (Supabase non configuré)'); return; }
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  let me = null, ready = null, lastTs = null;

  const css = document.createElement('style');
  css.textContent = '#pgAuth{position:fixed;inset:0;z-index:99999;background:#2B2F33;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}#pgAuth form,#pgAuth .box{background:#fff;border-top:6px solid #F2A900;border-radius:10px;padding:22px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px}#pgAuth h2{margin:0;font-size:20px}#pgAuth input{padding:11px;border:1px solid #ccc;border-radius:6px;font-size:16px}#pgAuth button{padding:12px;border:0;border-radius:6px;background:#CC5F00;color:#fff;font-size:16px;font-weight:600}#pgAuth button.l{background:#eee;color:#222}#pgAuth .e{color:#B4432D;font-size:13px;min-height:16px}#pgAuth small{color:#666}';
  document.head.appendChild(css);

  function screen(html){ let d = document.getElementById('pgAuth'); if(!d){ d = document.createElement('div'); d.id = 'pgAuth'; document.body.appendChild(d); } d.innerHTML = html; return d; }
  function close(){ const d = document.getElementById('pgAuth'); if(d) d.remove(); }

  function loginUI(){
    return new Promise(res=>{
      let mode = 'in';
      const draw = (err)=>{
        const d = screen(`<form><h2>🏗 Pilotage chantier</h2><small>${mode==='in'?'Connexion':'Créer mon accès (à valider par un administrateur)'}</small>
          ${mode==='up'?'<input name="nom" placeholder="Votre nom (signe vos modifications)" required autocomplete="name">':''}
          <input name="email" type="email" placeholder="E-mail" required autocomplete="email"><input name="pw" type="password" placeholder="Mot de passe (8 caractères min.)" minlength="8" required autocomplete="${mode==='in'?'current-password':'new-password'}">
          <div class="e">${err||''}</div><button type="submit">${mode==='in'?'Se connecter':'Créer mon accès'}</button>
          <button type="button" class="l" id="pgSw">${mode==='in'?'Première fois ? Créer mon accès':'J’ai déjà un accès'}</button></form>`);
        d.querySelector('#pgSw').onclick = ()=>{ mode = mode==='in'?'up':'in'; draw(); };
        d.querySelector('form').onsubmit = async ev=>{
          ev.preventDefault(); const f = new FormData(ev.target), email = f.get('email'), pw = f.get('pw');
          try{
            if(mode==='up'){ const {error} = await sb.auth.signUp({email, password:pw, options:{data:{nom:f.get('nom')}}}); if(error) throw error; }
            const {error} = await sb.auth.signInWithPassword({email, password:pw}); if(error) throw error;
            res();
          }catch(e){ draw(e.message==='Email not confirmed' ? 'Confirmez votre e-mail (lien reçu), puis reconnectez-vous.' : (e.message||'Erreur')); }
        };
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

  async function ensure(){
    let {data:{session}} = await sb.auth.getSession();
    if(!session){ await loginUI(); ({data:{session}} = await sb.auth.getSession()); }
    await profile(session.user);
    close();
    window.PILOTAGE_USER = {id:me.id, nom:me.nom};
    if(me.role==='lecteur') window.PILOTAGE_RO = true;
    try{ if(typeof userChipRender==='function') userChipRender(); }catch(e){}
    startWatch(); addMenu();
    return db;
  }

  const db = { doc(path){ return {
    async get(){ const {data, error} = await sb.from('docs').select('data').eq('path', path).maybeSingle(); if(error) throw error; return {exists:!!data, data:()=>data.data}; },
    async set(obj){ const {error} = await sb.from('docs').upsert({path, data:obj}); if(error) throw error; },
    async delete(){ const {error} = await sb.from('docs').delete().eq('path', path); if(error) throw error; }
  }; } };

  /* Collaboration : si un autre utilisateur a enregistré et que je n'ai rien en attente, je recharge pour récupérer ses modifications. */
  function startWatch(){
    const check = async ()=>{
      try{
        const {data} = await sb.from('docs').select('data,updated_by').eq('path','pilotage/meta').maybeSingle(); if(!data) return;
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
    if(me.role==='admin') mk('🔑 Gérer les accès', adminUI);
    mk('🚪 Se déconnecter ('+me.nom+')', ()=>window.pilotageLogout());
  }
  async function adm(body){
    const {data:{session}} = await sb.auth.getSession();
    const r = await fetch(cfg.url+'/functions/v1/admin-users', {method:'POST', headers:{'Content-Type':'application/json', apikey:cfg.anonKey, Authorization:'Bearer '+session.access_token}, body:JSON.stringify(body)});
    const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||('Erreur '+r.status)); return j;
  }
  const esc = t=>String(t==null?'':t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const genPw = ()=>{ const c='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let o=''; const a=new Uint32Array(10); crypto.getRandomValues(a); a.forEach(n=>o+=c[n%c.length]); return o; };
  async function adminUI(){
    const css2 = document.getElementById('pgAdmCss') || Object.assign(document.createElement('style'), {id:'pgAdmCss', textContent:'#pgAdm{position:fixed;inset:0;z-index:99998;background:rgba(22,35,43,.6);display:flex;align-items:center;justify-content:center;padding:12px;font-family:system-ui,sans-serif}#pgAdm .bx{background:#fff;border-top:6px solid #F2A900;border-radius:14px;padding:18px;width:100%;max-width:820px;max-height:92vh;overflow:auto}#pgAdm h3{margin:0 0 10px}#pgAdm table{width:100%;border-collapse:collapse;font-size:13px}#pgAdm td,#pgAdm th{padding:6px 4px;border-bottom:1px solid #eee;text-align:left;vertical-align:middle}#pgAdm input,#pgAdm select{padding:7px;border:1px solid #ccc;border-radius:6px;font-size:14px}#pgAdm button{padding:7px 12px;border:0;border-radius:6px;background:#eee;color:#222;font-size:13px;cursor:pointer}#pgAdm button.p{background:#CC5F00;color:#fff;font-weight:600}#pgAdm button.d{background:#fbe3df;color:#B4432D}#pgAdm .row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}#pgAdm .msg{font-size:13px;min-height:18px;margin:6px 0}#pgAdm .cred{background:#fff7e0;border:1px dashed #F2A900;border-radius:8px;padding:10px;font-size:13px;user-select:all;white-space:pre-wrap}'});
    if(!css2.parentNode) document.head.appendChild(css2);
    document.getElementById('pgAdm')?.remove();
    const ov = document.createElement('div'); ov.id = 'pgAdm'; document.body.appendChild(ov);
    const msg = (t,err)=>{ const m = ov.querySelector('.msg'); if(m){ m.textContent = t||''; m.style.color = err?'#B4432D':'#2a7a3b'; } };
    async function draw(cred){
      let users = []; try{ users = (await adm({action:'list'})).users; }catch(e){ ov.innerHTML = '<div class="bx"><h3>Accès</h3><p>'+esc(e.message)+'</p><button id="x">Fermer</button></div>'; ov.querySelector('#x').onclick = ()=>ov.remove(); return; }
      const roleSel = (id,r,dis)=>'<select data-role="'+id+'" '+(dis?'disabled':'')+'>'+['admin','editeur','lecteur'].map(x=>'<option value="'+x+'"'+(x===r?' selected':'')+'>'+({admin:'Administrateur',editeur:'Éditeur (saisit)',lecteur:'Lecteur (consulte)'})[x]+'</option>').join('')+'</select>';
      ov.innerHTML = '<div class="bx"><h3>🔑 Gestion des accès</h3>'
        +'<table><tr><th>Nom / e-mail</th><th>Rôle</th><th>Accès</th><th></th></tr>'+users.map(u=>'<tr><td><b>'+esc(u.nom)+'</b><br><small>'+esc(u.email)+(u.moi?' (vous)':'')+'</small></td><td>'+roleSel(u.id,u.role,u.moi)+'</td><td><label><input type="checkbox" data-ap="'+u.id+'" '+(u.approuve?'checked':'')+' '+(u.moi?'disabled':'')+'> autorisé</label></td><td>'+(u.moi?'':'<button data-pw="'+u.id+'">Nouveau mot de passe</button> <button class="d" data-del="'+u.id+'">Supprimer</button>')+'</td></tr>').join('')+'</table>'
        +'<h3 style="margin-top:18px">➕ Créer un compte</h3><div class="row"><input id="aN" placeholder="Nom"><input id="aE" type="email" placeholder="E-mail (identifiant)"><input id="aP" placeholder="Mot de passe" value="'+genPw()+'"><select id="aR"><option value="editeur">Éditeur</option><option value="lecteur">Lecteur</option><option value="admin">Administrateur</option></select><button class="p" id="aC">Créer le compte</button></div>'
        +(cred?'<div class="cred">'+esc(cred)+'</div><small>Sélectionnez ce texte, copiez-le et envoyez-le à la personne.</small>':'')
        +'<div class="msg"></div><div class="row" style="justify-content:flex-end"><button id="aX">Fermer</button></div></div>';
      ov.querySelector('#aX').onclick = ()=>ov.remove();
      ov.querySelector('#aC').onclick = async ()=>{ const nom = ov.querySelector('#aN').value.trim(), email = ov.querySelector('#aE').value.trim(), pw = ov.querySelector('#aP').value, role = ov.querySelector('#aR').value; msg('Création…');
        try{ await adm({action:'create', nom, email, password:pw, role}); await draw('Application Pilotage chantier\nLien : '+location.origin+location.pathname.replace(/index\.html$/,'')+'\nIdentifiant : '+email+'\nMot de passe : '+pw+'\n(Changez-le dès la première connexion si besoin.)'); }catch(e){ msg(e.message,true); } };
      ov.querySelectorAll('[data-role]').forEach(el=>el.onchange = async ()=>{ try{ await adm({action:'update', id:el.dataset.role, role:el.value}); msg('Rôle enregistré'); }catch(e){ msg(e.message,true); } });
      ov.querySelectorAll('[data-ap]').forEach(el=>el.onchange = async ()=>{ try{ await adm({action:'update', id:el.dataset.ap, approuve:el.checked}); msg(el.checked?'Accès autorisé':'Accès retiré'); }catch(e){ msg(e.message,true); } });
      ov.querySelectorAll('[data-pw]').forEach(el=>el.onclick = async ()=>{ const u = users.find(x=>x.id===el.dataset.pw), pw = genPw(); try{ await adm({action:'password', id:u.id, password:pw}); await draw('Nouveau mot de passe de '+u.email+' : '+pw); }catch(e){ msg(e.message,true); } });
      ov.querySelectorAll('[data-del]').forEach(el=>el.onclick = async ()=>{ const u = users.find(x=>x.id===el.dataset.del); if(!confirm('Supprimer le compte '+u.email+' ?')) return; try{ await adm({action:'delete', id:u.id}); await draw(); }catch(e){ msg(e.message,true); } });
    }
    draw();
  }

  window.PILOTAGE_SB = ()=> (ready = ready || ensure());
  window.pilotageLogout = async ()=>{ await sb.auth.signOut(); location.reload(); };
})();
