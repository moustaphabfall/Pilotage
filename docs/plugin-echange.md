# Format d'échange « descente de charge » (version 1.0)

Ce document est le contrat entre l'application et les plugins (Revit en priorité, puis Robot Structural Analysis et AutoCAD). Un plugin écrit **un fichier JSON** ; l'application le lit (écran « Descente de charge » > « Depuis un plugin »), le contrôle, montre le découpage Projet > Bâtiment > Niveau > Ouvrage et crée les ouvrages en bibliothèque. L'agent IA de l'application produit le même format.

Le contrôle est fait par le même code que celui de l'application (module `DcExchange`, tests dans `tests/descente.test.js`).

## Règles générales

- Fichier JSON, encodage UTF-8, extension `.json`. Taille : 20 Mo au plus.
- Unités fixes : **longueurs en m**, **forces en kN**, charges surfaciques en kN/m², charges linéiques en kN/m. Pas de conversion côté application : le plugin convertit avant d'écrire.
- Nombres avec point décimal (JSON). Un texte avec virgule (`"0,25"`) est aussi accepté.
- Coordonnées `x`, `y` dans le plan (m, repère du projet). L'axe vertical est donné par la cote du niveau (`cote_m`).
- Aucune valeur n'est inventée par l'application : un champ absent reste absent (charges, sol). Un plugin n'écrit un champ que s'il connaît sa valeur.
- Les champs inconnus sont ignorés (avertissement pour les charges). Les noms sont nettoyés (espaces, caractères de contrôle) et limités à 120 signes.

## Versionnement

- `format` : toujours `"bina-descente-charge"`.
- `version` : `"majeure.mineure"`. Version actuelle : `"1.0"`.
- Même version majeure, mineure plus récente : le fichier est lu, avec un avertissement. Version majeure différente : refus avec message clair.
- Ajouter un champ facultatif = nouvelle mineure. Changer le sens d'un champ ou en rendre un obligatoire = nouvelle majeure.

## Structure

```json
{
  "format": "bina-descente-charge",
  "version": "1.0",
  "source": { "outil": "Revit", "version_outil": "2025", "version_plugin": "0.1" },
  "date_export": "2026-11-27T10:00:00Z",
  "projet": {
    "nom": "Nom du projet",
    "sol": { "contrainte_admissible_kN_m2": 200, "profondeur_assise_m": 1.5 }
  },
  "batiments": [
    {
      "nom": "Bâtiment A",
      "niveaux": [
        {
          "nom": "RDC", "cote_m": 0, "hauteur_m": 3,
          "ouvrages": [
            { "nom": "P1 - RDC", "type": "poteau", "id_externe": "guid-ou-element-id",
              "geometrie": { "x": 0, "y": 0, "b_m": 0.3, "h_m": 0.3 },
              "charges": { "G_kN": 250, "Q_kN": 60 },
              "materiau": { "beton": "C25/30", "acier": "B500" } }
          ]
        }
      ]
    }
  ]
}
```

### Racine

| Champ | Obligatoire | Description |
|---|---|---|
| `format`, `version` | oui | Voir Versionnement. |
| `source.outil` | conseillé | `Revit`, `Robot Structural Analysis`, `AutoCAD`, `Agent IA` ou `Autre`. `source.version_outil`, `source.version_plugin` : facultatifs. |
| `date_export` | non | Date ISO du fichier. |
| `projet.nom` | oui | Nom du projet. |
| `projet.sol` | non | Seulement si connu : `contrainte_admissible_kN_m2` et/ou `profondeur_assise_m` (nombres > 0). Jamais de valeur par défaut. |
| `batiments` | oui | Au moins un. |

### Bâtiment, niveau

| Champ | Obligatoire | Description |
|---|---|---|
| `batiments[].nom` | oui | Unique dans le projet. |
| `niveaux[].nom` | oui | Unique dans le bâtiment (« RDC », « R+1 », « Fondations »…). |
| `niveaux[].cote_m` | oui | Cote du plancher fini du niveau, en m (négative sous le terrain de référence). |
| `niveaux[].hauteur_m` | non | Hauteur d'étage. Sert de hauteur par défaut aux poteaux, voiles et escaliers qui n'en donnent pas. |

### Ouvrage

| Champ | Obligatoire | Description |
|---|---|---|
| `nom` | oui | **Unique dans tout le projet** (la casse et les accents ne comptent pas). Conseil : code de l'élément + niveau (« P1 - RDC »). |
| `type` | oui | `dalle`, `poutre`, `poteau`, `voile`, `semelle`, `pieu`, `mur_soutenement`, `escalier`. |
| `id_externe` | non | Identifiant dans l'outil d'origine (GUID, ElementId…). Unique s'il est donné. Sert à ne pas recréer un ouvrage à la réimportation. |
| `geometrie` | oui | Selon le type (tableau ci-dessous). |
| `charges` | non | `G_kN`, `Q_kN` (efforts en kN), `g_kN_m2`, `q_kN_m2` (surfaciques), `g_kN_m`, `q_kN_m` (linéiques). Nombres >= 0. G = permanentes, Q = exploitation. |
| `materiau` | non | `beton`, `acier` (textes courts). |
| `statut` | non | `importe` (défaut pour un plugin), `non_verifie` (défaut pour l'agent IA), `valide`. |

### Géométrie par type

La position verticale vient de la cote du niveau : les éléments horizontaux sont **sous** la cote, les éléments verticaux **au-dessus**.

| Type | Champs | Position verticale |
|---|---|---|
| `dalle` | `x`, `y` (coin bas-gauche), `largeur_m` (selon x), `longueur_m` (selon y), `epaisseur_m` | de cote - épaisseur à cote |
| `poutre` | `x1`, `y1`, `x2`, `y2` (axe), `b_m`, `h_m` | de cote - h à cote |
| `poteau` | `x`, `y` (centre), `b_m` et `h_m` **ou** `diametre_m`, `hauteur_m` (facultatif si le niveau a `hauteur_m`) | de cote à cote + hauteur |
| `voile` | `x1`, `y1`, `x2`, `y2` (axe), `epaisseur_m`, `hauteur_m` (idem) | de cote à cote + hauteur |
| `semelle` | `x`, `y` (centre), `largeur_m`, `longueur_m`, `epaisseur_m` | de cote - épaisseur à cote |
| `pieu` | `x`, `y` (centre), `diametre_m`, `longueur_m` | de cote - longueur à cote |
| `mur_soutenement` | `x1`, `y1`, `x2`, `y2` (axe), `epaisseur_m`, `hauteur_m` (obligatoire) | de cote à cote + hauteur |
| `escalier` | `x1`, `y1`, `x2`, `y2` (axe), `largeur_m`, `hauteur_m` (facultatif si le niveau a `hauteur_m`) | de cote à cote + hauteur (volume enveloppe) |

## Ce que fait l'application du fichier

1. **Lecture et contrôle** : chaque problème est rapporté avec son chemin (« Bâtiment « A » > Niveau « RDC » > Ouvrage « P1 » : … »). Une erreur bloque la création ; un avertissement informe seulement.
2. **Découpage** : arbre Projet > Bâtiment > Niveau > Ouvrage, consultable et montré en maquette 3D à l'échelle réelle.
3. **Création en bibliothèque** : le projet, les bâtiments et les niveaux manquants sont créés ; chaque ouvrage devient un ouvrage de l'étude, rattaché à son bâtiment, son niveau et au type d'ouvrage correspondant. Les données du fichier sont conservées avec l'ouvrage.
4. **Réimportation** : un ouvrage dont le nom (ou l'`id_externe`) existe déjà n'est pas recréé et n'est jamais écrasé. Un niveau de même nom dans deux bâtiments est créé sous la forme « Bâtiment · Niveau ».

## Consignes pour les plugins

- **Revit** : un fichier par export. Niveaux = `Level` triés par cote ; bâtiments = regroupement par phase ou par paramètre de projet. Murs porteurs, poteaux, poutres, planchers, fondations isolées et filantes, pieux. `id_externe` = `UniqueId`.
- **Robot Structural Analysis** : barres et panneaux du modèle d'analyse ; les efforts issus des cas de charge vont dans `charges` seulement s'ils sont lus du modèle (jamais estimés).
- **AutoCAD** : éléments dessinés sur calques structurels, cotes lues dans le dessin ; si une dimension manque, ne pas inventer l'ouvrage.
- Toujours : noms uniques, unités m et kN, aucun champ rempli « par défaut ». Si une valeur est inconnue, ne pas écrire le champ.
- Valider le fichier avant envoi avec le jeu de tests de ce dépôt (`node tests/descente.test.js` montre des cas valides et invalides) ou en le chargeant dans l'écran de l'application.

## Voie « agent IA » (même format)

L'agent reçoit des plans et des photos, renvoie un document de ce format avec `source.outil = "Agent IA"`. Tous les ouvrages sont alors `non_verifie` : l'utilisateur accepte, renomme ou écarte chaque nœud, puis crée en bibliothèque. Seuls les ouvrages acceptés sont créés.

## Extension 1.1 : repère, pièces et pastilles (ajout facultatif)

La version `"1.1"` ajoute **trois blocs facultatifs**. Un fichier 1.0 reste valable tel quel, et un fichier 1.1 sans ces blocs se lit comme un fichier 1.0. Une application qui ne connaît que 1.0 lit un fichier 1.1 avec un avertissement et ignore les blocs. Les blocs ne sont lus que si `version` est `"1.1"` ou plus.

Unités de ces blocs : **centimètres** (le nom des champs le dit : `..._cm`). Repère : origine au coin bas-gauche du plan de référence, X vers la droite, Y vers le haut du plan, Z vers le haut ; Z d'un élément = cote du niveau + hauteur de pose. Une valeur inconnue n'est **pas écrite** : l'application ne la complète jamais.

### Racine : `repere` (facultatif)

| Champ | Description |
|---|---|
| `nord_deg` | Angle du nord par rapport au haut du plan, en degrés (entre -360 et 360), sens horaire. |
| `nord_confirme` | `true` seulement si le nord a été vérifié par une personne. |
| `origine` | Texte libre : où est l'origine (« Angle sud-ouest du bâtiment »). |
| `plan_ref` | Nom du plan de référence. |

### Niveau : `pieces` et `pastilles` (facultatifs)

Un niveau peut ne contenir que des pièces et des pastilles (pas d'`ouvrages`) : le fichier est alors accepté s'il contient au moins un ouvrage, une pièce ou une pastille.

**Pièce**

| Champ | Obligatoire | Description |
|---|---|---|
| `nom` | oui | Unique dans le niveau. |
| `polygone_cm` | oui | Au moins trois points `[x, y]` qui entourent une surface (pas alignés). |
| `hauteur_cm` | non | Hauteur sous plafond, seulement si elle est connue. |
| `confiance` | non | `faible`, `moyenne` ou `haute` (défaut : `faible`). |
| `source` | non | `{ "plan": "nom du plan", "page": 1 }`. |
| `id_externe` | non | Identifiant d'origine. Sert à ne pas recréer la pièce à la réimportation. |

**Pastille** : petite forme qui représente un élément (porte = un trait, machine = un rectangle, ballon d'eau chaude = un cercle…).

| Champ | Obligatoire | Description |
|---|---|---|
| `nom` | oui | **Unique dans tout le projet** (casse et accents ignorés). |
| `lot` | oui | `architecture`, `structure`, `cvc`, `plomberie`, `electricite`, `courants_faibles`, `securite_incendie` ou `equipements`. |
| `type` | oui | `porte`, `fenetre`, `machine`, `ballon`, `lavabo`, `evier`, `douche`, `wc`, `baignoire`, `radiateur`, `luminaire`, `prise`, `tableau_electrique`, `detecteur`, `extincteur`, `gaine`, `conduit`, `canalisation`, `poteau`, `autre`, ou un texte court. |
| `forme` | non | `ligne`, `rectangle`, `cercle` ou `polygone`. Si absente : la forme usuelle du type (obligatoire pour un type libre). |
| `dimensions_cm` | non | `ligne` : `{ "longueur" }` ; `rectangle` : `{ "largeur", "profondeur", "hauteur" (facultative) }` ; `cercle` : `{ "diametre" }` ; `polygone` : `{ "points": [[x, y], …] }` autour du centre. Si absentes ou invalides : avertissement, la pastille est gardée et sa taille reste à renseigner. |
| `position_cm` | oui | `{ "x", "y", "z" }` : centre de la forme dans le repère. `z` facultatif. |
| `rotation_deg` | non | Sens inverse des aiguilles, 0 = trait horizontal. |
| `piece` | non | Nom de la pièce qui contient l'élément. |
| `parametres` | non | Objet « nom du paramètre » vers texte, nombre ou booléen. Un paramètre inconnu n'est pas écrit (jamais de valeur vide ou par défaut). |
| `source` | non | `{ "plan": "nom du plan", "page": 1 }`. |
| `confiance` | non | `faible`, `moyenne` ou `haute` (défaut : `faible`). |
| `statut` | non | `importe` (défaut pour un plugin) ou `non_verifie` (défaut et seule valeur pour l'agent IA). |
| `id_externe` | non | Unique s'il est donné. Sert à l'idempotence. |

### Ce que fait l'application

1. **Contrôle** par le même code que la version 1.0 (module `DcExchange`, avec les tests de `tests/plans.test.js`).
2. **Lecture** dans l'écran « Lire le plan avec l'agent IA » (bouton « Fichier d'échange (plugin) ») : pièces et pastilles apparaissent sur le plan, à l'échelle, couleur par lot.
3. **Création en bibliothèque** : seuls les éléments acceptés, avec position et dimensions, sont créés. Les pièces deviennent des pièces de l'étude ; les pastilles deviennent des ouvrages (rattachés à leur lot, leur niveau et leur pièce) qui gardent leur forme, leurs dimensions, leur position et leurs paramètres.
4. **Réimportation** : un élément dont l'`id_externe` (ou, à défaut, le nom) existe déjà n'est pas recréé et n'est jamais écrasé.

L'agent IA de l'application produit des pièces et des pastilles à partir de plans : tout y est `non_verifie` jusqu'à ce que l'utilisateur accepte ou modifie. L'application peut aussi écrire un fichier 1.1 à partir de ce qui a été accepté (bouton « Fichier d'échange »).

### Paramètres de la maquette numérique (ajout facultatif de 1.1)

Pièces, compartiments et pastilles peuvent porter les champs suivants. Tous sont facultatifs. Un champ inconnu n'est pas écrit : l'application ne le complète jamais.

| Champ | Description |
|---|---|
| `guid` | Identifiant unique stable (forme `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, minuscules). S'il est absent, l'application le crée à partir de l'identifiant d'origine ou du nom ; le même élément donne toujours le même identifiant. |
| `classe` | Classe d'objet de la maquette numérique, du type `IfcSpace`, `IfcZone`, `IfcWall`, `IfcDoor`, `IfcWindow`, `IfcSlab`, `IfcBeam`, `IfcColumn`, `IfcFooting`… Si elle est absente, l'application la déduit du type (pièce : `IfcSpace`, compartiment : `IfcZone`). |
| `genre` (pièce seulement) | `compartiment` pour un compartiment ; absent pour une pièce. |
| `materiau` | Matériau, seulement s'il est connu. |
| `classe_resistance` | Résistance ou classe du matériau, seulement si elle est connue. |
| `porteur` | `true` ou `false`, seulement si connu. |
| `exterieur` | `true` (extérieur) ou `false` (intérieur), seulement si connu. |
| `resistance_feu` | Texte court (par exemple « EI 60 »), seulement si connu. |
| `proprietes` | Liste extensible de `{ "cle", "valeur", "unite" }` (`unite` facultative). Clés uniques, valeurs vides refusées. |
| `dimensions_cm.hauteur`, `dimensions_cm.epaisseur` | Pastille : hauteur et épaisseur facultatives pour toutes les formes. |

Déjà portés par les blocs ci-dessus : nom, bâtiment et niveau (cote Z) par la structure du fichier, pièce d'appartenance (`piece`), lot, position X, Y, Z et rotation, dimensions, `statut` (phase : `non_verifie`, `importe`…), `source` (plan et page), `confiance`. Pour une pièce, la surface et le volume sont **calculés** par l'application (contour en cm, `hauteur_cm`) et ne sont pas à écrire. Types de pastille ajoutés : `mur`, `voile`, `dalle`, `poutre`, `semelle`, `pieu`, `escalier` (classes `IfcWall`, `IfcSlab`, `IfcBeam`, `IfcFooting`, `IfcPile`, `IfcStair`).

L'application relit et réécrit ces champs sans perte (export puis import identiques).

## Analyse automatique des plans déposés

Quand un plan est déposé dans l'espace EG, l'application peut lancer seule la lecture par l'agent IA (réglage « Analyse automatique des plans », activé par défaut, désactivable). Seule une image réduite du plan est envoyée : ni le fichier d'origine, ni son nom, ni ses métadonnées. L'image temporaire n'existe qu'en mémoire locale et est effacée à la fin de l'analyse, qu'elle réussisse, échoue ou soit annulée. Rien n'est conservé côté serveur. Les pièces (noms lus, sinon « Pièce 1 », « Pièce 2 »…), compartiments et pastilles sont créés en bibliothèque, tous « non vérifiés ». Un même plan n'est analysé qu'une fois. Sans dimension lue, l'échelle n'est jamais devinée : les pièces sont créées sans cotes et l'application demande le calibrage.
