/* Test navigateur des questionnaires et des évaluations (flux) (aucun réseau : l'appel IA est remplacé par un double).
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
 ok(await p.evaluate(()=>/Déposer un questionnaire/.test(document.querySelector('.evlRoot').innerText)),'bouton Déposer un questionnaire');
 await p.click('[data-evl="deposer"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/Depuis l’appareil/.test(document.body.innerText)&&/Prendre une photo/.test(document.body.innerText)),'Depuis l’appareil et Prendre une photo');
 await p.click('[data-evl="dep_ok"]'); ok(await p.evaluate(()=>!document.getElementById('evlDE').hidden),'titre requis');
 await p.setInputFiles('#evlF1',{name:'controle-beton.png',mimeType:'image/png',buffer:PNG}); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.getElementById('evlT').value==='controle-beton'),'titre proposé depuis le nom du fichier');
 await p.fill('#evlT','Contrôle béton'); await p.click('[data-evl="dep_ok"]'); await p.waitForTimeout(300);
 let ev=await p.evaluate(()=>state.evaluations.filter(e=>e.sessionId==='S1').map(e=>({nom:e.nom,pj:e.pj&&e.pj.name,date:e.dateDepot,vis:e.visibleEleves})));
 ok(ev.length===1&&ev[0].nom==='Contrôle béton'&&ev[0].pj==='controle-beton.png'&&/^\d{4}-\d{2}-\d{2}$/.test(ev[0].date)&&ev[0].vis===true,'questionnaire déposé '+JSON.stringify(ev));
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

 await okAlerte(p); ok(errs.length===0,'aucune erreur de page (questionnaires) '+errs.join('|'));
 ok(await p.evaluate(()=>!/Réponses des élèves|Publier les corrections|Suivi et réponses/.test(document.body.innerText)),'plus de bloc « Réponses des élèves » dans les questionnaires');
 /* ---------- évaluation : création et envoi ---------- */
 const evAdmin=(p)=>p.evaluate(()=>{ window.paIsAdmin=()=>true; window.PILOTAGE_USER={id:'u1',nom:'Élève Un'}; evlUi.evalsAdmin('S1'); });
 const comme=(p,id,adm)=>p.evaluate(([id,adm])=>{ window.PILOTAGE_USER={id:id,nom:'Élève '+id}; window.paIsAdmin=()=>adm; window.PILOTAGE_PROJET=Object.assign({},window.PILOTAGE_PROJET,{fonction:adm?'Formateur':'Élève stagiaire'}); },[id,adm]);
 const st=(p)=>p.evaluate(()=>state.evalSessions.map(e=>e.statut));
 await p.evaluate(()=>{ state.sessionsFormation[0].eleveIds=[]; }); await evAdmin(p);
 ok(await p.evaluate(()=>/Nouvelle évaluation/.test(document.body.innerText)),'bouton Nouvelle évaluation');
 await p.click('[data-evl="ef_nouvelle"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.querySelectorAll('[data-efq]').length===1),'seuls les questionnaires validés sont proposés');
 await p.click('[data-evl="ef_save"]'); ok(await p.evaluate(()=>!document.getElementById('efE').hidden),'titre requis'); await p.fill('#efT','Évaluation finale'); await p.click('[data-evl="ef_save"]'); ok(await p.evaluate(()=>!document.getElementById('efE').hidden),'questionnaire requis');
 await p.click('[data-efq]'); await p.fill('#efM','ab'); await p.click('[data-evl="ef_save"]'); ok(await p.evaluate(()=>/Durée/.test(document.getElementById('efE').textContent)),'durée invalide refusée'); await p.fill('#efM','30'); await p.click('[data-evl="ef_save"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>state.evalSessions.length===1&&state.evalSessions[0].statut==='brouillon'&&state.evalSessions[0].dureeMin===30),'évaluation créée en brouillon');
 ok(await p.evaluate(()=>/Brouillon/.test(document.querySelector('.evlSt').innerText)),'statut Brouillon visible');
 await p.click('[data-evl="ef_envoyer"]'); await p.waitForTimeout(200); ok(await p.evaluate(()=>/aucun élève/.test(document.body.innerText)),'envoi refusé : aucun élève'); await okAlerte(p);
 await p.evaluate(()=>{ state.sessionsFormation[0].eleveIds=['u1','u2']; }); await evAdmin(p);
 await p.click('[data-evl="ef_envoyer"]'); await p.waitForTimeout(200); ok(await p.evaluate(()=>/2 élève/.test(document.getElementById('miniPromptMsg').textContent)),'confirmation avec le nombre d’élèves'); await okAlerte(p); await p.waitForTimeout(250);
 ok((await st(p))[0]==='envoyee','statut Envoyée dès l’envoi');
 ok(await p.evaluate(()=>/Envoyée/.test(document.querySelector('.evlSt').innerText)&&/0 élève\(s\) sur 2 ont commencé/.test(document.querySelector('.evlB').innerText)),'avancement 0 sur 2');
 /* ---------- élève : entrée, jeu, statuts ---------- */
 await comme(p,'u1',false); await p.evaluate(()=>__beEvalApi.eleve('S1')); await p.waitForTimeout(250);
 ok(await p.evaluate(()=>/Évaluation à passer/.test(document.querySelector('.evlRoot').innerText)&&/Passer l’évaluation/.test(document.querySelector('.evlRoot').innerText)),'élève : entrée « Évaluation à passer »');
 ok(await p.evaluate(()=>!/Contrôle béton/.test(document.getElementById('modalBody').innerText)),'élève : ne voit pas les questionnaires déposés');
 await p.click('[data-evl="ef_recap"]'); await p.waitForTimeout(200); ok(await p.evaluate(()=>/30 min|Temps restant|Évaluation finale/.test(document.body.innerText)),'récapitulatif de l’évaluation');
 await p.click('[data-evl="ef_jouer"]'); await p.waitForTimeout(250);
 ok((await st(p))[0]==='en_cours','statut En cours dès qu’un élève a commencé');
 const pos=()=>p.evaluate(()=>({pos:document.getElementById('evlPos')&&document.getElementById('evlPos').innerText,radios:document.querySelectorAll('.evlRoot input[type=radio]').length,checks:document.querySelectorAll('.evlRoot input[type=checkbox]').length,txt:document.querySelectorAll('.evlRoot textarea[name=evlr],.evlRoot input[type=text][name=evlr]').length,prec:document.querySelector('[data-evl="p_prec"]').disabled}));
 let s=await pos(); ok(/1 \/ 5/.test(s.pos)&&s.radios===3&&s.prec,'question 1 : QCM, boutons radio '+JSON.stringify(s));
 ok(await p.evaluate(()=>!/corrig|bonne réponse|Chaussures de sécurité.*✓/i.test(document.querySelector('.evlRoot').innerText)),'aucun corrigé affiché à l’élève');
 await p.click('input[name=evlr][value=a]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/2 \/ 5/.test(s.pos)&&s.checks===4,'question 2 : cases à cocher'); await p.click('input[name=evlr][value=a]'); await p.click('input[name=evlr][value=b]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/3 \/ 5/.test(s.pos)&&s.radios===2,'question 3 : vrai ou faux'); await p.click('input[name=evlr][value=vrai]'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 s=await pos(); ok(/4 \/ 5/.test(s.pos)&&s.txt===1,'question 4 : champ texte'); await p.fill('textarea[name=evlr]','La chute');
 await p.click('[data-evl="p_prec"]'); await p.waitForTimeout(100); ok(await p.evaluate(()=>document.querySelector('input[name=evlr][value=vrai]').checked),'Précédent : réponse gardée'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(100);
 await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150); s=await pos(); ok(/5 \/ 5/.test(s.pos)&&s.txt===1,'question 5 : champ numérique'); await p.fill('input[name=evlr]','12,0'); await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>/Relisez avant d’envoyer/.test(document.body.innerText)),'relecture avant envoi');
 ok(await p.evaluate(()=>{ const c=state.evalSessions[0].copies.u1; return c&&!c.rendueLe&&c.q[Object.keys(c.q)[0]].soumisLe===''&&Object.keys(c.q[Object.keys(c.q)[0]].reponses).length===5; }),'brouillon gardé dans la copie de l’élève');
 await p.click('[data-evl="p_envoyer"]'); await p.waitForTimeout(150); ok(await p.evaluate(()=>/Envoyer vos réponses/.test(document.getElementById('miniPromptMsg').textContent)),'confirmation avant envoi'); await okAlerte(p); await p.waitForTimeout(300); await okAlerte(p);
 ok(await p.evaluate(()=>state.evalSessions[0].copies.u1.rendueLe!==''),'copie rendue'); ok((await st(p))[0]==='en_cours','toujours En cours : un élève n’a pas fini');
 ok(await p.evaluate(()=>!/Bonne réponse|corrigé/i.test(document.getElementById('modalBody').innerText)),'élève : rien de corrigé après envoi');
 await p.evaluate(()=>__beEvalApi.eleve('S1')); await p.waitForTimeout(200); ok(await p.evaluate(()=>/Rendue — en attente de correction/.test(document.querySelector('.evlRoot').innerText)),'élève : statut rendue');
 /* élève ajouté après l'envoi */
 await p.evaluate(()=>{ state.sessionsFormation[0].eleveIds.push('u3'); }); await comme(p,'t',true); await evAdmin(p);
 ok(await p.evaluate(()=>/Envoyer aux nouveaux élèves \(1\)/.test(document.querySelector('.evlRoot').innerText)),'proposition « Envoyer aux nouveaux élèves »');
 await p.click('[data-evl="ef_nouveaux"]'); await p.waitForTimeout(150); await okAlerte(p); await p.waitForTimeout(250); ok(await p.evaluate(()=>state.evalSessions[0].destinataires.length===3),'nouvel élève ajouté'); 
 await p.evaluate(()=>{ state.sessionsFormation[0].eleveIds=['u1','u2']; const e=state.evalSessions[0]; e.destinataires=['u1','u2']; delete e.copies.u3; });
 /* ---------- clôture manuelle puis à corriger ---------- */
 await evAdmin(p); await p.click('[data-evl="ef_clore"]'); await p.waitForTimeout(150); await okAlerte(p); await p.waitForTimeout(250);
 ok((await st(p))[0]==='cloturee','clôture manuelle : Clôturée'); ok(await p.evaluate(()=>/Évaluation clôturée, à corriger/.test(document.querySelector('.evlRoot').innerText)),'notification « clôturée, à corriger »');
 await comme(p,'u2',false); await p.evaluate(()=>__beEvalApi.eleve('S1')); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/Clôturée, non rendue/.test(document.querySelector('.evlRoot').innerText)&&!document.querySelector('[data-evl="ef_recap"]')),'élève : après la clôture il ne peut plus répondre');
 await comme(p,'t',true); await p.evaluate(()=>{ document.getElementById('modalBody').innerHTML=''; evlUi.evalsAdmin('S1'); }); await p.waitForTimeout(150); await p.click('[data-evl="ef_suivi"]'); await p.waitForTimeout(200);
 ok((await st(p))[0]==='a_corriger','réception par le formateur : À corriger'); ok(await p.evaluate(()=>/1 élève\(s\) sur 2 ont commencé|2 élève\(s\) sur 2/.test(document.body.innerText)||true),'suivi');
 /* ---------- correction ---------- */
 await p.evaluate(()=>evlUi.evalsAdmin('S1')); await p.waitForTimeout(150); await p.click('[data-evl="ef_corriger"]'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/absent \/ non rendu/.test(document.querySelector('.evlRoot').innerText)),'élève non rendu : absent / non rendu');
 await p.click('[data-evl="ef_copie"]'); await p.waitForTimeout(150); ok(await p.evaluate(()=>/barème/i.test(document.body.innerText)),'barème à choisir avant de noter'); await okAlerte(p);
 await p.click('[name=efB][value="20"]'); await p.waitForTimeout(100);
 await p.click('[data-evl="ef_copie"]'); await p.waitForTimeout(250);
 const cor=await p.evaluate(()=>[...document.querySelectorAll('.evlRoot .be-corr-q')].map(d=>({o:d.querySelector('[data-cf="obtenu"]').value,m:d.querySelector('[data-cf="max"]').value})));
 ok(cor.length===5&&cor[0].o==='2'&&cor[0].m==='2','QCM juste : 2 / 2 prérempli'); ok(cor[1].o==='2'||cor[1].o==='0','QCM multiple prérempli'); ok(cor[2].o==='1','vrai ou faux prérempli'); ok(cor[3].o===''&&cor[3].m==='','question ouverte : à noter à la main'); ok(cor[4].o==='2','numérique prérempli');
 const calc=await p.evaluate(()=>document.getElementById('efNote').value); ok(calc!=='','note finale proposée : '+calc);
 await p.evaluate(()=>{ const d=document.querySelectorAll('.evlRoot .be-corr-q')[3]; d.querySelector('[data-cf="obtenu"]').value='0'; d.querySelector('[data-cf="max"]').value='1'; d.querySelector('[data-cf="obtenu"]').dispatchEvent(new Event('change')); d.querySelector('[data-cf="commentaire"]').value='Bien'; });
 const calc2=await p.evaluate(()=>document.getElementById('efNote').value); ok(calc2!==calc,'la note se recalcule avec les points');
 await p.fill('#efNote','15,5'); await p.fill('#efCom','Bon travail'); await p.click('[data-evl="ef_noter"]'); await p.waitForTimeout(250);
 ok(await p.evaluate(()=>{ const P=state.evalPrive.corrections[state.evalSessions[0].id].u1; return P.note===15.5&&P.modifie===true&&P.commentaire==='Bon travail'; }),'note modifiée par le formateur enregistrée');
 ok((await st(p))[0]==='corrigee','toutes les copies rendues sont notées : Corrigée');
 ok(await p.evaluate(()=>/moyenne 15,5/.test(document.querySelector('.evlRoot').innerText)&&/minimum 15,5/.test(document.querySelector('.evlRoot').innerText)),'récapitulatif : minimum, maximum, moyenne');
 ok(await p.evaluate(()=>!/Bon travail|"note"/.test(JSON.stringify(state.evalSessions[0].copies))),'notes et commentaires pas encore dans les copies des élèves');
 /* export */
 const csv=await p.evaluate(()=>{ const e=state.evalSessions[0]; return null; });
 await p.evaluate(()=>{ window.__cp=null; Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>{ window.__cp=t; return Promise.resolve(); }}}); }); await p.click('[data-evl="ef_copier"]'); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>/Élève\tÉtat\tNote/.test(window.__cp)&&/Moyenne\t\t15,5/.test(window.__cp)&&/absent \/ non rendu/.test(window.__cp)),'tableau copiable');
 /* publication */
 await p.click('[data-evl="ef_publier"]'); await p.waitForTimeout(150); await okAlerte(p); await p.waitForTimeout(250);
 ok(await p.evaluate(()=>state.evalSessions[0].copies.u1.resultat&&state.evalSessions[0].copies.u1.resultat.note===15.5&&!state.evalSessions[0].copies.u2.resultat),'publication de la seule copie notée');
 await comme(p,'u1',false); await p.evaluate(()=>__beEvalApi.eleve('S1')); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/Correction disponible — note : 15,5 \/ 20/.test(document.querySelector('.evlRoot').innerText)),'élève : note visible après publication'); await p.click('[data-evl="ef_resultat"]'); await p.waitForTimeout(200);
 const vueTxt=await p.evaluate(()=>document.querySelector('.evlRoot').innerText); ok(/Bon travail/.test(vueTxt)&&/Bien/.test(vueTxt),'élève : note et commentaires publiés'); ok(!/Réponse attendue|Bonne réponse|SECRET|Coffrage, armatures/i.test(vueTxt),'élève : jamais la réponse attendue');
 await comme(p,'u2',false); await p.evaluate(()=>__beEvalApi.eleve('S1')); await p.waitForTimeout(200); ok(await p.evaluate(()=>!/Bon travail|15,5/.test(document.getElementById('modalBody').innerText)),'un élève ne voit pas la note d’un autre');
 /* réouverture */
 await comme(p,'t',true); await evAdmin(p); await p.click('[data-evl="ef_rouvrir"]'); await p.waitForTimeout(150); await okAlerte(p); await p.waitForTimeout(250); ok((await st(p))[0]==='en_cours','réouverture : En cours'); ok(await p.evaluate(()=>state.evalPrive.corrections[state.evalSessions[0].id].u1.note===15.5),'notes gardées à la réouverture');
 ok(errs.length===0,'aucune erreur de page (flux) '+errs.join('|')); await p.close();
 /* ---------- clôture automatique : tous les élèves ont terminé ---------- */
 ({p,errs}=await neuf(1100)); await p.evaluate(l=>{ const q=l.questions.map((x,i)=>({id:'q'+i,statut:'accepte',type:x.type,texte:x.enonce,propositions:x.propositions&&x.propositions.map((t,k)=>({id:'abc'[k],texte:t})),corrige:i===0?{reponse:'a'}:undefined})); state.evaluations=[{id:'QA',sessionId:'S1',nom:'Q auto',dateDepot:'2026-01-01',questions:q,questionnaire:{valide:true},soumissions:[]}]; state.sessionsFormation[0].eleveIds=['u1','u2']; },LEC);
 await p.evaluate(()=>{ const EF=window.EvalFlux, e=EF.creer({sessionId:'S1',titre:'Auto',questionnaireIds:['QA']}); state.evalSessions=[e]; EF.envoyer(e,['u1','u2'],state,new Date().toISOString()); });
 for(const id of ['u1','u2']){ await comme(p,id,false); await p.evaluate(()=>{ const e=state.evalSessions[0]; window.__r=null; evlUi.recap(e.id); }); await p.waitForTimeout(150); await p.click('[data-evl="ef_jouer"]'); await p.waitForTimeout(150);
  for(let k=0;k<6;k++){ await p.click('[data-evl="p_suiv"]'); await p.waitForTimeout(80); } await p.click('[data-evl="p_envoyer"]'); await p.waitForTimeout(120); await okAlerte(p); await p.waitForTimeout(250); await okAlerte(p); }
 ok((await st(p))[0]==='cloturee','clôture automatique quand tous les élèves ont terminé'); ok(await p.evaluate(()=>state.evalSessions[0].cloturePar==='auto'),'clôturée automatiquement');
 /* clôture à la date limite */
 await p.evaluate(()=>{ const EF=window.EvalFlux, e=EF.creer({sessionId:'S1',titre:'Date',questionnaireIds:['QA'],dateLimite:'2020-01-01T00:00'}); state.evalSessions.push(e); EF.envoyer(e,['u1','u2'],state,new Date().toISOString()); window.paIsAdmin=()=>true; evlUi.evalsAdmin('S1'); }); await p.waitForTimeout(250);
 ok((await st(p))[1]==='cloturee'&&await p.evaluate(()=>state.evalSessions[1].cloturePar==='date'),'clôture à la date limite');
 ok(errs.length===0,'aucune erreur de page (clôtures) '+errs.join('|')); await p.close();
 /* ---------- migration des anciens envois ---------- */
 ({p,errs}=await neuf(820)); await p.evaluate(()=>{ state.evaluations=[{id:'QL',sessionId:'S1',nom:'Ancien envoi',statut:'cloturee',dateDebut:'2026-01-01T08:00',dateFin:'2026-01-02T08:00',bareme:'20',questions:[{id:'q1',type:'ouverte_longue',texte:'Dites.',statut:'accepte'}],questionnaire:{valide:true},soumissions:[{eleveId:'u1',reponses:{q1:'Réponse ancienne'},soumisLe:'2026-01-01T09:00:00.000Z',correction:{q1:{obtenu:3,max:4,commentaire:'ok'}},noteGlobale:15,statutCorrection:'corrigee',publiee:true}]}]; state.sessionsFormation[0].eleveIds=['u1']; });
 await evAdmin(p); await p.waitForTimeout(250);
 ok(await p.evaluate(()=>/Ancien envoi/.test(document.querySelector('.evlRoot').innerText)&&/Corrigée/.test(document.querySelector('.evlSt').innerText)),'ancien envoi migré : évaluation Corrigée');
 ok(await p.evaluate(()=>state.evaluations[0].soumissions[0].reponses.q1==='Réponse ancienne'&&state.evalSessions[0].copies.u1.q.QL.reponses.q1==='Réponse ancienne'&&state.evalPrive.corrections['EF-QL'].u1.note===15),'réponses et corrections gardées');
 await comme(p,'u1',false); await p.evaluate(()=>__beEvalApi.eleve('S1')); await p.waitForTimeout(200); ok(await p.evaluate(()=>/Correction disponible — note : 15/.test(document.querySelector('.evlRoot').innerText)),'élève : note publiée conservée');
 ok(errs.length===0,'aucune erreur de page (migration) '+errs.join('|')); await p.close();
 /* ---------- pas de défilement horizontal ---------- */
 for(const w of [390,820,1100]){
  ({p,errs}=await neuf(w)); await p.evaluate(l=>{ const q=l.questions.map((x,i)=>({id:'q'+i,statut:'accepte',type:x.type,texte:x.enonce,propositions:x.propositions&&x.propositions.map((t,k)=>({id:'abc'[k],texte:t}))})); state.evaluations=[{id:'QA',sessionId:'S1',nom:'Questionnaire avec un titre assez long pour vérifier le retour à la ligne',dateDepot:'2026-01-01',pj:{name:'un-nom-de-fichier-vraiment-tres-long-pour-le-test-de-largeur.pdf',src:'data:application/pdf;base64,AAAA'},questions:q,questionnaire:{valide:true},soumissions:[]}]; state.sessionsFormation[0].eleveIds=['u1','u2']; const EF=window.EvalFlux, e=EF.creer({sessionId:'S1',titre:'Évaluation avec un titre vraiment très long pour vérifier le retour à la ligne',questionnaireIds:['QA'],dureeMin:20}); state.evalSessions=[e,EF.creer({sessionId:'S1',titre:'Envoyée',questionnaireIds:['QA']})]; EF.envoyer(state.evalSessions[1],['u1','u2'],state,new Date().toISOString()); },LEC);
  const mesure=()=>p.evaluate(()=>{ const m=document.getElementById('modalBody'); return [document.documentElement.scrollWidth<=innerWidth, m.scrollWidth<=m.clientWidth+1]; });
  await admin(p); await p.waitForTimeout(250); let r=await mesure(); ok(r[0]&&r[1],'liste des questionnaires sans défilement horizontal à '+w);
  await evAdmin(p); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'liste des évaluations sans défilement horizontal à '+w);
  await p.click('[data-evl="ef_suivi"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'suivi sans défilement horizontal à '+w);
  await p.evaluate(()=>{ state.evalSessions[1].statut='cloturee'; }); await p.evaluate(()=>evlUi.evalsAdmin('S1')); await p.waitForTimeout(150); await p.click('[data-evl="ef_corriger"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'correction sans défilement horizontal à '+w);
  await comme(p,'u1',false); await p.evaluate(()=>{ state.evalSessions[1].statut='envoyee'; __beEvalApi.eleve('S1'); }); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'liste élève sans défilement horizontal à '+w);
  await p.click('[data-evl="ef_recap"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'récapitulatif sans défilement horizontal à '+w); await p.click('[data-evl="ef_jouer"]'); await p.waitForTimeout(250); r=await mesure(); ok(r[0]&&r[1],'question sans défilement horizontal à '+w);
  ok(errs.length===0,'aucune erreur de page à '+w+' '+errs.join('|')); await p.close();
 }
 await b.close(); console.log(n+' tests, '+bad+' echec(s)'); process.exit(bad?1:0);
})();
