/* Test de la garde d'usage de supabase/fiche-ia.ts avec des doubles (aucun réseau, aucune base).
   Lancer : node --experimental-strip-types tests/fiche-ia.test.mjs */
import { handle, ANIMATIONS, MISES_EN_PAGE, THEMES } from '../supabase/fiche-ia.ts';
let n = 0, ko = 0;
const eq = (a, b, m) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { ko++; console.log('ECHEC', m, 'attendu', JSON.stringify(b), 'recu', JSON.stringify(a)); } };
/* base simulée : mêmes règles que ia_consommer / ia_rembourser (migration-ia-limite.sql) */
function monde() {
  const users = { tA: { id: 'uA', email: 'a@x.fr', nom: 'Alice' }, tB: { id: 'uB', email: 'b@x.fr', nom: 'Bob' }, tS: { id: 'uS', email: 's@x.fr', nom: 'Super' }, tN: { id: 'uN', email: 'n@x.fr', nom: 'Nouveau' } };
  const profils = { uA: { role: 'editeur', approuve: true }, uB: { role: 'editeur', approuve: true }, uS: { role: 'admin', approuve: true }, uN: { role: 'editeur', approuve: false } };
  const membres = new Set(['uA|P1', 'uA|P2', 'uB|P1', 'uS|P1']);
  const acces = new Map(); const defaut = 3; const w = { appelsIA: 0, consommer: 0, rembourser: 0, derniereCle: null };
  const d = {
    apiKey: 'k',
    fetch: async (url, init) => { w.appelsIA++; w.derniereCle = init.headers['x-api-key']; const body = JSON.parse(init.body); w.dernierBody = body;
      if (w.echec) return new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 });
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', input: body.tools[0].name === 'definir_methode' ? { message: 'ok' } : { valeurs: [], resume: 'ok', manquant: [] } }] }), { status: 200 }); },
    getUser: async (t) => users[t] || null,
    getProfile: async (id) => profils[id] || null,
    isMember: async (u, p) => membres.has(u + '|' + p),
    consommer: async (u, p, nom, email) => { w.consommer++; const k = u + '|' + p; let cree = false;
      if (!acces.has(k)) { acces.set(k, { statut: 'attente', limite: defaut, utilise: 0, nom, email }); cree = true; }
      const r = acces.get(k); let ok = false; if (r.statut === 'accepte' && r.utilise < r.limite) { r.utilise++; ok = true; }
      return { statut: r.statut, limite: r.limite, utilise: r.utilise, autorise: ok, cree }; },
    rembourser: async (u, p) => { w.rembourser++; const r = acces.get(u + '|' + p); if (r && r.statut === 'accepte' && r.utilise > 0) r.utilise--; },
  };
  return { d, acces, w, defaut };
}
const req = (tok, body, method = 'POST') => new Request('http://x/fiche-ia', { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined });
const fiche = (o = {}) => ({ message: 'portee 6 m', champs: [{ cle: 'L', nom: 'Portee', unite: 'm', type: 'number', valeur: 5 }], projet: 'P1', ...o });
const meth = (o = {}) => ({ mode: 'methode', message: 'q fois L', projet: 'P1', ...o });
const run = async (d, tok, body) => { const r = await handle(req(tok, body), d); return { s: r.status, j: await r.json() }; };

{ /* preflight */
  const { d } = monde(); const r = await handle(req(null, null, 'OPTIONS'), d); eq(r.status, 200, 'options');
}
{ /* sans jeton : refus poli, aucun appel IA, rien compté */
  const { d, w } = monde(); const r = await run(d, null, fiche()); eq([r.s, r.j.code], [401, 'connexion'], 'sans jeton'); eq([w.appelsIA, w.consommer], [0, 0], 'sans jeton : rien appelé');
  const r2 = await run(d, 'inconnu', fiche()); eq([r2.s, r2.j.code], [401, 'connexion'], 'jeton faux');
}
{ /* compte non validé */
  const { d, w } = monde(); const r = await run(d, 'tN', fiche()); eq([r.s, r.j.code], [403, 'compte'], 'compte non valide'); eq(w.appelsIA, 0, 'compte non valide : pas d\'IA');
}
{ /* première demande : demande d'autorisation, réponse polie, IA non appelée */
  const { d, w, acces } = monde(); const r = await run(d, 'tA', fiche());
  eq([r.s, r.j.code], [403, 'attente'], 'attente'); eq(/en attente d'autorisation/.test(r.j.error), true, 'message poli');
  eq(w.appelsIA, 0, 'attente : IA non appelée'); eq(acces.get('uA|P1').statut, 'attente', 'ligne créée en attente');
  const r2 = await run(d, 'tA', meth()); eq(r2.j.code, 'attente', 'mode methode aussi en attente'); eq(acces.size, 1, 'pas de doublon');
}
{ /* projet absent ou étranger */
  const { d, w } = monde(); const r = await run(d, 'tA', fiche({ projet: '' })); eq(r.j.code, 'projet', 'projet absent');
  const r2 = await run(d, 'tB', fiche({ projet: 'P2' })); eq(r2.j.code, 'projet', 'projet dont il n\'est pas membre'); eq(w.consommer, 0, 'rien compté');
}
{ /* accord + limite : trois appels passent, le quatrième est refusé (429) ; deux modes comptent ensemble */
  const { d, w, acces } = monde(); await run(d, 'tA', fiche()); acces.get('uA|P1').statut = 'accepte';
  const a = await run(d, 'tA', fiche()); eq([a.s, !!a.j.data], [200, true], 'appel 1 fiche');
  const b = await run(d, 'tA', meth()); eq([b.s, !!b.j.data], [200, true], 'appel 2 methode');
  const c = await run(d, 'tA', fiche()); eq(c.s, 200, 'appel 3');
  const e = await run(d, 'tA', fiche()); eq([e.s, e.j.code], [429, 'limite'], 'appel 4 refuse'); eq(w.appelsIA, 3, 'IA appelée 3 fois seulement'); eq(acces.get('uA|P1').utilise, 3, 'compteur');
  acces.get('uA|P1').limite = 5; const f = await run(d, 'tA', fiche()); eq(f.s, 200, 'limite relevée : repasse');
  /* un autre projet du même utilisateur est compté à part */
  const g = await run(d, 'tA', fiche({ projet: 'P2' })); eq(g.j.code, 'attente', 'autre projet : sa propre demande'); eq(acces.size, 2, 'deux lignes');
  /* un autre utilisateur n'est pas touché */
  const h = await run(d, 'tB', fiche()); eq(h.j.code, 'attente', 'autre utilisateur : attente');
}
{ /* refus explicite */
  const { d, w, acces } = monde(); await run(d, 'tA', fiche()); acces.get('uA|P1').statut = 'refuse';
  const r = await run(d, 'tA', fiche()); eq([r.s, r.j.code], [403, 'refuse'], 'refuse'); eq(w.appelsIA, 0, 'refuse : pas d\'IA');
}
{ /* super administrateur : jamais limité, rien compté */
  const { d, w, acces } = monde(); for (let i = 0; i < 8; i++) { const r = await run(d, 'tS', fiche({ projet: '' })); eq(r.s, 200, 'super ' + i); }
  eq([w.appelsIA, w.consommer, acces.size], [8, 0, 0], 'super : pas de compteur');
}
{ /* échec côté IA : l'appel est rendu */
  const { d, w, acces } = monde(); await run(d, 'tA', fiche()); acces.get('uA|P1').statut = 'accepte'; w.echec = true;
  const r = await run(d, 'tA', fiche()); eq(r.s, 400, 'erreur IA'); eq(acces.get('uA|P1').utilise, 0, 'appel rendu'); eq(w.rembourser, 1, 'remboursement demande');
}
{ /* validations d'entrée : message vide ou fiche sans champ ne consomment pas */
  const { d, w, acces } = monde(); await run(d, 'tA', fiche()); acces.get('uA|P1').statut = 'accepte';
  const r1 = await run(d, 'tA', fiche({ message: '  ' })); eq(r1.s, 400, 'message vide'); const r2 = await run(d, 'tA', fiche({ champs: [] })); eq(r2.s, 400, 'sans champ');
  eq(acces.get('uA|P1').utilise, 0, 'rien consomme');
}
{ /* clé serveur absente */
  const { d } = monde(); d.apiKey = undefined; const r = await run(d, 'tA', fiche()); eq(r.s, 400, 'sans cle');
}
{ /* mode descente : passe aussi par la garde (attente, puis accord compte un appel) */
  const { d, w, acces } = monde(); const desc = { mode: 'descente', projet: 'P1', fichiers: [{ type: 'image/png', data: 'AAAA' }], lot: { numero: 1, total: 2 }, deja_connu: {} };
  const r = await run(d, 'tA', desc); eq([r.s, r.j.code], [403, 'attente'], 'descente : attente'); eq(w.appelsIA, 0, 'descente : IA non appelee');
  acces.get('uA|P1').statut = 'accepte'; const r2 = await run(d, 'tA', desc); eq(r2.s, 200, 'descente accordee'); eq(acces.get('uA|P1').utilise, 1, 'descente consomme un appel');
  const r3 = await run(d, 'tA', { ...desc, fichiers: [] }); eq(r3.s, 400, 'descente sans fichier');
}
{ /* mode support_cours : garde, validation des sources, aucun stockage, remboursement en cas d'echec */
  const { d, w, acces } = monde(); const sc = { mode: 'support_cours', projet: 'P1', modele: { nom: 'Resume', structure: 'Un titre, trois points' }, consigne: '', sources: [{ nom: 'cours.pdf', texte: 'Le beton se coule en couches.' }] };
  const r = await run(d, 'tA', sc); eq([r.s, r.j.code], [403, 'attente'], 'support : attente'); eq(w.appelsIA, 0, 'support : IA non appelee');
  acces.get('uA|P1').statut = 'accepte'; const r2 = await run(d, 'tA', sc); eq(r2.s, 200, 'support accorde'); eq(acces.get('uA|P1').utilise, 1, 'support consomme un appel');
  const r3 = await run(d, 'tA', { ...sc, sources: [] }); eq(r3.s, 400, 'support sans source'); eq(acces.get('uA|P1').utilise, 1, 'support sans source : rien consomme');
  const r4 = await run(d, 'tA', { ...sc, sources: [{ nom: 'x', texte: '', images: [{ type: 'image/gif', data: 'AAAA' }] }] }); eq(r4.s, 400, 'support image refusee');
  w.echec = true; const r5 = await run(d, 'tA', sc); eq(r5.s, 400, 'support echec serveur'); eq(acces.get('uA|P1').utilise, 1, 'support echec : appel rendu');
}
{ /* support_cours : schema de presentation, listes blanches d'animation, aucun code libre */
  const { d, w, acces } = monde(); await run(d, 'tA', { mode: 'support_cours', projet: 'P1', modele: { nom: 'x', structure: 'y' }, sources: [{ nom: 's', texte: 't' }] }); acces.get('uA|P1').statut = 'accepte';
  await run(d, 'tA', { mode: 'support_cours', projet: 'P1', modele: { nom: 'x', structure: 'y' }, sources: [{ nom: 's', texte: 't' }] });
  const tool = w.dernierBody.tools[0]; eq(tool.name, 'rediger_presentation', 'outil presentation');
  const it = tool.input_schema.properties.diapositives.items.properties; eq(it.animation.enum, ['aucune', 'fondu', 'glissement', 'zoom', 'points'], 'animations : liste blanche'); eq(it.mise_en_page.enum, MISES_EN_PAGE, 'mises en page : liste blanche');
  eq(tool.input_schema.properties.theme.enum, THEMES, 'themes : liste blanche'); eq(ANIMATIONS.includes('script'), false, 'pas d\'animation libre'); eq(w.dernierBody.tool_choice.name, 'rediger_presentation', 'outil impose');
  eq(/AUCUN fait/.test(w.dernierBody.system), true, 'consigne : aucun fait invente'); eq(/mur de texte/.test(w.dernierBody.system), true, 'consigne : style cartes');
}
{ /* simulation de l'environnement Deno : la fonction s'enregistre et répond */
  let h = null; globalThis.Deno = { serve: (f) => { h = f; }, env: { get: () => undefined } };
  await import('../supabase/fiche-ia.ts?deno'); eq(typeof h, 'function', 'Deno.serve appele'); delete globalThis.Deno;
}
console.log(n + ' tests, ' + ko + ' echec(s)'); process.exit(ko ? 1 : 0);
