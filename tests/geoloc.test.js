/* Position au pointage : cas accepté, refusé, permission du téléphone refusée, position indisponible, précision faible, messages au manager. Lancer : node tests/geoloc.test.js
   Lit le script <script id="geoJs"> de index.html, sans navigateur. */
const fs=require('fs'),path=require('path');
const h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const i=h.indexOf('<script id="geoJs">'),j=h.indexOf('</script>',i);
global.window={};new Function(h.slice(i+19,j))();const G=window.geoPt;
let bad=0;const ok=(c,n)=>{console.log((c?'OK  ':'FAIL')+' '+n);if(!c){bad++;process.exitCode=1;}};
const pos=(lat,lng,acc)=>({coords:{latitude:lat,longitude:lng,accuracy:acc}});
/* faux capteur : liste de réponses jouées dans l'ordre */
const capteur=(L)=>{const c={n:0,opts:[]};c.getCurrentPosition=(s,e,o)=>{c.opts.push(o);const r=L[Math.min(c.n++,L.length-1)];setTimeout(()=>r.err?e({code:r.err}):s(r.p),0);};return c;};
(async()=>{
  let c=capteur([{p:pos(48.8566,2.3522,12.4)}]),m=await G.mesure({geo:c});
  ok(m.etat==='ok'&&m.acc===12&&!m.faible&&m.essais===1,'accepté : bonne précision, un seul essai');
  ok(c.opts[0].enableHighAccuracy===true&&c.opts[0].maximumAge===0,'haute précision, jamais de position gardée en mémoire');
  c=capteur([{p:pos(48.85,2.35,300)},{p:pos(48.8566,2.3522,80)},{p:pos(48.8567,2.3523,150)}]);m=await G.mesure({geo:c});
  ok(m.etat==='ok'&&m.faible===true&&m.acc===80&&m.essais===3,'précision faible : 3 essais, meilleure mesure gardée, marquée faible');
  c=capteur([{p:pos(48.85,2.35,200)},{p:pos(48.8566,2.3522,20)}]);m=await G.mesure({geo:c});
  ok(m.etat==='ok'&&!m.faible&&m.essais===2,'précision mauvaise puis bonne : on s’arrête dès que c’est bon');
  c=capteur([{err:1}]);m=await G.mesure({geo:c});
  ok(m.etat==='permission'&&c.n===1,'permission du téléphone refusée : raison distincte, pas de nouvel essai');
  c=capteur([{err:2},{err:3},{err:2}]);m=await G.mesure({geo:c});
  ok(m.etat==='indisponible'&&c.n===3,'position indisponible après 3 essais');
  c=capteur([{p:pos(48.85,2.35,90)},{err:2}]);m=await G.mesure({geo:c});
  ok(m.etat==='ok'&&m.faible&&m.acc===90,'une mesure faible reste gardée si l’essai suivant échoue');
  m=await G.mesure({geo:null});ok(m.etat==='indisponible','pas de capteur : indisponible, rien ne bloque');
  c=capteur([{p:pos(1,1,10)}]);m=await G.mesure({geo:c,annule:()=>true});ok(c.n===0&&m.etat==='indisponible','annulé avant lecture : aucune lecture');
  /* fiche enregistrée */
  let f=G.fiche({etat:'ok',lat:48.8566,lng:2.3522,acc:12,faible:false,essais:1},{lat:48.8566,lng:2.3532},'2026-11-27T08:00:00Z');
  ok(f.etat==='ok'&&f.ecart>60&&f.ecart<80&&f.site.lat===48.8566,'écart au site calculé (environ 73 m)');
  f=G.fiche({etat:'ok',lat:1.5,lng:2.5,acc:9},null);ok(f.ecart===undefined&&f.site===undefined,'site sans position : aucun écart inventé');
  f=G.fiche({etat:'refus'},{lat:1,lng:1});ok(f.etat==='refus'&&f.lat===undefined&&f.lng===undefined&&f.acc===undefined,'refus : aucune coordonnée stockée');
  ok(G.fiche({etat:'ok',lat:1,lng:1,acc:5},{lat:null,lng:null}).ecart===undefined,'position de site vide (null) : pas d’écart');
  /* lecture des anciennes fiches */
  ok(G.etat(null)==='absent'&&G.etat({lat:1,lng:2,acc:5})==='ok'&&G.etat({refus:true})==='refus'&&G.etat({err:'refusée par le téléphone'})==='permission'&&G.etat({err:'délai dépassé'})==='indisponible','anciennes fiches comprises');
  ok(G.libelle(null)==='Position non disponible'&&G.libelle({etat:'refus'})==='Position refusée','libellés');
  /* messages au manager */
  let t=G.messageManager('Awa Diop','refus','in','27/11/2026','08:05','12 rue des Lilas');
  ok(/^Awa Diop a refusé de se géolocaliser/.test(t)&&/27\/11\/2026/.test(t)&&/08:05/.test(t)&&/12 rue des Lilas/.test(t)&&/l’agent a refusé/.test(t)&&/enregistré/.test(t),'message : refus');
  ok(/réglage du téléphone/.test(G.messageManager('A','permission','out','d','h','')),'message : permission');
  t=G.messageManager('A','indisponible','out','d','h','');ok(/n’a pas pu être géolocalisé/.test(t)&&/départ/.test(t)&&!/refusé de/.test(t),'message : position indisponible (sans dire « refusé »)');
  ok(!/openstreetmap|livre|page \d/i.test(h.slice(i,j)),'aucune source citée dans le moteur');
  console.log(bad?bad+' échec(s)':'tous verts');
})();
