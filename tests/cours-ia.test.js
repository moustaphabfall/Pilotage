/* Tests du bouton IA des supports de cours (lit <script id="coursIaJs"> de index.html, sans navigateur).
   Lancer : node tests/cours-ia.test.js */
const fs=require('fs'), vm=require('vm'), path=require('path'), zlib=require('zlib');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=/<script id="coursIaJs">([\s\S]*?)<\/script>/.exec(html); if(!m){ console.error('script coursIaJs introuvable'); process.exit(1); }
const sb={module:{exports:{}},console,TextDecoder,TextEncoder,Response,DecompressionStream,Blob,URL,navigator:{onLine:true}}; sb.globalThis=sb; vm.createContext(sb); vm.runInContext(m[1],sb);
const C=sb.module.exports; let n=0,ko=0; const eq=(a,b,t)=>{ n++; if(JSON.stringify(a)!==JSON.stringify(b)){ ko++; console.log('ECHEC',t,'attendu',JSON.stringify(b),'recu',JSON.stringify(a)); } };
const F=(name,content,type)=>{ const b=new Blob([content],{type:type||''}); b.name=name; return b; };
/* docx minimal : zip avec word/document.xml (stocke ou compresse) */
function zip(nom,data,deflate){ const raw=Buffer.from(data,'utf8'); const comp=deflate?zlib.deflateRawSync(raw):raw; const nb=Buffer.from(nom); const lh=Buffer.alloc(30); lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(deflate?8:0,8); lh.writeUInt32LE(comp.length,18); lh.writeUInt32LE(raw.length,22); lh.writeUInt16LE(nb.length,26);
 const ch=Buffer.alloc(46); ch.writeUInt32LE(0x02014b50,0); ch.writeUInt16LE(deflate?8:0,10); ch.writeUInt32LE(comp.length,20); ch.writeUInt32LE(raw.length,24); ch.writeUInt16LE(nb.length,28); ch.writeUInt32LE(0,42);
 const local=Buffer.concat([lh,nb,comp]); const cd=Buffer.concat([ch,nb]); const e=Buffer.alloc(22); e.writeUInt32LE(0x06054b50,0); e.writeUInt16LE(1,8); e.writeUInt16LE(1,10); e.writeUInt32LE(cd.length,12); e.writeUInt32LE(local.length,16); return Buffer.concat([local,cd,e]); }
(async()=>{
 const xml='<w:document><w:body><w:p><w:r><w:t>Le b&#233;ton &amp; l\'eau</w:t></w:r></w:p><w:p><w:r><w:t>Deuxième ligne</w:t></w:r></w:p></w:body></w:document>';
 for(const d of [false,true]){ const t=await C.docxTexte(Uint8Array.from(zip("word/document.xml",xml,d)).buffer); eq(/Deuxième ligne/.test(t)&&/& l'eau/.test(t),true,'docx lu '+(d?'compresse':'stocke')); }
 let bad=false; try{ await C.docxTexte(new Uint8Array(40).buffer); }catch(e){ bad=true; } eq(bad,true,'docx illisible refuse');
 /* dépôt multiple : texte, docx, image (réduite par l'écran), format inconnu, ancien Word */
 const deps={image:async f=>({type:'image/jpeg',data:'QQ=='}),pdf:async f=>({texte:'Texte du PDF',images:[]})};
 const S=[]; for(const f of [F('a.txt','Premier texte'),F('b.docx',zip('word/document.xml',xml,true)),F('c.png','x','image/png'),F('d.pdf','x','application/pdf'),F('e.xyz','x'),F('f.doc','x')]) S.push(await C.lireSource(f,deps));
 eq(S.map(s=>!!s.erreur),[false,false,false,false,true,true],'depot multiple : lecture et erreurs claires'); eq(S[2].images.length,1,'photo gardee en image reduite'); eq(S[2].texte,'','photo : pas de texte');
 /* choix du modèle */
 eq(C.MODELES.map(x=>x.id),['fiche','plan','diapo','resume','quiz','procedure'],'six modeles integres');
 const b1=C.construireDemande(S,'quiz',null,'  simple  '); eq([b1.mode,b1.modele.nom,b1.consigne],['support_cours','Quiz de validation des acquis','simple'],'modele integre choisi'); eq(b1.sources.length,4,'seules les sources lisibles partent'); eq(b1.modele_texte,undefined,'pas de modele depose');
 const b2=C.construireDemande(S,'quiz',{nom:'mon.txt',texte:'Titre\nEtape 1'},''); eq([/Modèle déposé/.test(b2.modele.nom),b2.modele_texte],[true,'Titre\nEtape 1'],'modele depose prioritaire');
 eq(JSON.stringify(b1).indexOf('Blob'),-1,'jamais le fichier d\'origine');
 const gros=[{nom:'g',texte:'x'.repeat(90000),images:[1,2,3,4,5,6,7,8].map(i=>({type:'image/jpeg',data:'A'}))}]; const b3=C.construireDemande(gros,'fiche',null,''); eq([b3.sources[0].texte.length,b3.sources[0].images.length],[C.MAXTXT,C.MAXIMG],'limites de texte et d\'images');
 /* présentation : listes blanches */
 const brute={titre:'T',theme:'rose',diapositives:[{titre:'A',mise_en_page:'cartes',cartes:[{titre:'c1',texte:'x'}],animation:'fondu'},{titre:'B',mise_en_page:'pirate',points:['p'],animation:'<script>alert(1)</script>'},{titre:'C',mise_en_page:'chiffre',animation:'zoom'},{titre:'D',animation:'points',points:['a','b']}],manquant:['durée']};
 const pr=C.validerPresentation(brute); eq(pr.theme,'ardoise','theme inconnu = ardoise'); eq(pr.diapositives.map(x=>x.animation),['fondu','aucune','zoom','points'],'animation inconnue = aucune'); eq(pr.diapositives.map(x=>x.mise_en_page),['cartes','points','citation','points'],'mise en page inconnue corrigee'); eq(C.ANIMS,['aucune','fondu','glissement','zoom','points'],'liste blanche des animations');
 eq(C.validerPresentation({}),null,'vide refuse'); eq(C.validerPresentation('x'),null,'non objet refuse'); eq(C.validerPresentation({diapositives:[]}),null,'sans diapositive refuse');
 eq(C.validerPresentation({diapositives:Array.from({length:60},(_,i)=>({titre:'d'+i}))}).diapositives.length,30,'30 diapositives au plus');
 const anc=C.validerPresentation({titre:'Vieux',sections:[{titre:'S',paragraphes:['p'],liste:['l']}],manquant:[]}); eq([anc.diapositives.length,anc.diapositives[1].points],[2,['p','l']],'ancien resultat converti');
 const t=C.versTexte(pr); const r2=C.depuisTexte(t,pr); eq([r2.diapositives.length,r2.diapositives[0].cartes[0].titre,r2.diapositives[3].points,r2.diapositives[3].animation],[4,'c1',['a','b'],'points'],'texte modifiable : aller-retour');
 const ed=C.depuisTexte(t+'\n\n## Nouvelle\n- un',pr); eq([ed.diapositives.length,ed.diapositives[4].animation],[5,'fondu'],'diapositive ajoutee');
 /* fichier presentable : un seul fichier, donnees echappees, aucun code de l'IA */
 const mal=C.validerPresentation({titre:'</script><script>alert(1)</script>',diapositives:[{titre:'<img src=x onerror=alert(1)>',points:['</script>']}]});
 const h=C.htmlPresentation(mal,{animation:'avec'}); eq((h.match(/<script/g)||[]).length,2,'deux balises script seulement'); eq(/data-anim="avec"/.test(h),true,'avec animation'); eq(/data-anim="sans"/.test(C.htmlPresentation(mal,{animation:'sans'})),true,'sans animation'); eq(/ontouchstart|touchend/.test(h)&&/prefers-reduced-motion/.test(h)&&/requestFullscreen/.test(h),true,'tactile, mouvement reduit, plein ecran');
 eq(h.indexOf('<img src=x'),-1,'texte echappe'); eq(/https?:\/\//.test(h.replace(/<!doctype[^>]*>/,'')),false,'aucune ressource externe');
 /* PDF : une diapositive par page, 16:9 */
 const lib=require('../lib/jspdf.umd.min.js'); const Js=(lib.jsPDF||lib.default||lib.jspdf.jsPDF);
 const blob=C.pdfPresentation(C.EXEMPLE,Js); const buf=Buffer.from(await blob.arrayBuffer()); eq(buf.slice(0,5).toString(),'%PDF-','pdf valide'); eq((buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length,C.EXEMPLE.diapositives.length,'une diapositive par page');
 const mb=/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(buf.toString('latin1')); eq(Math.abs(mb[1]/mb[2]-16/9)<0.02,true,'format 16:9');
 /* échec serveur : causes claires, aucune copie touchee */
 const ok=await C.demander({},async()=>({resp:{ok:true,status:200},j:{data:{titre:'X',diapositives:[{titre:'a',points:['b']}],manquant:[]}}})); eq(!!ok.resultat,true,'serveur ok');
 const f404=await C.demander({},async()=>({resp:{ok:false,status:404},j:null})); eq(f404.cause,'indispo','serveur absent');
 const fres=await C.demander({},async()=>{ throw new Error('reseau'); }); eq(fres.cause,'indispo','reseau coupe');
 const fold=await C.demander({},async()=>({resp:{ok:false,status:400},j:{error:'Message vide'}})); eq([fold.cause,/pas à jour/.test(fold.erreur)],['ancien',true],'ancienne fonction serveur : message precis, pas « Message vide »');
 const fold2=await C.demander({},async()=>({resp:{ok:true,status:200},j:{data:{valeurs:[],resume:'x',manquant:[]}}})); eq(fold2.cause,'ancien','reponse d\'une autre fonction = pas a jour');
 const f500=await C.demander({},async()=>({resp:{ok:false,status:500},j:{error:'boom'}})); eq([f500.cause,/boom/.test(f500.erreur)],['erreur',true],'erreur serveur');
 const fvid=await C.demander({},async()=>({resp:{ok:true,status:200},j:{data:{}}})); eq(fvid.cause,'vide','reponse vide');
 const flim=await C.demander({},async()=>({resp:{ok:false,status:429},j:{code:'limite',error:'x'}})); eq(!!flim.erreur,true,'limite d\'usage');
 const keep={sources:S.slice(0,2),modeleDoc:{nom:'m',texte:'secret'},urls:[],body:b2}; await C.demander(b2,async()=>({resp:{ok:false,status:500},j:{error:'boom'}})); eq([keep.sources.length,keep.modeleDoc.texte],[2,'secret'],'echec : documents et modele gardes');
 await C.demander(b2,async()=>({resp:{ok:true,status:200},j:{data:{}}})); eq(keep.sources.length,2,'reponse vide : documents gardes');
 const tmp={sources:S.slice(0,2),modeleDoc:{nom:'m',texte:'secret'},urls:[],body:b2}; const kp=tmp.sources; C.effacer(tmp);
 eq([tmp.sources.length,tmp.modeleDoc,tmp.body,kp.length],[0,null,null,0],'copies temporaires effacees a la fermeture voulue'); eq(b2.sources,[],'demande videe'); eq(b2.modele_texte,undefined,'modele depose efface');
 /* ---------- images ---------- */
 const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
 function zipN(entries){ const loc=[], cd=[]; let off=0; entries.forEach(([nom,data])=>{ const raw=Buffer.isBuffer(data)?data:Buffer.from(data,'utf8'); const nb=Buffer.from(nom); const lh=Buffer.alloc(30); lh.writeUInt32LE(0x04034b50,0); lh.writeUInt32LE(raw.length,18); lh.writeUInt32LE(raw.length,22); lh.writeUInt16LE(nb.length,26); const ch=Buffer.alloc(46); ch.writeUInt32LE(0x02014b50,0); ch.writeUInt32LE(raw.length,20); ch.writeUInt32LE(raw.length,24); ch.writeUInt16LE(nb.length,28); ch.writeUInt32LE(off,42); const b=Buffer.concat([lh,nb,raw]); loc.push(b); cd.push(Buffer.concat([ch,nb])); off+=b.length; }); const c=Buffer.concat(cd); const e=Buffer.alloc(22); e.writeUInt32LE(0x06054b50,0); e.writeUInt16LE(entries.length,8); e.writeUInt16LE(entries.length,10); e.writeUInt32LE(c.length,12); e.writeUInt32LE(off,16); return Buffer.concat(loc.concat([c,e])); }
 const png=Buffer.from(PNG,'base64');
 const dx='<w:document><w:body><w:p><w:r><w:t>Coupe du mur</w:t></w:r><w:r><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:r></w:p><w:p><w:r><w:t>Figure 2 : détail de l\'appui</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rId6"/></w:drawing></w:r></w:p><w:p><w:r><w:t>Légende voisine</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p></w:body></w:document>';
 const rl='<Relationships><Relationship Id="rId5" Type="x" Target="media/image1.png"/><Relationship Id="rId6" Type="x" Target="media/image2.png"/><Relationship Id="rId7" Type="x" Target="media/vecteur.emf"/></Relationships>';
 const dz=zipN([['word/document.xml',dx],['word/_rels/document.xml.rels',rl],['word/media/image1.png',png],['word/media/image2.png',png],['word/media/vecteur.emf',Buffer.from('EMF')]]);
 const reduire=async(octets,mime)=>({w:120,h:90,src:'data:image/png;base64,'+Buffer.from(octets).toString('base64'),thumb:{type:'image/jpeg',data:'TUI='}});
 const figs=await C.docxFigures(Uint8Array.from(dz).buffer,reduire); eq(figs.length,2,'docx : deux images (l\'emf est ignore)'); eq(figs.map(f=>f.legende),['Coupe du mur','Légende voisine'],'docx : legende = texte du paragraphe ou voisin');
 const txtDocx=await C.docxTexte(Uint8Array.from(dz).buffer); eq(/Coupe du mur/.test(txtDocx),true,'docx : texte lu avec plusieurs entrees');
 const srcI=await C.lireSource(F('plan.docx',dz),{reduire}); eq([srcI.figures.length,!!srcI.erreur],[2,false],'lireSource : images d\'un Word');
 const srcP=await C.lireSource(F('p.pdf','x','application/pdf'),{pdf:async()=>({texte:'Le texte',images:[]}),figuresPdf:async()=>[{w:100,h:80,src:'data:image/png;base64,'+PNG,thumb:{type:'image/jpeg',data:'AA=='},legende:'p1',page:1}]}); eq([srcP.figures.length,srcP.figures[0].page],[1,1],'lireSource : images d\'un PDF');
 const srcX=await C.lireSource(F('p.pdf','x','application/pdf'),{pdf:async()=>({texte:'T',images:[]}),figuresPdf:async()=>{ throw new Error('x'); }}); eq([srcX.figures.length,!!srcX.erreur],[0,false],'echec des images : le texte reste lu');
 const srcM=await C.lireSource(F('photo.png','x','image/png'),{image:async()=>({type:'image/jpeg',data:'QQ=='}),figureImage:async()=>({w:200,h:100,src:'data:image/png;base64,'+PNG,thumb:{type:'image/jpeg',data:'AA=='},legende:'photo',page:null})}); eq([srcM.figures.length,srcM.images.length],[1,1],'photo deposee : image gardee');
 /* demande : miniatures et legendes seulement */
 const lf=[{id:'img1',page:2,legende:'Coupe',src:'data:image/png;base64,'+PNG,w:1,h:1,thumb:{type:'image/jpeg',data:'AAAA'}},{id:'x<script>',thumb:{data:'BB'}},{id:'img2',page:null,legende:'',src:'data:image/png;base64,'+PNG,thumb:{type:'image/jpeg',data:'BBBB'}}];
 const bi=C.construireDemande([{nom:'a',texte:'t',images:[]}],'fiche',null,'',lf); eq(bi.images_disponibles.map(x=>x.id),['img1','img2'],'demande : seuls les identifiants valides'); eq(JSON.stringify(bi).indexOf('base64,'+PNG),-1,'demande : jamais l\'image reelle'); eq(Object.keys(bi.images_disponibles[0]).sort(),['id','legende','miniature','page'],'demande : id, page, legende, miniature');
 eq(C.construireDemande([{nom:'a',texte:'t',images:[]}],'fiche',null,'',[]).images_disponibles,undefined,'sans images : rien envoye');
 /* liste blanche des identifiants d'image */
 const dispo={img1:{src:'data:image/png;base64,'+PNG,w:100,h:50,legende:'Coupe',page:2},img2:{src:'http://evil/x.png',w:1,h:1},img3:{src:'data:image/svg+xml;base64,AAAA',w:1,h:1},'x y':{src:'data:image/png;base64,'+PNG}};
 const pi=C.validerPresentation({titre:'T',diapositives:[{titre:'A',mise_en_page:'image',image_id:'img1'},{titre:'B',mise_en_page:'image',image_id:'img2'},{titre:'C',mise_en_page:'image',image_id:'https://x/y.png',points:['p']},{titre:'D',cartes:[{titre:'c',image_id:'img1'},{titre:'d',image_id:'img9'}]},{titre:'E',mise_en_page:'points',points:['p'],image_id:'img1'}]},dispo);
 eq(pi.diapositives.map(x=>x.mise_en_page+':'+x.image_id),['image:img1','citation:','points:','cartes:','points:img1'],'identifiant inconnu ou lien = pas d\'image, mise en page lisible'); eq(pi.diapositives[3].cartes.map(c=>c.image_id),['img1',''],'image dans les cartes'); eq(Object.keys(pi.images),['img1'],'seules les images utilisees restent'); eq(Object.keys(C.imagesSures(dispo)),['img1'],'images locales : donnees integrees seulement');
 const tx=C.versTexte(pi); eq(/\[image\] img1/.test(tx),true,'texte modifiable : ligne image'); const ed2=C.depuisTexte(tx,pi); eq(ed2.diapositives[0].image_id,"img1","aller-retour : image gardee"); eq(Object.keys(ed2.images),['img1'],'aller-retour : images gardees');
 const sans=C.depuisTexte(tx.replace('[image] img1',''),pi); eq(sans.diapositives[0].image_id==='img1'&&sans.diapositives[0].mise_en_page==='image',false,'image retiree a la main');
 /* rendu avec images : fichier autonome et PDF */
 const hi=C.htmlPresentation(pi,{animation:'sans'}); eq(hi.indexOf('data:image/png;base64,'+PNG)>0,true,'html : image integree au fichier'); eq(/<img src=|https?:\/\//.test(hi.replace(/<!doctype[^>]*>/,'')),false,'html : aucune ressource externe'); eq(hi.indexOf('onerror')>0,true,'html : image absente = diapositive lisible');
 const bl=C.pdfPresentation(pi,Js); const bb=Buffer.from(await bl.arrayBuffer()).toString('latin1'); eq((bb.match(/\/Subtype\s*\/Image/g)||[]).length>=1,true,'pdf : images integrees'); eq((bb.match(/\/Type\s*\/Page[^s]/g)||[]).length,pi.diapositives.length,'pdf : une diapositive par page avec images');
 const pm=JSON.parse(JSON.stringify(pi)); pm.images.img1.src='data:image/png;base64,AAAA'; const blm=C.pdfPresentation(pm,Js); eq(Buffer.from(await blm.arrayBuffer()).slice(0,5).toString(),'%PDF-','pdf : image illisible = PDF quand meme produit');
 /* plusieurs pieces jointes et migration douce */
 const ancien={id:'S1',theme:'T',pj:{name:'vieux.pdf',src:'data:application/pdf;base64,AA=='},iaContenu:{titre:'x'}}; const m1=C.coursIaPjs(ancien); eq([m1.length,m1[0].role,m1[0].label,m1[0].name],[1,'pdf','PDF généré','vieux.pdf'],'migration : ancien support avec presentation = PDF genere'); eq(ancien.pj.name,'vieux.pdf','migration : ancienne pj conservee');
 const manuel={id:'S2',theme:'T',pj:{name:'cours.docx',src:'data:application/x;base64,AA=='}}; eq(C.coursIaPjs(manuel)[0].role,'autre','migration : piece jointe manuelle'); eq(C.coursIaPjs({id:'S3'}),[],'migration : support sans piece jointe');
 const trois={id:'S4',pjs:[{id:'o0',role:'origine',label:'Document d\'origine',name:'a.pdf',src:'x'},{id:'o1',role:'origine',label:'Document d\'origine',name:'b.docx',src:'x'},{id:'g1',role:'pdf',label:'PDF généré',name:'c.pdf',src:'x'}],iaContenu:{titre:'p'}}; eq(C.coursIaPjs(trois).map(x=>x.role),['origine','origine','pdf'],'plusieurs pieces jointes : origine(s) et PDF generes gardes');
 console.log(n+' tests, '+ko+' echec(s)'); process.exit(ko?1:0);
})();
