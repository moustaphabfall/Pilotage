'use strict';
/* Les 7 chantiers de démonstration. Tout est FICTIF : noms, adresses, entreprises, personnes, communes. Unités : cm pour les plans, m pour les niveaux. */
/* Pièces : "Nom:largeur_cm:type" ; largeur 0 = le reste de la rangée ; type : sec, humide, tech, noyau, circ */
const P = (s) => s.split(',').map((x) => { const a = x.split(':'); return [a[0].trim(), +a[1] || 0, (a[2] || 'sec').trim()]; });

const CHANTIERS = [
  {
    id: 'c1', code: 'C1', nom: 'Résidence Les Tilleuls', type: 'Immeuble de logements R+4', ville: 'Valmont-sur-Orne', adresse: '14 allée des Tilleuls, 99100 Valmont-sur-Orne',
    moa: 'Société Foncière Aubrac (fictive)', phase: 'Gros œuvre', surface_m2: 3150, debut: '2026-03-02', fin: '2027-09-17', nord_deg: 12,
    W: 2400, D: 1500, Cw: 160, Ds: 700, usage: { g: 5.5, q: 1.5 }, nEtages: 5, ouvertureMax: 6,
    avancement: { go: 72, archi: 4, tech: 0, cc: 12 }, profil: 'Gros œuvre en cours : planchers du R+3 coulés',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -1.2, h: 1.2, plans: ['go'], fond: 'semelles' },
      { nom: 'RDC', code: 'RDC', cote: 0, h: 3.0, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        S: P('Local vélos:450:tech,Logement 1 Séjour:700,Logement 1 Chambre:600,Logement 1 Salle d\'eau:0:humide'), C: 'Hall et circulation', N: P('Noyau escalier et ascenseur:420:noyau,Local ordures:380:tech,Logement 2 Séjour:700,Logement 2 Chambre:500,Logement 2 Salle d\'eau:0:humide') },
      { nom: 'R+1', code: 'R1', cote: 3.0, h: 2.9, plans: ['archi', 'go', 'tech', 'cc'], kind: 'etage', note: 'Étage courant (R+1 à R+4 identiques)',
        S: P('Logement 3 Séjour:700,Logement 3 Chambre:600,Logement 3 Salle d\'eau:400:humide,Logement 4 Chambre:0'), C: 'Palier et circulation', N: P('Noyau escalier et ascenseur:420:noyau,Logement 5 Séjour:700,Logement 5 Chambre:600,Logement 5 Salle d\'eau:0:humide') },
      { nom: 'Toiture', code: 'TOI', cote: 14.5, h: 1.2, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  },
  {
    id: 'c2', code: 'C2', nom: 'Bureaux du Quai Verdier', type: 'Immeuble de bureaux R+3', ville: 'Port-Aurel', adresse: '3 quai Verdier, 99200 Port-Aurel',
    moa: 'Verdier Immobilier d\'Entreprise (fictif)', phase: 'Second œuvre', surface_m2: 2480, debut: '2025-10-06', fin: '2027-02-26', nord_deg: -25,
    W: 3000, D: 1600, Cw: 180, Ds: 720, usage: { g: 5.8, q: 2.5 }, nEtages: 4, ouvertureMax: 8,
    avancement: { go: 100, archi: 48, tech: 36, cc: 88 }, profil: 'Second œuvre : cloisons et réseaux en cours, façades posées',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -1.0, h: 1.0, plans: ['go'], fond: 'semelles' },
      { nom: 'RDC', code: 'RDC', cote: 0, h: 3.6, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        S: P('Accueil:600,Salle de réunion:500,Bureau 1:0'), C: 'Hall et circulation', N: P('Noyau escalier et ascenseurs:450:noyau,Sanitaires:400:humide,Local serveur:300:tech,Open space:0') },
      { nom: 'R+1', code: 'R1', cote: 3.6, h: 3.4, plans: ['archi', 'go', 'tech', 'cc'], kind: 'etage', note: 'Étage courant (R+1 à R+3 identiques)',
        S: P('Open space A:0'), C: 'Circulation', N: P('Noyau escalier et ascenseurs:450:noyau,Sanitaires:400:humide,Salle de réunion:600,Bureau 2:0') },
      { nom: 'Toiture', code: 'TOI', cote: 14.0, h: 1.0, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  },
  {
    id: 'c3', code: 'C3', nom: 'École primaire Jules-Marin', type: 'École primaire R+1', ville: 'Saint-Ivor-les-Prés', adresse: '2 chemin du Moulin, 99300 Saint-Ivor-les-Prés',
    moa: 'Commune de Saint-Ivor-les-Prés (fictive)', phase: 'Clos et couvert', surface_m2: 1850, debut: '2026-01-12', fin: '2027-07-30', nord_deg: 0,
    W: 3600, D: 1400, Cw: 240, Ds: 640, usage: { g: 5.2, q: 2.5 }, nEtages: 2, ouvertureMax: 8,
    avancement: { go: 100, archi: 15, tech: 8, cc: 62 }, profil: 'Clos et couvert : charpente posée, étanchéité en cours',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -0.9, h: 0.9, plans: ['go'], fond: 'semelles' },
      { nom: 'RDC', code: 'RDC', cote: 0, h: 3.2, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        S: P('Classe 1:800,Classe 2:800,Classe 3:0'), C: 'Préau couvert et circulation', N: P('Noyau escalier et ascenseur:400:noyau,Sanitaires:420:humide,Salle des maîtres:500,Restauration:0') },
      { nom: 'R+1', code: 'R1', cote: 3.2, h: 3.2, plans: ['archi', 'go', 'tech', 'cc'], kind: 'etage',
        S: P('Classe 4:800,Classe 5:800,Classe 6:0'), C: 'Circulation', N: P('Noyau escalier et ascenseur:400:noyau,Sanitaires:420:humide,Bibliothèque:700,Salle polyvalente:0') },
      { nom: 'Toiture', code: 'TOI', cote: 6.4, h: 1.0, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  },
  {
    id: 'c4', code: 'C4', nom: 'Entrepôt logistique des Landes Hautes', type: 'Entrepôt logistique avec bureaux', ville: 'Roche-Valmer', adresse: 'Zone d\'activités des Landes Hautes, lot 7, 99400 Roche-Valmer',
    moa: 'Logistique Nordaval (fictive)', phase: 'Gros œuvre', surface_m2: 4300, debut: '2026-05-04', fin: '2027-04-23', nord_deg: 90,
    W: 6000, D: 3600, usage: { g: 6.0, q: 5.0 }, nEtages: 1, ouvertureMax: 8,
    avancement: { go: 45, archi: 0, tech: 0, cc: 5 }, profil: 'Début de gros œuvre : dallage et poteaux de la halle',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -1.1, h: 1.1, plans: ['go'], fond: 'semelles' },
      { nom: 'RDC', code: 'RDC', cote: 0, h: 9.0, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        rooms: [['Halle de stockage', 1200, 0, 6000, 3600, 'sec'], ['Accueil et bureau', 0, 0, 1200, 1200, 'sec'], ['Bureau exploitation', 0, 1200, 1200, 2400, 'sec'], ['Sanitaires', 0, 2400, 1200, 3000, 'humide'], ['Local technique', 0, 3000, 1200, 3600, 'tech']],
        halle: true },
      { nom: 'Toiture', code: 'TOI', cote: 9.0, h: 1.0, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  },
  {
    id: 'c5', code: 'C5', nom: 'Hôtel Le Belvédère', type: 'Hôtel R+3', ville: 'Port-Aurel', adresse: '21 promenade des Embruns, 99200 Port-Aurel',
    moa: 'Groupe Hôtelier Belvédère (fictif)', phase: 'Second œuvre avancé', surface_m2: 3300, debut: '2025-06-02', fin: '2026-12-18', nord_deg: 35,
    W: 3200, D: 1500, Cw: 180, Ds: 700, usage: { g: 5.6, q: 1.5 }, nEtages: 4, ouvertureMax: 8,
    avancement: { go: 100, archi: 82, tech: 70, cc: 100 }, profil: 'Second œuvre avancé : finitions des chambres',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -1.3, h: 1.3, plans: ['go'], fond: 'semelles' },
      { nom: 'RDC', code: 'RDC', cote: 0, h: 3.6, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        S: P('Réception:700,Restaurant:0'), C: 'Hall et circulation', N: P('Noyau escalier et ascenseurs:450:noyau,Cuisine:600:tech,Bar:500,Salon:0') },
      { nom: 'R+1', code: 'R1', cote: 3.6, h: 3.0, plans: ['archi', 'go', 'tech', 'cc'], kind: 'etage', note: 'Étage courant (R+1 à R+3 identiques)',
        S: P('Chambre 101:400,Salle de bains 101:200:humide,Chambre 102:400,Salle de bains 102:200:humide,Chambre 103:400,Salle de bains 103:200:humide,Chambre 104:0'), C: 'Couloir', N: P('Noyau escalier et ascenseurs:450:noyau,Chambre 105:400,Salle de bains 105:200:humide,Chambre 106:400,Salle de bains 106:200:humide,Suite 107:0') },
      { nom: 'Toiture', code: 'TOI', cote: 12.6, h: 1.2, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  },
  {
    id: 'c6', code: 'C6', nom: 'Résidence seniors Les Glycines', type: 'Résidence seniors R+2', ville: 'Saint-Ivor-les-Prés', adresse: '8 rue des Glycines, 99300 Saint-Ivor-les-Prés',
    moa: 'Les Jardins d\'Automne (fictive)', phase: 'Réception proche', surface_m2: 2650, debut: '2025-02-03', fin: '2026-12-11', nord_deg: -10,
    W: 2800, D: 1400, Cw: 200, Ds: 640, usage: { g: 5.4, q: 1.5 }, nEtages: 3, ouvertureMax: 6,
    avancement: { go: 100, archi: 96, tech: 94, cc: 100 }, profil: 'Presque terminé : réserves et essais en cours',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -1.1, h: 1.1, plans: ['go'], fond: 'semelles' },
      { nom: 'RDC', code: 'RDC', cote: 0, h: 3.2, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        S: P('Salon commun:800,Restaurant:0'), C: 'Hall et circulation', N: P('Noyau escalier et ascenseur:450:noyau,Accueil:400,Infirmerie:300:tech,Salle d\'activités:0') },
      { nom: 'R+1', code: 'R1', cote: 3.2, h: 3.0, plans: ['archi', 'go', 'tech', 'cc'], kind: 'etage', note: 'Étage courant (R+1 et R+2 identiques)',
        S: P('Logement 11 Séjour:500,Logement 11 Salle d\'eau:200:humide,Logement 12 Séjour:500,Logement 12 Salle d\'eau:200:humide,Logement 13:0'), C: 'Circulation', N: P('Noyau escalier et ascenseur:450:noyau,Logement 14 Séjour:500,Logement 14 Salle d\'eau:200:humide,Logement 15:0') },
      { nom: 'Toiture', code: 'TOI', cote: 9.2, h: 1.0, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  },
  {
    id: 'c7', code: 'C7', nom: 'Parking et commerces de la place Vérane', type: 'Parking silo avec commerces', ville: 'Roche-Valmer', adresse: 'Place Vérane, 99400 Roche-Valmer',
    moa: 'Régie des Stationnements de Roche-Valmer (fictive)', phase: 'Fondations et sous-sol', surface_m2: 5200, debut: '2026-09-07', fin: '2028-03-31', nord_deg: 180,
    W: 4000, D: 3000, usage: { g: 6.2, q: 2.5 }, nEtages: 3, ouvertureMax: 6,
    avancement: { go: 28, archi: 0, tech: 0, cc: 0 }, profil: 'Démarrage : pieux et dallage du sous-sol',
    niveaux: [
      { nom: 'Fondations', code: 'FND', cote: -4.4, h: 1.0, plans: ['go'], fond: 'pieux' },
      { nom: 'Sous-sol', code: 'SS1', cote: -3.4, h: 3.0, plans: ['archi', 'go', 'tech', 'cc'], kind: 'ss',
        rooms: [['Parking sous-sol', 0, 0, 3000, 3000, 'sec'], ['Rampe d\'accès', 3000, 0, 4000, 1600, 'circ'], ['Noyau escalier et ascenseur', 3000, 1600, 4000, 2300, 'noyau'], ['Local technique', 3000, 2300, 4000, 3000, 'tech']] },
      { nom: 'RDC', code: 'RDC', cote: -0.4, h: 3.6, plans: ['archi', 'go', 'tech', 'cc'], kind: 'rdc',
        rooms: [['Commerce 1', 0, 1900, 1500, 3000, 'sec'], ['Commerce 2', 1500, 1900, 3000, 3000, 'sec'], ['Parking RDC', 0, 0, 3000, 1900, 'sec'], ['Rampe d\'accès', 3000, 0, 4000, 1600, 'circ'], ['Noyau escalier et ascenseur', 3000, 1600, 4000, 2400, 'noyau'], ['Local technique', 3000, 2400, 4000, 3000, 'tech']] },
      { nom: 'Toiture', code: 'TOI', cote: 3.2, h: 1.0, plans: ['tech', 'cc'], kind: 'toit' }
    ]
  }
];

module.exports = { CHANTIERS };
