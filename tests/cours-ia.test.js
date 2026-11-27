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
 /* résultat */
 const r=C.validerResultat({titre:'T',sections:[{titre:'S1',paragraphes:['p1'],liste:['a','b']}],manquant:['durée']}); eq([r.titre,r.sections.length,r.manquant],['T',1,['durée']],'resultat valide'); eq(C.validerResultat({}),null,'resultat vide refuse'); eq(C.validerResultat('x'),null,'resultat non objet refuse');
 const t=C.versTexte(r); const r2=C.depuisTexte(t,r.manquant); eq([r2.titre,r2.sections[0].titre,r2.sections[0].paragraphes,r2.sections[0].liste],['T','S1',['p1'],['a','b']],'texte modifiable : aller-retour');
 eq(/&lt;b&gt;/.test(C.versHtml({titre:'<b>',sections:[],manquant:[]})),true,'html echappe'); eq(/généré par IA/i.test(C.versHtml(r)),true,'etiquette genere par IA');
 /* échec serveur et effacement */
 const ok=await C.demander({},async()=>({resp:{ok:true,status:200},j:{data:{titre:'X',sections:[{titre:'a',paragraphes:['b']}],manquant:[]}}})); eq(!!ok.resultat,true,'serveur ok');
 const f404=await C.demander({},async()=>({resp:{ok:false,status:404},j:null})); eq([!!f404.erreur,f404.indispo],[true,true],'serveur absent : IA indisponible');
 const fres=await C.demander({},async()=>{ throw new Error('reseau'); }); eq([/indisponible/.test(fres.erreur),fres.indispo],[true,true],'reseau coupe');
 const f500=await C.demander({},async()=>({resp:{ok:false,status:500},j:{error:'boom'}})); eq([f500.erreur,f500.indispo],['boom',undefined],'erreur serveur');
 const fvid=await C.demander({},async()=>({resp:{ok:true,status:200},j:{data:{}}})); eq(!!fvid.erreur,true,'reponse vide');
 const tmp={sources:S.slice(0,2),modeleDoc:{nom:'m',texte:'secret'},urls:[],body:b2}; const keep=tmp.sources; C.effacer(tmp);
 eq([tmp.sources.length,tmp.modeleDoc,tmp.body,keep.length],[0,null,null,0],'copies temporaires effacees'); eq(b2.sources,[],'demande videe'); eq(b2.modele_texte,undefined,'modele depose efface');
 /* effacement même si l'appel échoue */
 const t2={sources:[{nom:'x',texte:'secret',images:[{data:'A'}]}],modeleDoc:null,urls:[],body:null}; t2.body=C.construireDemande(t2.sources,'fiche',null,''); try{ await C.demander(t2.body,async()=>{ throw new Error('x'); }); }finally{ C.effacer(t2); } eq(t2.sources.length,0,'effacement apres echec');
 console.log(n+' tests, '+ko+' echec(s)'); process.exit(ko?1:0);
})();
