'use strict';
/* Moteur de génération : pièces, murs, ouvrages de gros œuvre (avec données de dimensionnement), pastilles par lot, avancement, devis neutres, demandes. Déterministe : aucun hasard, aucune date du jour. */
const { CHANTIERS } = require('./chantiers.js');
const AUJOURDHUI = '2026-11-30'; /* date de référence de la démonstration (fixe, pour que tout soit reproductible) */

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;
function addJours(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + Math.round(n)); return d.toISOString().slice(0, 10); }
function ecartJours(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

/* ---------- pièces et murs ---------- */
function rangee(y0, y1, liste, W) {
  const fixe = liste.reduce((a, r) => a + (r[1] || 0), 0); let x = 0; const out = [];
  liste.forEach((r, i) => { const w = r[1] || (W - fixe); out.push({ nom: r[0], type: r[2], poly: [[x, y0], [x + w, y0], [x + w, y1], [x, y1]] }); x += w; });
  return out;
}
function pieces(ch, nv) {
  if (nv.rooms) return nv.rooms.map((r) => ({ nom: r[0], type: r[5], poly: [[r[1], r[2]], [r[3], r[2]], [r[3], r[4]], [r[1], r[4]]] }));
  if (!nv.S) return [];
  const { W, D, Cw, Ds } = ch;
  return rangee(0, Ds, nv.S, W).concat(rangee(Ds, Ds + Cw, [[nv.C, 0, 'circ']], W), rangee(Ds + Cw, D, nv.N, W));
}
function bbox(poly) { const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; }
function murs(ch, rooms) {
  const seen = {}, out = [];
  rooms.forEach((r) => r.poly.forEach((p, i) => {
    const q = r.poly[(i + 1) % r.poly.length], a = p[0] < q[0] || (p[0] === q[0] && p[1] <= q[1]) ? [p, q] : [q, p], k = a.join('|');
    if (seen[k]) return; seen[k] = 1;
    const ext = (a[0][0] === 0 && a[1][0] === 0) || (a[0][0] === ch.W && a[1][0] === ch.W) || (a[0][1] === 0 && a[1][1] === 0) || (a[0][1] === ch.D && a[1][1] === ch.D);
    out.push({ x1: a[0][0], y1: a[0][1], x2: a[1][0], y2: a[1][1], ext });
  }));
  return out;
}
const piece_de = (rooms, x, y) => { const c = rooms.filter((q) => { const b = bbox(q.poly); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; }); const r = c.filter((q) => q.type !== 'circ')[0] || c[0]; return r ? r.nom : ''; };

/* ---------- ouvrages de gros œuvre (mètres) ---------- */
function grille(ch) { const nx = Math.ceil(ch.W / 1000) + 1; const xs = []; for (let i = 0; i < nx; i++) xs.push(Math.round(ch.W * i / (nx - 1) / 10) * 10); return { xs, ys: [0, ch.D] }; }
function sectionPoteau(N) { return N < 900 ? 30 : N < 1700 ? 40 : N < 2800 ? 50 : 60; }
function goNiveau(ch, nv, idx, rooms) {
  const L = [], { xs, ys } = grille(ch), g = ch.usage.g, q = ch.usage.q, nb = Math.max(1, ch.nEtages - Math.max(0, idx - 1));
  const portee = Math.max(...xs.map((x, i) => (i ? x - xs[i - 1] : 0))) / 100, tribA = (xs[1] - xs[0]) / 100 * Math.min(ch.D / 200, 7);
  const nivPorteur = nv.kind !== 'toit';
  if (nv.fond) {
    xs.forEach((x, i) => ys.forEach((y, j) => {
      const Ng = g * tribA * ch.nEtages * 0.8, Nq = q * tribA * ch.nEtages * 0.8, Nser = Ng + Nq, nom = `${ch.code}-${nv.code}-${nv.fond === 'pieux' ? 'PI' : 'S'}${String(L.length + 1).padStart(2, '0')}`;
      if (nv.fond === 'pieux') L.push({ nom, type: 'pieu', geometrie: { x: x / 100, y: y / 100, diametre_m: 0.6, longueur_m: 14 }, charges: { G_kN: r1(Ng), Q_kN: r1(Nq) }, materiau: { beton: 'C30/37', acier: 'B500' } });
      else { const cote = Math.ceil(Math.sqrt(Nser / 200) * 10) / 10, ep = Math.max(0.4, r2((cote - 0.4) / 4 + 0.1)); L.push({ nom, type: 'semelle', geometrie: { x: x / 100, y: y / 100, largeur_m: cote, longueur_m: cote, epaisseur_m: ep }, charges: { G_kN: r1(Ng), Q_kN: r1(Nq) }, materiau: { beton: 'C25/30', acier: 'B500' } }); }
    }));
    return L;
  }
  if (!nivPorteur) return L;
  let n = 0;
  xs.forEach((x) => ys.forEach((y) => {
    const Ng = g * tribA * nb, Nq = q * tribA * nb, s = sectionPoteau(1.35 * Ng + 1.5 * Nq);
    L.push({ nom: `${ch.code}-${nv.code}-P${String(++n).padStart(2, '0')}`, type: 'poteau', geometrie: { x: x / 100, y: y / 100, b_m: s / 100, h_m: s / 100, hauteur_m: nv.h }, charges: { G_kN: r1(Ng), Q_kN: r1(Nq) }, materiau: { beton: 'C30/37', acier: 'B500' } });
  }));
  n = 0;
  ys.forEach((y) => xs.forEach((x, i) => { if (!i) return; L.push({ nom: `${ch.code}-${nv.code}-PX${String(++n).padStart(2, '0')}`, type: 'poutre', geometrie: { x1: xs[i - 1] / 100, y1: y / 100, x2: x / 100, y2: y / 100, b_m: 0.25, h_m: portee > 8 ? 0.6 : 0.5 }, charges: { g_kN_m: r1(g * 4), q_kN_m: r1(q * 4) }, materiau: { beton: 'C25/30', acier: 'B500' } }); }));
  L.push({ nom: `${ch.code}-${nv.code}-D01`, type: 'dalle', geometrie: { x: 0, y: 0, largeur_m: ch.W / 100, longueur_m: ch.D / 100, epaisseur_m: nv.halle ? 0.25 : 0.2 }, charges: { g_kN_m2: g, q_kN_m2: q }, materiau: { beton: 'C25/30', acier: 'B500' } });
  const noy = rooms.filter((r) => r.type === 'noyau')[0];
  if (noy) { const b = bbox(noy.poly); [[b.x0, b.y0, b.x1, b.y0], [b.x1, b.y0, b.x1, b.y1], [b.x1, b.y1, b.x0, b.y1], [b.x0, b.y1, b.x0, b.y0]].forEach((s, i) => L.push({ nom: `${ch.code}-${nv.code}-V${String(i + 1).padStart(2, '0')}`, type: 'voile', geometrie: { x1: s[0] / 100, y1: s[1] / 100, x2: s[2] / 100, y2: s[3] / 100, epaisseur_m: 0.2, hauteur_m: nv.h }, materiau: { beton: 'C30/37', acier: 'B500' } })); }
  else if (nv.halle) L.push({ nom: `${ch.code}-${nv.code}-V01`, type: 'voile', geometrie: { x1: 12, y1: 0, x2: 12, y2: ch.D / 100, epaisseur_m: 0.2, hauteur_m: nv.h }, materiau: { beton: 'C30/37', acier: 'B500' } });
  return L;
}

/* données de dimensionnement d'exemple (valeurs fictives) pour lancer les modules de calcul en démonstration */
function calcDe(o, ch) {
  const g = o.geometrie, c = o.charges || {};
  if (o.type === 'poteau') return { module: 'dimPT', data: { forme: 'rect', b_cm: Math.round(g.b_m * 100), h_cm: Math.round(g.h_m * 100), D_cm: Math.round(g.b_m * 100), planFlexion: 'h', L_m: g.hauteur_m, appuiBas: 'encastre', appuiHaut: 'encastre', mode_l0: 'portique_contreve', k_bas: 0.1, k_haut: 0.1, classeGlobale: 'C30/37', classeAcier: 'B500', classeExposition: 'XC1', materiau: 'beton_arme', enrobage_cm: 3, poidsPropre: 'ajoute', N_kN: Math.round(1.35 * c.G_kN + 1.5 * c.Q_kN), M_tete_kNm: 0, M_pied_kNm: 0, resultats: null } };
  if (o.type === 'poutre') { const L = Math.hypot(g.x2 - g.x1, g.y2 - g.y1); return { module: 'dimPC', data: { travees: [{ portee_m: r2(L) }], appuis: [{ raideur_kN_m: null, blocage_rotation: false }, { raideur_kN_m: null, blocage_rotation: false }], classeGlobale: 'C25/30', termeGlobal: 'court', classeAcier: 'B500', enrobage_cm: 3, b_cm: Math.round(g.b_m * 100), h_cm: Math.round(g.h_m * 100), charges: [{ type: 'G', forme: 'repartie', repere: 'global', nu_gauche_m: 0, valeur_gauche: c.g_kN_m }, { type: 'Q', forme: 'repartie', repere: 'global', nu_gauche_m: 0, valeur_gauche: c.q_kN_m }], poidsPropre: true, resultats: null, vueCombo: 'ELS', _maxStep: 1, convoiActif: false, convoi: [{ dx: 0, P: 50 }, { dx: 1.5, P: 50 }], zone: { debut: null, fin: null }, sens: 'deux' } }; }
  if (o.type === 'dalle') return { module: 'dimDL', data: { sens: 'deux', lx_m: 6, ly_m: 8, h_cm: Math.round(g.epaisseur_m * 100), nTravees: 3, position: 'intermediaire', riveSolidaire: false, classeGlobale: 'C25/30', classeAcier: 'B500', enrobage_cm: 2.5, classeExposition: 'XC1', poidsPropre: true, redistTransv: false, G_kNm2: c.g_kN_m2, Q_kNm2: c.q_kN_m2, poincon: false, poteauForme: 'rect', c1_cm: 40, c2_cm: 40, D_cm: 40, N_poincon_kN: null, resultats: null } };
  if (o.type === 'semelle') return { module: 'dimSM', data: { sens: 'isolee', a_cm: 40, b_cm: 40, classeGlobale: 'C25/30', classeAcier: 'B500', fissuration: 'FP', solMode: 'els', qsol_MPa: 0.2, qu_MPa: 0.6, G_kN: c.G_kN, Q_kN: c.Q_kN, excentrique: false, Mser_kNm: 0, resultats: null } };
  return null;
}

/* ---------- pastilles par lot ---------- */
const PROP = {
  porte: { materiau: 'Bois', porteur: false, exterieur: false }, fenetre: { materiau: 'Aluminium', classe_resistance: 'A*3 E*7B V*A2', porteur: false, exterieur: true },
  escalier: { materiau: 'Béton armé', classe_resistance: 'C25/30', porteur: true, exterieur: false }, ascenseur: { materiau: 'Acier', porteur: false, exterieur: false },
  mur: { materiau: 'Plaque de plâtre', porteur: false, exterieur: false, resistance_feu: 'EI 60' },
  machine: { materiau: 'Acier', exterieur: false }, gaine: { materiau: 'Acier galvanisé', exterieur: false }, radiateur: { materiau: 'Acier', exterieur: false },
  ballon: { materiau: 'Acier émaillé', exterieur: false }, canalisation: { materiau: 'Cuivre', exterieur: false }, lavabo: { materiau: 'Céramique' }, wc: { materiau: 'Céramique' }, douche: { materiau: 'Résine' },
  tableau_electrique: { materiau: 'Polycarbonate', exterieur: false }, luminaire: { materiau: 'Aluminium' }, prise: { materiau: 'Polycarbonate' }, baie: { materiau: 'Acier', exterieur: false },
  detecteur: { materiau: 'Polycarbonate' }, extincteur: { materiau: 'Acier', exterieur: false }, centrale: { materiau: 'Acier', exterieur: false },
  'garde-corps': { materiau: 'Acier galvanisé', exterieur: true, porteur: false }, facade: { materiau: 'Enduit sur isolant', exterieur: true, porteur: false }, etancheite: { materiau: 'Bitume', exterieur: true },
  'isolation toiture': { materiau: 'Laine de roche', exterieur: true }, lanterneau: { materiau: 'Polycarbonate', exterieur: true }, 'descente eaux pluviales': { materiau: 'Zinc', exterieur: true }, tremie: { materiau: 'Béton armé', porteur: false }
};
const CODE = { porte: 'PO', fenetre: 'FE', escalier: 'ES', ascenseur: 'AS', mur: 'CL', machine: 'MA', gaine: 'GA', radiateur: 'RA', ballon: 'BA', canalisation: 'CA', lavabo: 'LA', wc: 'WC', douche: 'DO', tableau_electrique: 'TE', luminaire: 'LU', prise: 'PR', baie: 'BR', detecteur: 'DE', extincteur: 'EX', centrale: 'CE', 'garde-corps': 'GC', facade: 'FA', etancheite: 'ET', 'isolation toiture': 'IS', lanterneau: 'LN', 'descente eaux pluviales': 'EP', tremie: 'TR' };
const CORPS_LOT = { archi: 'Architecture', go: 'Gros œuvre / Structure', cc: 'Clos et couvert', cvc: 'CVC', plomberie: 'Plomberie', electricite: 'Électricité', courants_faibles: 'Courants faibles', securite_incendie: 'Sécurité incendie' };

function pastillesNiveau(ch, nv, rooms, mursL) {
  const out = [], cnt = {};
  const { W, D } = ch;
  function add(famille, lot, type, forme, dims, x, y, rot, params, cc) {
    const tc = CODE[type] || 'XX'; cnt[tc] = (cnt[tc] || 0) + 1;
    const nom = `${ch.code}-${nv.code}-${tc}${String(cnt[tc]).padStart(2, '0')}`;
    const p = Object.assign({}, PROP[type] || {}, params || {});
    const o = { nom, famille, corps: cc || (famille === 'archi' ? 'archi' : famille === 'cc' ? 'cc' : lot), lot: (lot === 'cc' ? 'architecture' : lot), type, forme, dimensions_cm: dims, position_cm: { x: Math.round(x), y: Math.round(y), z: Math.round(nv.cote * 100 + (p.zpose || 0)) }, rotation_deg: rot || 0, piece: piece_de(rooms, x, y), parametres: {} };
    delete p.zpose; ['materiau', 'classe_resistance', 'porteur', 'exterieur', 'resistance_feu'].forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; });
    o.parametres.corps_etat = CORPS_LOT[o.corps] || ''; if (o.corps === 'cc' && type !== 'fenetre') o.parametres.famille_clos_couvert = type;
    return (out.push(o), o);
  }
  const circ = rooms.filter((r) => r.type === 'circ')[0], noy = rooms.filter((r) => r.type === 'noyau')[0];
  const plans = nv.plans;
  /* ARCHITECTURE : portes, escalier, ascenseur, cloisons coupe-feu */
  if (plans.includes('archi')) {
    let nbP = 0;
    rooms.forEach((r) => {
      if (r.type === 'circ' || r.type === 'noyau' || nbP >= 10) return; const b = bbox(r.poly), cx = (b.x0 + b.x1) / 2;
      if (circ) { const cb = bbox(circ.poly), y = b.y1 <= cb.y0 + 1 ? b.y1 : (b.y0 >= cb.y1 - 1 ? b.y0 : null); if (y !== null) { add('archi', 'architecture', 'porte', 'ligne', { longueur: 90 }, cx, y, 0, { exterieur: false, resistance_feu: 'EI 30' }); nbP++; } }
      else if (nv.halle || nv.kind === 'ss' || nv.kind === 'rdc') { const y = b.y0 === 0 ? 0 : null; if (y !== null && nbP < 4) { add('archi', 'architecture', 'porte', 'ligne', { longueur: r.nom.startsWith('Halle') ? 400 : 90 }, cx, y, 0, { exterieur: true, materiau: r.nom.startsWith('Halle') ? 'Acier' : 'Aluminium' }); nbP++; } }
    });
    if (noy) { const b = bbox(noy.poly), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; add('archi', 'architecture', 'escalier', 'rectangle', { largeur: Math.min(250, b.x1 - b.x0 - 40), profondeur: Math.min(500, b.y1 - b.y0 - 40), hauteur: nv.h * 100 }, b.x0 + 130 + 10, cy, 0, {}); add('archi', 'architecture', 'ascenseur', 'rectangle', { largeur: 110, profondeur: 140 }, b.x1 - 85, b.y0 + 110, 0, { materiau: 'Acier' }); }
    const cl = mursL.filter((m) => !m.ext && Math.abs(m.x2 - m.x1) < 1 && m.y2 - m.y1 > 300).slice(0, 2);
    cl.forEach((m) => add('archi', 'architecture', 'mur', 'ligne', { longueur: m.y2 - m.y1, epaisseur: 10 }, m.x1, (m.y1 + m.y2) / 2, 90, {}));
  }
  /* CLOS ET COUVERT */
  if (plans.includes('cc')) {
    if (nv.kind !== 'toit') {
      const fen = []; rooms.forEach((r) => { if (r.type !== 'sec' && r.type !== 'tech') return; const b = bbox(r.poly); [[b.y0 === 0, 0], [b.y1 === D, D]].forEach((e) => { if (e[0]) fen.push({ x: (b.x0 + b.x1) / 2, y: e[1], w: Math.min(180, (b.x1 - b.x0) * 0.4) }); }); });
      fen.slice(0, ch.ouvertureMax).forEach((f) => add('cc', 'cc', 'fenetre', 'ligne', { longueur: Math.round(f.w) }, f.x, f.y, 0, {}));
      add('cc', 'cc', 'facade', 'rectangle', { largeur: W, profondeur: 30 }, W / 2, 0, 0, { resistance_feu: nv.kind === 'rdc' ? 'EI 60' : undefined });
      if (nv.kind === 'etage') add('cc', 'cc', 'garde-corps', 'ligne', { longueur: 300 }, W / 4, 0, 0, { zpose: 0 });
    } else {
      add('cc', 'cc', 'etancheite', 'rectangle', { largeur: W, profondeur: D }, W / 2, D / 2, 0, {});
      add('cc', 'cc', 'isolation toiture', 'rectangle', { largeur: W, profondeur: D }, W / 2, D / 2, 0, {});
      [[0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]].forEach((p) => add('cc', 'cc', 'descente eaux pluviales', 'cercle', { diametre: 11 }, W * p[0], D * p[1], 0, {}));
      [[0.4, 0.5], [0.6, 0.5]].forEach((p) => add('cc', 'cc', 'lanterneau', 'rectangle', { largeur: 120, profondeur: 120 }, W * p[0], D * p[1], 0, {}));
      add('cc', 'cc', 'garde-corps', 'ligne', { longueur: W }, W / 2, D, 0, {});
      add('cc', 'cc', 'garde-corps', 'ligne', { longueur: W }, W / 2, 0, 0, {});
    }
  }
  /* GROS ŒUVRE : trémies */
  if (plans.includes('go') && noy) { const b = bbox(noy.poly); add('go', 'structure', 'tremie', 'rectangle', { largeur: 160, profondeur: 200 }, b.x1 - 85, b.y0 + 110, 0, {}, 'go'); add('go', 'structure', 'tremie', 'rectangle', { largeur: 270, profondeur: 520 }, b.x0 + 140, (b.y0 + b.y1) / 2, 0, {}, 'go'); }
  /* TECHNIQUE */
  if (plans.includes('tech')) {
    const tech = rooms.filter((r) => r.type === 'tech')[0], hum = rooms.filter((r) => r.type === 'humide'), cb = circ ? bbox(circ.poly) : { x0: 0, x1: W, y0: D / 2 - 50, y1: D / 2 + 50 }, nb = noy ? bbox(noy.poly) : { x0: 0, x1: 300, y0: 0, y1: 300 };
    if (nv.kind === 'toit') {
      add('tech', 'cvc', 'machine', 'rectangle', { largeur: 250, profondeur: 150, hauteur: 140 }, W * 0.3, D * 0.5, 0, { materiau: 'Acier galvanisé' });
      add('tech', 'cvc', 'machine', 'rectangle', { largeur: 200, profondeur: 120, hauteur: 110 }, W * 0.7, D * 0.5, 0, {});
      add('tech', 'electricite', 'tableau_electrique', 'rectangle', { largeur: 60, profondeur: 20 }, W * 0.3, D * 0.7, 0, {});
      add('tech', 'securite_incendie', 'detecteur', 'cercle', { diametre: 12 }, W * 0.5, D * 0.5, 0, {});
      add('tech', 'securite_incendie', 'extincteur', 'cercle', { diametre: 22 }, W * 0.35, D * 0.7, 0, {});
    } else {
      const base = tech ? bbox(tech.poly) : cb;
      add('tech', 'cvc', 'machine', 'rectangle', { largeur: 200, profondeur: 120, hauteur: 120 }, (base.x0 + base.x1) / 2, (base.y0 + base.y1) / 2, 0, {});
      [-1, 1].forEach((s) => add('tech', 'cvc', 'gaine', 'rectangle', { largeur: 60, profondeur: 40 }, (nb.x0 + nb.x1) / 2 + s * 80, nb.y1 - 40, 0, {}));
      rooms.filter((r) => r.type === 'sec').slice(0, 4).forEach((r) => { const b = bbox(r.poly); add('tech', 'cvc', 'radiateur', 'rectangle', { largeur: 120, profondeur: 12, hauteur: 60 }, (b.x0 + b.x1) / 2, b.y0 === 0 ? 20 : (b.y1 === D ? D - 20 : (b.y0 + b.y1) / 2), 0, {}); });
      if (tech || hum[0]) { const b = bbox((tech || hum[0]).poly); add('tech', 'plomberie', 'ballon', 'cercle', { diametre: 60, hauteur: 140 }, b.x0 + 80, (b.y0 + b.y1) / 2, 0, {}); }
      add('tech', 'plomberie', 'canalisation', 'ligne', { longueur: 280 }, (nb.x0 + nb.x1) / 2 - 80, (nb.y0 + nb.y1) / 2, 90, { zpose: 0 });
      hum.slice(0, 3).forEach((r) => { const b = bbox(r.poly); add('tech', 'plomberie', 'lavabo', 'rectangle', { largeur: 60, profondeur: 45 }, b.x0 + 50, b.y1 - 40, 0, {}); add('tech', 'plomberie', 'wc', 'rectangle', { largeur: 40, profondeur: 70 }, b.x1 - 40, b.y1 - 55, 0, {}); });
      add('tech', 'electricite', 'tableau_electrique', 'rectangle', { largeur: 60, profondeur: 20 }, cb.x0 + 60, cb.y0 + 15, 0, {});
      [0.25, 0.5, 0.75].forEach((f) => add('tech', 'electricite', 'luminaire', 'cercle', { diametre: 30 }, W * f, (cb.y0 + cb.y1) / 2, 0, {}));
      rooms.filter((r) => r.type === 'sec').slice(0, 2).forEach((r) => { const b = bbox(r.poly); add('tech', 'electricite', 'prise', 'cercle', { diametre: 8 }, b.x0 + 30, (b.y0 + b.y1) / 2, 0, { zpose: 30 }); });
      add('tech', 'courants_faibles', 'baie', 'rectangle', { largeur: 60, profondeur: 60, hauteur: 200 }, (base.x0 + base.x1) / 2 + 100, (base.y0 + base.y1) / 2, 0, {});
      rooms.filter((r) => r.type === 'sec').slice(0, 2).forEach((r) => { const b = bbox(r.poly); add('tech', 'courants_faibles', 'prise', 'cercle', { diametre: 8 }, b.x1 - 30, (b.y0 + b.y1) / 2, 0, { zpose: 30 }); });
      [0.15, 0.4, 0.65, 0.9].forEach((f) => add('tech', 'securite_incendie', 'detecteur', 'cercle', { diametre: 12 }, W * f, (cb.y0 + cb.y1) / 2 + 40, 0, {}));
      [0.2, 0.8].forEach((f) => add('tech', 'securite_incendie', 'extincteur', 'cercle', { diametre: 22 }, W * f, cb.y0 + 20, 0, {}));
      if (nv.kind === 'rdc' || nv.kind === 'ss') add('tech', 'securite_incendie', 'centrale', 'rectangle', { largeur: 40, profondeur: 30, hauteur: 60 }, cb.x0 + 140, cb.y0 + 15, 0, {});
    }
  }
  return out;
}

/* ---------- construction d'un chantier ---------- */
function construire(ch) {
  const niveaux = [], plans = [];
  ch.niveaux.forEach((nv, idx) => {
    const rooms = pieces(ch, nv), mursL = murs(ch, rooms), go = plans_has(nv, 'go') ? goNiveau(ch, nv, idx, rooms) : [], past = pastillesNiveau(ch, nv, rooms, mursL);
    const compart = (nv.kind === 'rdc' || nv.kind === 'etage') && ch.W >= 2000 && !nv.rooms ? [['Compartiment Ouest', 0, 0, ch.W / 2, ch.D], ['Compartiment Est', ch.W / 2, 0, ch.W, ch.D]] : [];
    niveaux.push({ def: nv, idx, rooms, murs: mursL, go, past, compart });
    nv.plans.forEach((fam) => plans.push({ id: `${ch.id}-${nv.code.toLowerCase()}-${fam}`, famille: fam, niveau: nv, nom: `${ch.code} · ${nv.nom} · ${{ archi: 'Architecture', go: 'Gros œuvre', tech: 'Technique', cc: 'Clos et couvert' }[fam]}`, ce: { archi: 'Architecture', go: 'Gros œuvre / Structure', tech: 'Technique', cc: 'Clos et couvert' }[fam] }));
  });
  return { ch, niveaux, plans };
}
function plans_has(nv, f) { return nv.plans.includes(f); }

/* ---------- avancement ---------- */
function pctOuvrage(ch, corps, nom, nvIdx, nvTotal) {
  const base = ch.avancement[corps === 'archi' ? 'archi' : corps === 'go' ? 'go' : corps === 'cc' ? 'cc' : 'tech'];
  if (base <= 0) return 0; if (base >= 100) return 100;
  const lag = corps === 'go' ? (nvIdx - 1) * 22 : (nvIdx - 1) * 14, b = Math.max(0, Math.min(100, base - Math.max(0, lag))), r = hash(nom);
  return r < b / 100 ? 100 : (r < b / 100 + 0.18 ? 50 : 0);
}
const FENETRE_CORPS = { go: [0, 0.4], cc: [0.3, 0.75], archi: [0.45, 0.88], tech: [0.5, 0.92] };
function datesOuvrage(ch, corps, nom) {
  const cc = corps === 'archi' || corps === 'go' || corps === 'cc' ? corps : 'tech', f = FENETRE_CORPS[cc], dur = ecartJours(ch.debut, ch.fin), r = hash(nom + 'd');
  const d0 = addJours(ch.debut, dur * (f[0] + (f[1] - f[0]) * r * 0.7)); return { quand: d0, dateFin: addJours(d0, 4 + Math.round(r * 12)) };
}

/* ---------- devis neutres, situations, demandes ---------- */
const LIBELLE = { poteau: ['Poteaux en béton armé', 'u', 1450], poutre: ['Poutres en béton armé', 'u', 2100], dalle: ['Dalle de plancher en béton armé', 'u', 38500], voile: ['Voiles en béton armé', 'u', 4300], semelle: ['Semelles isolées en béton armé', 'u', 1850], pieu: ['Pieux forés', 'u', 3900], tremie: ['Trémies et réservations', 'u', 380],
  porte: ['Blocs-portes intérieurs', 'u', 640], escalier: ['Escalier en béton armé', 'u', 12500], ascenseur: ['Ascenseur', 'u', 31500], mur: ['Cloisons coupe-feu', 'u', 1900],
  fenetre: ['Menuiseries extérieures aluminium', 'u', 1250], facade: ['Façade : enduit sur isolant', 'u', 8600], 'garde-corps': ['Garde-corps métalliques', 'u', 1400], etancheite: ['Étanchéité de toiture-terrasse', 'u', 24800], 'isolation toiture': ['Isolation de toiture', 'u', 15200], lanterneau: ['Lanterneaux de désenfumage', 'u', 1850], 'descente eaux pluviales': ['Descentes d’eaux pluviales', 'u', 320],
  machine: ['Centrales de traitement d’air et groupes', 'u', 11800], gaine: ['Gaines de ventilation', 'u', 950], radiateur: ['Radiateurs', 'u', 420], ballon: ['Ballons d’eau chaude', 'u', 1650], canalisation: ['Colonnes d’alimentation', 'u', 1250], lavabo: ['Lavabos', 'u', 380], wc: ['WC', 'u', 420], douche: ['Douches', 'u', 650],
  tableau_electrique: ['Tableaux électriques', 'u', 2300], luminaire: ['Luminaires', 'u', 180], prise: ['Prises et appareillage', 'u', 45], baie: ['Baies de brassage', 'u', 1400], detecteur: ['Détecteurs d’incendie', 'u', 85], extincteur: ['Extincteurs', 'u', 75], centrale: ['Centrale de sécurité incendie', 'u', 5200] };
const LOT_DEVIS = { go: 'Gros œuvre', archi: 'Architecture', cc: 'Clos et couvert', cvc: 'CVC', plomberie: 'Plomberie', electricite: 'Électricité', courants_faibles: 'Courants faibles', securite_incendie: 'Sécurité incendie' };
const ENTREPRISES = { go: 'Maçonnerie Delorme et fils (fictive)', archi: 'Agencements Moreau (fictive)', cc: 'Façades et Toitures du Nord (fictive)', cvc: 'Thermique Aquilon (fictive)', plomberie: 'Plomberie Garance (fictive)', electricite: 'Électricité Lumeo (fictive)', courants_faibles: 'Réseaux Lumeo (fictive)', securite_incendie: 'Sécurité Ignis (fictive)' };

function finance(ch, items) {
  /* items : [{nom,type,corps,lot,pct}] ; une ligne de devis par (lot, type) ; devis par lot */
  const parLot = {};
  items.forEach((o) => { const lot = o.corps === 'go' ? 'go' : o.corps === 'archi' ? 'archi' : o.corps === 'cc' ? 'cc' : o.lot; (parLot[lot] = parLot[lot] || {})[o.type] = (parLot[lot][o.type] || []).concat(o); });
  const devis = []; let n = 0;
  Object.keys(LOT_DEVIS).forEach((lot) => {
    if (!parLot[lot]) return; n++;
    const lignes = Object.keys(parLot[lot]).map((type, i) => { const L = parLot[lot][type], lib = LIBELLE[type] || [type, 'u', 500], pu = Math.round(lib[2] * (0.92 + 0.16 * hash(ch.id + type)));
      return { code: `${ch.code}-D${String(n).padStart(2, '0')}-L${String(i + 1).padStart(2, '0')}`, libelle: lib[0], unite: lib[1], quantite: L.length, prix_unitaire_eur: pu, ouvrages: L.map((o) => o.nom), avancement_pct: Math.round(L.reduce((a, o) => a + o.pct, 0) / L.length) }; });
    devis.push({ code: `${ch.code}-D${String(n).padStart(2, '0')}`, lot: LOT_DEVIS[lot], entreprise: ENTREPRISES[lot], date: addJours(ch.debut, 20 + n * 6), statut: 'signe', lignes, total_ht_eur: lignes.reduce((a, l) => a + l.quantite * l.prix_unitaire_eur, 0) });
  });
  const dur = ecartJours(ch.debut, AUJOURDHUI), sit = [];
  [[0.4, 'emise', 'validee'], [0.75, 'emise', 'validee'], [1, 'prete_a_valider', 'a_verifier']].forEach((f, k) => {
    const lignes = []; devis.forEach((d) => d.lignes.forEach((l) => { const p = f[0] === 1 ? l.avancement_pct : Math.floor(l.avancement_pct * f[0] / 5) * 5; if (p > 0) lignes.push({ ligne: l.code, avancement_cumule_pct: p }); }));
    if (!lignes.length) return;
    sit.push({ numero: k + 1, date: addJours(ch.debut, Math.round(dur * (0.35 + 0.3 * k))), statut: f[1], etat_verification: f[2], lignes, facture: f[1] === 'emise' ? { numero: `${ch.code}-F${String(k + 1).padStart(2, '0')}`, statut: 'emise' } : null });
  });
  return { devis, situations: sit };
}
const STATUT_DEM = ['a_faire', 'envoyee', 'en_attente', 'accordee'];
function demandes(ch, i) {
  const ref = (k) => `${ch.code}-ADM-${String(k).padStart(2, '0')}`, mairie = `Mairie de ${ch.ville} (fictive)`, avance = ch.avancement.go >= 100 && ch.avancement.archi > 80;
  const L = [['Demande d’autorisation de travaux', mairie, 'accordee'], ['Déclaration d’ouverture de chantier', mairie, 'accordee'], ['Demande de prolongation de délai', ch.moa, avance ? 'accordee' : STATUT_DEM[(i + 1) % 4]], ['Levée de réserves', ch.moa, avance ? 'envoyee' : 'a_faire'], ['Dossier de sécurité incendie', 'Service départemental de sécurité (fictif)', avance ? 'en_attente' : STATUT_DEM[(i + 2) % 4]]];
  return L.map((l, k) => ({ reference: ref(k + 1), objet: l[0], destinataire: l[1], statut: l[2], date_demande: addJours(ch.debut, k * 25 - 20), echeance: addJours(ch.debut, 60 + k * 90), note: 'Donnée fictive de démonstration.' }));
}

module.exports = { CHANTIERS, AUJOURDHUI, hash, r1, r2, slug, construire, calcDe, pctOuvrage, datesOuvrage, finance, demandes, CORPS_LOT, addJours, bbox };
