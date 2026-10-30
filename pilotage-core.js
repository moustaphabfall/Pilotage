/* Noyau de stockage de l'Artefact de pilotage : choisit où sont hébergées les données.
   Chaque fournisseur (Supabase, Microsoft 365/SharePoint, …) s'enregistre dans window.PILOTAGE_PROVIDERS avec
   {label, available(), init()} ; init() définit window.PILOTAGE_SB() (→ db.doc(path).get/set/delete), window.PILOTAGE_BLOBS,
   window.PILOTAGE_USER, window.PILOTAGE_PROJET (id, nom, role, …) et window.PILOTAGE_RO.
   Principe commun : la personne se connecte avec son compte du fournisseur, autorise l'application, et les données sont enregistrées chez lui. */
(function(){
  const cfg = window.PILOTAGE_CONFIG || {}, P = window.PILOTAGE_PROVIDERS || {};
  const names = Object.keys(P).filter(k=>{ try{ return P[k].available(); }catch(e){ return false; } });
  if(!names.length){ console.info('Pilotage : mode local (aucun hébergement configuré)'); return; }
  let chosen = null, inner = null, innerBlobs = null, pr = null;
  const ls = {get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }};
  function choose(){
    let k = cfg.backend && names.includes(cfg.backend) ? cfg.backend : null;
    if(!k){ const s = ls.get('pg_backend'); if(s && names.includes(s)) k = s; }
    if(!k && names.length===1) k = names[0];
    if(k) return Promise.resolve(k);
    return new Promise(res=>{
      const d = document.createElement('div'); d.id = 'pgAuth'; d.setAttribute('style','position:fixed;inset:0;z-index:99999;background:#2B2F33;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif');
      d.innerHTML = '<div style="background:#fff;border-top:6px solid #F2A900;border-radius:10px;padding:22px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:10px"><h2 style="margin:0;font-size:20px">🏗 Pilotage chantier</h2><small style="color:#666">Où sont hébergées vos données ? Vous vous connectez avec votre compte de ce service et autorisez l’application.</small>'
        + names.map(n=>'<button data-n="'+n+'" style="padding:12px;border:0;border-radius:6px;background:#CC5F00;color:#fff;font-size:16px;font-weight:600;cursor:pointer">'+P[n].label+'</button>').join('')+'</div>';
      document.body.appendChild(d);
      d.querySelectorAll('[data-n]').forEach(b=>b.onclick = ()=>{ ls.set('pg_backend', b.dataset.n); d.remove(); res(b.dataset.n); });
    });
  }
  const outerBlobs = {
    async upload(b){ await window.PILOTAGE_SB(); return innerBlobs.upload(b); },
    async fetch(id){ await window.PILOTAGE_SB(); return innerBlobs.fetch(id); }
  };
  window.PILOTAGE_BLOBS = outerBlobs;
  const outer = ()=> (pr = pr || choose().then(async k=>{ chosen = k; P[k].init(); inner = window.PILOTAGE_SB; innerBlobs = window.PILOTAGE_BLOBS; window.PILOTAGE_BLOBS = outerBlobs; window.PILOTAGE_SB = outer; window.PILOTAGE_BACKEND = k; return inner(); }));
  window.PILOTAGE_SB = outer;
  window.pilotageChangeBackend = ()=>{ try{ localStorage.removeItem('pg_backend'); }catch(e){} location.reload(); };
})();
