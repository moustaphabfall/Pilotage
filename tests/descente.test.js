/* Tests du format d'échange « descente de charge » et du découpage (lit <script id="dcExchangeJs"> de index.html, sans navigateur).
   Lancer : node tests/descente.test.js */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=/<script id="dcExchangeJs">([\s\S]*?)<\/script>/.exec(html); if(!m){ console.error('script dcExchangeJs introuvable'); process.exit(1); }
const sb={console}; sb.window=sb; vm.createContext(sb); vm.runInContext(m[1],sb,{timeout:3000});
const X=sb.DcExchange; let n=0, bad=0;
function t(nom,fn){ n++; try{ fn(); }catch(e){ bad++; console.error('ECHEC : '+nom+' -> '+(e&&e.message)); } }
const clone=o=>JSON.parse(JSON.stringify(o));
const S=()=>clone(X.sample('Revit'));
const ko=(doc,re)=>{ const r=X.check(doc); assert(!r.ok,'attendu refus'); assert(r.erreurs.some(e=>re.test(e)),'message attendu '+re+' dans '+JSON.stringify(r.erreurs)); return r; };
t('exemple valide',()=>{ const r=X.check(S()); assert(r.ok,JSON.stringify(r.erreurs)); assert.strictEqual(r.stats.batiments,1); assert.strictEqual(r.stats.niveaux,4); assert(r.stats.ouvrages>20); });
t('lecture texte JSON',()=>{ const r=X.read(JSON.stringify(S())); assert(r.ok); });
t('JSON illisible',()=>{ const r=X.read('{pas du json'); assert(!r.ok); assert(/JSON/.test(r.erreurs[0])); });
t('BOM accepte',()=>{ assert(X.read('﻿'+JSON.stringify(S())).ok); });
t('pas un objet',()=>{ ko([],/objet JSON/); ko(null,/objet JSON/); ko('x',/objet JSON/); });
t('mauvais format',()=>{ const d=S(); d.format='autre'; ko(d,/format/); });
t('version absente',()=>{ const d=S(); delete d.version; ko(d,/version/i); });
t('version majeure inconnue',()=>{ const d=S(); d.version='2.0'; ko(d,/non prise en charge/); });
t('version mineure plus recente = avertissement',()=>{ const d=S(); d.version='1.7'; const r=X.check(d); assert(r.ok); assert(r.avertissements.some(a=>/plus récente/.test(a))); });
t('nom de projet obligatoire',()=>{ const d=S(); d.projet.nom='  '; ko(d,/nom du projet/); });
t('batiments vides',()=>{ const d=S(); d.batiments=[]; ko(d,/bâtiment/); });
t('nom de batiment double',()=>{ const d=S(); d.batiments.push(clone(d.batiments[0])); ko(d,/nom de bâtiment est utilisé deux fois/); });
t('nom de niveau double dans un batiment',()=>{ const d=S(); d.batiments[0].niveaux[2].nom='rdc'; ko(d,/niveau est utilisé deux fois/); });
t('meme nom de niveau dans deux batiments : permis',()=>{ const d=S(); const b=clone(d.batiments[0]); b.nom='Bâtiment B'; b.niveaux.forEach(n=>n.ouvrages.forEach(o=>{ o.nom+=' B'; })); d.batiments.push(b); assert(X.check(d).ok); });
t('nom d ouvrage unique dans le projet',()=>{ const d=S(); d.batiments[0].niveaux[2].ouvrages[0].nom=d.batiments[0].niveaux[1].ouvrages[0].nom.toUpperCase(); ko(d,/existe déjà dans le projet/); });
t('nom d ouvrage sans accent compare',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].nom='Élément'; d.batiments[0].niveaux[2].ouvrages[0].nom='element'; ko(d,/existe déjà/); });
t('nom d ouvrage vide',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].nom=' '; ko(d,/nom de l.ouvrage est obligatoire/); });
t('type inconnu',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].type='tuyau'; ko(d,/inconnu/); });
t('geometrie absente',()=>{ const d=S(); delete d.batiments[0].niveaux[1].ouvrages[0].geometrie; ko(d,/géométrie est absente/); });
t('dimension negative',()=>{ const d=S(); const o=d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='dalle'); o.geometrie.epaisseur_m=-0.2; ko(d,/epaisseur_m.*supérieur à 0/); });
t('dimension texte avec virgule acceptee',()=>{ const d=S(); const o=d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='dalle'); o.geometrie.epaisseur_m='0,25'; const r=X.check(d); assert(r.ok); assert.strictEqual(r.doc.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='dalle').geometrie.epaisseur_m,0.25); });
t('dimension texte invalide',()=>{ const d=S(); const o=d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='dalle'); o.geometrie.largeur_m='abc'; ko(d,/largeur_m/); });
t('poutre de longueur nulle',()=>{ const d=S(); const o=d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='poutre'); o.geometrie.x2=o.geometrie.x1; o.geometrie.y2=o.geometrie.y1; ko(d,/longueur est nulle/); });
t('poteau : section ou diametre',()=>{ const d=S(); const o=d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='poteau'); o.geometrie.diametre_m=0.4; ko(d,/pas les deux/); delete o.geometrie.diametre_m; delete o.geometrie.h_m; ko(d,/section/); });
t('poteau rond',()=>{ const d=S(); const o=d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='poteau'); delete o.geometrie.b_m; delete o.geometrie.h_m; o.geometrie.diametre_m=0.4; assert(X.check(d).ok); });
t('hauteur reprise du niveau',()=>{ const r=X.check(S()); const p=r.doc.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='poteau'); assert.strictEqual(p.geometrie.hauteur_m,3); });
t('hauteur absente sans hauteur de niveau',()=>{ const d=S(); delete d.batiments[0].niveaux[1].hauteur_m; ko(d,/hauteur_m.*niveau n.a pas de hauteur_m/); });
t('cote de niveau obligatoire',()=>{ const d=S(); delete d.batiments[0].niveaux[1].cote_m; ko(d,/cote du niveau/); });
t('aucun defaut invente : charges absentes restent absentes',()=>{ const r=X.check(S()); r.doc.batiments[0].niveaux.forEach(n=>n.ouvrages.forEach(o=>{ assert.strictEqual(o.charges,undefined); })); assert.strictEqual(r.doc.projet.sol,undefined); });
t('charges valides conservees',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].charges={G_kN:120.5,Q_kN:'30,2'}; const r=X.check(d); assert(r.ok); assert.strictEqual(JSON.stringify(r.doc.batiments[0].niveaux[1].ouvrages[0].charges),JSON.stringify({G_kN:120.5,Q_kN:30.2})); });
t('charge negative refusee',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].charges={G_kN:-1}; ko(d,/charge « G_kN »/); });
t('charge inconnue = avertissement',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].charges={vent:3}; const r=X.check(d); assert(r.ok); assert(r.avertissements.some(a=>/ignoré/.test(a))); });
t('sol invalide refuse, jamais complete',()=>{ const d=S(); d.projet.sol={contrainte_admissible_kN_m2:-5}; ko(d,/sol/); const e=S(); e.projet.sol={}; const r=X.check(e); assert(r.ok); assert.strictEqual(r.doc.projet.sol,undefined); });
t('sol valide conserve',()=>{ const d=S(); d.projet.sol={contrainte_admissible_kN_m2:200}; const r=X.check(d); assert.strictEqual(JSON.stringify(r.doc.projet.sol),JSON.stringify({contrainte_admissible_kN_m2:200})); });
t('identifiant externe en double',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].id_externe='X1'; d.batiments[0].niveaux[1].ouvrages[1].id_externe='X1'; ko(d,/identifiant d.origine/); });
t('statut : plugin = importe, agent = non_verifie',()=>{ const a=X.check(S()); assert.strictEqual(a.doc.batiments[0].niveaux[0].ouvrages[0].statut,'importe'); const d=S(); d.source.outil='Agent IA'; d.batiments[0].niveaux[0].ouvrages[0].statut='importe'; const b=X.check(d); assert.strictEqual(b.doc.batiments[0].niveaux[0].ouvrages[0].statut,'non_verifie'); });
t('hors limite',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages.find(o=>o.type==='dalle').geometrie.largeur_m=5000; ko(d,/hors limite/); });
t('pollution de prototype ignoree',()=>{ const raw=JSON.parse('{"__proto__":{"x":1},"format":"bina-descente-charge","version":"1.0","projet":{"nom":"P"},"batiments":[{"nom":"A","niveaux":[{"nom":"N","cote_m":0,"ouvrages":[{"nom":"d","type":"dalle","geometrie":{"x":0,"y":0,"largeur_m":1,"longueur_m":1,"epaisseur_m":0.2},"constructor":{"prototype":{"y":2}}}]}]}]}'); const r=X.check(raw); assert(r.ok); assert.strictEqual(({}).x,undefined); assert.strictEqual(({}).y,undefined); });
t('aucun ouvrage',()=>{ const d=S(); d.batiments[0].niveaux.forEach(n=>{ n.ouvrages=[]; }); ko(d,/Aucun ouvrage/); });
t('le document source n est pas modifie',()=>{ const d=S(), copie=JSON.stringify(d); X.check(d); assert.strictEqual(JSON.stringify(d),copie); });
/* découpage */
t('arbre Projet > Batiment > Niveau > Ouvrage',()=>{ const r=X.check(S()), tr=X.tree(r.doc); assert.strictEqual(tr.niveau,'projet'); assert.strictEqual(tr.enfants[0].niveau,'batiment'); assert.strictEqual(tr.enfants[0].enfants[0].niveau,'niveau'); assert.strictEqual(tr.enfants[0].enfants[1].enfants[0].niveau,'ouvrage'); const c=X.compte(tr); assert.strictEqual(c.ouvrages,r.stats.ouvrages); assert.strictEqual(c.niveaux,4); });
t('identifiants stables et retrouves',()=>{ const r=X.check(S()), tr=X.tree(r.doc); const o=tr.enfants[0].enfants[1].enfants[0]; assert.strictEqual(o.id,'b0n1o0'); const l=X.locate(r.doc,o.id); assert.strictEqual(l.o.nom,o.nom); assert.strictEqual(X.locate(r.doc,'b9'),null); assert.strictEqual(X.locate(r.doc,'zz'),null); });
t('chaque ouvrage a un type de bibliotheque',()=>{ const r=X.check(S()); X.aPlat(r.doc).forEach(e=>{ assert(X.TYPES[e.ouvrage.type].ts); }); });
t('plan : tout est a creer dans une bibliotheque vide',()=>{ const r=X.check(S()), p=X.plan(r.doc,{}); assert.strictEqual(p.aCreer,r.stats.ouvrages); assert.strictEqual(p.existants,0); assert.strictEqual(p.batiments[0].niveaux[1].libNom,'RDC'); });
t('plan : un ouvrage existant n est pas recree',()=>{ const r=X.check(S()), p=X.plan(r.doc,{ouvrages:[{nom:'d1 - rdc'}],batiments:['Bâtiment A'],niveaux:['RDC'],nivBat:{RDC:'Bâtiment A'}}); assert.strictEqual(p.existants,1); assert.strictEqual(p.aCreer,r.stats.ouvrages-1); assert.strictEqual(p.batiments[0].existe,true); assert.strictEqual(p.batiments[0].niveaux[1].existe,true); });
t('plan : reimport du meme fichier ne cree rien',()=>{ const r=X.check(S()), ex=X.aPlat(r.doc).map(e=>({nom:e.ouvrage.nom})); assert.strictEqual(X.plan(r.doc,{ouvrages:ex}).aCreer,0); });
t('plan : identifiant externe deja connu',()=>{ const d=S(); d.batiments[0].niveaux[1].ouvrages[0].id_externe='GUID-1'; const r=X.check(d); const p=X.plan(r.doc,{ouvrages:[{nom:'autre',id_externe:'GUID-1'}]}); assert.strictEqual(p.existants,1); });
t('plan : niveau de meme nom dans deux batiments recoit un nom distinct',()=>{ const d=S(); const b=clone(d.batiments[0]); b.nom='Bâtiment B'; b.niveaux.forEach(n=>n.ouvrages.forEach(o=>{ o.nom+=' B'; })); d.batiments.push(b); const r=X.check(d); const p=X.plan(r.doc,{}); const noms=[].concat(...p.batiments.map(x=>x.niveaux.map(n=>n.libNom))); assert.strictEqual(new Set(noms).size,noms.length); assert(noms.includes('Bâtiment A · RDC')); });
t('plan : niveau existant d un autre batiment ne est pas pris',()=>{ const r=X.check(S()); const p=X.plan(r.doc,{batiments:['Autre'],niveaux:['RDC'],nivBat:{RDC:'Autre'}}); assert.strictEqual(p.batiments[0].niveaux[1].libNom,'Bâtiment A · RDC'); assert.strictEqual(p.batiments[0].niveaux[1].existe,false); });
t('plan : agent IA, seuls les ouvrages acceptes',()=>{ const d=S(); d.source.outil='Agent IA'; const r=X.check(d); const nb=r.stats.ouvrages; let p=X.plan(r.doc,{seulementValides:true}); assert.strictEqual(p.aCreer,0); assert.strictEqual(p.ecartes,nb); r.doc.batiments[0].niveaux[1].ouvrages[0].statut='valide'; p=X.plan(r.doc,{seulementValides:true}); assert.strictEqual(p.aCreer,1); });
/* maquette */
t('maquette : un prisme par ouvrage, vraies dimensions',()=>{ const r=X.check(S()), mq=X.massing(r.doc); assert.strictEqual(mq.boites.length,r.stats.ouvrages); assert(Math.abs(mq.dims.L-11.2)<1e-9); assert(Math.abs(mq.dims.l-7.2)<1e-9); assert(Math.abs(mq.dims.H-7.6)<1e-9); });
t('maquette : dalle sous sa cote, poteau au dessus',()=>{ const r=X.check(S()), mq=X.massing(r.doc); const d=mq.boites.find(b=>b.id==='b0n1o'+r.doc.batiments[0].niveaux[1].ouvrages.findIndex(o=>o.type==='dalle')); assert(Math.abs(d.z1-0)<1e-9&&Math.abs(d.z0+0.2)<1e-9); const p=mq.boites.find(b=>b.type==='poteau'); assert(Math.abs(p.z1-p.z0-3)<1e-9); });
t('maquette : echelle unique (projection)',()=>{ const a=X.proj(0,0,0,0,0,10), b=X.proj(5,0,0,0,0,10), c=X.proj(0,0,5,0,0,10); assert(Math.abs(Math.hypot(b.sx-a.sx,b.sy-a.sy)-50)<1e-9); assert(Math.abs(Math.hypot(c.sx-a.sx,c.sy-a.sy)-50)<1e-9); const e=X.proj(0,5,0,0,Math.PI/2,10); assert(Math.abs(Math.hypot(e.sx,e.sy)-50)<1e-9); });
t('maquette : faces triees du fond vers l avant',()=>{ const r=X.check(S()), f=X.faces(X.massing(r.doc),-0.6,0.5,10); assert(f.length>0); for(let i=1;i<f.length;i++) assert(f[i-1].d>=f[i].d); });
t('maquette : filtre',()=>{ const r=X.check(S()), mq=X.massing(r.doc,o=>o.type==='poteau'); assert(mq.boites.every(b=>b.type==='poteau')); });
t('tous les types ont une forme',()=>{ const d={format:X.FORMAT,version:X.VERSION,source:{outil:'Autre'},projet:{nom:'T'},batiments:[{nom:'A',niveaux:[{nom:'N',cote_m:0,hauteur_m:3,ouvrages:[
 {nom:'a',type:'dalle',geometrie:{x:0,y:0,largeur_m:5,longueur_m:4,epaisseur_m:0.2}},{nom:'b',type:'poutre',geometrie:{x1:0,y1:0,x2:4,y2:3,b_m:0.2,h_m:0.4}},{nom:'c',type:'poteau',geometrie:{x:0,y:0,b_m:0.3,h_m:0.3}},{nom:'d',type:'voile',geometrie:{x1:0,y1:0,x2:4,y2:0,epaisseur_m:0.2}},{nom:'e',type:'semelle',geometrie:{x:0,y:0,largeur_m:1,longueur_m:1,epaisseur_m:0.4}},{nom:'f',type:'pieu',geometrie:{x:0,y:0,diametre_m:0.6,longueur_m:12}},{nom:'g',type:'mur_soutenement',geometrie:{x1:0,y1:0,x2:6,y2:0,epaisseur_m:0.3,hauteur_m:3}},{nom:'h',type:'escalier',geometrie:{x1:0,y1:0,x2:3,y2:0,largeur_m:1.2}}]}]}]};
 const r=X.check(d); assert(r.ok,JSON.stringify(r.erreurs)); const mq=X.massing(r.doc); assert.strictEqual(mq.boites.length,8); mq.boites.forEach(b=>{ assert(b.poly.length>=4); assert(b.z1>b.z0); b.poly.forEach(q=>{ assert(isFinite(q[0])&&isFinite(q[1])); }); }); });
t('fmt virgule decimale',()=>{ assert.strictEqual(X.fmt(2.5),'2,5'); assert.strictEqual(X.fmt(10.6),'10,6'); });
t('aucune reference de source dans le module',()=>{ assert(!/classeur|guide p\.|Concrete Centre|Pratique de l/i.test(m[1])); });
t('exemple du plugin Revit conforme au contrat',()=>{ const f=path.join(__dirname,'..','plugins','revit','exemple','exemple-revit.json'); const r=X.read(fs.readFileSync(f,'utf8')); assert(r.ok,JSON.stringify(r.erreurs)); assert.strictEqual(r.avertissements.length,0); assert.strictEqual(r.stats.ouvrages,8); const p=X.plan(r.doc,{}); assert.strictEqual(p.aCreer,8); });
console.log(n+' tests, '+bad+' echec(s)'); process.exit(bad?1:0);
