/* Cas chiffrés du moteur commun « variation de température » (vérifiés à la main). Lancer : node tests/thm.test.js
   Lit le script <script id="thmJs"> de index.html, sans navigateur. */
const fs=require('fs'),path=require('path');
const h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const i=h.indexOf('<script id="thmJs">'),j=h.indexOf('</script>',i);const s=h.slice(i+20,j);
global.window={};global.document={addEventListener(){},getElementById(){return null},body:{}};global.MutationObserver=class{observe(){}};
new Function(s)();const T=window.thm;
const near=(a,b,t,n)=>{const ok=Math.abs(a-b)<=t;console.log((ok?'OK  ':'FAIL')+' '+n+' = '+a+' (attendu '+b+')');if(!ok)process.exitCode=1;};
/* cas 1 : poutre béton 25x50 C25/30 (E=31000), 1 travée 6 m, dT=20, grad=10, alpha=10e-6 */
const g1={ok:true,kind:'beam',spans:[6],h:0.5,A:0.25*0.5,I:0.25*0.5**3/12,E:31000,alpha0:10};
let r=T.calc({thDT:20,thGrad:10},g1);
near(r.dLtot*1000,1.2,1e-9,'allongement libre (mm) 1e-5*20*6');
near(r.N,-775,1e-6,'effort bloqué (kN) E A α ΔT');
near(r.ffree*1000,0.9,1e-9,'flèche libre (mm) κL²/8');
near(Math.abs(r.fmax)*1000,0.9,0.01,'flèche numérique appui simple (mm)');
near(r.Mfix,31000*g1.I*1000*2e-4,1e-6,'moment encastré EIκ');
/* cas 2 : 2 travées égales 5+5, mêmes section : M appui = -1,5 EIκ */
const g2=Object.assign({},g1,{spans:[5,5]});
r=T.calc({thDT:0,thGrad:10},g2);
const EI=31000*g1.I*1000;
near(r.M[1],-1.5*EI*2e-4,1e-6,'moment sur appui 2 travées = -1,5 EIκ (kN·m)');
console.log('M appui =',r.M[1].toFixed(3),'EI =',EI.toFixed(1));
/* cas 3 : acier IPE 300 A=53.8 cm2, L=6, dT=30 => ΔL=12e-6*30*6=2,16 mm ; N=210000*53.8e-4*12e-6*30*1000=406.8 kN */
const g3={ok:true,kind:'beam',spans:[6],h:0.3,A:53.8e-4,I:8356e-8,E:210000,alpha0:12};
r=T.calc({thDT:30},g3);
near(r.dLtot*1000,2.16,1e-9,'acier allongement (mm)');
near(Math.abs(r.N),406.728,1e-3,'acier effort bloqué (kN)');
r=T.calc({thDT:30,thBloc:0.5},g3);near(Math.abs(r.N),203.364,1e-3,'taux de blocage 0,5');
/* réservoir D=10 H=8 e=0,3 dT=20: dD=10*1e-5*20=2mm ; Nring=31000*0.3*1e-5*20*1000=1860 kN/m */
r=T.calc({thDT:20},{ok:true,kind:'shell',D:10,H:8,e:0.3,E:31000,alpha0:10,h:0.3});
near(r.dD*1000,2,1e-9,'réservoir ΔD mm');near(Math.abs(r.Nring),1860,1e-6,'réservoir effort annulaire kN/m');
/* svg ne plante pas */
console.log(T.svg({}, g2, T.calc({thDT:20,thGrad:10},g2)).length>500?'svg ok':'svg court');
console.log(T.svg({}, {ok:true,kind:'shell',D:10,H:8,e:0.3,E:31000,alpha0:10,h:0.3}, T.calc({thDT:20},{ok:true,kind:'shell',D:10,H:8,e:0.3,E:31000,alpha0:10,h:0.3})).length>300?'svg shell ok':'x');

