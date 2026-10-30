/* Adaptateur SharePoint / Microsoft 365 de l'Artefact de pilotage.
   Fournisseur « sharepoint » : disponible si config.js contient msClientId.
   Connexion : fenêtre Microsoft (identifiant + mot de passe + autorisation). Les données sont des fichiers JSON
   dans une bibliothèque SharePoint (dossier « Pilotage/<projet> »), créés automatiquement à la première connexion.
   Les droits sont ceux de SharePoint : qui peut modifier le site peut modifier le chantier, qui peut seulement lire est en lecture seule. */
(function(){
  const cfg = window.PILOTAGE_CONFIG || {};
  (window.PILOTAGE_PROVIDERS = window.PILOTAGE_PROVIDERS || {}).sharepoint = {label:'Microsoft 365 / SharePoint', available:()=>!!(cfg.msClientId && window.msal), init:function(){
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SCOPES = ['User.Read','Files.ReadWrite.All','Sites.ReadWrite.All'];
  const ROOT = cfg.msFolder || 'Pilotage';
    const app = new msal.PublicClientApplication({auth:{clientId:cfg.msClientId, authority:'https://login.microsoftonline.com/'+(cfg.msTenant||'organizations'), redirectUri:cfg.msRedirect||(location.origin+location.pathname.replace(/[^/]*$/,''))}, cache:{cacheLocation:'localStorage'}});
  let acct = null, ready = null, lastMark = null, me = null;
  const ls = {get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }};

  const css = document.createElement('style');
  css.textContent = '#pgAuth{position:fixed;inset:0;z-index:99999;background:#2B2F33;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}#pgAuth .box{background:#fff;border-top:6px solid #F2A900;border-radius:10px;padding:22px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:10px;max-height:90vh;overflow:auto}#pgAuth h2{margin:0;font-size:20px}#pgAuth button{padding:12px;border:0;border-radius:6px;background:#CC5F00;color:#fff;font-size:16px;font-weight:600;cursor:pointer}#pgAuth button.l{background:#eee;color:#222;font-weight:500;text-align:left}#pgAuth .e{color:#B4432D;font-size:13px}#pgAuth small{color:#666}';
  document.head.appendChild(css);
  const esc = t=>String(t==null?'':t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function screen(html){ let d = document.getElementById('pgAuth'); if(!d){ d = document.createElement('div'); d.id = 'pgAuth'; document.body.appendChild(d); } d.innerHTML = html; return d; }
  function close(){ const d = document.getElementById('pgAuth'); if(d) d.remove(); }

  async function token(){
    const req = {scopes:SCOPES, account:acct};
    try{ return (await app.acquireTokenSilent(req)).accessToken; }
    catch(e){ return (await app.acquireTokenPopup(req)).accessToken; }
  }
  async function g(path, opt){
    opt = opt||{}; const t = await token();
    const r = await fetch(path.startsWith('http')?path:GRAPH+path, Object.assign({}, opt, {headers:Object.assign({Authorization:'Bearer '+t}, opt.headers||{})}));
    return r;
  }
  async function gj(path, opt){ const r = await g(path, opt); if(!r.ok){ const j = await r.json().catch(()=>({})); const e = new Error((j.error&&j.error.message)||('Erreur '+r.status)); e.status = r.status; throw e; } return r.json(); }

  /* ---- connexion ---- */
  async function login(){
    await app.initialize();
    const res = await app.handleRedirectPromise().catch(()=>null);
    acct = (res&&res.account) || app.getActiveAccount() || app.getAllAccounts()[0] || null;
    if(!acct){
      await new Promise(done=>{
        const d = screen('<div class="box"><h2>🏗 Pilotage chantier</h2><p>Connectez-vous avec votre compte Microsoft 365 professionnel. Une fenêtre Microsoft s’ouvre : identifiant, mot de passe, puis « Accepter ».</p><div class="e" id="pgE"></div><button id="pgMs">Se connecter avec Microsoft</button></div>');
        d.querySelector('#pgMs').onclick = async ()=>{ try{ const r = await app.loginPopup({scopes:SCOPES}); acct = r.account; done(); }catch(e){ d.querySelector('#pgE').textContent = (e.message||'Connexion annulée'); } };
      });
    }
    app.setActiveAccount(acct);
  }

  /* ---- projet = un dossier SharePoint ; chaque projet a son propre hébergement, partagé par ses membres ---- */
  let proj = null, base = null;
  const setProj = p=>{ proj = p; base = '/drives/'+p.driveId+'/items/'+p.itemId; };
  async function folderOf(item){ const r = item.remoteItem || item; return {driveId:r.parentReference.driveId, itemId:r.id, nom:item.name}; }
  async function listSites(){
    let sites = [];
    try{ sites = (await gj('/sites?search=*&$top=50')).value || []; }catch(e){}
    try{ const f = (await gj('/me/followedSites')).value||[]; f.forEach(s=>{ if(!sites.find(x=>x.id===s.id)) sites.push(s); }); }catch(e){}
    return sites;
  }
  async function chooseProject(){
    const saved = ls.get('pg_sp_proj');
    if(saved){ try{ const p = JSON.parse(saved); await gj('/drives/'+p.driveId+'/items/'+p.itemId); setProj(p); return; }catch(e){ try{ localStorage.removeItem('pg_sp_proj'); }catch(x){} } }
    for(;;){
      let shared = []; try{ shared = ((await gj('/me/drive/sharedWithMe')).value||[]).filter(x=>x.folder || (x.remoteItem&&x.remoteItem.folder)); }catch(e){}
      const pick = await new Promise(done=>{
        const d = screen('<div class="box"><h2>📁 Choisir un projet</h2>'
          +(shared.length?'<small>Projets partagés avec vous</small>'+shared.map((x,i)=>'<button class="l" data-s="'+i+'">'+esc(x.name)+'</button>').join(''):'<small>Aucun projet partagé avec vous pour l’instant.</small>')
          +'<small>Administrateur : créer ou rouvrir un projet</small><button class="l" data-n="1">➕ Mes projets / nouveau projet</button><div class="e" id="pgE"></div></div>');
        d.querySelectorAll('[data-s]').forEach(b=>b.onclick = async ()=>{ try{ done(await folderOf(shared[+b.dataset.s])); }catch(e){ d.querySelector('#pgE').textContent = e.message; } });
        d.querySelector('[data-n]').onclick = ()=>done(null);
      });
      if(pick){ setProj(pick); ls.set('pg_sp_proj', JSON.stringify(pick)); return; }
      const mine = await ownProject(); if(mine){ setProj(mine); ls.set('pg_sp_proj', JSON.stringify(mine)); return; }
    }
  }
  /* choix d'un SharePoint (ou OneDrive), puis d'un projet existant ou création : un projet = un dossier « Pilotage/<nom> » */
  async function ownProject(){
    const sites = await listSites();
    const root = await new Promise(done=>{
      const d = screen('<div class="box"><h2>🏢 Quel SharePoint héberge ce projet ?</h2><small>Chaque projet a son propre hébergement.</small>'
        +sites.map((x,i)=>'<button class="l" data-i="'+i+'">'+esc(x.displayName||x.name)+'<br><small>'+esc(x.webUrl||'')+'</small></button>').join('')
        +'<button class="l" data-od="1">☁ Mon OneDrive (test personnel)</button><button class="l" data-back="1">← Retour</button><div class="e" id="pgE"></div></div>');
      const go = async b=>{ try{ await gj(b+'/drive'); done(b+'/drive'); }catch(e){ d.querySelector('#pgE').textContent = 'Accès impossible : '+e.message; } };
      d.querySelectorAll('[data-i]').forEach(b=>b.onclick = ()=>go('/sites/'+sites[+b.dataset.i].id));
      d.querySelector('[data-od]').onclick = ()=>go('/me'); d.querySelector('[data-back]').onclick = ()=>done(null);
    });
    if(!root) return null;
    let kids = []; try{ kids = ((await gj(root+'/root:/'+encodeURIComponent(ROOT)+':/children')).value||[]).filter(x=>x.folder); }catch(e){}
    return new Promise(done=>{
      const d = screen('<div class="box"><h2>🗂 Projets de ce SharePoint</h2>'+(kids.length?kids.map((x,i)=>'<button class="l" data-k="'+i+'">'+esc(x.name)+'</button>').join(''):'<small>Aucun projet pour l’instant.</small>')
        +'<small>Nouveau projet (vous en serez l’administrateur)</small><input id="pgN" placeholder="Nom du projet (ex. SM)" style="padding:11px;border:1px solid #ccc;border-radius:6px;font-size:16px"><button id="pgC">Créer le projet</button><button class="l" id="pgB">← Retour</button><div class="e" id="pgE"></div></div>');
      d.querySelectorAll('[data-k]').forEach(b=>b.onclick = async ()=>{ try{ done(await folderOf(kids[+b.dataset.k])); }catch(e){ d.querySelector('#pgE').textContent = e.message; } });
      d.querySelector('#pgB').onclick = ()=>done(null);
      d.querySelector('#pgC').onclick = async ()=>{ const nom = d.querySelector('#pgN').value.trim().replace(/[\\/:*?"<>|#%]/g,''); if(!nom){ d.querySelector('#pgE').textContent = 'Nom requis'; return; }
        try{ if(kids.find(x=>x.name.toLowerCase()===nom.toLowerCase())) throw new Error('Ce projet existe déjà : ouvrez-le dans la liste.');
          const r = await g(root+'/root:/'+enc(ROOT+'/'+nom+'/LISEZ-MOI.txt')+':/content?@microsoft.graph.conflictBehavior=replace', {method:'PUT', headers:{'Content-Type':'text/plain'}, body:'Données de l’application Pilotage chantier (projet '+nom+'). Ne pas renommer ni supprimer ces fichiers.'}); if(!r.ok) throw new Error('Création refusée ('+r.status+')');
          const f = await gj(root+'/root:/'+enc(ROOT+'/'+nom)); done({driveId:f.parentReference.driveId, itemId:f.id, nom});
        }catch(e){ d.querySelector('#pgE').textContent = e.message; } };
    });
  }

  /* ---- fichiers ---- */
  const enc = p=>p.split('/').map(encodeURIComponent).join('/');
  const url = (p,suffix)=>base+':/'+enc(p)+(suffix||'');
  async function putFile(p, body, type){
    const size = body.size!=null ? body.size : new Blob([body]).size;
    if(size < 3.5*1024*1024){ const r = await g(url(p,':/content?@microsoft.graph.conflictBehavior=replace'), {method:'PUT', headers:{'Content-Type':type||'application/json'}, body}); if(!r.ok){ if(r.status===403){ window.PILOTAGE_RO = true; } throw new Error('Écriture refusée ('+r.status+')'+(r.status===403?' : vous avez un accès en lecture seule':'')); } return r.json(); }
    const s = await gj(url(p,':/createUploadSession'), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'replace'}})});
    const blob = body instanceof Blob ? body : new Blob([body]); const CH = 5*320*1024; let last = null;
    for(let o=0; o<blob.size; o+=CH){ const part = blob.slice(o, Math.min(o+CH, blob.size)); const r = await fetch(s.uploadUrl, {method:'PUT', headers:{'Content-Range':'bytes '+o+'-'+(o+part.size-1)+'/'+blob.size}, body:part}); if(!r.ok&&r.status!==202) throw new Error('Envoi interrompu ('+r.status+')'); if(r.status!==202) last = await r.json().catch(()=>null); }
    return last;
  }
  async function getFile(p){ const r = await g(url(p,':/content')); if(r.status===404) return null; if(!r.ok) throw new Error('Lecture refusée ('+r.status+')'); return r; }

  const db = { doc(path){ return {
    async get(){ const r = await getFile(path+'.json'); if(!r) return {exists:false, data:()=>undefined}; const j = await r.json(); return {exists:true, data:()=>j}; },
    async set(obj){ await putFile(path+'.json', JSON.stringify(obj)); },
    async delete(){ const r = await g(url(path+'.json'), {method:'DELETE'}); if(!r.ok && r.status!==404) throw new Error('Suppression refusée ('+r.status+')'); }
  }; } };

  async function sha(b){ const h = await crypto.subtle.digest('SHA-1', await b.arrayBuffer()); return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join(''); }
  window.PILOTAGE_BLOBS = {
    async upload(blob){ const id = await sha(blob); const ex = await g(url('media/'+id,'')); if(ex.status===404) await putFile('media/'+id, blob, blob.type||'application/octet-stream'); else if(!ex.ok) throw new Error('Lecture refusée ('+ex.status+')'); return {id}; },
    async fetch(id){ const r = await getFile('media/'+id); if(!r) return {ok:false}; const b = await r.blob(); return {ok:true, blob:async()=>b}; }
  };

  /* ---- collaboration : recharge si un autre utilisateur a enregistré ---- */
  function startWatch(){
    const check = async ()=>{
      try{
        const it = await gj(url('pilotage/meta.json','')); const mark = it.eTag||it.lastModifiedDateTime; const by = it.lastModifiedBy&&it.lastModifiedBy.user&&it.lastModifiedBy.user.id;
        if(lastMark===null){ lastMark = mark; return; }
        if(mark!==lastMark){ lastMark = mark; if(by!==me.oid){ let dirty = false; try{ dirty = localStorage.getItem('pilotage_dirty')==='1'; }catch(e){} if(!dirty && document.visibilityState==='visible') location.reload(); } }
      }catch(e){}
    };
    check(); setInterval(check, 20000);
  }
  /* ---- membres du projet = partage du dossier SharePoint (lecture / écriture) ---- */
  const ROLE = {read:'lecteur', write:'editeur'};
  window.PILOTAGE_SP = {
    async members(){ const v = (await gj(base+'/permissions')).value||[];
      return v.filter(p=>!p.link).map(p=>{ const u = (p.grantedToV2&&p.grantedToV2.user)||(p.grantedToIdentitiesV2&&p.grantedToIdentitiesV2[0]&&p.grantedToIdentitiesV2[0].user)||{}; const grp = p.grantedToV2&&p.grantedToV2.siteGroup; const roles = p.roles||[];
        return {id:p.id, nom:u.displayName||(grp&&grp.displayName)||'', email:u.email||'', role: roles.includes('owner')?'admin':(roles.includes('write')?'editeur':'lecteur'), herite:!!p.inheritedFrom}; }); },
    async invite(email, role){ return gj(base+'/invite', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({requireSignIn:true, sendInvitation:true, roles:[role==='lecteur'?'read':'write'], recipients:[{email}], message:'Accès au projet « '+proj.nom+' » (application Pilotage chantier). Ouvrez le lien de l’application et connectez-vous avec ce compte Microsoft.'})}); },
    async setRole(id, role){ return gj(base+'/permissions/'+id, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({roles:[role==='lecteur'?'read':'write']})}); },
    async remove(id){ const r = await g(base+'/permissions/'+id, {method:'DELETE'}); if(!r.ok) throw new Error('Retrait refusé ('+r.status+')'); }
  };
  async function detectRole(){
    try{ await gj(base+'/permissions'); return 'admin'; }catch(e){}
    try{ const n = '.sonde-'+me.oid; await putFile(n, 'ok', 'text/plain'); await g(url(n), {method:'DELETE'}); return 'editeur'; }catch(e){ return 'lecteur'; }
  }
  function addMenu(){
    const m = document.getElementById('dataMenu'); if(!m){ setTimeout(addMenu, 600); return; }
    if(m.querySelector('[data-pg]')) return;
    const mk = (txt, fn)=>{ const b = document.createElement('button'); b.type = 'button'; b.dataset.pg = '1'; b.textContent = txt; b.onclick = ()=>{ try{ dataMenuClose(); }catch(e){} fn(); }; m.appendChild(b); };
    if(window.PILOTAGE_PROJET.role==='admin') mk('🔑 Gérer les accès', ()=>{ try{ showPage('projet'); }catch(e){} });
    mk('📁 Changer de projet', ()=>{ try{ localStorage.removeItem('pg_sp_proj'); }catch(e){} location.reload(); });
    mk('🚪 Se déconnecter ('+me.nom+')', ()=>window.pilotageLogout());
  }

  async function ensure(){
    await login();
    me = {oid:(acct.idTokenClaims&&acct.idTokenClaims.oid)||acct.localAccountId, nom:acct.name||acct.username, email:acct.username};
    await chooseProject();
    const role = await detectRole();
    close();
    window.PILOTAGE_USER = {id:me.oid, nom:me.nom};
    window.PILOTAGE_PROJET = {id:proj.itemId, nom:proj.nom, role, fonctions:{}, valide_jusqu:null, global:false, sharepoint:true, projets:[{id:proj.itemId, nom:proj.nom}]};
    if(role==='lecteur') window.PILOTAGE_RO = true;
    try{ if(typeof userChipRender==='function') userChipRender(); }catch(e){}
    startWatch(); addMenu();
    return db;
  }
  window.PILOTAGE_SB = ()=> (ready = ready || ensure());
  window.pilotageLogout = async ()=>{ try{ localStorage.removeItem('pg_sp_proj'); }catch(e){} await app.logoutPopup({account:acct}).catch(()=>{}); location.reload(); };
}};
})();
