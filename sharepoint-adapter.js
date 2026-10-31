/* Fournisseur d'hébergement « Microsoft 365 / SharePoint » (stockage des DONNÉES du projet uniquement).
   L'administration (comptes, projets, rôles, fonctionnalités, paiement) reste dans l'annuaire de l'outil, quel que soit le fournisseur.
   Interface d'un fournisseur : {label, available(), setup(nomProjet) → hebergement|null, open(hebergement) → stockage}
   Stockage : {db.doc(path).get/set/delete, blobs.upload/fetch, list(), mark(), members/invite/setRole/remove, probe()}.
   Disponible si config.js contient msClientId. Un projet = un dossier « Pilotage/<projet> » d'une bibliothèque SharePoint. */
(function(){
  const cfg = window.PILOTAGE_CONFIG || {};
  (window.PILOTAGE_PROVIDERS = window.PILOTAGE_PROVIDERS || {}).sharepoint = {label:'Microsoft (OneDrive / SharePoint)', available:()=>!!(cfg.msClientId && window.msal), setup, open};
  const GRAPH = 'https://graph.microsoft.com/v1.0', BASE_SCOPES = ['User.Read','Files.ReadWrite.All'], ROOT = cfg.msFolder || 'Pilotage';
  let app = null, acct = null, SCOPES = BASE_SCOPES;   /* Sites.ReadWrite.All demandé seulement si on choisit un site SharePoint */
  const esc = t=>String(t==null?'':t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const css = document.createElement('style');
  css.textContent = '#pgSp{position:fixed;inset:0;z-index:99999;background:rgba(22,35,43,.85);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}#pgSp .box{background:#fff;border-top:6px solid #F2A900;border-radius:10px;padding:22px;width:100%;max-width:420px;display:flex;flex-direction:column;gap:10px;max-height:90vh;overflow:auto}#pgSp h2{margin:0;font-size:20px}#pgSp button{padding:12px;border:0;border-radius:6px;background:#CC5F00;color:#fff;font-size:16px;font-weight:600;cursor:pointer}#pgSp button.l{background:#eee;color:#222;font-weight:500;text-align:left}#pgSp .e{color:#B4432D;font-size:13px}#pgSp small{color:#666}#pgSp input{padding:11px;border:1px solid #ccc;border-radius:6px;font-size:16px}';
  document.head.appendChild(css);
  function screen(html){ let d = document.getElementById('pgSp'); if(!d){ d = document.createElement('div'); d.id = 'pgSp'; document.body.appendChild(d); } d.innerHTML = html; return d; }
  const close = ()=>{ const d = document.getElementById('pgSp'); if(d) d.remove(); };

  async function connect(){
    if(!app){ app = new msal.PublicClientApplication({auth:{clientId:cfg.msClientId, authority:'https://login.microsoftonline.com/'+(cfg.msTenant||'common'), redirectUri:cfg.msRedirect||(location.origin+location.pathname.replace(/[^/]*$/,''))}, cache:{cacheLocation:'localStorage'}}); await app.initialize(); await app.handleRedirectPromise().catch(()=>null); }
    acct = app.getActiveAccount() || app.getAllAccounts()[0] || null;
    const hint = window.PILOTAGE_USER_EMAIL || undefined;   /* même adresse que la connexion à l'outil : connexion Microsoft silencieuse si possible */
    if(!acct && hint){ try{ acct = (await app.ssoSilent({scopes:SCOPES, loginHint:hint})).account; }catch(e){ acct = null; } }
    if(!acct){
      await new Promise(done=>{
        const d = screen('<div class="box"><h2>☁ Hébergement des données</h2><p>Les données de ce projet sont hébergées sur Microsoft 365. Connectez-vous avec votre compte professionnel : une fenêtre Microsoft s’ouvre (identifiant, mot de passe, puis « Accepter »).</p><div class="e" id="e"></div><button id="ms">Se connecter avec Microsoft</button></div>');
        d.querySelector('#ms').onclick = async ()=>{ try{ acct = (await app.loginPopup({scopes:SCOPES, loginHint:hint})).account; done(); }catch(e){ d.querySelector('#e').textContent = e.message||'Connexion annulée'; } };
      });
      close();
    }
    app.setActiveAccount(acct);
  }
  async function token(){ const req = {scopes:SCOPES, account:acct}; try{ return (await app.acquireTokenSilent(req)).accessToken; }catch(e){ return (await app.acquireTokenPopup(req)).accessToken; } }
  async function g(path, opt){ opt = opt||{}; const t = await token(); return fetch(path.startsWith('http')?path:GRAPH+path, Object.assign({}, opt, {headers:Object.assign({Authorization:'Bearer '+t}, opt.headers||{})})); }
  async function gj(path, opt){ const r = await g(path, opt); if(!r.ok){ const j = await r.json().catch(()=>({})); const e = new Error((j.error&&j.error.message)||('Erreur '+r.status)); e.status = r.status; throw e; } return r.json(); }
  const enc = p=>p.split('/').map(encodeURIComponent).join('/');

  /* ---- paramétrage (administrateur) : choisir le SharePoint puis créer ou rouvrir le dossier du projet ---- */
  function notice(html){ return new Promise(done=>{ const d = screen(html); d.querySelector('#b').onclick = ()=>done(); }); }

  async function setup(nomProjet){
    await connect();
    for(;;){
      const choix = await new Promise(done=>{
        const d = screen('<div class="box"><h2>☁ Hébergement Microsoft</h2><small>Compte connecté : '+esc(acct.username)+'</small><p>Où enregistrer les données du projet ?</p>'
          +'<button id="od">☁ Dans mon OneDrive (recommandé : aucun réglage)</button>'
          +'<button class="l" id="sp">🏢 Dans un site SharePoint de mon entreprise</button><button class="l" id="no">Annuler</button><div class="e" id="e"></div></div>');
        d.querySelector('#od').onclick = ()=>done('od'); d.querySelector('#sp').onclick = ()=>done('sp'); d.querySelector('#no').onclick = ()=>done(null);
      });
      if(!choix){ close(); return null; }
      let root = null;
      if(choix==='od'){ root = {base:'/me/drive', label:'OneDrive'}; try{ await gj('/me/drive'); }catch(e){ await notice('<div class="box"><h2>OneDrive indisponible</h2><p>'+esc(e.message)+'</p><button id="b">Retour</button></div>'); continue; } }
      else {
        SCOPES = BASE_SCOPES.concat(['Sites.ReadWrite.All']);
        try{ await app.acquireTokenPopup({scopes:SCOPES, account:acct}); }catch(e){ SCOPES = BASE_SCOPES; await notice('<div class="box"><h2>Autorisation SharePoint</h2><p>'+esc(e.message||'Autorisation refusée')+'</p><p><small>Votre entreprise doit peut-être autoriser l’application : demandez à votre administrateur Microsoft 365 de l’approuver.</small></p><button id="b">Retour</button></div>'); continue; }
        let sites = [];
        try{ sites = (await gj('/sites?search=*&$top=50')).value || []; }catch(e){}
        try{ ((await gj('/me/followedSites')).value||[]).forEach(s2=>{ if(!sites.find(x=>x.id===s2.id)) sites.push(s2); }); }catch(e){}
        root = await new Promise(done=>{
          const d = screen('<div class="box"><h2>🏢 Quel site SharePoint ?</h2>'+sites.map((x,i)=>'<button class="l" data-i="'+i+'">'+esc(x.displayName||x.name)+'<br><small>'+esc(x.webUrl||'')+'</small></button>').join('')+'<button class="l" data-back="1">← Retour</button><div class="e" id="e"></div></div>');
          d.querySelectorAll('[data-i]').forEach(b=>b.onclick = async ()=>{ const st = sites[+b.dataset.i]; try{ await gj('/sites/'+st.id+'/drive'); done({base:'/sites/'+st.id+'/drive', label:st.displayName||st.name}); }catch(e){ d.querySelector('#e').textContent = 'Accès impossible : '+e.message; } });
          d.querySelector('[data-back]').onclick = ()=>done(null);
        });
        if(!root) continue;
      }
      /* dossier du projet : rouvert s'il existe, sinon créé automatiquement (aucune question) */
      const nom = (nomProjet||'Projet').trim().replace(/[\\/:*?"<>|#%]/g,'') || 'Projet';
      try{
        let f = null; const r0 = await g(root.base+'/root:/'+enc(ROOT+'/'+nom));
        if(r0.ok) f = await r0.json();
        else if(r0.status===404){ const r = await g(root.base+'/root:/'+enc(ROOT+'/'+nom+'/LISEZ-MOI.txt')+':/content?@microsoft.graph.conflictBehavior=replace', {method:'PUT', headers:{'Content-Type':'text/plain'}, body:'Données de l’application Pilotage chantier (projet '+nom+'). Ne pas renommer ni supprimer ces fichiers.'}); if(!r.ok) throw new Error('Création du dossier refusée ('+r.status+')'); f = await gj(root.base+'/root:/'+enc(ROOT+'/'+nom)); }
        else throw new Error('Erreur '+r0.status);
        close(); SCOPES = BASE_SCOPES;
        return {provider:'sharepoint', driveId:f.parentReference.driveId, itemId:f.id, nom:f.name, site:root.label, compte:acct.username};
      }catch(e){ await notice('<div class="box"><h2>Dossier non créé</h2><p>'+esc(e.message)+'</p><button id="b">Réessayer</button></div>'); }
    }
  }

  /* ---- stockage d'un projet ---- */
  async function open(h){
    await connect();
    const base = '/drives/'+h.driveId+'/items/'+h.itemId, url = (p,s)=>base+':/'+enc(p)+(s||'');
    const me = {oid:(acct.idTokenClaims&&acct.idTokenClaims.oid)||acct.localAccountId};
    await gj(base).catch(e=>{ throw new Error('Dossier SharePoint inaccessible ('+e.message+'). Votre compte Microsoft a-t-il été invité sur ce projet ?'); });
    async function putFile(p, body, type){
      const size = body.size!=null ? body.size : new Blob([body]).size;
      if(size < 3.5*1024*1024){ const r = await g(url(p,':/content?@microsoft.graph.conflictBehavior=replace'), {method:'PUT', headers:{'Content-Type':type||'application/json'}, body}); if(!r.ok) throw new Error('Écriture refusée ('+r.status+')'+(r.status===403?' : accès en lecture seule':'')); return r.json(); }
      const s = await gj(url(p,':/createUploadSession'), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'replace'}})});
      const blob = body instanceof Blob ? body : new Blob([body]); const CH = 5*320*1024; let last = null;
      for(let o=0; o<blob.size; o+=CH){ const part = blob.slice(o, Math.min(o+CH, blob.size)); const r = await fetch(s.uploadUrl, {method:'PUT', headers:{'Content-Range':'bytes '+o+'-'+(o+part.size-1)+'/'+blob.size}, body:part}); if(!r.ok&&r.status!==202) throw new Error('Envoi interrompu ('+r.status+')'); if(r.status!==202) last = await r.json().catch(()=>null); }
      return last;
    }
    async function getFile(p){ const r = await g(url(p,':/content')); if(r.status===404) return null; if(!r.ok) throw new Error('Lecture refusée ('+r.status+')'); return r; }
    async function children(p){ let out = [], u = url(p,':/children?$top=200'); try{ while(u){ const j = await gj(u); out = out.concat(j.value||[]); u = j['@odata.nextLink']||null; } }catch(e){ if(e.status!==404) throw e; } return out; }
    async function sha(b){ const url = await new Promise((res,rej)=>{ const fr = new FileReader(); fr.onload = ()=>res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); const h2 = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(url));  /* même identifiant que la base de l'outil : les images suivent d'un hébergement à l'autre */ return Array.from(new Uint8Array(h2)).map(x=>x.toString(16).padStart(2,'0')).join(''); }
    return {
      provider:'sharepoint', userId:me.oid,
      db:{ doc(path){ return {
        async get(){ const r = await getFile(path+'.json'); if(!r) return {exists:false, data:()=>undefined}; const j = await r.json(); return {exists:true, data:()=>j}; },
        async set(obj){ await putFile(path+'.json', JSON.stringify(obj)); },
        async delete(){ const r = await g(url(path+'.json'), {method:'DELETE'}); if(!r.ok && r.status!==404) throw new Error('Suppression refusée ('+r.status+')'); } }; } },
      blobs:{
        async upload(blob){ const id = await sha(blob); const ex = await g(url('media/'+id)); if(ex.status===404) await putFile('media/'+id, blob, blob.type||'application/octet-stream'); else if(!ex.ok) throw new Error('Lecture refusée ('+ex.status+')'); return {id}; },
        async fetch(id){ const r = await getFile('media/'+id); if(!r) return {ok:false}; const b = await r.blob(); return {ok:true, blob:async()=>b}; } },
      async list(){ return {docs:(await children('pilotage')).filter(x=>x.file&&/\.json$/.test(x.name)).map(x=>'pilotage/'+x.name.replace(/\.json$/,'')), media:(await children('media')).filter(x=>x.file).map(x=>x.name)}; },
      async mark(){ try{ const it = await gj(url('pilotage/meta.json')); return {mark:it.eTag||it.lastModifiedDateTime, by:it.lastModifiedBy&&it.lastModifiedBy.user&&it.lastModifiedBy.user.id}; }catch(e){ return null; } },
      async probe(){ try{ const n = '.sonde-'+me.oid; await putFile(n,'ok','text/plain'); await g(url(n),{method:'DELETE'}); return true; }catch(e){ return false; } },
      async members(){ const v = (await gj(base+'/permissions')).value||[];
        return v.filter(p=>!p.link).map(p=>{ const u = (p.grantedToV2&&p.grantedToV2.user)||(p.grantedToIdentitiesV2&&p.grantedToIdentitiesV2[0]&&p.grantedToIdentitiesV2[0].user)||{}; const roles = p.roles||[]; return {id:p.id, nom:u.displayName||'', email:(u.email||'').toLowerCase(), role:roles.includes('owner')?'admin':(roles.includes('write')?'editeur':'lecteur'), herite:!!p.inheritedFrom}; }); },
      async invite(email, role){ return gj(base+'/invite', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({requireSignIn:true, sendInvitation:true, roles:[role==='lecteur'?'read':'write'], recipients:[{email}], message:'Accès au projet « '+h.nom+' » (application Pilotage chantier). Connectez-vous à l’application avec votre identifiant, puis autorisez Microsoft quand la fenêtre s’ouvre.'})}); },
      async setRole(id, role){ return gj(base+'/permissions/'+id, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({roles:[role==='lecteur'?'read':'write']})}); },
      async remove(id){ const r = await g(base+'/permissions/'+id, {method:'DELETE'}); if(!r.ok) throw new Error('Retrait refusé ('+r.status+')'); },
      async disconnect(){ try{ await app.logoutPopup({account:acct}); }catch(e){} }
    };
  }
})();
