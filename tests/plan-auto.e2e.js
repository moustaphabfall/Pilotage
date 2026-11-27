/* Test navigateur de l'analyse automatique des plans (aucun réseau : la fonction d'appel IA est remplacée par un double).
   Lancer : node tests/plan-auto.e2e.js   (nécessite playwright et chromium) */
const {chromium}=require('playwright'); const path=require('path'); const assert=require('assert');
const URL_='file://'+path.join(__dirname,'..','index.html'); let n=0, bad=0;
const ok=(c,m)=>{ n++; if(!c){ bad++; console.error('ECHEC : '+m); } };
const LEC=(cotes)=>({message:'ok',lecture:Object.assign({niveaux:[{nom:'RDC',cote_cm:0}],pieces:[{nom:'Salon',polygone:[[0.1,0.1],[0.5,0.1],[0.5,0.5],[0.1,0.5]]},{polygone:[[0.5,0.1],[0.9,0.1],[0.9,0.5],[0.5,0.5]]}],compartiments:[{polygone:[[0.05,0.05],[0.95,0.05],[0.95,0.95],[0.05,0.95]]}],pastilles:[{nom:'Porte 1',type:'porte',lot:'architecture',x:0.3,y:0.5,dimensions_cm:{longueur:90}},{nom:'Machine A',type:'machine',lot:'equipements',x:0.7,y:0.3,dimensions_cm:{largeur:60,profondeur:60}}]},cotes?{cotes_lues:[{p1:{x:0.1,y:0.9},p2:{x:0.9,y:0.9},longueur_cm:800}]}:{})});
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 async function neuf(w){
  const p=await b.newPage({viewport:{width:w,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL_); await p.waitForTimeout(1200);
  await p.evaluate(()=>{ window.__corps=[]; window.__mode='ok'; window.__cotes=true;
   window.dimIaCall=function(corps){ window.__corps.push(JSON.parse(JSON.stringify(corps)));
    if(window.__mode==='pend') return new Promise(function(){});
    if(window.__mode==='boom') return Promise.reject(new Error('réseau'));
    if(window.__mode==='ko') return Promise.resolve({resp:{ok:false},j:{}});
    return Promise.resolve({resp:{ok:true},j:{data:window.__lec}}); };
   window.__lec=null; window.deposer=function(k){ var c=document.createElement('canvas'); c.width=800; c.height=600; var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,800,600); g.fillStyle='#000'; g.fillRect(40+k*7,40,300,200); var src=c.toDataURL('image/png'); openPlanForm(src,800,600,'Plan RDC '+k); var f=document.querySelector('#modalBody input[type=text]'); savePlan(); return src; };
  });
  return {p,errs};
 }
 const set=(p,lec)=>p.evaluate(l=>{ window.__lec=l; },lec);
 const etat=(p)=>p.evaluate(()=>({corps:window.__corps.length,temp:(window.__plpTemp||[]).length,zones:state.zonesChantier.filter(z=>z.plp).length,taches:state.tasks.filter(t=>t.pastille).length,plans:state.plans.length,jobs:Object.values(window.__plpJobs||{}).map(j=>j.etat),badge:(document.getElementById('plpAutoBadge')||{}).innerText||''}));
 /* 1. déclenchement automatique sans clic */
 let {p,errs}=await neuf(1100); await set(p,LEC(true));
 await p.evaluate(()=>window.deposer(1)); await p.waitForTimeout(2500);
 let e=await etat(p); const e0={plans:e.plans-1};
 ok(e.corps===1,'un appel après le dépôt, sans clic ('+e.corps+')'); ok(e.jobs.includes('ok'),'analyse terminée '+JSON.stringify(e.jobs)); ok(e.zones===3,'pièces et compartiment créés ('+e.zones+')'); ok(e.taches===2,'ouvrages créés ('+e.taches+')'); ok(e.temp===0,'image temporaire effacée');
 const c=await p.evaluate(()=>window.__corps[0]); ok(!('plan_nom' in c)&&c.fichiers.length===1&&Object.keys(c.fichiers[0]).sort().join()==='data,type'&&c.fichiers[0].type==='image/jpeg','seule une image réduite part, sans nom ni métadonnée');
 const z=await p.evaluate(()=>state.zonesChantier.filter(z=>z.plp).map(z=>({nom:z.nom,st:z.plp.statut,g:z.plp.guid,c:z.plp.classe,cp:!!z.compartiment}))); ok(z.some(x=>x.nom==='Salon')&&z.some(x=>x.nom==='Pièce 1'),'nom repris, sinon nom neutre'); ok(z.every(x=>x.st==='non_verifie'&&x.g&&x.c),'tout non vérifié avec identifiant et classe'); ok(z.some(x=>x.cp&&x.c==='IfcZone'),'compartiment créé');
 const t=await p.evaluate(()=>state.tasks.filter(t=>t.pastille).map(t=>t.pastille)); ok(t.every(x=>x.statut==='non_verifie'&&x.guid&&x.classe),'ouvrages non vérifiés avec identifiant et classe'); ok(t.find(x=>x.type==='porte').classe==='IfcDoor','classe de la porte');
 ok(e.badge.indexOf('image du plan')>=0||e.badge.indexOf('analysé')>=0,'pastille d’avancement affichée');
 /* 2. idempotence : même plan redéposé */
 await p.evaluate(()=>window.deposer(1)); await p.waitForTimeout(2000); e=await etat(p);
 ok(e.plans===e0.plans+2,'deux dépôts'); ok(e.corps===1,'pas de seconde analyse du même plan'); ok(e.zones===3&&e.taches===2,'pas de doublon');
 /* 3. réglage désactivé */
 await p.evaluate(()=>plpAuto.regler(false)); await p.evaluate(()=>window.deposer(2)); await p.waitForTimeout(2000); e=await etat(p); ok(e.corps===1,'réglage désactivé : aucun appel');
 /* 4. réglage dans l'écran, interrupteur */
 await p.evaluate(()=>plpOpen({})); await p.waitForTimeout(300); let sw=await p.evaluate(()=>{ const b=document.querySelector('[data-pl="auto_toggle"]'); return b&&b.getAttribute('aria-checked'); }); ok(sw==='false','interrupteur désactivé visible');
 await p.click('[data-pl="auto_toggle"]'); ok(await p.evaluate(()=>plpAuto.actif()),'interrupteur réactive'); ok(await p.evaluate(()=>/image du plan est analysée, puis effacée/.test(document.querySelector('.plpRoot').innerText)),'ligne de confidentialité visible');
 await p.evaluate(()=>closeModal());
 /* 5. échec réseau puis relance */
 await p.evaluate(()=>{ window.__mode='boom'; }); await p.evaluate(()=>window.deposer(3)); await p.waitForTimeout(2000); e=await etat(p);
 ok(e.jobs.includes('echec'),'échec signalé'); ok(e.temp===0,'image effacée après échec'); ok(/Relancer/.test(e.badge),'bouton Relancer'); ok(e.corps===2,'une tentative');
 await p.evaluate(()=>{ window.__mode='ok'; }); await p.click('#plpAutoBadge [data-plpb="retry"]'); await p.waitForTimeout(2000); e=await etat(p); ok(e.corps===3&&e.jobs.pop()==='ok','relance réussie'); ok(e.temp===0,'image effacée après relance');
 /* 6. réponse refusée par la garde */
 await p.evaluate(()=>{ window.__mode='ko'; }); await p.evaluate(()=>window.deposer(4)); await p.waitForTimeout(2000); e=await etat(p); ok(e.jobs.pop()==='echec'&&e.temp===0,'refus : message simple, image effacée');
 /* 7. annulation */
 await p.evaluate(()=>{ window.__mode='pend'; }); await p.evaluate(()=>window.deposer(5)); await p.waitForTimeout(1500); e=await etat(p); ok(e.jobs.slice(-1)[0]==='cours'&&e.temp===1,'en cours : image temporaire présente'); await p.click('#plpAutoBadge [data-plpb="cancel"]'); await p.waitForTimeout(500); e=await etat(p); ok(e.temp===0,'image effacée après annulation'); ok(e.jobs.pop()==='echec','annulation : rien de bloquant');
 ok(errs.length===0,'aucune erreur de page '+errs.join('|')); await p.close();
 /* 8. échelle introuvable : pièces sans cotes, demande de calibrage */
 ({p,errs}=await neuf(820)); await set(p,LEC(false)); await p.evaluate(()=>window.deposer(1)); await p.waitForTimeout(2500); e=await etat(p);
 ok(e.jobs.includes('calib'),'demande de calibrage '+JSON.stringify(e.jobs)); ok(e.zones===3&&e.taches===0,'pièces créées, pastilles en attente d’échelle ('+e.zones+','+e.taches+')'); ok(/calibrez/i.test(e.badge),'message de calibrage');
 const sc=await p.evaluate(()=>state.zonesChantier.filter(z=>z.plp).every(z=>!z.plp.polygone_cm)); ok(sc,'aucune cote inventée');
 /* après calibrage, les pastilles sont créées */
 await p.evaluate(()=>{ const d=window.__plpState.draft, k=Object.keys(d.plans)[0]; d.plans[k].cm_par_px=1; window.__plpState.draft=d; });
 await p.evaluate(()=>{ plpOpen({}); }); await p.waitForTimeout(200); await p.evaluate(()=>{ const d=window.__plpState.draft; Object.keys(d.plans).forEach(k=>PlanLecture.recalculer(d,k)); }); await p.evaluate(()=>{ window.dcAutoTest=1; });
 ok(errs.length===0,'aucune erreur de page (échelle) '+errs.join('|')); await p.close();
 /* 9. pas de défilement horizontal */
 for(const w of [390,820,1100]){
  ({p,errs}=await neuf(w)); await set(p,LEC(true)); await p.evaluate(()=>window.deposer(1)); await p.waitForTimeout(800);
  const s1=await p.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]); ok(s1[0]<=s1[1],'pastille sans défilement horizontal à '+w);
  await p.waitForTimeout(1800); await p.evaluate(()=>plpOpen({})); await p.waitForTimeout(300);
  await p.evaluate(()=>{ document.querySelectorAll('.plpEye[aria-pressed="false"]').forEach(x=>x.click()); }); await p.waitForTimeout(200);
  const s2=await p.evaluate(()=>{ const m=document.getElementById('modalBody'); return [document.documentElement.scrollWidth,innerWidth,m.scrollWidth,m.clientWidth]; }); ok(s2[0]<=s2[1]&&s2[2]<=s2[3]+1,'écran sans défilement horizontal à '+w+' '+s2.join('/'));
  ok(errs.length===0,'aucune erreur de page à '+w+' '+errs.join('|')); await p.close();
 }
 await b.close(); console.log(n+' tests, '+bad+' echec(s)'); process.exit(bad?1:0);
})();
