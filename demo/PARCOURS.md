# Parcours de démonstration : un client, sept chantiers (environ 19 minutes)

Pour quelqu'un qui suit sept chantiers, qui fait des démarches administratives, des demandes et des situations. Le fil rouge : **« un seul outil pour tous mes chantiers, de la lecture des plans à la facture »**. Les données sont fictives (jeu « Démo »). Avant de commencer : `AVANT-LA-DEMO.md`.

Légende : ce qu'on dit, ce qu'on montre, résultat attendu, piège.

## 1. Le décor (1 min)
- On dit : « Voici sept chantiers de types différents, tous fictifs. Un en gros œuvre, un en second œuvre, un presque terminé. »
- On montre : la liste des projets « Démo · … ».
- Résultat attendu : le client reconnaît sa propre situation (plusieurs chantiers, plusieurs étapes).
- Piège : ne pas détailler tout de suite. Rester sur l'idée « tout au même endroit ».

## 2. Passer d'un chantier à l'autre, voir l'avancement de tous (2 min)
- On montre : le choix du projet, puis la vue d'ensemble des ouvrages avec le filtre par projet. On passe de la résidence au parking en quelques touches.
- Résultat attendu : le client voit que le gros œuvre est fini à l'hôtel et à peine commencé au parking, sans ouvrir de dossier.
- Piège : l'application n'a pas encore un écran unique « tous les chantiers côte à côte » (voir `README.md`). Le dire simplement : « c'est le prochain pas » ; ne pas improviser.

## 3. Lecture des plans par l'agent IA (3 min)
- On montre : « Lire le plan avec l'agent IA ». On dépose `pdf/c1-residence-les-tilleuls.pdf` (plusieurs pages). La barre d'avancement montre les lots de pages lus.
- Puis : les pièces apparaissent sur le plan, avec leurs noms, les compartiments coupe-feu, les portes, fenêtres, machines. Tout est marqué « non vérifié ». On accepte une pièce, on en renomme une (« J'accepte », « Je modifie »).
- Résultat attendu : le client comprend que l'agent propose et que lui valide.
- Piège : si l'agent n'est pas connecté, charger « Exemple » et le dire. Un plan sans cote lisible : l'échelle n'est jamais devinée, l'application demande de la calibrer. Les plans du jeu ont des cotes imprimées exprès.

## 4. Pièces, pastilles, descente de charge (2 min)
- On montre : le plan « C1 · RDC · Architecture » avec ses pièces et ses pourcentages. Puis « Descente de charge » > « Depuis un plugin » > fichier `echange/c1-...json` : arbre Projet > Bâtiment > Niveau > Ouvrage, maquette 3D à l'échelle, « Créer en bibliothèque ».
- Résultat attendu : les ouvrages de structure sont créés, rien n'est recréé si on recommence.
- Piège : dans le projet où le jeu est déjà chargé, les ouvrages existent déjà : le message « rien de nouveau à créer » est normal. Pour voir la création, utiliser un autre fichier ou un projet vide.

## 5. Dimensionnement et note de calcul (2 min)
- On montre : un poteau du chantier C1 (par exemple `C1-RDC-P01`), son module prêt à calculer, « Calculer », puis la note de calcul.
- Résultat attendu : un résultat et une note au même modèle pour tous les ouvrages.
- Piège : les charges et le sol sont des exemples fictifs. Le dire avant qu'on le demande.

## 6. LA SITUATION : de « je pointe » à « la facture part » (5 min, le moment fort)
Ce qu'on veut faire sentir : **une situation en quelques minutes**.
1. On ouvre le chantier le plus avancé (C6 ou C5). On montre les travaux, tous ensemble, par lot.
2. On pointe les ouvrages terminés. Le pourcentage de la ligne de devis liée avance tout seul.
3. On ouvre la situation prête à valider : lignes, pourcentages cumulés, montants.
4. On vérifie, on valide : la facture est émise directement.
5. On montre les deux situations précédentes déjà émises : l'historique est là.
- Résultat attendu : le client voit le lien devis, ouvrages, situation, facture, sans ressaisie.
- Données prêtes : `neutre/devis-situations-neutres.json` (8 devis par chantier, lignes liées aux ouvrages par code, deux situations émises, une prête à valider).
- Piège important : ce flux est en construction ailleurs. **Ne le présenter comme acquis que s'il est dans la version montrée.** Sinon : montrer le fichier neutre, dire clairement « voici ce que le flux fera » et ne pas cliquer sur des boutons qui n'existent pas encore.

## 7. Sur place, avec le téléphone ou la tablette (2 min)
- On montre, sur le téléphone : ouvrir un plan, toucher un ouvrage (porte, fenêtre, machine), le pointer, prendre une photo, faire une demande.
- Résultat attendu : tout se fait au doigt, sans défilement de côté, boutons assez grands.
- Piège : prévoir le réseau. Les captures à 390 et 820 px sont dans `captures/` si le réseau lâche.

## 8. Exports et démarches administratives (2 min)
- On montre : « Exporter (données ou reporting) » et l'export CSV du suivi.
- On parle des démarches : le jeu contient cinq demandes fictives par chantier (autorisation, déclaration, prolongation, levée de réserves, dossier de sécurité) avec des statuts variés.
- Piège : il n'y a pas encore de module de demandes administratives dans l'application, ni d'export unique par corps d'état et par niveau pour tous les chantiers. Les présenter comme des demandes d'évolution, pas comme des fonctions existantes.

## Les avantages à retenir (sans chiffres)
- Un seul endroit pour tous les chantiers, au lieu d'un dossier par chantier.
- Les plans deviennent des pièces et des ouvrages sans tout ressaisir.
- Chaque ouvrage garde son plan, sa position, ses données de calcul et son avancement.
- Moins de ressaisie entre le terrain, le calcul et la facturation.
- Chacun valide ce que l'IA propose : rien n'est pris pour vrai sans accord.

## Si on manque de temps
Couper dans cet ordre : 8, puis 4, puis 5. Ne jamais couper le 6.
