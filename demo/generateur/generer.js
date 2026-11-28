'use strict';
/* Génère tout le jeu de démonstration : plans (SVG -> JPEG et PDF), fichiers d'échange 1.1 (un par chantier), jeu unique, données neutres (devis, situations, demandes).
   Usage : node demo/generateur/generer.js          (Playwright et Chromium requis pour les images et PDF ; sinon : --sans-images) */
const fs = require('fs'), path = require('path');
const M = require('./moteur.js'), R = require('./rendu.js');
const RACINE = path.join(__dirname, '..');
const SANS_IMAGES = process.argv.includes('--sans-images');
['echange', 'plans', 'pdf', 'neutre'].forEach((d) => fs.mkdirSync(path.join(RACINE, d), { recursive: true }));

function centre(o) {
  const g = o.geometrie;
  if (o.type === 'poutre' || o.type === 'voile') return { x: (g.x1 + g.x2) * 50, y: (g.y1 + g.y2) * 50 };
  if (o.type === 'dalle') return { x: (g.x + g.largeur_m / 2) * 100, y: (g.y + g.longueur_m / 2) * 100 };
  return { x: g.x * 100, y: g.y * 100 };
}
function formeGo(o) {
  const g = o.geometrie, cm = (v) => Math.round(v * 100);
  if (o.type === 'poteau') return { forme: 'rectangle', dimensions_cm: { largeur: cm(g.b_m), profondeur: cm(g.h_m), hauteur: cm(g.hauteur_m) } };
  if (o.type === 'poutre') return { forme: 'ligne', dimensions_cm: { longueur: cm(Math.hypot(g.x2 - g.x1, g.y2 - g.y1)), epaisseur: cm(g.b_m), hauteur: cm(g.h_m) } };
  if (o.type === 'voile') return { forme: 'ligne', dimensions_cm: { longueur: cm(Math.hypot(g.x2 - g.x1, g.y2 - g.y1)), epaisseur: cm(g.epaisseur_m), hauteur: cm(g.hauteur_m) } };
  if (o.type === 'dalle') return { forme: 'rectangle', dimensions_cm: { largeur: cm(g.largeur_m), profondeur: cm(g.longueur_m), epaisseur: cm(g.epaisseur_m) } };
  if (o.type === 'semelle') return { forme: 'rectangle', dimensions_cm: { largeur: cm(g.largeur_m), profondeur: cm(g.longueur_m), epaisseur: cm(g.epaisseur_m) } };
  return { forme: 'cercle', dimensions_cm: { diametre: cm(g.diametre_m), hauteur: cm(g.longueur_m) } };
}
const rotGo = (o) => (o.type === 'poutre' || o.type === 'voile') ? Math.round(Math.atan2(o.geometrie.y2 - o.geometrie.y1, o.geometrie.x2 - o.geometrie.x1) * 180 / Math.PI) : 0;

(async () => {
  const jeu = { format: 'bina-demo', version: '1.0', nom: 'Jeu de démonstration (données fictives)', reference_date: M.AUJOURDHUI, chantiers: [] };
  const rendus = [], parChantier = {}, neutreFin = [], neutreDem = [];
  M.CHANTIERS.forEach((ch, ci) => {
    const b = M.construire(ch), planDe = {}, planDesc = [];
    b.plans.forEach((pl) => {
      const lv = b.niveaux.filter((n) => n.def === pl.niveau)[0], r = R.svgPlan(ch, pl, lv), g = r.geom, f = `${pl.id}`;
      planDe[pl.niveau.code + ':' + pl.famille] = pl.id;
      planDesc.push({ id: pl.id, nom: pl.nom, famille: pl.famille, ce: pl.ce, niveau: pl.niveau.nom, fichier: `plans/${f}.jpg`, w: g.w, h: g.h, mpp: +(1 / g.ppm).toFixed(6), cm_par_px: +(100 / g.ppm).toFixed(4), ox_px: g.ox, oy_px: g.oy });
      rendus.push({ id: f, svg: r.svg, geom: g }); (parChantier[ch.id + '-' + M.slug(ch.nom)] = parChantier[ch.id + '-' + M.slug(ch.nom)] || []).push({ svg: r.svg });
    });
    const planNom = (code, fam) => (planDesc.filter((p) => p.id === planDe[code + ':' + fam])[0] || {}).nom;
    const doc = { format: 'bina-descente-charge', version: '1.1', source: { outil: 'Autre', version_outil: 'Jeu de démonstration' }, date_export: M.AUJOURDHUI + 'T08:00:00Z',
      repere: { nord_deg: ch.nord_deg, nord_confirme: true, origine: 'Angle sud-ouest du bâtiment', plan_ref: planNom('RDC', 'archi') || planNom('SS1', 'archi') },
      projet: { nom: 'Démo · ' + ch.nom }, batiments: [{ nom: ch.nom, niveaux: [] }] };
    const extras = {}, avancement = {}, items = [];
    b.niveaux.forEach((lv) => {
      const nv = lv.def, niv = { nom: nv.nom, cote_m: nv.cote, hauteur_m: nv.h, ouvrages: [], pieces: [], pastilles: [] };
      const archi = planDe[nv.code + ':archi'], go = planDe[nv.code + ':go'];
      lv.go.forEach((o) => { niv.ouvrages.push({ nom: o.nom, type: o.type, id_externe: 'DEMO-' + o.nom, geometrie: o.geometrie, charges: o.charges, materiau: o.materiau });
        const c = centre(o), fo = formeGo(o), cal = M.calcDe(o, ch);
        extras[o.nom] = { planId: go, pos_cm: c, forme: fo.forme, dimensions_cm: fo.dimensions_cm, rotation_deg: rotGo(o), calc: cal, bim: { porteur: true, exterieur: false, materiau: o.materiau.beton ? 'Béton armé ' + o.materiau.beton : '', classe_resistance: o.materiau.beton || '' }, corps: 'go', lot: 'structure', cote_z_cm: Math.round(nv.cote * 100) };
        items.push({ nom: o.nom, type: o.type, corps: 'go', lot: 'structure', nvIdx: lv.idx }); });
      lv.rooms.forEach((r) => niv.pieces.push({ nom: r.nom, polygone_cm: r.poly, hauteur_cm: Math.round(nv.h * 100 - 30), confiance: 'haute', source: { plan: planNom(nv.code, 'archi'), page: 1 }, id_externe: `DEMO-${ch.code}-${nv.code}-${M.slug(r.nom)}` }));
      lv.compart.forEach((c) => niv.pieces.push({ nom: c[0], genre: 'compartiment', polygone_cm: [[c[1], c[2]], [c[3], c[2]], [c[3], c[4]], [c[1], c[4]]], hauteur_cm: Math.round(nv.h * 100 - 30), confiance: 'haute', resistance_feu: 'EI 60', source: { plan: planNom(nv.code, 'archi'), page: 1 }, id_externe: `DEMO-${ch.code}-${nv.code}-${M.slug(c[0])}` }));
      lv.past.forEach((p) => {
        const e = { nom: p.nom, lot: p.lot, type: p.type, forme: p.forme, dimensions_cm: p.dimensions_cm, position_cm: p.position_cm, rotation_deg: p.rotation_deg, parametres: p.parametres, source: { plan: planNom(nv.code, p.famille), page: 1 }, confiance: 'haute', statut: 'importe', id_externe: 'DEMO-' + p.nom };
        if (p.piece) e.piece = p.piece; ['materiau', 'classe_resistance', 'porteur', 'exterieur', 'resistance_feu'].forEach((k) => { if (p[k] !== undefined) e[k] = p[k]; });
        niv.pastilles.push(e); extras[p.nom] = { planId: planDe[nv.code + ':' + p.famille], corps: p.corps, lot: p.lot };
        items.push({ nom: p.nom, type: p.type, corps: p.corps, lot: p.lot, nvIdx: lv.idx });
      });
      extras['@niveau:' + nv.nom] = { archi, go, pieces_plan: archi };
      doc.batiments[0].niveaux.push(niv);
    });
    items.forEach((o) => { const pct = M.pctOuvrage(ch, o.corps, o.nom, o.nvIdx, b.niveaux.length), d = M.datesOuvrage(ch, o.corps, o.nom); o.pct = pct; avancement[o.nom] = { pct, etat: pct >= 100 ? 'fait' : pct > 0 ? 'encours' : 'afaire', quand: d.quand, dateFin: d.dateFin, corps: o.corps }; });
    const fin = M.finance(ch, items), dem = M.demandes(ch, ci);
    jeu.chantiers.push({ id: ch.id, code: ch.code, nom: ch.nom, type: ch.type, adresse: ch.adresse, maitre_ouvrage: ch.moa, phase: ch.phase, surface_m2: ch.surface_m2, debut: ch.debut, fin: ch.fin, nord_deg: ch.nord_deg, origine: 'Angle sud-ouest du bâtiment', profil: ch.profil, echange: doc, plans: planDesc, extras, avancement });
    fs.writeFileSync(path.join(RACINE, 'echange', `${ch.id}-${M.slug(ch.nom)}.json`), JSON.stringify(doc, null, 1) + '\n');
    neutreFin.push({ chantier: ch.code, nom: ch.nom, devis: fin.devis, situations: fin.situations }); neutreDem.push({ chantier: ch.code, nom: ch.nom, demandes: dem });
  });
  fs.writeFileSync(path.join(RACINE, 'jeu-demonstration.json'), JSON.stringify(jeu) + '\n');
  fs.writeFileSync(path.join(RACINE, 'neutre', 'devis-situations-neutres.json'), JSON.stringify({ format: 'demo-finance-neutre', version: '1.0', note: 'Données fictives. Format neutre à convertir vers le modèle de l’application : lignes de devis liées aux ouvrages par code, avancement, situations.', chantiers: neutreFin }, null, 1) + '\n');
  fs.writeFileSync(path.join(RACINE, 'neutre', 'demandes-administratives.json'), JSON.stringify({ format: 'demo-demandes-neutre', version: '1.0', note: 'Données fictives. Aucun module de demandes administratives dans l’application à ce jour.', chantiers: neutreDem }, null, 1) + '\n');
  if (!SANS_IMAGES) await R.exporter(rendus, path.join(RACINE, 'plans'), path.join(RACINE, 'pdf'), parChantier);
  console.log('Chantiers :', jeu.chantiers.length, '· plans :', rendus.length);
})().catch((e) => { console.error(e); process.exit(1); });
