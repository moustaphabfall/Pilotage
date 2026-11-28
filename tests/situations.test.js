/* Situations de travaux : lien devis-ouvrage, avancement automatique, situation 1 puis 2, ajustement, validation, facture unique, exports. Lancer : node tests/situations.test.js
   Lit le script <script id="sitJs"> de index.html, sans navigateur. */
const fs=require('fs'),path=require('path');
const h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const i=h.indexOf('<script id="sitJs">'),j=h.indexOf('</script>',i);
global.window={};new Function(h.slice(i+19,j))();const E=window.sitEng;
let bad=0;const ok=(c,n)=>{console.log((c?'OK  ':'FAIL')+' '+n);if(!c){bad++;process.exitCode=1;}};
const tasks={T1:0,T2:0,T3:0,T4:0};const pctOf=id=>(id in tasks)?tasks[id]:null;
const devis={id:'D1',titre:'Cloisons R+1',societe:'Soc',cond:{tva:20,retenue:5,avance:null},lignes:[
 {id:'L1',code:'CL1',libelle:'Cloisons',qte:'10',pu:'100',liens:[{tid:'T1',poids:1},{tid:'T2',poids:3}]},
 {id:'L2',code:'PE1',libelle:'Peinture',montant:'500',liens:[{tid:'T3'}]},
 {id:'L3',code:'DI1',libelle:'Divers',montant:'200',liens:[],pctManuel:'40'}]};
ok(E.totalDevis(devis)===1700,'total du devis = 1700 (qté × prix, montants saisis)');
ok(E.montantLigne({qte:'2,5',pu:'10,2'})===25.5,'virgule décimale acceptée');
tasks.T1=100;tasks.T2=0;
let lp=E.lignePct(devis.lignes[0],pctOf);ok(lp.pct===25&&lp.source==='ouvrages','moyenne pondérée (1×100 + 3×0)/4 = 25 %');
tasks.T2=100;lp=E.lignePct(devis.lignes[0],pctOf);ok(lp.pct===100,'tous les ouvrages faits = 100 %, mise à jour automatique');
ok(E.lignePct(devis.lignes[2],pctOf).pct===40&&E.lignePct(devis.lignes[2],pctOf).source==='manuel','ligne non liée : pointage à la main');
ok(E.lignePct({liens:[{tid:'ZZ'}],pctManuel:'10'},pctOf).pct===10,'ouvrage supprimé : on retombe sur la saisie à la main');
ok(E.liensParCode({code:'CL1'},[{id:'T9',quoi:'CL1 Cloison R+1'},{id:'T8',quoi:'Peinture'},{id:'cl1'}]).length===2,'lien automatique par code');
/* situation 1 */
tasks.T1=100;tasks.T2=100;tasks.T3=50;
const docs=[];let s1=E.creer(devis,[],pctOf,{date:'2026-11-01',du:'2026-10-01',au:'2026-10-31',par:'Awa',chantier:'Site A'});s1.id='S1';
ok(s1.numSit===1&&s1.statut==='brouillon','situation n°1 en brouillon');
ok(s1.lignes[0].montantCumul===1000&&s1.lignes[1].montantCumul===250&&s1.lignes[2].montantCumul===80,'cumuls par ligne');
ok(s1.totaux.periodeHT===1330&&s1.totaux.tva===266&&s1.totaux.ttc===1596,'total HT 1330, TVA 266, TTC 1596');
ok(s1.totaux.retenuePeriode===66.5&&s1.totaux.net===1529.5,'retenue de garantie 5 % du cumul puis net à payer');
ok(s1.totaux.avanceRembPeriode===null,'avance non saisie : aucune valeur inventée');
const sansCond=E.creer(Object.assign({},devis,{cond:{}}),[],pctOf,{});ok(sansCond.totaux.tva===null&&sansCond.totaux.retenuePeriode===null&&sansCond.totaux.ttc===sansCond.totaux.periodeHT,'sans conditions : ni TVA ni retenue');
/* ajustement */
E.ajuster(s1,'L2',40,'Resp','réception partielle');
ok(s1.lignes[1].pct===40&&s1.lignes[1].ajuste&&s1.lignes[1].ecart===-10&&s1.totaux.periodeHT===1280,'ajustement : écart avec le pointage visible, totaux refaits');
ok(s1.journal.some(x=>x.action==='ajustement'&&/50 % → 40 %/.test(x.detail)),'ajustement écrit au journal');
let err=null;try{E.ajuster(s1,'L2','abc','x');}catch(e){err=e;}ok(!!err,'valeur invalide refusée');
E.commenter(s1,'Vu avec le conducteur','Resp');ok(s1.commentaire==='Vu avec le conducteur','commentaire');
tasks.T3=60;E.actualiser(s1,devis,pctOf,'Resp');ok(s1.lignes[1].pctPointage===60&&s1.lignes[1].pct===40,'actualisation : le % ajusté à la main est gardé, le pointage est mis à jour');
E.envoyer(s1,'Awa');ok(s1.statut==='averifier','envoi en vérification');
E.valider(s1,'Resp');ok(s1.statut==='validee'&&s1.verrou,'validation : verrouillée');
err=null;try{E.ajuster(s1,'L1',50,'x');}catch(e){err=e;}ok(!!err,'situation validée : plus de modification');
err=null;try{E.valider(s1,'x');}catch(e){err=e;}ok(!!err,'impossible de valider deux fois');
/* facture unique */
s1.id='S1';let f=E.facturer(s1,docs,{id:'F1',date:'2026-11-05',echeance:'2026-12-05',par:'Resp'});
ok(f.numero===1&&s1.statut==='facturee'&&s1.factureId==='F1'&&docs.length===1&&f.ht===1280&&f.net===s1.totaux.net&&f.statut==='emise','facture émise : numéro, montants repris, statut Émise, lien situation-facture');
err=null;try{E.facturer(s1,docs,{id:'F2'});}catch(e){err=e;}ok(!!err&&docs.length===1,'impossible d’émettre deux fois');
const sB=E.creer(devis,[],pctOf,{});err=null;try{E.facturer(sB,docs,{id:'F3'});}catch(e){err=e;}ok(!!err,'situation non validée : pas de facture');
/* situation 2 */
tasks.T3=100;tasks.T1=100;tasks.T2=100;
let s2=E.creer(devis,[s1],pctOf,{date:'2026-12-01'});s2.id='S2';
ok(s2.numSit===2,'situation n°2');
ok(s2.lignes[0].pctPrec===100&&s2.lignes[0].montantPeriode===0&&s2.lignes[1].pctPrec===40&&s2.lignes[1].pct===100&&s2.lignes[1].montantPeriode===300,'cumul précédent déduit (peinture 40 % → 100 % = 300 €)');
ok(s2.totaux.cumulHT===1000+500+80&&s2.totaux.periodeHT===1580-1280,'total période = cumul - cumul précédent');
ok(s2.totaux.retenueCumul===79&&s2.totaux.retenuePeriode===r(79-64),'retenue de la période = retenue cumulée - précédente');
function r(x){return Math.round(x*100)/100;}
tasks.T3=20;let s3=E.creer(devis,[s1],pctOf,{});ok(s3.lignes[1].pct===40&&s3.lignes[1].recul===true&&s3.lignes[1].montantPeriode===0,'pointage en recul : jamais en dessous de la situation précédente, signalé');
/* avance */
const dA=Object.assign({},devis,{cond:{tva:20,retenue:null,avance:340}});tasks.T3=100;let sa=E.creer(dA,[],pctOf,{});ok(sa.totaux.avanceRembPeriode===E.r2(340*1580/1700),'avance remboursée au prorata de l’avancement');
/* numéros */
ok(E.numeroSuivant([{type:'facture',numero:3},{type:'facture',numero:7},{type:'devis',numero:9}],'facture')===8,'numéro de facture suivant');
/* exports */
const c=E.csv(s2);ok(/^﻿"Situation n°2"/.test(c)&&/;"300,00"/.test(c)&&/Net à payer/.test(c),'CSV situation (virgule décimale)');
const cf=E.csv(f);ok(/"Facture";"1"/.test(cf)&&/Net à payer/.test(cf)&&/1280,00/.test(cf),'CSV facture');
console.log(bad?bad+' échec(s)':'tous verts');
if(process.env.DBG){console.log(c.slice(0,400));console.log(cf.slice(0,300));}
