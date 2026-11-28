'use strict';
/* Dessin des plans en SVG à vraie échelle (cotes imprimées, cartouche), puis export en JPEG (réduit) et en PDF avec Chromium (Playwright). */
const { AUJOURDHUI, bbox } = require('./moteur.js');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COUL = { architecture: '#5B6770', structure: '#A0522D', cvc: '#1E88A8', plomberie: '#2563EB', electricite: '#D97706', courants_faibles: '#7C3AED', securite_incendie: '#B91C1C', equipements: '#15803D', cc: '#0F766E' };
const NOMLOT = { architecture: 'Architecture', structure: 'Structure', cvc: 'CVC', plomberie: 'Plomberie', electricite: 'Électricité', courants_faibles: 'Courants faibles', securite_incendie: 'Sécurité incendie', cc: 'Clos et couvert' };
const TINT = { sec: '#F4F1EA', humide: '#DCEBF5', tech: '#ECE6D6', noyau: '#E5E5E5', circ: '#FFFFFF' };
const fm = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

function geometrie(ch) {
  const W = ch.W, D = ch.D, ppm = Math.min(60, Math.floor(1060 / (W / 100)), Math.floor(680 / (D / 100)));
  const ml = 120, mt = 80, mb = 100, cart = 150, w = Math.round(ml + W * ppm / 100 + 80), h = Math.round(mt + D * ppm / 100 + mb + cart);
  return { ppm, ml, mt, w, h, ox: ml, oy: cart + mb, X: (x) => ml + x * ppm / 100, Y: (y) => h - (cart + mb) - y * ppm / 100, S: (c) => c * ppm / 100 };
}
function axes(ch) { const nx = Math.ceil(ch.W / 1000) + 1, xs = []; for (let i = 0; i < nx; i++) xs.push(Math.round(ch.W * i / (nx - 1) / 10) * 10); const ys = ch.Cw ? [0, ch.Ds, ch.Ds + ch.Cw, ch.D] : [0, ch.D]; return { xs, ys }; }

function cotesEtGrille(ch, g) {
  const { xs, ys } = axes(ch), A = (i) => String.fromCharCode(65 + i); let s = '';
  xs.forEach((x, i) => { s += `<line x1="${g.X(x)}" y1="${g.Y(0) + 8}" x2="${g.X(x)}" y2="${g.Y(ch.D) - 28}" stroke="#9aa" stroke-width="0.6" stroke-dasharray="10 3 2 3"/><circle cx="${g.X(x)}" cy="${g.Y(ch.D) - 40}" r="11" fill="#fff" stroke="#333"/><text x="${g.X(x)}" y="${g.Y(ch.D) - 36}" font-size="12" text-anchor="middle">${A(i)}</text>`; });
  const yAx = ch.Cw ? [0, ch.D] : ys; yAx.forEach((y, i) => { s += `<line x1="${g.X(0) - 28}" y1="${g.Y(y)}" x2="${g.X(ch.W) + 8}" y2="${g.Y(y)}" stroke="#9aa" stroke-width="0.6" stroke-dasharray="10 3 2 3"/><circle cx="${g.X(0) - 40}" cy="${g.Y(y)}" r="11" fill="#fff" stroke="#333"/><text x="${g.X(0) - 40}" y="${g.Y(y) + 4}" font-size="12" text-anchor="middle">${i + 1}</text>`; });
  const yb = g.Y(0) + 38; s += `<g stroke="#111" stroke-width="1" fill="none"><line x1="${g.X(0)}" y1="${yb}" x2="${g.X(ch.W)}" y2="${yb}"/>`;
  xs.forEach((x) => { s += `<line x1="${g.X(x) - 4}" y1="${yb + 4}" x2="${g.X(x) + 4}" y2="${yb - 4}"/>`; }); s += '</g>';
  xs.forEach((x, i) => { if (i) s += `<text x="${(g.X(x) + g.X(xs[i - 1])) / 2}" y="${yb - 5}" font-size="11" text-anchor="middle">${x - xs[i - 1]}</text>`; });
  const yo = yb + 26; s += `<line x1="${g.X(0)}" y1="${yo}" x2="${g.X(ch.W)}" y2="${yo}" stroke="#111"/><line x1="${g.X(0) - 4}" y1="${yo + 4}" x2="${g.X(0) + 4}" y2="${yo - 4}" stroke="#111"/><line x1="${g.X(ch.W) - 4}" y1="${yo + 4}" x2="${g.X(ch.W) + 4}" y2="${yo - 4}" stroke="#111"/><text x="${g.X(ch.W / 2)}" y="${yo - 5}" font-size="12" font-weight="700" text-anchor="middle">${ch.W}</text>`;
  const xl = g.X(0) - 66; s += `<line x1="${xl}" y1="${g.Y(0)}" x2="${xl}" y2="${g.Y(ch.D)}" stroke="#111"/>`;
  ys.forEach((y) => { s += `<line x1="${xl - 4}" y1="${g.Y(y) + 4}" x2="${xl + 4}" y2="${g.Y(y) - 4}" stroke="#111"/>`; });
  ys.forEach((y, i) => { if (i) s += `<text transform="translate(${xl - 5} ${(g.Y(y) + g.Y(ys[i - 1])) / 2}) rotate(-90)" font-size="11" text-anchor="middle">${y - ys[i - 1]}</text>`; });
  s += `<text transform="translate(${xl - 20} ${g.Y(ch.D / 2)}) rotate(-90)" font-size="12" font-weight="700" text-anchor="middle">${ch.D}</text>`;
  return s;
}
function repere(ch, g) {
  const x0 = g.X(0), y0 = g.Y(0); let s = `<g stroke="#000" stroke-width="1.6" fill="#000"><line x1="${x0}" y1="${y0}" x2="${x0 + 34}" y2="${y0}"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 - 34}"/><circle cx="${x0}" cy="${y0}" r="3.5"/></g><text x="${x0 + 38}" y="${y0 + 4}" font-size="11">X</text><text x="${x0 - 4}" y="${y0 - 38}" font-size="11">Y</text><text x="${x0 + 6}" y="${y0 + 15}" font-size="9">0,0 : angle sud-ouest</text>`;
  const nx = g.w - 52, ny = 52; s += `<g transform="translate(${nx} ${ny}) rotate(${ch.nord_deg})"><circle r="22" fill="#fff" stroke="#222"/><path d="M0 -19 L7 8 L0 3 L-7 8 Z" fill="#222"/></g><text x="${nx}" y="${ny - 28}" font-size="11" text-anchor="middle">N</text>`;
  return s;
}
function symbole(p, g, couleur) {
  const c = { x: g.X(p.position_cm.x), y: g.Y(p.position_cm.y) }, rot = -(p.rotation_deg || 0), d = p.dimensions_cm || {}; const m = 4;
  const t = `transform="translate(${c.x} ${c.y}) rotate(${rot})"`;
  if (p.forme === 'ligne') { const L = Math.max(m * 2, g.S(d.longueur || 60)), th = Math.max(2.5, g.S(d.epaisseur || 6));
    if (p.type === 'porte') return `<g ${t}><line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="#fff" stroke-width="${th + 3}"/><line x1="${-L / 2}" y1="0" x2="${-L / 2}" y2="${-L}" stroke="${couleur}" stroke-width="1.5"/><path d="M${-L / 2} ${-L} A${L} ${L} 0 0 1 ${L / 2} 0" fill="none" stroke="${couleur}" stroke-width="0.8"/></g>`;
    if (p.type === 'fenetre') return `<g ${t}><line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="#fff" stroke-width="${th + 4}"/><line x1="${-L / 2}" y1="-2" x2="${L / 2}" y2="-2" stroke="${couleur}" stroke-width="1"/><line x1="${-L / 2}" y1="2" x2="${L / 2}" y2="2" stroke="${couleur}" stroke-width="1"/></g>`;
    return `<g ${t}><line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="${couleur}" stroke-width="${p.type === 'garde-corps' ? 3.5 : th}" ${p.type === 'mur' ? 'stroke-dasharray="6 3"' : ''}/></g>`; }
  if (p.forme === 'cercle') { const r = Math.max(3, g.S((d.diametre || 10) / 2)); return `<g ${t}><circle r="${r}" fill="${couleur}" fill-opacity="0.35" stroke="${couleur}" stroke-width="1.2"/>${p.type === 'detecteur' ? '<circle r="1.2" fill="' + couleur + '"/>' : ''}</g>`; }
  const w = Math.max(m, g.S(d.largeur || 40)), h = Math.max(m, g.S(d.profondeur || 40));
  return `<g ${t}><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${couleur}" fill-opacity="${p.type === 'etancheite' || p.type === 'isolation toiture' ? 0.12 : 0.3}" stroke="${couleur}" stroke-width="1.2"${p.type === 'facade' ? ' stroke-dasharray="5 2"' : ''}/>${p.type === 'machine' || p.type === 'ballon' ? `<line x1="${-w / 2}" y1="${-h / 2}" x2="${w / 2}" y2="${h / 2}" stroke="${couleur}" stroke-width="0.8"/><line x1="${-w / 2}" y1="${h / 2}" x2="${w / 2}" y2="${-h / 2}" stroke="${couleur}" stroke-width="0.8"/>` : ''}</g>`;
}
function muraux(lv, g, ext, intr, ouv) {
  let s = ''; lv.murs.forEach((m) => { s += `<line x1="${g.X(m.x1)}" y1="${g.Y(m.y1)}" x2="${g.X(m.x2)}" y2="${g.Y(m.y2)}" stroke="${m.ext ? ext.c : intr.c}" stroke-width="${Math.max(m.ext ? 2.5 : 1.2, g.S(m.ext ? ext.t : intr.t))}" stroke-linecap="square"/>`; }); return s;
}
function cartouche(ch, plan, g, lv, nbPast) {
  const x = 40, y = g.h - 140, w = g.w - 80, H = 124;
  const cote = lv.def.cote, cm = 100 / g.ppm;
  const bar = [5, 10, 20].filter((b) => b * g.ppm < w * 0.25).pop() || 5;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${H}" fill="#fff" stroke="#111" stroke-width="1.5"/><line x1="${x + w * 0.55}" y1="${y}" x2="${x + w * 0.55}" y2="${y + H}" stroke="#111"/><line x1="${x}" y1="${y + 40}" x2="${x + w * 0.55}" y2="${y + 40}" stroke="#111"/>`;
  s += `<text x="${x + 10}" y="${y + 17}" font-size="12" font-weight="700">${esc('Démo · ' + ch.nom)}</text><text x="${x + 10}" y="${y + 33}" font-size="10">${esc(ch.adresse)}</text>`;
  s += `<text x="${x + 10}" y="${y + 62}" font-size="15" font-weight="700">${esc(plan.nom)}</text><text x="${x + 10}" y="${y + 80}" font-size="11">${esc('Niveau ' + lv.def.nom + ' · cote Z ' + fm(cote) + ' m' + (lv.def.note ? ' · ' + lv.def.note : ''))}</text>`;
  s += `<text x="${x + 10}" y="${y + 99}" font-size="10">${esc('Maître d’ouvrage : ' + ch.moa)}</text><text x="${x + 10}" y="${y + 114}" font-size="10">${esc('Phase : ' + ch.phase + ' · indice A · ' + AUJOURDHUI)}</text>`;
  const bx = x + w * 0.55 + 16; s += `<text x="${bx}" y="${y + 17}" font-size="11" font-weight="700">Échelle et cotes</text><text x="${bx}" y="${y + 33}" font-size="10">${esc('1 pixel = ' + fm(cm) + ' cm · cotes imprimées en cm')}</text>`;
  s += `<g stroke="#111" stroke-width="2"><line x1="${bx}" y1="${y + 52}" x2="${bx + bar * g.ppm}" y2="${y + 52}"/><line x1="${bx}" y1="${y + 46}" x2="${bx}" y2="${y + 58}"/><line x1="${bx + bar * g.ppm}" y1="${y + 46}" x2="${bx + bar * g.ppm}" y2="${y + 58}"/></g><text x="${bx + bar * g.ppm + 8}" y="${y + 56}" font-size="11">${bar} m</text>`;
  s += `<text x="${bx}" y="${y + 78}" font-size="10">${esc('Repère : origine angle sud-ouest, X vers la droite, Y vers le haut')}</text><text x="${bx}" y="${y + 93}" font-size="10">${esc('Nord : ' + ch.nord_deg + '° par rapport au haut du plan')}</text><text x="${bx}" y="${y + 112}" font-size="9" fill="#a33">${esc('DONNÉES FICTIVES : jeu de démonstration')}</text>`;
  return s;
}
function legende(plan, lv, g) {
  const lots = {}; lv.past.filter((p) => p.famille === plan.famille).forEach((p) => { const k = p.corps === 'cc' ? 'cc' : p.lot; lots[k] = 1; }); const ks = Object.keys(lots); if (!ks.length) return '';
  let s = '', y = g.mt - 74; ks.forEach((k, i) => { s += `<rect x="${g.ml + 30 + i * 150}" y="${y}" width="12" height="12" fill="${COUL[k]}" fill-opacity="0.5" stroke="${COUL[k]}"/><text x="${g.ml + 30 + i * 150 + 17}" y="${y + 11}" font-size="11">${esc(NOMLOT[k])}</text>`; }); return s;
}
function svgPlan(ch, plan, lv) {
  const g = geometrie(ch); let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${g.w}" height="${g.h}" viewBox="0 0 ${g.w} ${g.h}" font-family="Helvetica, Arial, sans-serif"><rect width="${g.w}" height="${g.h}" fill="#fff"/>`;
  s += `<defs><pattern id="ha" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#444" stroke-width="1.5"/></pattern></defs>`;
  const f = plan.famille, rooms = lv.rooms;
  const faint = f === 'go' || f === 'tech';
  if (f === 'archi' || f === 'cc' || faint) {
    if (lv.def.kind === 'toit') s += `<rect x="${g.X(0)}" y="${g.Y(ch.D)}" width="${g.S(ch.W)}" height="${g.S(ch.D)}" fill="#F7F7F2" stroke="#222" stroke-width="${Math.max(2, g.S(30))}"/>`;
    else rooms.forEach((r) => { s += `<polygon points="${r.poly.map((p) => g.X(p[0]) + ',' + g.Y(p[1])).join(' ')}" fill="${f === 'archi' ? TINT[r.type] : '#FAFAFA'}" stroke="none"/>`; });
    s += muraux(lv, g, faint ? { c: '#9a9a9a', t: 30 } : { c: '#222', t: 30 }, faint ? { c: '#c4c4c4', t: 10 } : { c: '#444', t: 10 });
  }
  if (f === 'archi') rooms.forEach((r) => { const b = bbox(r.poly), wpx = g.S(b.x1 - b.x0), fs = Math.max(7, Math.min(12, wpx * 0.92 / (r.nom.length * 0.56))); s += `<text x="${g.X((b.x0 + b.x1) / 2)}" y="${g.Y((b.y0 + b.y1) / 2) + 3}" font-size="${fs}" text-anchor="middle" fill="#222">${esc(r.nom)}</text>`; });
  /* ouvertures vues sur le plan d'architecture : fenêtres du niveau */
  if (f === 'archi') lv.past.filter((p) => p.type === 'fenetre').forEach((p) => { s += symbole(p, g, COUL.cc); });
  if (f === 'go') {
    const dl = lv.go.filter((o) => o.type === 'dalle')[0]; if (dl) s += `<text x="${g.X(ch.W / 2)}" y="${g.Y(ch.D / 2) + 3}" font-size="11" text-anchor="middle" fill="#7a3d1c">${esc('Dalle ép. ' + Math.round(dl.geometrie.epaisseur_m * 100) + ' cm')}</text>`;
    lv.go.forEach((o) => { const q = o.geometrie, col = COUL.structure;
      if (o.type === 'poteau') { const w = Math.max(5, g.S(q.b_m * 100)), h = Math.max(5, g.S(q.h_m * 100)); s += `<rect x="${g.X(q.x * 100) - w / 2}" y="${g.Y(q.y * 100) - h / 2}" width="${w}" height="${h}" fill="#111"/><text x="${g.X(q.x * 100) + w / 2 + 3}" y="${g.Y(q.y * 100) - h / 2 - 2}" font-size="8.5" fill="${col}">${esc(o.nom.split('-').slice(2).join('-'))}</text>`; }
      else if (o.type === 'poutre') { s += `<line x1="${g.X(q.x1 * 100)}" y1="${g.Y(q.y1 * 100)}" x2="${g.X(q.x2 * 100)}" y2="${g.Y(q.y2 * 100)}" stroke="${col}" stroke-width="2" stroke-dasharray="9 4"/><text x="${g.X((q.x1 + q.x2) * 50)}" y="${g.Y(q.y1 * 100) + (q.y1 === 0 ? -6 : 13)}" font-size="8.5" text-anchor="middle" fill="${col}">${esc(o.nom.split('-').slice(2).join('-') + ' ' + Math.round(q.b_m * 100) + 'x' + Math.round(q.h_m * 100))}</text>`; }
      else if (o.type === 'voile') { s += `<line x1="${g.X(q.x1 * 100)}" y1="${g.Y(q.y1 * 100)}" x2="${g.X(q.x2 * 100)}" y2="${g.Y(q.y2 * 100)}" stroke="#222" stroke-width="${Math.max(3, g.S(q.epaisseur_m * 100))}"/>`; }
      else if (o.type === 'semelle') { const w = g.S(q.largeur_m * 100), h = g.S(q.longueur_m * 100); s += `<rect x="${g.X(q.x * 100) - w / 2}" y="${g.Y(q.y * 100) - h / 2}" width="${w}" height="${h}" fill="url(#ha)" stroke="${col}" stroke-width="1.4"/><text x="${g.X(q.x * 100)}" y="${g.Y(q.y * 100) + h / 2 + 11}" font-size="8.5" text-anchor="middle" fill="${col}">${esc(o.nom.split('-').slice(2).join('-') + ' ' + fm(q.largeur_m * 100 / 100) + 'x' + fm(q.longueur_m) + ' m')}</text>`; }
      else if (o.type === 'pieu') { const r = Math.max(4, g.S(q.diametre_m * 50)); s += `<circle cx="${g.X(q.x * 100)}" cy="${g.Y(q.y * 100)}" r="${r}" fill="none" stroke="${col}" stroke-width="1.6"/><line x1="${g.X(q.x * 100) - r}" y1="${g.Y(q.y * 100)}" x2="${g.X(q.x * 100) + r}" y2="${g.Y(q.y * 100)}" stroke="${col}"/><line x1="${g.X(q.x * 100)}" y1="${g.Y(q.y * 100) - r}" x2="${g.X(q.x * 100)}" y2="${g.Y(q.y * 100) + r}" stroke="${col}"/><text x="${g.X(q.x * 100) + r + 3}" y="${g.Y(q.y * 100) - r}" font-size="8.5" fill="${col}">${esc(o.nom.split('-').slice(2).join('-') + ' Ø' + Math.round(q.diametre_m * 100))}</text>`; }
    });
  }
  lv.past.filter((p) => p.famille === f && !(f === 'archi' && p.type === 'fenetre')).forEach((p) => { s += symbole(p, g, p.corps === 'cc' ? COUL.cc : (p.corps === 'go' ? COUL.structure : COUL[p.lot])); });
  if (f === 'archi') lv.compart.forEach((c, i) => { s += `<rect x="${g.X(c[1]) + 3}" y="${g.Y(c[4]) + 3}" width="${g.S(c[3] - c[1]) - 6}" height="${g.S(c[4] - c[2]) - 6}" fill="none" stroke="#B91C1C" stroke-width="1.2" stroke-dasharray="14 5"/><text x="${g.X(c[1]) + 8}" y="${g.Y(c[4]) + 16}" font-size="10" fill="#B91C1C">${esc(c[0] + ' EI 60')}</text>`; });
  s += cotesEtGrille(ch, g) + repere(ch, g) + legende(plan, lv, g) + cartouche(ch, plan, g, lv) + '</svg>';
  return { svg: s, geom: g };
}

async function exporter(items, dossierPlans, dossierPdf, parChantier) {
  const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
  const br = await chromium.launch({ args: ['--no-sandbox'] }); const pg = await br.newPage();
  for (const it of items) { await pg.setViewportSize({ width: it.geom.w, height: it.geom.h }); await pg.setContent(`<body style="margin:0;background:#fff">${it.svg}</body>`); await pg.screenshot({ path: path.join(dossierPlans, it.id + '.jpg'), type: 'jpeg', quality: 58 }); }
  for (const k of Object.keys(parChantier)) {
    const pages = parChantier[k].map((it) => `<div class="pg">${it.svg.replace(/width="\d+" height="\d+"/, '')}</div>`).join('');
    await pg.setContent(`<style>@page{size:420mm 297mm;margin:0}body{margin:0}.pg{width:420mm;height:297mm;page-break-after:always;display:flex;align-items:center;justify-content:center}.pg svg{max-width:100%;max-height:100%;width:100%;height:100%}</style>${pages}`);
    await pg.pdf({ path: path.join(dossierPdf, k + '.pdf'), width: '420mm', height: '297mm', printBackground: true });
  }
  await br.close();
}
module.exports = { svgPlan, exporter, geometrie };
