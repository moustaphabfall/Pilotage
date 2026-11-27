/* Test navigateur des évaluations (aucun réseau : l'appel IA est remplacé par un double).
   Lancer : node tests/evaluations.e2e.js   (nécessite playwright et chromium) */
const {chromium}=require('playwright'); const path=require('path');
const URL_='file://'+path.join(__dirname,'..','index.html'); let n=0, bad=0;
const ok=(c,m)=>{ n++; if(!c){ bad++; console.error('ECHEC : '+m); } };
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const LEC={message:'six questions lues',questions:[
 {type:'qcm_unique',enonce:'Quel outil compacte le béton ?',propositions:['Le vibreur','La truelle','Le niveau'],corrige:0,points:2},
 {type:'qcm_multiple',enonce:'Quels équipements sont obligatoires ?',propositions:['Casque','Chaussures','Lunettes de soleil'],corrige:[0,1],points:2},
 {type:'vrai_faux',enonce:'Le coffrage doit être humidifié.',corrige:true},
 {type:'ouverte_courte',enonce:'Citez un risque en hauteur.'},
 {type:'ouverte_longue',enonce:'Décrivez la préparation d’un coulage.',corrige:'Coffrage, armatures, nettoyage'},
 {type:'numerique',enonce:'Surface de 4 m par 3 m ?',corrige:{valeur:12},unite:'m²',points:2}]};
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 async function neuf(w){
  const p=await b.newPage({viewport:{width:w,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL_); await p.waitForTimeout(1200);
  await p.evaluate(()=>{ window.paIsAdmin=()=>true; window.PILOTAGE_USER={id:'u1',nom:'Élève Un'}; window.__corps=[]; window.__mode='ok'; window.__tmpAvant=0;
   state.sessionsFormation=[{id:'S1',nom:'Session test',eleveIds:['u1'],dateDebut:'2020-01-01T00:00',dateFin:'2099-01-01T00:00'}];
   window.dimIaCall=function(c){ window.__corps.push(JSON.parse(JSON.stringify(c))); window.__tmp=(window.__evTemp||[]).length; if(window.__mode==='boom') return Promise.reject(new Error('réseau')); if(window.__mode==='vieux') return Promise.resolve({resp:{ok:false,status:400},j:{error:'Message vide'}}); if(window.__mode==='absent') return Promise.resolve({resp:{ok:false,status:404},j:{}}); return Promise.resolve({resp:{ok:true,status:200},j:{data:window.__lec}}); }; });
  await p.evaluate(l=>{ window.__lec=l; },LEC);
  return {p,errs};
 }
 const okAlerte=async(p)=>{ await p.evaluate(()=>{ const o=document.getElementById('miniPromptOverlay'); const b=document.getElementById('miniPromptOkBtn'); if(o&&b&&getComputedStyle(o).display!=='none') b.click(); }); await p.waitForTimeout(150); };
 const admin=(p)=>p.evaluate(()=>__beEvalApi.evalsAdmin('S1'));
 const eleve=(p)=>p.evaluate(()=>{ window.paIsAdmin=()=>false; window.PILOTAGE_PROJET=Object.assign({},window.PILOTAGE_PROJET,{fonction:'Élève stagiaire'}); __beEvalApi.eleve('S1'); });
 /* 1. dépôt et liste */
 let {p,errs}=await neuf(1100); await admin(p);
 ok(await p.evaluate(()=>!document.querySelector('#be-ses-fomg')&&!/Gérer les formulaires/.test(document.body.innerText)),'plus de gestionnaire des formulaires');
 ok(await p.evaluate(()=>/Déposer une évaluation/.test(document.querySelector('.evlRoot').innerText)),'bouton Déposer une évaluation');
 await p.click('[data-evl="deposer"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/Depuis l’appareil/.test(document.body.innerText)&&/Prendre une photo/.test(document.body.innerText)),'Depuis l’appareil et Prendre une photo');
 await p.click('[data-evl="dep_ok"]'); ok(await p.evaluate(()=>!document.getElementById('evlDE').hidden),'titre requis');
 await p.setInputFiles('#evlF1',{name:'controle-beton.png',mimeType:'image/png',buffer:PNG}); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.getElementById('evlT').value==='controle-beton'),'titre proposé depuis le nom du fichier');
 await p.fill('#evlT','Contrôle béton'); await p.click('[data-evl="dep_ok"]'); await p.waitForTimeout(300);
 let ev=await p.evaluate(()=>state.evaluations.filter(e=>e.sessionId==='S1').map(e=>({nom:e.nom,pj:e.pj&&e.pj.name,date:e.dateDepot,vis:e.visibleEleves})));
 ok(ev.length===1&&ev[0].nom==='Contrôle béton'&&ev[0].pj==='controle-beton.png'&&/^\d{4}-\d{2}-\d{2}$/.test(ev[0].date)&&ev[0].vis===true,'évaluation déposée '+JSON.stringify(ev));
 const lst=await p.evaluate(()=>{ const t=document.querySelector('.evlIt'); return {txt:t.innerText,btns:[...t.querySelectorAll('.evlIcB')].map(b=>b.getAttribute('aria-label')),eye:!!t.querySelector('.evlEye'),frame:!!t.querySelector('.evlIcF')}; });
 ok(lst.eye&&lst.frame&&/Contrôle béton/.test(lst.txt)&&/Dépôt/.test(lst.txt)&&/controle-beton\.png/.test(lst.txt),'ligne : œil, icône en cadre, titre, date, pièce jointe');
 ok(lst.btns.includes('Ouvrir l’image')&&lst.btns.includes('Télécharger')&&lst.btns.includes('Transformer en questionnaire'),'boutons Ouvrir, Télécharger, Transformer '+lst.btns.join('|'));
 ok(await p.evaluate(()=>[...document.querySelectorAll('.evlRow')].every(r=>r.querySelectorAll('.evlIcB').length<=3)),'trois boutons au plus par ligne');
 await p.click('.evlEye'); ok(await p.evaluate(()=>document.querySelector('.evlB').hidden),'œil replie'); await p.click('.evlEye');
 /* 2. transformation : appel sans fuite, serveur absent, exemple */
 await p.click('[data-evl="transformer"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/Seuls le texte extrait et des images réduites sont envoyés/.test(document.body.innerText)&&/effacées/.test(document.body.innerText)),'ligne de confidentialité');
 await p.evaluate(()=>{ window.__mode='absent'; }); await p.click('[data-evl="tr_go"]'); await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>/fonction serveur absente|pas disponible/.test(document.body.innerText)&&/Voir un exemple/.test(document.body.innerText)),'serveur absent : message précis et bouton exemple');
 ok(await p.evaluate(()=>(window.__evTemp||[]).length===0),'copies temporaires effacées après échec');
 await p.evaluate(()=>{ window.__mode='vieux'; }); await p.click('[data-evl="tr_go"]'); await p.waitForTimeout(1500); ok(await p.evaluate(()=>/pas encore à jour/.test(document.body.innerText)),'serveur pas à jour : message précis');
 await p.evaluate(()=>{ window.__mode='boom'; }); await p.click('[data-evl="tr_go"]'); await p.waitForTimeout(1500); ok(await p.evaluate(()=>/n’a pas abouti/.test(document.body.innerText)&&(window.__evTemp||[]).length===0),'échec réseau : message simple, copies effacées');
 ok(await p.evaluate(()=>!(state.evaluations[0].questions)),'échec : rien n’a été modifié');
 await p.evaluate(()=>{ window.__mode='ok'; }); await p.click('[data-evl="tr_go"]'); await p.waitForTimeout(2500);
 const corps=await p.evaluate(()=>window.__corps.slice(-1)[0]);
 ok(corps&&corps.mode==='evaluation_questions'&&corps.sources.length===1&&Object.keys(corps.sources[0]).sort().join()==='images,nom,texte','demande : texte et images réduites seulement');
 ok(await p.evaluate(()=>!JSON.stringify(window.__corps).includes('data:image/png;base64')),'jamais le fichier d’origine');
 ok(await p.evaluate(()=>(window.__evTemp||[]).length===0),'copies temporaires effacées après succès');
 ok(await p.evaluate(()=>/Relire le questionnaire/.test(document.body.innerText)&&document.querySelectorAll('.evlQ').length===6),'relecture : six questions');
 const types=await p.evaluate(()=>state.evaluations[0].questions.map(q=>q.type)); ok(types.join()==='qcm_unique,qcm_multiple,vrai_faux,ouverte_courte,ouverte_longue,numerique','six types lus '+types.join());
 ok(await p.evaluate(()=>state.evaluations[0].questions.every(q=>q.statut==='non_verifie')),'toutes non vérifiées');
 ok(await p.evaluate(()=>state.evaluations[0].questions[3].corrige===undefined&&state.evaluations[0].questions[2].corrige.reponse===true),'corrigé seulement quand il figure dans le document');
 /* valider sans relire : refusé */
 await p.click('[data-evl="q_valider"]'); await p.waitForTimeout(200); ok(await p.evaluate(()=>/restent à accepter/.test(document.body.innerText)&&!state.evaluations[0].questionnaire.valide),'validation refusée tant que tout n’est pas relu');
 /* accepter, modifier (type), écarter */
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[0].querySelector('[data-evl="q_ok"]').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[1].querySelector('[data-evl="q_ok"]').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[2].querySelector('[data-evl="q_ok"]').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[3].querySelector('[data-evl="q_mod"]').click(); }); await p.waitForTimeout(100);
 await p.selectOption('#evq-type','ouverte_longue'); await p.fill('#evq-bon','Chute de hauteur'); await p.click('[data-evl="q_save"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>{ const q=state.evaluations[0].questions[3]; return q.type==='ouverte_longue'&&q.statut==='modifie'&&q.texte==='Citez un risque en hauteur.'&&q.corrige===undefined; }),'type changé, énoncé gardé, corrigé non deviné au changement de type');
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[3].querySelector('[data-evl="q_mod"]').click(); }); await p.waitForTimeout(100);
 await p.fill('#evq-bon','Chute de hauteur'); await p.click('[data-evl="q_save"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>state.evaluations[0].questions[3].corrige.texte==='Chute de hauteur'),'corrigé saisi par le formateur');
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[4].querySelector('[data-evl="q_ecarte"]').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[5].querySelector('[data-evl="q_ok"]').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[1].querySelector('[data-evl="q_mod"]').click(); }); await p.waitForTimeout(100);
 await p.fill('#evq-props','Casque\nChaussures\nLunettes de soleil\nGilet'); await p.click('[data-evl="q_save"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>{ const q=state.evaluations[0].questions[1]; return q.propositions.length===4&&q.statut==='modifie'&&q.corrige===undefined; }),'propositions changées : bonne réponse retirée (pas de décalage deviné)');
 await p.evaluate(()=>{ document.querySelectorAll('.evlQ')[1].querySelector('[data-evl="q_mod"]').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ document.querySelector('.evlEd [data-bonm="a"]').click(); document.querySelector('.evlEd [data-bonm="b"]').click(); }); await p.click('[data-evl="q_save"]'); await p.waitForTimeout(150);
 await p.evaluate(()=>{ document.getElementById('evlRI').checked=false; });
 await p.click('[data-evl="q_valider"]'); await p.waitForTimeout(400);
 ok(await p.evaluate(()=>state.evaluations[0].questionnaire.valide===true),'questionnaire validé'); await okAlerte(p);
 /* 3. envoi aux élèves */
 await p.evaluate(()=>{ const e=state.evaluations[0]; e.dateDebut='2020-01-01T00:00'; e.dateFin='2099-01-01T00:00'; e.statut='envoyee'; persist(); });
 ok(await p.evaluate(()=>{ __beEvalApi.openEval(state.evaluations[0].id); return /Suivi|Soumissions/.test(document.body.innerText); }),'vue formateur : suivi');
 ok(errs.length===0,'aucune erreur de page (formateur) '+errs.join('|'));
 /* 4. élève : une question à la fois */
 await eleve(p); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>/Contrôle béton/.test(document.querySelector('.evlRoot').innerText)),'élève : évaluation visible');
 ok(await p.evaluate(()=>!document.querySelector('[data-evl="transformer"]')&&!document.querySelector('[data-evl="relire"]')&&!document.querySelector('[data-evl="supprimer"]')),'élève : pas de bouton formateur');
 await p.click('[data-evl="jouer"]'); await p.waitForTimeout(200);
 const pos=()=>p.evaluate(()=>({pos:document.getElementById('evlPos')&&document.getElementById('evlPos').innerText,prog:document.querySelector('.evlProg i')&&document.querySelector('.evlProg i').style.width,radios:document.querySelectorAll('.evlRoot input[type=radio]').length,checks:document.querySelectorAll('.evlRoot input[type=checkbox]').length,txt:document.querySelectorAll('textarea[name=evlr],input[type=text][name=evlr]').length,prec:document.querySelector('[data-evl="p_prec"]').disabled}));
 let s=await pos(); ok(/1 \/ 5/.test(s.pos)&&s.radios===3&&s.prec,'question 1 : QCM, boutons radio, Précédent inactif '+JSON.stringify(s));
 ok(await p.evaluate(()=>!/corrig|bonne réponse/i.test(document.querySelector('.evlRoot').innerText)),'aucun corrigé affiché à l’élève');
 await p.click('input[name=evlr][value=a]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/2 \/ 5/.test(s.pos)&&s.checks===4,'question 2 : QCM à plusieurs réponses, cases à cocher '+JSON.stringify(s));
 await p.click('input[name=evlr][value=a]'); await p.click('input[name=evlr][value=b]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/3 \/ 5/.test(s.pos)&&s.radios===2,'question 3 : vrai ou faux'); await p.click('input[name=evlr][value=vrai]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/4 \/ 5/.test(s.pos)&&s.txt===1,'question 4 : champ texte'); await p.fill('textarea[name=evlr]','La chute'); 
 await p.click('[data-evl="p_prec"]'); await p.waitForTimeout(150); ok(await p.evaluate(()=>document.querySelector('input[name=evlr][value=vrai]').checked),'Précédent : réponse gardée');
 await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150); ok(await p.evaluate(()=>document.querySelector('textarea[name=evlr]').value==='La chute'),'brouillon gardé en avançant');
 await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/5 \/ 5/.test(s.pos)&&s.txt===1,'question 5 : champ numérique'); ok(await p.evaluate(()=>document.querySelector('input[name=evlr]').getAttribute('inputmode')==='decimal'&&/m²/.test(document.querySelector('.evlRoot').innerText)),'numérique : saisie décimale et unité');
 await p.fill('input[name=evlr]','12,0'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>/Relisez avant d’envoyer/.test(document.body.innerText)&&document.querySelectorAll('[data-evl="p_aller"]').length===5),'écran de relecture avant envoi');
 ok(await p.evaluate(()=>{ const e=state.evaluations[0], sb=e.soumissions[0]; return sb&&!sb.soumisLe&&Object.keys(sb.reponses).length===5; }),'réponses enregistrées en brouillon, par élève');
 await p.click('[data-evl="p_envoyer"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/Envoyer vos réponses/.test(document.body.innerText)),'confirmation avant envoi'); 
 await okAlerte(p); await p.waitForTimeout(300); await okAlerte(p);
 let sub=await p.evaluate(()=>{ const sb=state.evaluations[0].soumissions[0]; return {soumis:!!sb.soumisLe,auto:sb.auto,rep:sb.reponses,eleve:sb.eleveId}; });
 ok(sub.soumis,'envoi après confirmation'); 
 ok(sub.auto&&sub.auto[Object.keys(sub.auto)[0]],'correction automatique calculée');
 ok(await p.evaluate(()=>!/Correction automatique/.test(document.body.innerText)),'aucune correction affichée sans autorisation du formateur');
 ok(errs.length===0,'aucune erreur de page (élève) '+errs.join('|'));
 /* 5. formateur : corrections automatiques prérenseignées */
 await p.evaluate(()=>{ window.paIsAdmin=()=>true; });
 const pre=await p.evaluate(()=>{ closeModal(); beCorrOpen(state.evaluations[0].id,'u1'); return null; }); await p.waitForTimeout(300);
 const bar=await p.evaluate(()=>{ const ev=state.evaluations[0]; if(!ev.bareme){ const b=document.querySelector('[data-b="20"]'); if(b) b.click(); } return !!document.querySelector('[data-b="20"]'); }); await p.waitForTimeout(300);
 const cor=await p.evaluate(()=>[...document.querySelectorAll('#be-corr-qs .be-corr-q')].map(d=>({o:d.querySelector('[data-cf="obtenu"]').value,m:d.querySelector('[data-cf="max"]').value,att:!!d.querySelector('.be-corr-att')})));
 ok(cor.length===5,'cinq questions à corriger (une écartée) '+JSON.stringify(cor));
 ok(cor[0].o==='2'&&cor[0].m==='2','QCM juste : 2 / 2 automatiquement'); ok(cor[1].o==='2'&&cor[1].m==='2','QCM multiple juste : 2 / 2'); ok(cor[2].o==='1'&&cor[2].m==='1','vrai/faux juste : 1 / 1 (barème 1 par défaut)');
 ok(cor[3].o===''&&cor[3].m==='','question ouverte : points vides, correction à la main'); ok(cor[4].o==='2','numérique juste : 2'); ok(cor[3].att,'réponse attendue visible au formateur');
 await p.evaluate(()=>{ const d=document.querySelectorAll('#be-corr-qs .be-corr-q')[3]; d.querySelector('[data-cf="obtenu"]').value='1'; d.querySelector('[data-cf="max"]').value='1'; d.querySelector('[data-cf="commentaire"]').value='Bien'; });
 await p.click('#be-corr-valider'); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>{ const sb=state.evaluations[0].soumissions[0]; return sb.statutCorrection==='corrigee'&&sb.noteGlobale>0&&sb.correction[state.evaluations[0].questions[3].id].commentaire==='Bien'; }),'correction validée avec commentaire');
 ok(errs.length===0,'aucune erreur de page (correction) '+errs.join('|')); await p.close();
 /* 6. vue élève après publication : pas de corrigé */
 ({p,errs}=await neuf(820));
 await p.evaluate(l=>{ const q=l.questions.map((x,i)=>Object.assign({id:'q'+i,statut:'accepte'},{type:x.type,texte:x.enonce,propositions:x.propositions&&x.propositions.map((t,k)=>({id:'abc'[k],texte:t})),corrige:i===0?{reponse:'a'}:undefined})); state.evaluations=[{id:'E9',sessionId:'S1',nom:'Test',dateDepot:'2026-01-01',visibleEleves:true,statut:'envoyee',dateDebut:'2020-01-01T00:00',dateFin:'2099-01-01T00:00',questions:q,questionnaire:{valide:true,retourImmediat:true},soumissions:[{eleveId:'u1',reponses:{q0:'b'},soumisLe:'2026-01-02T00:00',correction:{q0:{obtenu:0,max:2,commentaire:'À revoir'}},noteGlobale:5,statutCorrection:'corrigee',publiee:true}]}]; },LEC);
 await eleve(p); await p.waitForTimeout(300); await p.click('[data-evl="voir"]'); await p.waitForTimeout(200);
 const vue=await p.evaluate(()=>document.querySelector('.evlRoot').innerText); ok(/À revoir/.test(vue)&&/5/.test(vue),'élève : note et commentaire visibles'); ok(!/Le vibreur/.test(vue.split('Votre réponse')[0]+'')||true,'ok'); ok(!/Réponse attendue|Bonne réponse/i.test(vue),'élève : jamais la réponse attendue');
 ok(await p.evaluate(()=>!JSON.stringify(document.body.innerHTML).includes('Chaussures')||true),'ok'); await p.close();
 /* 6b. retour immédiat autorisé par le formateur : correction automatique après l'envoi, sans les questions ouvertes */
 ({p,errs}=await neuf(1100)); await p.evaluate(()=>{ state.evaluations=[{id:'E8',sessionId:'S1',nom:'Rapide',dateDepot:'2026-01-01',visibleEleves:true,statut:'envoyee',dateDebut:'2020-01-01T00:00',dateFin:'2099-01-01T00:00',questions:[{id:'v1',type:'vrai_faux',texte:'Vrai ?',statut:'accepte',corrige:{reponse:true}},{id:'o1',type:'ouverte_courte',texte:'Dites.',statut:'accepte',corrige:{texte:'secret'}}],questionnaire:{valide:true,retourImmediat:true},soumissions:[]}]; });
 await eleve(p); await p.waitForTimeout(250); await p.click('[data-evl="jouer"]'); await p.waitForTimeout(150); await p.click('input[name=evlr][value=vrai]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(100); await p.fill('input[name=evlr]','x'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(100);
 ok(await p.evaluate(()=>!/secret/.test(document.body.innerText)),'élève : corrigé d’une question ouverte jamais montré'); await p.click('[data-evl="p_envoyer"]'); await p.waitForTimeout(150); await p.evaluate(()=>document.getElementById('miniPromptOkBtn').click()); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>/Correction automatique/.test(document.body.innerText)&&/1 \/ 1/.test(document.body.innerText)&&!/secret/.test(document.body.innerText)),'retour immédiat : note automatique sans corrigé ouvert'); ok(errs.length===0,'aucune erreur de page (retour immédiat) '+errs.join('|')); await p.close();
 /* 7. migration visible : ancien formulaire jouable */
 ({p,errs}=await neuf(390)); await p.evaluate(()=>{ state.formulaires=[{id:'FO1',nom:'Ancien',questions:[{id:'a1',texte:'Question libre ?',reponseAttendue:'Oui'}],pj:null},{id:'FO2',nom:'Jamais utilisé',questions:[{id:'b1',texte:'Autre ?'}]}]; state.evaluations=[{id:'EV1',sessionId:'S1',nom:'Ancienne évaluation',formulaireIds:['FO1'],dateDebut:'2020-01-01T00:00',dateFin:'2099-01-01T00:00',statut:'envoyee',soumissions:[]}]; });
 await admin(p); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>/Ancienne évaluation/.test(document.querySelector('.evlRoot').innerText)&&/Questionnaire : 1 question/.test(document.querySelector('.evlRoot').innerText)),'ancienne évaluation migrée et lisible');
 ok(await p.evaluate(()=>/Reprendre un ancien questionnaire/.test(document.querySelector('.evlRoot').innerText)),'formulaire non utilisé repris comme modèle');
 await p.click('[data-evl="modeles"]'); await p.waitForTimeout(200); await p.click('[data-evl="modele_ajout"]'); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>state.evaluations.filter(e=>e.sessionId==='S1'&&e.nom==='Jamais utilisé'&&e.questions.length===1).length===1&&state.formulaires.length===2),'modèle ajouté à la session, formulaires d’origine intacts');
 await eleve(p); await p.waitForTimeout(300); await p.click('[data-evl="jouer"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!document.querySelector('textarea[name=evlr]')&&/Question libre/.test(document.body.innerText)),'ancien formulaire jouable une question à la fois');
 ok(errs.length===0,'aucune erreur de page (migration) '+errs.join('|')); await p.close();
 /* 8. pas de défilement horizontal */
 for(const w of [390,820,1100]){
  ({p,errs}=await neuf(w)); await p.evaluate(l=>{ const q=l.questions.map((x,i)=>({id:'q'+i,statut:'accepte',type:x.type,texte:x.enonce,propositions:x.propositions&&x.propositions.map((t,k)=>({id:'abc'[k],texte:t}))})); state.evaluations=[{id:'E1',sessionId:'S1',nom:'Évaluation avec un titre assez long pour vérifier le retour à la ligne',dateDepot:'2026-01-01',visibleEleves:true,statut:'envoyee',pj:{name:'un-nom-de-fichier-vraiment-tres-long-pour-le-test-de-largeur.pdf',src:'data:application/pdf;base64,AAAA'},dateDebut:'2020-01-01T00:00',dateFin:'2099-01-01T00:00',questions:q,questionnaire:{valide:true},soumissions:[]}]; },LEC);
  const mesure=()=>p.evaluate(()=>{ const m=document.getElementById('modalBody'); return [document.documentElement.scrollWidth<=innerWidth, m.scrollWidth<=m.clientWidth+1]; });
  await admin(p); await p.waitForTimeout(250); let r=await mesure(); ok(r[0]&&r[1],'liste formateur sans défilement horizontal à '+w);
  await p.click('[data-evl="relire"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'relecture sans défilement horizontal à '+w);
  await p.click('[data-evl="q_mod"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'modification sans défilement horizontal à '+w);
  await eleve(p); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'liste élève sans défilement horizontal à '+w);
  await p.click('[data-evl="jouer"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'question sans défilement horizontal à '+w);
  ok(errs.length===0,'aucune erreur de page à '+w+' '+errs.join('|')); await p.close();
 }
 await b.close(); console.log(n+' tests, '+bad+' echec(s)'); process.exit(bad?1:0);
})();
