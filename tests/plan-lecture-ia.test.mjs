/* Test du mode « plan_lecture » de supabase/fiche-ia.ts avec des doubles (aucun réseau, aucune base).
   Lancer : node --experimental-strip-types tests/plan-lecture-ia.test.mjs */
import { handle } from '../supabase/fiche-ia.ts';
let n = 0, ko = 0;
const eq = (a, b, m) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { ko++; console.log('ECHEC', m, 'attendu', JSON.stringify(b), 'recu', JSON.stringify(a)); } };
const w = { appels: 0, dernier: null };
const d = {
  apiKey: 'k',
  fetch: async (url, init) => { w.appels++; w.dernier = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: 'tool_use', input: { message: 'ok', lecture: { pieces: [] } } }] }), { status: 200 }); },
  getUser: async (t) => (t === 'tS' ? { id: 'uS' } : null),
  getProfile: async (id) => (id === 'uS' ? { role: 'admin', approuve: true } : null),
  isMember: async () => true,
  consommer: async () => ({ statut: 'accepte', limite: 10, utilise: 1, autorise: true, cree: false }),
  rembourser: async () => {},
};
const req = (body, tok) => new Request('http://x', { method: 'POST', headers: tok ? { Authorization: 'Bearer ' + tok } : {}, body: JSON.stringify(body) });
const img = { nom: 'p', type: 'image/jpeg', data: 'AAAA' };
let r = await handle(req({ mode: 'plan_lecture', lot: 'plomberie', fichiers: [img] }), d);
eq(r.status, 401, 'sans jeton : refusé par la garde'); eq(w.appels, 0, 'sans jeton : aucun appel à l’IA');
r = await handle(req({ mode: 'plan_lecture', lot: 'plomberie', fichiers: [] }, 'tS'), d);
eq(r.status, 400, 'sans image : refusé'); eq(w.appels, 0, 'sans image : aucun appel à l’IA');
r = await handle(req({ mode: 'plan_lecture', lot: 'plomberie', lot_nom: 'Plomberie', plan_nom: 'Plan RDC', niveau: 'RDC', pieces_connues: ['Séjour'], fichiers: [img, img] }, 'tS'), d);
eq(r.status, 200, 'avec jeton et image : accepté'); eq((await r.json()).data.message, 'ok', 'réponse transmise');
eq(w.appels, 1, 'un seul appel à l’IA'); eq(w.dernier.tools[0].name, 'proposer_lecture_plan', 'bon outil');
eq(w.dernier.messages[0].content.filter((c) => c.type === 'image').length, 1, 'un seul plan lu à la fois');
eq(/Séjour/.test(JSON.stringify(w.dernier.messages)), true, 'pièces connues transmises');
eq(/^Tu es l'assistant de lecture de plans/.test(w.dernier.system), true, 'consigne du mode plan');
console.log(n + ' tests, ' + ko + ' echec(s)'); process.exit(ko ? 1 : 0);
