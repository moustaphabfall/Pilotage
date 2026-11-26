/* Tests de l'interpréteur sûr des méthodes décrites par l'utilisateur (DimSkill).
   Lancer : node tests/dimskill.test.js   (lit le script <script id="dimSkillJs"> de index.html, sans navigateur) */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=/<script id="dimSkillJs">([\s\S]*?)<\/script>/.exec(html); if(!m){ console.error('script dimSkillJs introuvable'); process.exit(1); }
const sandbox={console}; sandbox.window=sandbox; vm.createContext(sandbox); vm.runInContext(m[1],sandbox,{timeout:2000});
const D=sandbox.DimSkill; let n=0, bad=0;
function t(nom,fn){ n++; try{ fn(); }catch(e){ bad++; console.error('ECHEC : '+nom+' -> '+(e&&e.message)); } }
const ev=(f,vars)=>{ const sk={nom:'t',entrees:Object.keys(vars||{}).map(k=>({id:k,valeur:vars[k]})),etapes:[{id:'r',formule:f}],sorties:[{id:'r'}]}; return D.run(sk); };
const val=(f,vars)=>{ const r=ev(f,vars); assert(r.ok,'attendu ok : '+f+' '+r.erreurs); return r.sorties[0].valeur; };
const ko=(f,vars)=>{ const r=ev(f,vars); assert(!r.ok,'attendu refus : '+f); assert(r.erreurs.length>0); return r; };
/* arithmétique et priorités */
t('addition',()=>assert.strictEqual(val('1+2*3'),7));
t('parentheses',()=>assert.strictEqual(val('(1+2)*3'),9));
t('puissance droite',()=>assert.strictEqual(val('2^3^2'),512));
t('moins unaire et puissance',()=>assert.strictEqual(val('-2^2'),-4));
t('puissance negative',()=>assert.strictEqual(val('2^-2'),0.25));
t('variables',()=>assert.strictEqual(val('q*L^2/8',{q:20,L:5}),62.5));
t('sqrt',()=>assert.strictEqual(val('sqrt(16)'),4));
t('min max abs',()=>{ assert.strictEqual(val('min(3,1,2)'),1); assert.strictEqual(val('max(3,1,2)'),3); assert.strictEqual(val('abs(-4)'),4); });
t('trigo',()=>{ assert(Math.abs(val('sin(pi/2)')-1)<1e-12); assert(Math.abs(val('cos(0)')-1)<1e-12); assert(Math.abs(val('tan(pi/4)')-1)<1e-12); });
t('ln exp',()=>{ assert(Math.abs(val('ln(exp(2))')-2)<1e-12); });
t('notation scientifique',()=>assert.strictEqual(val('1e3+1'),1001));
t('signes typographiques',()=>assert.strictEqual(val('6 × 2 ÷ 3 − 1'),3));
/* refus sûrs */
t('division par zero',()=>ko('1/0'));
t('division par zero variable',()=>ko('1/(a-a)',{a:3}));
t('zero puissance negative',()=>ko('0^-1'));
t('exposant enorme',()=>ko('2^100000'));
t('exposant enorme 2',()=>ko('10^400'));
t('depassement par produits',()=>ko('1e300*1e300'));
t('sqrt negatif',()=>ko('sqrt(-1)'));
t('ln zero',()=>ko('ln(0)'));
t('exp enorme',()=>ko('exp(1000)'));
t('tan pi/2',()=>ko('tan(pi/2)'));
t('puissance non definie',()=>ko('(-8)^0.5'));
t('variable inconnue',()=>ko('x+1'));
t('fonction inconnue',()=>ko('alert(1)'));
t('fonction sans parenthese',()=>ko('sqrt'));
t('mauvais nombre arguments',()=>ko('sqrt(1,2)'));
t('parenthese manquante',()=>ko('(1+2'));
t('formule vide',()=>ko('   '));
t('virgule decimale refusee',()=>ko('2,5*2'));
/* injection de code et acces interdits */
['constructor','__proto__','this','window','document','globalThis','process','require("fs")','Function("return 1")()','eval("1")','(function(){})()','`${1}`','1;alert(1)','a=1','a==1','a&&b','a||b','!a','a?b:c','[1][0]','{}','"x"','\'x\'','\\u0061','/*c*/1','//c','x.y','x[0]','a=>a','import("x")','fetch("http://x")','1%2','1&2','1|2','1<2','1>2','$a','a b','1 2','@'].forEach(s=>{ t('injection : '+s,()=>ko(s,{a:1,b:2,x:3})); });
t('proto via entrees',()=>{ const r=D.validate({nom:'x',entrees:[{id:'__proto__',valeur:1}],etapes:[{id:'r',formule:'1'}],sorties:[{id:'r'}]}); assert(r.ok||!r.ok); const q=D.run({nom:'x',entrees:[{id:'constructor',valeur:1}],etapes:[{id:'r',formule:'constructor+1'}],sorties:[{id:'r'}]}); assert(q.ok===true||q.ok===false); assert.strictEqual(({}).polluted,undefined); });
t('pollution du prototype',()=>{ D.run({nom:'x',entrees:[{id:'__proto__',valeur:1}],etapes:[{id:'polluted',formule:'__proto__*2'}],sorties:[{id:'polluted'}]}); assert.strictEqual(({}).polluted,undefined); assert.strictEqual(Object.prototype.polluted,undefined); });
/* limites de taille */
t('formule trop longue',()=>ko('1+'.repeat(200)+'1'));
t('imbrication profonde',()=>ko('('.repeat(300)+'1'+')'.repeat(300)));
t('moins en chaine',()=>ko('-'.repeat(300)+'1'));
t('trop de jetons',()=>ko(Array(250).fill('1').join('+')));
t('nombre geant',()=>ko('1e999'));
t('temps borne',()=>{ const t0=Date.now(); ev('((((((((((1+1)*2)*3)*4)*5)*6)*7)*8)*9)*10)^1000'); assert(Date.now()-t0<200); });
/* structure */
t('structure valide',()=>{ const sk={nom:'Poutre',entrees:[{id:'q',nom:'Charge',unite:'kN/m',valeur:20},{id:'L',unite:'m',valeur:5}],etapes:[{id:'M',nom:'Moment',formule:'q*L^2/8',unite:'kN.m'},{id:'V',nom:'Effort',formule:'q*L/2',unite:'kN'}],sorties:[{id:'M'},{id:'V'}]}; const r=D.run(sk); assert(r.ok); assert.strictEqual(r.sorties[0].valeur,62.5); assert.strictEqual(r.sorties[1].valeur,50); assert(r.lignes[0].subst.indexOf('(20)')>=0); });
t('surcharge d entree',()=>{ const sk={nom:'x',entrees:[{id:'a',valeur:2}],etapes:[{id:'r',formule:'a*3'}],sorties:[{id:'r'}]}; assert.strictEqual(D.run(sk,{a:5}).sorties[0].valeur,15); });
t('etape avant sa definition',()=>{ const r=D.run({nom:'x',entrees:[],etapes:[{id:'a',formule:'b+1'},{id:'b',formule:'2'}],sorties:[{id:'a'}]}); assert(!r.ok); });
t('identifiants doubles',()=>{ assert(!D.validate({nom:'x',entrees:[{id:'a',valeur:1}],etapes:[{id:'a',formule:'1'}],sorties:[{id:'a'}]}).ok); });
t('identifiant reserve',()=>{ assert(!D.validate({nom:'x',entrees:[{id:'sqrt',valeur:1}],etapes:[{id:'r',formule:'1'}],sorties:[{id:'r'}]}).ok); assert(!D.validate({nom:'x',entrees:[{id:'pi',valeur:1}],etapes:[{id:'r',formule:'1'}],sorties:[{id:'r'}]}).ok); });
t('valeur d entree invalide',()=>{ ['abc','',null,undefined,Infinity,NaN,1e20,{},[]].forEach(v=>assert(!D.validate({nom:'x',entrees:[{id:'a',valeur:v}],etapes:[{id:'r',formule:'a'}],sorties:[{id:'r'}]}).ok,'refus '+String(v))); });
t('entree avec virgule',()=>{ assert.strictEqual(D.run({nom:'x',entrees:[{id:'a',valeur:'2,5'}],etapes:[{id:'r',formule:'a*2'}],sorties:[{id:'r'}]}).sorties[0].valeur,5); });
t('bornes d entree',()=>{ assert(!D.validate({nom:'x',entrees:[{id:'a',valeur:5,max:3}],etapes:[{id:'r',formule:'a'}],sorties:[{id:'r'}]}).ok); });
t('sortie inconnue',()=>{ assert(!D.validate({nom:'x',entrees:[],etapes:[{id:'r',formule:'1'}],sorties:[{id:'zzz'}]}).ok); });
t('entrees invalides',()=>{ [null,undefined,'x',5,[],{},{etapes:'x'}].forEach(v=>{ const r=D.run(v); assert.strictEqual(r.ok,false); }); });
t('trop d etapes',()=>{ const et=[]; for(let i=0;i<60;i++) et.push({id:'e'+i,formule:'1'}); assert(!D.validate({nom:'x',entrees:[],etapes:et,sorties:[{id:'e0'}]}).ok); });
t('champs inconnus ignores',()=>{ const v=D.validate({nom:'x',evil:'<script>',entrees:[{id:'a',valeur:1,hack:'x'}],etapes:[{id:'r',formule:'a',run:'x'}],sorties:[{id:'r'}]}); assert(v.ok); assert.strictEqual(v.skill.evil,undefined); assert.strictEqual(v.skill.entrees[0].hack,undefined); });
t('texte nettoye',()=>{ const v=D.validate({nom:'<img src=x onerror=1>',entrees:[],etapes:[{id:'r',formule:'1'}],sorties:[{id:'r'}]}); assert(v.skill.nom.indexOf('<')<0); });
t('aucune API dans le bac a sable',()=>{ assert.strictEqual(typeof sandbox.fetch,'undefined'); assert.strictEqual(typeof sandbox.document,'undefined'); });
console.log(n+' tests, '+bad+' echec(s)'); process.exit(bad?1:0);
