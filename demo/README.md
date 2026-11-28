# Jeu de démonstration : 7 chantiers fictifs

Un jeu complet de données **100 % fictives** (noms, adresses, entreprises, personnes, communes inventés) pour présenter l'application à un client qui suit environ sept chantiers. Tout est produit par un script : on peut le régénérer à l'identique.

## Ce que contient le jeu

| Chantier | Type | État d'avancement mis en scène |
|---|---|---|
| C1 Résidence Les Tilleuls | Logements R+4 | Gros œuvre en cours |
| C2 Bureaux du Quai Verdier | Bureaux R+3 | Second œuvre : cloisons et réseaux en cours |
| C3 École primaire Jules-Marin | École R+1 | Clos et couvert : toiture en cours |
| C4 Entrepôt logistique des Landes Hautes | Entrepôt et bureaux | Début de gros œuvre |
| C5 Hôtel Le Belvédère | Hôtel R+3 | Second œuvre avancé |
| C6 Résidence seniors Les Glycines | Résidence seniors R+2 | Presque terminé : réserves et essais |
| C7 Parking et commerces de la place Vérane | Parking silo et commerces | Démarrage : pieux et dalle du sous-sol |

Pour chaque chantier : nom, adresse fictive, maître d'ouvrage fictif, phase, niveaux avec cote Z, surface, dates, repère (origine angle sud-ouest, X, Y, Z) et nord.

Pour chaque niveau utile, **quatre plans** (un par famille de corps d'état), dessinés à vraie échelle, avec cotes imprimées (en cm), grille d'axes, repère, flèche du nord, échelle graphique et cartouche :
- **Architecture** : pièces nommées, compartiments coupe-feu, cloisons, portes, escalier, ascenseur.
- **Gros œuvre** : poteaux, poutres, voiles, dalle, semelles ou pieux, trémies.
- **Technique** : CVC, plomberie, électricité, courants faibles, sécurité incendie (machines, ballon, tableau, gaines, détecteurs, extincteurs, centrale).
- **Clos et couvert** : fenêtres, façade, garde-corps, étanchéité, isolation, lanterneaux, descentes d'eaux pluviales.

Sur chaque plan : les pièces dessinées (polygones nommés) et les ouvrages de ce lot (porte = trait, fenêtre = trait, machine = rectangle, ballon = cercle…) avec position X, Y, Z, dimensions et paramètres de maquette numérique (matériau, classe, porteur, extérieur, résistance au feu). Les noms sont uniques et clairs : `C1-RDC-P01` (poteau), `C1-RDC-PX01` (poutre), `C1-RDC-D01` (dalle), `C1-FND-S01` (semelle), `C1-RDC-PO01` (porte), `C1-RDC-FE01` (fenêtre)…

Les ouvrages de gros œuvre (poteaux, poutres, dalles, semelles) portent des **données de dimensionnement d'exemple cohérentes** : sections, portées, charges. Les modules de calcul se lancent directement. Les valeurs (charges, sol) sont des exemples fictifs : elles ne remplacent jamais celles d'un vrai projet.

## Fichiers

| Dossier ou fichier | Rôle |
|---|---|
| `jeu-demonstration.json` | Le jeu unique que l'application charge (7 chantiers). |
| `echange/` | Un fichier d'échange 1.1 par chantier (voir `docs/plugin-echange.md`). Importables seuls par « Descente de charge » > « Depuis un plugin » ou « Lire le plan ». |
| `plans/` | Les plans en images JPEG réduites (chargés à la demande par l'application). |
| `pdf/` | Un PDF A3 par chantier avec tous ses plans en vectoriel : pour montrer la lecture de plans par l'agent IA. |
| `neutre/devis-situations-neutres.json` | Devis fictifs (lots, lignes, quantités, prix inventés) liés aux ouvrages par code, avancements, deux situations émises et une prête à valider. Format neutre, à convertir vers le modèle de l'application. |
| `neutre/demandes-administratives.json` | Cinq demandes fictives par chantier, statuts variés. |
| `captures/` | Captures téléphone (390 px) et tablette (820 px). |
| `generateur/` | Le script qui produit tout. |
| `PARCOURS.md` | Le déroulé de la démonstration (environ 19 minutes). |
| `AVANT-LA-DEMO.md` | La liste de contrôle. |

## Charger et retirer (super administrateur)

Dans l'application : page Travaux, vue « Bibliothèque du projet », bouton « Descente de charge ». Un bloc « Jeu de démonstration (super administrateur) » apparaît (il n'apparaît que pour le super administrateur).

- **Charger le jeu de démonstration** : ajoute les 7 chantiers **dans le projet ouvert** (par exemple TEST), avec une confirmation. C'est un ajout : rien d'existant n'est modifié. Tout est marqué « Démo » (identifiants commençant par `DEMO-`, projets nommés « Démo · … »). Recharger ne crée aucun doublon.
- **Retirer le jeu de démonstration** : supprime seulement ce qui porte la marque « Démo », y compris les lignes sol, plafond et murs que l'application crée d'elle-même pour les pièces de démonstration.
- La sauvegarde passe par le chemin normal de l'application : rien n'est écrit en dehors.

Poids ajouté au projet : environ 1,5 Mo de données pour les ouvrages, pièces et plans, plus environ 0,2 Mo de lignes créées par l'application pour les pièces. Les images des plans (environ 3,8 Mo) ne sont **pas** dans les données du projet : l'application les lit à la demande dans les fichiers du dossier `demo/plans`. Il faut donc que le dossier `demo/` soit publié avec l'application.

## Régénérer

```
node demo/generateur/generer.js
```

Il faut Node et Playwright avec Chromium pour les images et les PDF. Sans eux : `node demo/generateur/generer.js --sans-images` régénère tous les fichiers de données. Aucun hasard, aucune date du jour : deux exécutions donnent les mêmes fichiers (c'est vérifié par `tests/descente.test.js`).

## Contrôles faits

- Les 7 fichiers d'échange sont acceptés sans avertissement par le code de lecture de l'application.
- Chargement dans un navigateur de test sur un projet contenant déjà des données : aucune donnée existante modifiée, deuxième chargement sans doublon, retrait propre (état identique à l'avant).
- Aucune erreur de page, aucun défilement horizontal à 390, 820 et 1100 px, aucun bouton de l'écran du jeu sous 44 px.

## Ce que l'application a déjà, et ce qui manque pour la démonstration

Constaté en lisant le code de l'application.

- **Passer d'un chantier à l'autre** : le sélecteur de projet de l'application bascule d'un espace à l'autre. Dans un même espace, chaque ouvrage porte un champ « Projet » et le mode dimensionnement filtre sur un projet. Il n'y a pas de sélecteur de chantier global sur le tableau de bord.
- **Avancement de tous les chantiers** : pas d'écran dédié trouvé. Le tableau de bord présente bâtiments et niveaux. À construire ou à confirmer.
- **Exports** : « Exporter (données ou reporting) », export CSV du suivi, export .mbf. Pas trouvé : un export par corps d'état et par niveau pour tous les chantiers d'un coup.
- **Demandes administratives** : aucun module trouvé. Les données sont fournies à part, en format neutre, pour quand il existera.
- **Devis, situations, factures** : le module Finance range des documents (type, lot, date, société, montant). Les lignes de devis liées aux ouvrages, le pointage qui fait avancer le pourcentage, la situation vérifiée puis la facture sont en construction par ailleurs. Le jeu fournit les données neutres pour les y brancher.
